import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { build, type Plugin } from "vite";
import { ProjectFile, SceneGraph, ResolvedProject, DEFAULT_SETTINGS } from "./types";

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
  const projectPath = args[0];
  const outDir = args.find((_, i) => args[i - 1] === "--out") ?? "dist";

  if (!projectPath) {
    console.error("Использование: gu-build <project.gu.json | scenes.json> [--out <dir>]");
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

  await build({
    root: gameRoot,
    plugins: [injectProjectPlugin(project)],
    build: {
      outDir: absOutDir,
      emptyOutDir: true,
    },
    logLevel: "info",
  });

  console.log(`\nГотово! Файлы в: ${absOutDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
