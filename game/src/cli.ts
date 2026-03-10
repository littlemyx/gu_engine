import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve, dirname, relative, basename, extname, join } from "node:path";
import { build, type Plugin } from "vite";
import { zipSync, Zippable } from "fflate";
import { ProjectFile, SceneGraph, ResolvedProject, DEFAULT_SETTINGS } from "./types";

/** Collect all image URLs from scene nodes */
function collectImageUrls(scenes: SceneGraph): string[] {
  const urls: string[] = [];
  for (const node of scenes.nodes) {
    if (node.data.image) {
      urls.push(node.data.image);
    }
  }
  return [...new Set(urls)];
}

/** Download a URL to a local file. Returns true on success. */
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
 * Download all assets to assetsDir, return a mapping from original URL to relative path.
 */
async function downloadAssets(
  urls: string[],
  assetsDir: string,
): Promise<Map<string, string>> {
  mkdirSync(assetsDir, { recursive: true });
  const mapping = new Map<string, string>();
  const usedNames = new Set<string>();

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
    }
  }

  return mapping;
}

/** Replace image URLs in project scenes according to the mapping */
function rewriteImageUrls(
  project: ResolvedProject,
  mapping: Map<string, string>,
): ResolvedProject {
  return {
    ...project,
    scenes: {
      ...project.scenes,
      nodes: project.scenes.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          image: mapping.get(node.data.image) ?? node.data.image,
        },
      })),
    },
  };
}

/** Recursively collect all files in a directory into a fflate-compatible structure */
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

function injectProjectPlugin(project: ResolvedProject): Plugin {
  return {
    name: "gu-inject-project",
    config() {
      return {
        define: {
          __GU_PROJECT__: JSON.stringify(project),
        },
      };
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const filteredArgs = args.filter((a) => a !== "--archive");
  const archive = args.includes("--archive");
  const projectPath = filteredArgs[0];
  const outDir = filteredArgs.find((_, i) => filteredArgs[i - 1] === "--out") ?? "dist";

  if (!projectPath) {
    console.error("Использование: gu-build <project.gu.json | scenes.json> [--out <dir>] [--archive]");
    process.exit(1);
  }

  const absProjectPath = resolve(process.cwd(), projectPath);
  if (!existsSync(absProjectPath)) {
    console.error(`Файл проекта не найден: ${absProjectPath}`);
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

  const projectDir = dirname(absProjectPath);
  const raw = JSON.parse(readFileSync(absProjectPath, "utf-8"));

  let project: ResolvedProject;

  if (raw.nodes && raw.edges) {
    // Прямой scenes JSON (экспорт из редактора)
    project = {
      title: "Новелла",
      scenes: raw as SceneGraph,
      settings: { ...DEFAULT_SETTINGS },
    };
  } else {
    // ProjectFile (.gu.json)
    const projectFile = raw as ProjectFile;
    const scenesPath = resolve(projectDir, projectFile.scenes);
    if (!existsSync(scenesPath)) {
      console.error(`Файл сцен не найден: ${scenesPath}`);
      process.exit(1);
    }
    const scenes: SceneGraph = JSON.parse(readFileSync(scenesPath, "utf-8"));
    project = {
      title: projectFile.title ?? "Новелла",
      scenes,
      settings: { ...DEFAULT_SETTINGS, ...projectFile.settings },
    };
  }

  console.log(`Сборка: "${project.title}"`);
  console.log(`Сцен: ${project.scenes.nodes.length}, связей: ${project.scenes.edges.length}`);

  // Download assets and rewrite image URLs to relative paths
  const imageUrls = collectImageUrls(project.scenes);
  let buildProject = project;

  if (imageUrls.length > 0) {
    console.log(`\nСкачивание ассетов (${imageUrls.length})...`);
    const assetsDir = resolve(absOutDir, "assets");
    const mapping = await downloadAssets(imageUrls, assetsDir);
    console.log(`Скачано: ${mapping.size}/${imageUrls.length}`);
    buildProject = rewriteImageUrls(project, mapping);
  }

  await build({
    root: gameRoot,
    plugins: [injectProjectPlugin(buildProject)],
    build: {
      outDir: absOutDir,
      emptyOutDir: false, // preserve downloaded assets
    },
    logLevel: "info",
  });

  if (archive) {
    const title = buildProject.title.replace(/[^a-zа-яё0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "project";
    const archivePath = resolve(dirname(absOutDir), `${title}.gu`);
    console.log(`\nУпаковка в архив: ${archivePath}`);
    packArchive(absOutDir, archivePath);
    rmSync(absOutDir, { recursive: true });
    console.log(`Готово! Архив: ${archivePath}`);
  } else {
    console.log(`\nГотово! Файлы в: ${absOutDir}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
