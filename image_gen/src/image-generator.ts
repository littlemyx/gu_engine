import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
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
 * Check if a pixel is in the green chromakey range.
 */
function isGreenish(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  const HUE_CENTER = 120;
  const HUE_RANGE = 50;
  const SAT_MIN = 0.08;
  const VAL_MIN = 0.2;

  const hueDist = Math.abs(h - HUE_CENTER);
  const isGreenHue = hueDist <= HUE_RANGE || hueDist >= 360 - HUE_RANGE;
  return isGreenHue && s >= SAT_MIN && v >= VAL_MIN;
}

/**
 * Remove chromakey green background using flood-fill from image edges.
 * Only pixels connected to the border that are in the green range get removed.
 * This preserves green elements inside the character (clothing, eyes, etc.).
 * Border pixels of the detected region get partial transparency for anti-aliasing.
 */
async function removeChromakeyGreen(inputPath: string): Promise<void> {
  const image = sharp(inputPath);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("Cannot read image dimensions");

  const { data } = await image
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const totalPixels = width * height;

  // 1. Flood-fill from all border pixels to find connected green background
  const isBackground = new Uint8Array(totalPixels); // 0 = not bg, 1 = bg
  const queue: number[] = [];

  // Seed with all border pixels that are green
  for (let x = 0; x < width; x++) {
    // Top row
    const topIdx = x;
    const topOff = topIdx * 4;
    if (isGreenish(data[topOff], data[topOff + 1], data[topOff + 2])) {
      isBackground[topIdx] = 1;
      queue.push(topIdx);
    }
    // Bottom row
    const botIdx = (height - 1) * width + x;
    const botOff = botIdx * 4;
    if (isGreenish(data[botOff], data[botOff + 1], data[botOff + 2])) {
      isBackground[botIdx] = 1;
      queue.push(botIdx);
    }
  }
  for (let y = 1; y < height - 1; y++) {
    // Left column
    const leftIdx = y * width;
    const leftOff = leftIdx * 4;
    if (isGreenish(data[leftOff], data[leftOff + 1], data[leftOff + 2])) {
      isBackground[leftIdx] = 1;
      queue.push(leftIdx);
    }
    // Right column
    const rightIdx = y * width + (width - 1);
    const rightOff = rightIdx * 4;
    if (isGreenish(data[rightOff], data[rightOff + 1], data[rightOff + 2])) {
      isBackground[rightIdx] = 1;
      queue.push(rightIdx);
    }
  }

  // BFS flood-fill
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    const neighbors = [
      y > 0 ? idx - width : -1, // up
      y < height - 1 ? idx + width : -1, // down
      x > 0 ? idx - 1 : -1, // left
      x < width - 1 ? idx + 1 : -1 // right
    ];

    for (const nIdx of neighbors) {
      if (nIdx < 0 || isBackground[nIdx]) continue;
      const nOff = nIdx * 4;
      if (isGreenish(data[nOff], data[nOff + 1], data[nOff + 2])) {
        isBackground[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  // 2. Find enclosed green areas: seed with strict-green pixels, then flood-fill
  // outward with the loose threshold to capture anti-aliased edges.
  const STRICT_HUE_RANGE = 20;
  const STRICT_SAT_MIN = 0.6;
  const STRICT_VAL_MIN = 0.4;
  const enclosedQueue: number[] = [];
  for (let i = 0; i < totalPixels; i++) {
    if (isBackground[i]) continue;
    const off = i * 4;
    const [h, s, v] = rgbToHsv(data[off], data[off + 1], data[off + 2]);
    const hueDist = Math.abs(h - 120);
    const isStrictGreen =
      (hueDist <= STRICT_HUE_RANGE || hueDist >= 360 - STRICT_HUE_RANGE) &&
      s >= STRICT_SAT_MIN &&
      v >= STRICT_VAL_MIN;
    if (isStrictGreen) {
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
      const nOff = nIdx * 4;
      if (isGreenish(data[nOff], data[nOff + 1], data[nOff + 2])) {
        isBackground[nIdx] = 1;
        enclosedQueue.push(nIdx);
      }
    }
  }

  // 3. Find border pixels (background pixels adjacent to non-background)
  const isBorder = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (!isBackground[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    const neighbors = [
      y > 0 ? i - width : -1,
      y < height - 1 ? i + width : -1,
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1
    ];
    for (const nIdx of neighbors) {
      if (nIdx >= 0 && !isBackground[nIdx]) {
        isBorder[i] = 1;
        break;
      }
    }
  }

  // 4. Apply transparency: fully transparent for interior, soft alpha for borders
  const HUE_CENTER = 120;
  const HUE_RANGE = 50;
  const SAT_MIN = 0.08;

  for (let i = 0; i < totalPixels; i++) {
    if (!isBackground[i]) continue;

    const off = i * 4;

    if (!isBorder[i]) {
      // Interior background pixel — fully transparent
      data[off + 3] = 0;
      continue;
    }

    // Border pixel — soft alpha for anti-aliasing
    const [h, s] = rgbToHsv(data[off], data[off + 1], data[off + 2]);
    const hueDist = Math.abs(h - HUE_CENTER);
    const hueAlpha = Math.max(0, hueDist / HUE_RANGE);
    const satAlpha = Math.max(0, 1 - (s - SAT_MIN) / (1 - SAT_MIN));
    const alpha = Math.min(hueAlpha, satAlpha);
    data[off + 3] = Math.round(alpha * 255);
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(inputPath + ".tmp");

  fs.renameSync(inputPath + ".tmp", inputPath);
}

function buildCharacterPosePrompt(
  masterPrompt: string,
  characterDescription: string,
  pose: string,
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
    `Generate exactly ONE character — one body, one head, one pair of arms, one pair of legs — in a "${pose}" pose/emotion as a full-body shot, centered in the frame. STRICTLY FORBIDDEN: multiple characters, duplicates, copies, turnaround sheets, character sheets, multiple views, side-by-side variations, or any layout containing more than one figure. The image contains exactly one figure. The character must be rendered on a solid bright chromakey green (#00FF00) background. The entire background must be uniform pure green with no gradients, no shadows, no environment, no ground. The character should have a thin clean white outline (2-3 pixels) separating it from the green background. Crisp sharp edges, no blur or feathering at the borders. Maintain consistent character design, proportions, and art style.`
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

  let idleLocalPath: string;
  try {
    const idleItem: GenerateItem = {
      id: idleId,
      description: buildCharacterPosePrompt(
        masterPrompt,
        characterDescription,
        "idle — neutral standing pose, relaxed, facing the viewer",
        storyMasterPrompt
      )
    };
    idleLocalPath = await generateImage(idleItem, undefined, undefined, "2:3");
    logger.log(
      `[processCharacterBatch] batch=${batch.batchId} — removing chromakey from idle pose`
    );
    await removeChromakeyGreen(idleLocalPath);
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
          storyMasterPrompt
        ),
        referenceImages: [idleDataUri]
      };
      const localPath = await generateImage(poseItem, undefined, undefined, "2:3");
      logger.log(
        `[processCharacterBatch] batch=${batch.batchId} pose=${pose} — removing chromakey`
      );
      await removeChromakeyGreen(localPath);
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
    const refDataUri = `data:${refImage.mimeType};base64,${refImage.data}`;

    const poseItem: GenerateItem = {
      id: poseId,
      description: buildCharacterPosePrompt(
        masterPrompt,
        characterDescription,
        pose,
        storyMasterPrompt
      ),
      referenceImages: [refDataUri]
    };
    const localPath = await generateImage(poseItem, undefined, undefined, "2:3");
    logger.log(
      `[processRegeneratePose] batch=${batch.batchId} pose=${poseId} — removing chromakey`
    );
    await removeChromakeyGreen(localPath);
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
