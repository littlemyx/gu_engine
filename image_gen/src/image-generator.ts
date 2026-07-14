import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
import { Potrace } from "potrace";
import type {
  GenerateItem,
  BatchState,
  CharacterGenerateRequest,
  RegeneratePoseRequest,
  BackgroundGenerateRequest
} from "./types.js";
import { logger } from "./logger.js";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  logger.error("GOOGLE_API_KEY environment variable is required");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const RESULT_DIR = path.resolve("result_images");
fs.mkdirSync(RESULT_DIR, { recursive: true });

const IMAGE_SERVER_BASE =
  process.env.IMAGE_SERVER_URL || "http://localhost:3007";

async function uploadToImageServer(
  filePath: string,
  originalName: string
): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "image/png" });
  const formData = new FormData();
  formData.append("image", blob, originalName);

  const res = await fetch(`${IMAGE_SERVER_BASE}/images`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    throw new Error(
      `Failed to upload to image server: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as { name: string };
  return data.name;
}

async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  // Handle data URIs directly
  const dataUriMatch = url.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUriMatch) {
    return { data: dataUriMatch[2], mimeType: dataUriMatch[1] };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: contentType };
}

function buildPrompt(
  item: GenerateItem,
  masterPrompt?: string,
  negativePrompt?: string
): string {
  const parts: string[] = [];
  if (masterPrompt) parts.push(masterPrompt);
  parts.push(item.description);
  if (negativePrompt) parts.push(`Avoid the following: ${negativePrompt}`);
  return parts.join("\n\n");
}

export async function generateImage(
  item: GenerateItem,
  masterPrompt?: string,
  negativePrompt?: string,
  aspectRatio?: string
): Promise<string> {
  const promptText = buildPrompt(item, masterPrompt, negativePrompt);

  const contentParts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];
  contentParts.push({ text: promptText });

  if (item.referenceImages?.length) {
    logger.log(
      `[generateImage] id=${item.id} — attaching ${item.referenceImages.length} reference image(s)`
    );
    for (const url of item.referenceImages) {
      const img = await fetchImageAsBase64(url);
      contentParts.push({
        inlineData: { mimeType: img.mimeType, data: img.data }
      });
    }
  }

  logger.log(`[generateImage] id=${item.id} — calling Gemini API...`);
  const startTime = Date.now();

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: contentParts,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: aspectRatio ? { aspectRatio } : undefined
    }
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No response parts from API");

  for (const part of parts) {
    if (part.inlineData) {
      const imageData = part.inlineData.data;
      if (!imageData) continue;
      const filePath = path.join(RESULT_DIR, `${item.id}.png`);
      fs.writeFileSync(filePath, Buffer.from(imageData, "base64"));
      logger.log(
        `[generateImage] id=${item.id} — saved locally to ${filePath} (${elapsed}s)`
      );
      return filePath;
    }
  }

  throw new Error("No image data in API response");
}

export async function processBatch(
  batch: BatchState,
  items: GenerateItem[],
  masterPrompt?: string,
  negativePrompt?: string
) {
  logger.log(
    `[processBatch] batch=${batch.batchId} — starting ${items.length} item(s)`
  );
  for (const item of items) {
    batch.items[item.id].status = "processing";
    logger.log(
      `[processBatch] batch=${batch.batchId} item=${item.id} — processing`
    );
    try {
      const localPath = await generateImage(item, masterPrompt, negativePrompt);
      const serverName = await uploadToImageServer(localPath, `${item.id}.png`);
      batch.items[item.id].status = "completed";
      batch.items[item.id].filePath = serverName;
      logger.log(
        `[processBatch] batch=${batch.batchId} item=${item.id} — completed (${serverName})`
      );
    } catch (err: any) {
      batch.items[item.id].status = "failed";
      batch.items[item.id].error = err.message ?? String(err);
      logger.error(
        `[processBatch] batch=${batch.batchId} item=${item.id} — failed: ${err.message ?? err}`
      );
    }
  }
  logger.log(`[processBatch] batch=${batch.batchId} — done`);
}

/**
 * Convert RGB to HSV. Returns [h (0-360), s (0-1), v (0-1)].
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else h = 60 * ((rn - gn) / delta + 4);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  return [h, s, max];
}

/**
 * Candidate chromakey colors. The pipeline picks the one that clashes least
 * with the character's own palette (the "antagonist" color) — a green-clad
 * character gets keyed on magenta, etc. Red/orange are excluded because they
 * collide with skin tones. Order matters: earlier entries win ties.
 */
const CHROMAKEY_COLORS = [
  { name: "green", hex: "#00FF00", hue: 120 },
  { name: "magenta", hex: "#FF00FF", hue: 300 },
  { name: "cyan", hex: "#00FFFF", hue: 180 },
  { name: "blue", hex: "#0000FF", hue: 240 }
] as const;
type ChromaKey = (typeof CHROMAKEY_COLORS)[number];

// Tight thresholds on purpose: the rendered chromakey is near-pure
// (saturation ~1), while muted clothing (olive/khaki/sage for green) sits
// around saturation 0.2-0.35 — a loose threshold lets the flood-fill eat
// garments and punch holes in the character.
const CHROMA_HUE_RANGE = 40;
const CHROMA_SAT_MIN = 0.45;
const CHROMA_VAL_MIN = 0.25;

// If more than this fraction of the figure's pixels fall in the current key's
// chroma range, the key would eat the character — switch to the antagonist.
const CHROMA_DANGER_THRESHOLD = 0.02;

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Check if a pixel is in the chromakey range for the given key hue.
 */
function isChroma(r: number, g: number, b: number, keyHue: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  return (
    hueDistance(h, keyHue) <= CHROMA_HUE_RANGE &&
    s >= CHROMA_SAT_MIN &&
    v >= CHROMA_VAL_MIN
  );
}

/**
 * Build the background mask for a chromakey hue: flood-fill from image
 * borders (so key-colored elements inside the character survive), then remove
 * enclosed pockets of pure key color (gaps between limbs etc.).
 * Returns a per-pixel mask: 1 = background, 0 = character.
 */
function computeChromaMask(
  data: Buffer | Uint8Array,
  width: number,
  height: number,
  keyHue: number
): Uint8Array {
  const totalPixels = width * height;
  const isBackground = new Uint8Array(totalPixels);
  const queue: number[] = [];

  const isKeyPixel = (idx: number) => {
    const off = idx * 4;
    return isChroma(data[off], data[off + 1], data[off + 2], keyHue);
  };

  // Seed with all border pixels that match the key
  for (let x = 0; x < width; x++) {
    const topIdx = x;
    if (isKeyPixel(topIdx)) {
      isBackground[topIdx] = 1;
      queue.push(topIdx);
    }
    const botIdx = (height - 1) * width + x;
    if (isKeyPixel(botIdx)) {
      isBackground[botIdx] = 1;
      queue.push(botIdx);
    }
  }
  for (let y = 1; y < height - 1; y++) {
    const leftIdx = y * width;
    if (isKeyPixel(leftIdx)) {
      isBackground[leftIdx] = 1;
      queue.push(leftIdx);
    }
    const rightIdx = y * width + (width - 1);
    if (isKeyPixel(rightIdx)) {
      isBackground[rightIdx] = 1;
      queue.push(rightIdx);
    }
  }

  // BFS flood-fill from the borders
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1
    ];

    for (const nIdx of neighbors) {
      if (nIdx < 0 || isBackground[nIdx]) continue;
      if (isKeyPixel(nIdx)) {
        isBackground[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  // Enclosed key-colored pockets: seed with strict key pixels, then expand
  // with the normal threshold to capture anti-aliased pocket edges. The model
  // often renders pockets slightly shaded (armpit gaps ~s0.6/v0.5), so the
  // seeds must tolerate that. Clothing in key-like tones is protected one
  // level up: pickChromaKey sends such characters to the antagonist key, so
  // by the time we key an image its figure has no key-hue content.
  const STRICT_HUE_RANGE = 20;
  const STRICT_SAT_MIN = 0.55;
  const STRICT_VAL_MIN = 0.4;
  const enclosedQueue: number[] = [];
  for (let i = 0; i < totalPixels; i++) {
    if (isBackground[i]) continue;
    const off = i * 4;
    const [h, s, v] = rgbToHsv(data[off], data[off + 1], data[off + 2]);
    const isStrictKey =
      hueDistance(h, keyHue) <= STRICT_HUE_RANGE &&
      s >= STRICT_SAT_MIN &&
      v >= STRICT_VAL_MIN;
    if (isStrictKey) {
      isBackground[i] = 1;
      enclosedQueue.push(i);
    }
  }

  let enclosedHead = 0;
  while (enclosedHead < enclosedQueue.length) {
    const idx = enclosedQueue[enclosedHead++];
    const x = idx % width;
    const y = (idx - x) / width;

    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1
    ];

    for (const nIdx of neighbors) {
      if (nIdx < 0 || isBackground[nIdx]) continue;
      if (isKeyPixel(nIdx)) {
        isBackground[nIdx] = 1;
        enclosedQueue.push(nIdx);
      }
    }
  }

  return isBackground;
}

// A pixel "clashes" with a key when its hue is near the key hue and it has
// any noticeable color — much looser than the keying thresholds on purpose:
// an olive/khaki figure (s ~0.3, hue ~60-75 — yellow-green, outside the
// keying hue window) is not eaten by a tight green key, but it IS too close
// in tone for reliable pocket removal and despill, so such a figure must be
// sent to the antagonist key. Hence the wide hue range here.
const CLASH_HUE_RANGE = 60;
const CLASH_SAT_MIN = 0.2;
const CLASH_VAL_MIN = 0.15;

/**
 * Pick the chromakey color that clashes least with the figure's palette.
 * danger[k] = fraction of foreground pixels whose tone is close to
 * candidate k's hue.
 */
function pickChromaKey(
  data: Buffer | Uint8Array,
  isForeground: (idx: number) => boolean,
  totalPixels: number
): { key: ChromaKey; dangers: number[] } {
  const counts = new Array(CHROMAKEY_COLORS.length).fill(0);
  let foreground = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (!isForeground(i)) continue;
    foreground++;
    const off = i * 4;
    const [h, s, v] = rgbToHsv(data[off], data[off + 1], data[off + 2]);
    if (s < CLASH_SAT_MIN || v < CLASH_VAL_MIN) continue;
    for (let k = 0; k < CHROMAKEY_COLORS.length; k++) {
      if (hueDistance(h, CHROMAKEY_COLORS[k].hue) <= CLASH_HUE_RANGE) {
        counts[k]++;
      }
    }
  }
  const dangers = counts.map(c => (foreground > 0 ? c / foreground : 0));
  let best = 0;
  for (let k = 1; k < dangers.length; k++) {
    if (dangers[k] < dangers[best] - 1e-9) best = k;
  }
  return { key: CHROMAKEY_COLORS[best], dangers };
}

/**
 * Analyze a freshly generated raw frame: how much of the figure would the
 * current key eat, and which candidate key is the safest antagonist.
 */
async function chooseChromaKeyForRaw(
  localPath: string,
  currentKey: ChromaKey
): Promise<{ key: ChromaKey; currentDanger: number }> {
  const { data, info } = await sharp(localPath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const totalPixels = info.width * info.height;
  const isBg = computeChromaMask(data, info.width, info.height, currentKey.hue);
  const { key, dangers } = pickChromaKey(data, i => !isBg[i], totalPixels);
  const currentIdx = CHROMAKEY_COLORS.findIndex(c => c.name === currentKey.name);
  return { key, currentDanger: dangers[currentIdx] };
}

/**
 * Pick the safest chromakey for a new generation based on an existing keyed
 * sprite (transparent PNG) of the same character. Falls back to green.
 */
async function chooseChromaKeyForSprite(imageBuffer: Buffer): Promise<ChromaKey> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    const totalPixels = info.width * info.height;
    const { key } = pickChromaKey(
      data,
      i => data[i * 4 + 3] > 200,
      totalPixels
    );
    return key;
  } catch {
    return CHROMAKEY_COLORS[0];
  }
}

/**
 * Trace a binary mask (single-channel PNG, white = figure) into smooth Bezier
 * contours using the Potrace algorithm (Selinger 2003 — the same engine
 * Inkscape uses). Returns the SVG path `d` string.
 */
async function traceMaskToSvgPath(maskPng: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const tracer = new Potrace();
    tracer.setParameters({
      threshold: 128,
      blackOnWhite: false, // trace the white (figure) regions
      turdSize: 8, // drop speck-sized islands and holes
      // Keep the trace close to the mask (±1px): larger tolerances cut
      // corners in narrow gaps, and the cover stroke then has no margin left
      // to overlap the raster seam between the rim and the art
      alphaMax: 1.0,
      optCurve: true,
      optTolerance: 0.3
    });
    tracer.loadImage(maskPng, (err: Error | null) => {
      if (err) return reject(err);
      const match = tracer.getPathTag().match(/d="([^"]+)"/);
      if (!match) return reject(new Error("Potrace produced no path"));
      resolve(match[1]);
    });
  });
}

/**
 * Remove the chromakey background using flood-fill from image edges.
 * Only pixels connected to the border that are in the key range get removed.
 * This preserves key-colored elements inside the character (clothing, eyes).
 * The resulting mask is feathered for anti-aliasing, the key-colored fringe
 * is despilled, and a white sticker outline is synthesized around a smoothed
 * silhouette contour.
 */
async function removeChromakey(
  inputPath: string,
  key: ChromaKey
): Promise<void> {
  const image = sharp(inputPath);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("Cannot read image dimensions");

  const { data } = await image
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const totalPixels = width * height;

  // 1. Background mask: border flood-fill + enclosed key-colored pockets
  const isBackground = computeChromaMask(data, width, height, key.hue);

  // 2. Binary figure mask, fed to Potrace as-is. No blur+threshold
  // pre-smoothing: it shrinks narrow gaps (between legs, fingers) by pixels,
  // pushing the traced contour away from the real edge. Smoothing pixel
  // jitter into clean curves is exactly what Potrace's polygon-fitting stage
  // is for.
  const binaryMask = Buffer.alloc(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    binaryMask[i] = isBackground[i] ? 0 : 255;
  }

  // A narrow band around the contour, used to decide where to despill
  const { data: edgeBand, info: bandInfo } = await sharp(binaryMask, {
    raw: { width, height, channels: 1 }
  })
    .blur(1.2)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (bandInfo.channels !== 1) {
    throw new Error(`Edge band mask has ${bandInfo.channels} channels, expected 1`);
  }

  // 3. Trace the smoothed mask into Bezier contours (Potrace) once. Both the
  // character cutout alpha AND the sticker outline are rendered from this
  // single vector path, so the inner and outer edges of the white line are
  // equally smooth sub-pixel curves — a raster mask here would leave a pixel
  // staircase on the character side of the line.
  const maskPng = await sharp(binaryMask, {
    raw: { width, height, channels: 1 }
  })
    .png()
    .toBuffer();
  const pathD = await traceMaskToSvgPath(maskPng);

  const renderPath = async (pathAttrs: string): Promise<Buffer> => {
    const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><path d="${pathD}" fill-rule="evenodd" ${pathAttrs}/></svg>`;
    const { data: px, info } = await sharp(Buffer.from(svg))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== width || info.height !== height) {
      throw new Error(
        `Path rendered at ${info.width}x${info.height}, expected ${width}x${height}`
      );
    }
    return px;
  };

  const cutoutMask = await renderPath(`fill="#fff"`);
  // The cover stroke (drawn over the character at the end) is also used here
  // to resolve keying-vs-vector disagreements near the contour
  // Thin: it only needs to hide the ±1-2px raster seam between cutout and
  // art; wider covers visibly eat the art's own dark edge lineart
  const coverMask = await renderPath(
    `fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`
  );

  // 4. Apply the vector cutout alpha; despill the key tint inside the edge
  // band by pulling those pixels toward neutral gray (strongest at key hue)
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    data[off + 3] = cutoutMask[off + 3];
    if (data[off + 3] === 0) continue;
    // Keyed-out background pixels that the vector contour still covers (the
    // curve rounds edges and shrinks small holes, swallowing a rim of
    // ex-background): under the cover stroke they turn white (the stroke
    // hides them with a smooth vector edge); deeper than the stroke the
    // keying verdict wins — transparent — so no raster-edged white teeth and
    // no raw chromakey ever show
    if (isBackground[i]) {
      if (coverMask[off + 3] > 0) {
        data[off] = 255;
        data[off + 1] = 255;
        data[off + 2] = 255;
      } else {
        data[off + 3] = 0;
      }
      continue;
    }
    const band = edgeBand[i];
    if (band > 0 && band < 255) {
      const [h, s] = rgbToHsv(data[off], data[off + 1], data[off + 2]);
      const hd = hueDistance(h, key.hue);
      if (hd <= CHROMA_HUE_RANGE && s > 0.1) {
        const t = 1 - hd / CHROMA_HUE_RANGE;
        const gray =
          0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
        data[off] = Math.round(data[off] + (gray - data[off]) * t);
        data[off + 1] = Math.round(data[off + 1] + (gray - data[off + 1]) * t);
        data[off + 2] = Math.round(data[off + 2] + (gray - data[off + 2]) * t);
      }
    }
  }

  // 5. The sticker base: same path with a centered round-join stroke = the
  // figure dilated by OUTLINE_WIDTH outward. Holes in the silhouette (gaps
  // between limbs) get outlined too, like a real die-cut sticker.
  const OUTLINE_WIDTH = Math.max(4, Math.round(Math.min(width, height) / 200));
  const ringMask = await renderPath(
    `fill="#fff" stroke="#fff" stroke-width="${OUTLINE_WIDTH * 2}" stroke-linejoin="round" stroke-linecap="round"`
  );

  // Composite the character over the white sticker base
  for (let i = 0; i < totalPixels; i++) {
    const ringAlpha = ringMask[i * 4 + 3] / 255;
    if (ringAlpha <= 0) continue;
    const off = i * 4;
    const charAlpha = data[off + 3] / 255;
    if (charAlpha >= 1) continue;
    const outAlpha = charAlpha + ringAlpha * (1 - charAlpha);
    const white = 255 * ringAlpha * (1 - charAlpha);
    data[off] = Math.round((data[off] * charAlpha + white) / outAlpha);
    data[off + 1] = Math.round((data[off + 1] * charAlpha + white) / outAlpha);
    data[off + 2] = Math.round((data[off + 2] * charAlpha + white) / outAlpha);
    data[off + 3] = Math.round(outAlpha * 255);
  }

  // 6. The thin cover stroke drawn OVER the character. It hides the
  // raster-edged seam where the cutout meets the art — whitened
  // ex-background rim pixels and anti-aliased key fringe — so the inner edge
  // of the line is the same smooth vector curve as the outer one.
  for (let i = 0; i < totalPixels; i++) {
    const coverAlpha = coverMask[i * 4 + 3] / 255;
    if (coverAlpha <= 0) continue;
    const off = i * 4;
    const baseAlpha = data[off + 3] / 255;
    const outAlpha = coverAlpha + baseAlpha * (1 - coverAlpha);
    data[off] = Math.round(
      (255 * coverAlpha + data[off] * baseAlpha * (1 - coverAlpha)) / outAlpha
    );
    data[off + 1] = Math.round(
      (255 * coverAlpha + data[off + 1] * baseAlpha * (1 - coverAlpha)) / outAlpha
    );
    data[off + 2] = Math.round(
      (255 * coverAlpha + data[off + 2] * baseAlpha * (1 - coverAlpha)) / outAlpha
    );
    data[off + 3] = Math.round(outAlpha * 255);
  }

  // Запись с валидацией: наблюдался разовый сбой, когда sharp записал PNG с
  // валидными CRC чанков, но битым zlib-потоком IDAT. Такой файл молча уезжал
  // на image_server и дальше ронял ВСЕ генерации поз этого персонажа
  // (Gemini: «Unable to process input image»). Перечитываем written-файл;
  // битая запись ретраится один раз, повторный фейл — громкая ошибка.
  for (let attempt = 0; ; attempt++) {
    await sharp(data, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(inputPath + ".tmp");
    try {
      await sharp(inputPath + ".tmp").stats();
      break;
    } catch (err) {
      if (attempt >= 1) {
        throw new Error(
          `removeChromakey: written PNG failed decode validation (${(err as Error).message})`
        );
      }
      logger.error(
        `[removeChromakey] ${inputPath} — written PNG is corrupt, retrying write`
      );
    }
  }

  fs.renameSync(inputPath + ".tmp", inputPath);
}

