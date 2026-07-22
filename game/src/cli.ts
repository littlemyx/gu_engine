import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve, dirname, relative, basename, extname, join } from "node:path";
import { build, type Plugin } from "vite";
import { zipSync, Zippable } from "fflate";
import {
  STORY_BUNDLE_FORMAT_VERSION,
  validateStoryBundle,
  type StoryBundleV2,
} from "gu-engine-story-core";

async function downloadFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  Не удалось скачать ${url}: ${res.status}`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    return true;
  } catch (e) {
    console.warn(`  Ошибка загрузки ${url}: ${(e as Error).message}`);
    return false;
  }
}

/** Extract a filename from a URL, falling back to a hash-based name */
function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = basename(pathname);
    if (name && name !== "/" && name !== "") return name;
  } catch {
    // not a valid URL, try as a path
    const name = basename(url);
    if (name) return name;
  }
  // fallback: use a hash
  const hash = url.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return `asset_${Math.abs(hash).toString(36)}`;
}

/**
 * Download all assets to assetsDir, return a mapping from original URL to
 * relative path. usedNames разделяется между проходами (image/audio), чтобы
 * файл одного прохода не перезаписал одноимённый файл другого.
 */
async function downloadAssets(
  urls: string[],
  assetsDir: string,
  usedNames: Set<string>,
  failed: string[],
): Promise<Map<string, string>> {
  mkdirSync(assetsDir, { recursive: true });
  const mapping = new Map<string, string>();

  for (const url of urls) {
    let name = filenameFromUrl(url);

    // Deduplicate filenames
    if (usedNames.has(name)) {
      const ext = extname(name);
      const base = basename(name, ext);
      let i = 1;
      while (usedNames.has(`${base}_${i}${ext}`)) i++;
      name = `${base}_${i}${ext}`;
    }
    usedNames.add(name);

    const dest = resolve(assetsDir, name);
    const ok = await downloadFile(url, dest);
    if (ok) {
      mapping.set(url, `./assets/${name}`);
    } else {
      failed.push(url);
    }
  }

  return mapping;
}

/** Рекурсивный обход директории для упаковки в архив. */
function collectFiles(dir: string, prefix = ""): Zippable {
  const result: Zippable = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(result, collectFiles(entryPath, zipPath));
    } else {
      result[zipPath] = readFileSync(entryPath);
    }
  }
  return result;
}

/** Pack the output directory into a .gu ZIP archive */
function packArchive(outDir: string, archivePath: string): void {
  const files = collectFiles(outDir);
  const zipped = zipSync(files);
  writeFileSync(archivePath, zipped);
}

/** Все внешние URL бандла: фоны локаций, спрайты по строкам, аудио. */
function collectBundleUrls(bundle: StoryBundleV2): { images: string[]; audio: string[] } {
  const images = new Set<string>();
  const audio = new Set<string>();

  for (const l of bundle.world.locations) if (l.background) images.add(l.background);
  for (const b of bundle.spine.beats) if (b.background) images.add(b.background);
  for (const e of bundle.spine.endings) if (e.background) images.add(e.background);
  if (bundle.intro.background) images.add(bundle.intro.background);

  for (const unit of bundle.units) {
    for (const v of unit.variants) {
      for (const n of v.nodes) for (const l of n.lines) for (const s of l.sprites ?? []) images.add(s.url);
      for (const l of v.farewell?.lines ?? []) for (const s of l.sprites ?? []) images.add(s.url);
    }
    if (unit.audioProfile?.positiveUrl) audio.add(unit.audioProfile.positiveUrl);
    if (unit.audioProfile?.negativeUrl) audio.add(unit.audioProfile.negativeUrl);
    if (unit.sfxUrl) audio.add(unit.sfxUrl);
  }

  if (bundle.audio.bgmUrl) audio.add(bundle.audio.bgmUrl);
  for (const u of Object.values(bundle.audio.ambientByMood ?? {})) audio.add(u);
  for (const u of Object.values(bundle.audio.ambientBySpecial ?? {})) audio.add(u);

  return { images: [...images], audio: [...audio] };
}

/**
 * Переписывание URL в бандле. Сериализуем-подменяем-разбираем: адресов много и
 * они разной глубины, а обход руками пришлось бы держать синхронным со схемой.
 */
function rewriteBundleUrls(bundle: StoryBundleV2, mapping: Map<string, string>): StoryBundleV2 {
  let json = JSON.stringify(bundle);
  for (const [from, to] of mapping) {
    json = json.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1));
  }
  return JSON.parse(json) as StoryBundleV2;
}

async function buildBundle(
  bundle: StoryBundleV2,
  absOutDir: string,
  gameRoot: string,
  archive: boolean,
): Promise<void> {
  const issues = validateStoryBundle(bundle).filter((i) => i.severity === "error");
  if (issues.length > 0) {
    console.error("Бандл не прошёл проверку:");
    for (const i of issues) console.error(`  - ${i.message}`);
    process.exit(1);
  }

  console.log(`Сборка бандла: "${bundle.title}"`);
  console.log(
    `Юнитов: ${bundle.units.length}, битов: ${bundle.spine.beats.length}, ` +
      `концовок: ${bundle.spine.endings.length}, слотов: ${bundle.calendar.slotCount}`,
  );

  const { images, audio } = collectBundleUrls(bundle);
  const usedNames = new Set<string>();
  const failedDownloads: string[] = [];
  const assetsDir = resolve(absOutDir, "assets");
  let out = bundle;

  if (images.length > 0) {
    console.log(`\nСкачивание изображений (${images.length})...`);
    const mapping = await downloadAssets(images, assetsDir, usedNames, failedDownloads);
    console.log(`Скачано: ${mapping.size}/${images.length}`);
    out = rewriteBundleUrls(out, mapping);
  }
  if (audio.length > 0) {
    console.log(`\nСкачивание аудио (${audio.length})...`);
    const mapping = await downloadAssets(audio, assetsDir, usedNames, failedDownloads);
    console.log(`Скачано: ${mapping.size}/${audio.length}`);
    out = rewriteBundleUrls(out, mapping);
  }

  if (failedDownloads.length > 0) {
    console.warn(`\n⚠ Не скачано ассетов: ${failedDownloads.length}. В сборке останутся исходные URL:`);
    for (const url of failedDownloads) console.warn(`  - ${url}`);
  }

  await build({
    root: gameRoot,
    plugins: [
      {
        name: "gu-inject-bundle",
        config: () => ({ define: { __GU_PROJECT__: JSON.stringify(out) } }),
      } as Plugin,
    ],
    build: { outDir: absOutDir, emptyOutDir: false },
    logLevel: "info",
  });

  if (archive) {
    const title = out.title.replace(/[^a-zа-яё0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "project";
    const archivePath = resolve(dirname(absOutDir), `${title}.gu`);
    console.log(`\nУпаковка в архив: ${archivePath}`);
    packArchive(absOutDir, archivePath);
  }

  console.log(`\n✓ Готово: ${absOutDir}`);
}

async function main() {
  const args = process.argv.slice(2);
  const filteredArgs = args.filter((a) => a !== "--archive");
  const archive = args.includes("--archive");
  const projectPath = filteredArgs[0];
  const outDir = filteredArgs.find((_, i) => filteredArgs[i - 1] === "--out") ?? "dist";

  if (!projectPath) {
    console.error("Использование: gu-build <story.gu.json> [--out <dir>] [--archive]");
    process.exit(1);
  }

  const absProjectPath = resolve(process.cwd(), projectPath);
  if (!existsSync(absProjectPath)) {
    console.error(`Файл бандла не найден: ${absProjectPath}`);
    process.exit(1);
  }

  // Проверяем что outDir не является директорией с исходниками game/
  const gameRoot = resolve(import.meta.dirname, "..");
  const absOutDir = resolve(process.cwd(), outDir);
  const rel = relative(gameRoot, absOutDir);
  if (rel === "" || (!rel.startsWith("..") && !resolve(rel).startsWith("/"))) {
    // outDir внутри game/ или совпадает с ним — опасно
    const hasSourceFiles = existsSync(resolve(absOutDir, "src"));
    const isGameDir = absOutDir === gameRoot;
    if (isGameDir || hasSourceFiles) {
      console.error(
        `Ошибка: выходная директория "${absOutDir}" содержит исходники проекта.\n` +
        `Используйте другую директорию, например: --out ../result-game`
      );
      process.exit(1);
    }
  }

  const raw = JSON.parse(readFileSync(absProjectPath, "utf-8"));

  if (raw.formatVersion !== STORY_BUNDLE_FORMAT_VERSION) {
    console.error(
      `Это не storylet-бандл (formatVersion ${raw.formatVersion ?? "нет"}).\n` +
        `gu-build собирает только формат v${STORY_BUNDLE_FORMAT_VERSION} — ` +
        `экспортируйте историю кнопкой «Скачать storylet-бандл (v2)».`,
    );
    process.exit(1);
  }

  await buildBundle(raw as StoryBundleV2, absOutDir, gameRoot, archive);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