/**
 * Полная проверка декодируемости референса перед отправкой в Gemini.
 * Битый референс иначе даёт непрозрачное `400 Unable to process input image`.
 */
async function assertReferenceDecodable(
  base64Data: string,
  context: string
): Promise<void> {
  try {
    await sharp(Buffer.from(base64Data, "base64")).stats();
  } catch (err) {
    throw new Error(
      `${context}: reference image is corrupt or undecodable (${(err as Error).message}). ` +
        `Перегенерируйте idle-спрайт персонажа целиком.`
    );
  }
}

/**
 * Развёртка канонических эмоций (client emotionResolver.CANONICAL_POSES) в
 * выразительные описания мимики и языка тела. Голое слово («soft») модель
 * почти игнорирует — позы выходили одинаково-меланхоличными и различались
 * только реквизитом, а не эмоцией. Ключ — то, что приходит в poses[];
 * незнакомая поза падает в старое поведение (слово как есть).
 */
const POSE_EXPRESSIONS: Record<string, string> = {
  idle: 'neutral relaxed stance, calm open face, arms at ease',
  happy: 'bright genuine smile with slightly squinted joyful eyes, lifted posture, open energetic body language',
  sad: 'downcast eyes, drooping shoulders, corners of the mouth turned down, withdrawn closed-off posture',
  tense: 'tight jaw, worried furrowed brows, stiff shoulders, guarded posture with arms drawn close',
  soft: 'warm gentle smile, tender affectionate half-lidded gaze, relaxed open shoulders, head slightly tilted toward the viewer',
  thoughtful: 'pensive gaze directed aside and upward, a finger near the chin or lips, weight shifted onto one leg',
  surprised: 'wide-open eyes and raised eyebrows, slightly parted lips, hands raised in a startled gesture',
  angry: 'sharp glare with knitted brows, clenched fists, confrontational squared stance',
};

function buildCharacterPosePrompt(
  masterPrompt: string,
  characterDescription: string,
  pose: string,
  chromaKey: ChromaKey,
  storyMasterPrompt?: string
): string {
  const parts = [
    masterPrompt,
  ];
  if (storyMasterPrompt) {
    parts.push(`Story context:\n${storyMasterPrompt}`);
  }
  parts.push(
    characterDescription,
    `Generate exactly ONE character — one body, one head, one pair of arms, one pair of legs — in a "${pose}" pose/emotion (${POSE_EXPRESSIONS[pose] ?? pose}) as a full-body shot, centered in the frame. The emotion must be clearly readable in BOTH the facial expression and the body language; poses of the same character must be visually distinct from each other primarily through emotion, not props. STRICTLY FORBIDDEN: multiple characters, duplicates, copies, turnaround sheets, character sheets, multiple views, side-by-side variations, or any layout containing more than one figure. The image contains exactly one figure. The character must be rendered on a solid bright chromakey ${chromaKey.name} (${chromaKey.hex}) background. The entire background must be uniform pure ${chromaKey.name} with no gradients, no shadows, no environment, no ground. Do NOT draw any outline, border, stroke, or halo around the character — even if a reference image shows a white outline, do not reproduce it; the outline is added later in post-processing. Render the character directly against the ${chromaKey.name} background with clean edges. Maintain consistent character design, proportions, and art style.`
  );
  return parts.join("\n\n");
}

export async function processCharacterBatch(
  batch: BatchState,
  request: CharacterGenerateRequest
) {
  const { masterPrompt, storyMasterPrompt, characterDescription } = request;

  // Deduplicate and normalize poses, ensure idle is first
  const rawPoses = request.poses ?? [];
  const uniquePoses = [
    ...new Set(rawPoses.map(p => p.toLowerCase().trim()))
  ].filter(p => p !== "idle");
  const allPoses = ["idle", ...uniquePoses];

  logger.log(
    `[processCharacterBatch] batch=${batch.batchId} — generating idle pose first, then ${uniquePoses.length} additional pose(s)`
  );

  // 1. Generate idle pose first
  const idleId = "idle";
  batch.items[idleId].status = "processing";

  let chromaKey: ChromaKey = CHROMAKEY_COLORS[0];
  let idleLocalPath: string;
  try {
    const makeIdleItem = (key: ChromaKey): GenerateItem => ({
      id: idleId,
      description: buildCharacterPosePrompt(
        masterPrompt,
        characterDescription,
        "idle — neutral standing pose, relaxed, facing the viewer",
        key,
        storyMasterPrompt
      )
    });
    idleLocalPath = await generateImage(
      makeIdleItem(chromaKey),
      undefined,
      undefined,
      "2:3"
    );

    // If the character's palette clashes with the key color, the keying would
    // eat the figure — switch to the antagonist key and regenerate once
    const { key: bestKey, currentDanger } = await chooseChromaKeyForRaw(
      idleLocalPath,
      chromaKey
    );
    if (currentDanger > CHROMA_DANGER_THRESHOLD && bestKey.name !== chromaKey.name) {
      logger.log(
        `[processCharacterBatch] batch=${batch.batchId} — character palette clashes with ${chromaKey.name} chromakey (${(currentDanger * 100).toFixed(1)}% of figure), regenerating idle on ${bestKey.name}`
      );
      chromaKey = bestKey;
      idleLocalPath = await generateImage(
        makeIdleItem(chromaKey),
        undefined,
        undefined,
        "2:3"
      );
    }

    logger.log(
      `[processCharacterBatch] batch=${batch.batchId} — removing ${chromaKey.name} chromakey from idle pose`
    );
    await removeChromakey(idleLocalPath, chromaKey);
    const idleServerName = await uploadToImageServer(idleLocalPath, "idle.png");
    batch.items[idleId].status = "completed";
    batch.items[idleId].filePath = idleServerName;
    logger.log(
      `[processCharacterBatch] batch=${batch.batchId} — idle pose completed (${idleServerName})`
    );
  } catch (err: any) {
    batch.items[idleId].status = "failed";
    batch.items[idleId].error = err.message ?? String(err);
    logger.error(
      `[processCharacterBatch] batch=${batch.batchId} — idle pose failed: ${err.message ?? err}`
    );
    // Mark all remaining as failed since we need idle as reference
    for (const pose of uniquePoses) {
      batch.items[pose].status = "failed";
      batch.items[pose].error = "Skipped: idle pose generation failed";
    }
    return;
  }

  // 2. Generate remaining poses in parallel, using idle as reference
  if (uniquePoses.length === 0) return;

  logger.log(
    `[processCharacterBatch] batch=${batch.batchId} — generating ${uniquePoses.length} pose(s) in parallel: [${uniquePoses.join(", ")}]`
  );

  const idleImageBase64 = fs.readFileSync(idleLocalPath);
  try {
    await assertReferenceDecodable(
      idleImageBase64.toString("base64"),
      `processCharacterBatch batch=${batch.batchId} idle reference`
    );
  } catch (err: any) {
    logger.error(`[processCharacterBatch] batch=${batch.batchId} — ${err.message ?? err}`);
    for (const pose of uniquePoses) {
      batch.items[pose].status = "failed";
      batch.items[pose].error = err.message ?? String(err);
    }
    return;
  }
  const idleDataUri = `data:image/png;base64,${idleImageBase64.toString("base64")}`;

  const posePromises = uniquePoses.map(async pose => {
    batch.items[pose].status = "processing";
    try {
      const poseItem: GenerateItem = {
        id: pose,
        description: buildCharacterPosePrompt(
          masterPrompt,
          characterDescription,
          pose,
          chromaKey,
          storyMasterPrompt
        ),
        referenceImages: [idleDataUri]
      };
      const localPath = await generateImage(poseItem, undefined, undefined, "2:3");
      logger.log(
        `[processCharacterBatch] batch=${batch.batchId} pose=${pose} — removing ${chromaKey.name} chromakey`
      );
      await removeChromakey(localPath, chromaKey);
      const serverName = await uploadToImageServer(localPath, `${pose}.png`);
      batch.items[pose].status = "completed";
      batch.items[pose].filePath = serverName;
      logger.log(
        `[processCharacterBatch] batch=${batch.batchId} pose=${pose} — completed (${serverName})`
      );
    } catch (err: any) {
      batch.items[pose].status = "failed";
      batch.items[pose].error = err.message ?? String(err);
      logger.error(
        `[processCharacterBatch] batch=${batch.batchId} pose=${pose} — failed: ${err.message ?? err}`
      );
    }
  });

  await Promise.all(posePromises);
  logger.log(`[processCharacterBatch] batch=${batch.batchId} — all poses done`);
}

export async function processRegeneratePose(
  batch: BatchState,
  request: RegeneratePoseRequest
) {
  const { masterPrompt, storyMasterPrompt, characterDescription, pose, referenceImageUrl } =
    request;
  const poseId = pose.toLowerCase().trim();

  batch.items[poseId].status = "processing";
  logger.log(
    `[processRegeneratePose] batch=${batch.batchId} pose=${poseId} — fetching reference image from ${referenceImageUrl}`
  );

  try {
    // Fetch existing idle image and convert to data URI for reference
    const refImage = await fetchImageAsBase64(referenceImageUrl);
    await assertReferenceDecodable(
      refImage.data,
      `processRegeneratePose pose=${poseId} ref=${referenceImageUrl}`
    );
    const refDataUri = `data:${refImage.mimeType};base64,${refImage.data}`;

    // Pick the chromakey that clashes least with the character's palette
    const chromaKey = await chooseChromaKeyForSprite(
      Buffer.from(refImage.data, "base64")
    );
    logger.log(
      `[processRegeneratePose] batch=${batch.batchId} pose=${poseId} — using ${chromaKey.name} chromakey`
    );

    const poseItem: GenerateItem = {
      id: poseId,
      description: buildCharacterPosePrompt(
        masterPrompt,
        characterDescription,
        pose,
        chromaKey,
        storyMasterPrompt
      ),
      referenceImages: [refDataUri]
    };
    const localPath = await generateImage(poseItem, undefined, undefined, "2:3");
    logger.log(
      `[processRegeneratePose] batch=${batch.batchId} pose=${poseId} — removing ${chromaKey.name} chromakey`
    );
    await removeChromakey(localPath, chromaKey);
    const serverName = await uploadToImageServer(localPath, `${poseId}.png`);
    batch.items[poseId].status = "completed";
    batch.items[poseId].filePath = serverName;
    logger.log(
      `[processRegeneratePose] batch=${batch.batchId} pose=${poseId} — completed (${serverName})`
    );
  } catch (err: any) {
    batch.items[poseId].status = "failed";
    batch.items[poseId].error = err.message ?? String(err);
    logger.error(
      `[processRegeneratePose] batch=${batch.batchId} pose=${poseId} — failed: ${err.message ?? err}`
    );
  }
}

export async function processBackgroundBatch(
  batch: BatchState,
  request: BackgroundGenerateRequest
) {
  const itemId = "background";
  batch.items[itemId].status = "processing";
  logger.log(
    `[processBackgroundBatch] batch=${batch.batchId} — generating background`
  );
  try {
    const parts = [
      request.masterPrompt,
    ];
    if (request.storyMasterPrompt) {
      parts.push(`Story context:\n${request.storyMasterPrompt}`);
    }
    parts.push(
      request.sceneDescription,
      "Generate a detailed background/environment scene. No characters or people should be present — only the environment, scenery, and atmosphere. The image should work as a backdrop for a visual novel."
    );
    const item: GenerateItem = {
      id: itemId,
      description: parts.join("\n\n")
    };
    const localPath = await generateImage(item, undefined, undefined, "16:9");
    const serverName = await uploadToImageServer(localPath, "background.png");
    batch.items[itemId].status = "completed";
    batch.items[itemId].filePath = serverName;
    logger.log(
      `[processBackgroundBatch] batch=${batch.batchId} — completed (${serverName})`
    );
  } catch (err: any) {
    batch.items[itemId].status = "failed";
    batch.items[itemId].error = err.message ?? String(err);
    logger.error(
      `[processBackgroundBatch] batch=${batch.batchId} — failed: ${err.message ?? err}`
    );
  }
}
