import { GameEngine } from "./engine";
import { GameRenderer } from "./renderer";
import { WorldState } from "./worldState";
import { WorldMap } from "./map";
import { GameAudio } from "./audio";
import {
  ResolvedProject,
  ProjectFile,
  ProjectSettings,
  SceneGraph,
  DEFAULT_SETTINGS,
} from "./types";
import "./style.css";

declare const __GU_PROJECT__: ResolvedProject | undefined;

const app = document.getElementById("app")!;
const renderer = new GameRenderer(app);

let currentProject: ResolvedProject | null = null;

if (typeof __GU_PROJECT__ !== "undefined") {
  launchGame(__GU_PROJECT__);
} else {
  showStartScreen();
}

// ── Стартовый экран ──

function showStartScreen(): void {
  app.innerHTML = `
    <div class="load-screen">
      <h1>Движок новелл</h1>
      <div class="load-actions">
        <button class="load-btn" id="open-btn">Открыть проект</button>
        <button class="load-btn load-btn--secondary" id="new-btn">Новый проект</button>
      </div>
      <input type="file" id="file-input" accept=".json,.gu.json" hidden />
    </div>
  `;

  const openBtn = document.getElementById("open-btn")!;
  const newBtn = document.getElementById("new-btn")!;
  const input = document.getElementById("file-input") as HTMLInputElement;

  openBtn.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const projectFile: ProjectFile = JSON.parse(text);
      currentProject = {
        title: projectFile.title ?? "Новелла",
        scenes: { nodes: [], edges: [] },
        projectFile: file.name,
        settings: { ...DEFAULT_SETTINGS, ...projectFile.settings },
      };
      showProjectScreen();
    } catch (e) {
      alert(`Ошибка чтения файла: ${(e as Error).message}`);
    }
  });

  newBtn.addEventListener("click", () => {
    currentProject = {
      title: "Новая новелла",
      scenes: { nodes: [], edges: [] },
      settings: { ...DEFAULT_SETTINGS },
    };
    showProjectScreen();
  });
}

// ── Экран проекта ──

function showProjectScreen(): void {
  if (!currentProject) return;

  const p = currentProject;
  const hasScenes = p.scenes.nodes.length > 0;
  const scenesStatus = hasScenes
    ? `${p.scenes.nodes.length} сцен, ${p.scenes.edges.length} связей`
    : "Сцены не загружены";

  app.innerHTML = `
    <div class="project-screen">
      <div class="project-header">
        <input class="project-title-input" id="title-input" value="${escapeAttr(p.title)}" />
      </div>

      <div class="project-section">
        <h2>Сцены</h2>
        <p class="project-status">${scenesStatus}</p>
        <button class="load-btn" id="load-scenes-btn">Загрузить scenes.json</button>
        <input type="file" id="scenes-input" accept=".json" hidden />
      </div>

      <div class="project-section">
        <h2>Настройки</h2>
        <div class="settings-grid">
          ${settingRow("sceneFadeInMs", "Появление сцены (мс)", p.settings.sceneFadeInMs)}
          ${settingRow("sceneFadeOutMs", "Затухание сцены (мс)", p.settings.sceneFadeOutMs)}
          ${settingRow("choiceAppearDelayMs", "Задержка между вариантами (мс)", p.settings.choiceAppearDelayMs)}
          ${settingRow("endFadeInMs", "Появление конца (мс)", p.settings.endFadeInMs)}
        </div>
      </div>

      <div class="project-actions">
        <button class="load-btn" id="play-btn" ${hasScenes ? "" : "disabled"}>Играть</button>
        <button class="load-btn load-btn--secondary" id="save-btn">Сохранить проект</button>
        <button class="load-btn load-btn--secondary" id="back-btn">Назад</button>
      </div>
    </div>
  `;

  document.getElementById("title-input")!.addEventListener("input", (e) => {
    p.title = (e.target as HTMLInputElement).value;
  });

  const loadScenesBtn = document.getElementById("load-scenes-btn")!;
  const scenesInput = document.getElementById("scenes-input") as HTMLInputElement;
  loadScenesBtn.addEventListener("click", () => scenesInput.click());
  scenesInput.addEventListener("change", async () => {
    const file = scenesInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      p.scenes = JSON.parse(text) as SceneGraph;
      p.scenesFile = file.name;
      showProjectScreen();
    } catch (e) {
      alert(`Ошибка: ${(e as Error).message}`);
    }
  });

  document.querySelectorAll<HTMLInputElement>(".setting-input").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.key as keyof ProjectSettings;
      const val = parseInt(input.value, 10);
      if (!isNaN(val) && val >= 0) {
        (p.settings as unknown as Record<string, number>)[key] = val;
      }
    });
  });

  document.getElementById("play-btn")!.addEventListener("click", () => {
    if (hasScenes) launchGame(p);
  });

  document.getElementById("save-btn")!.addEventListener("click", () => {
    const projectFile: ProjectFile = {
      title: p.title,
      scenes: "./scenes.json",
      settings: p.settings,
    };
    downloadJson(`${slugify(p.title)}.gu.json`, projectFile);
    if (hasScenes) {
      downloadJson("scenes.json", p.scenes);
    }
  });

  document.getElementById("back-btn")!.addEventListener("click", showStartScreen);
}

function settingRow(key: string, label: string, value: number): string {
  return `
    <label class="setting-row">
      <span class="setting-label">${label}</span>
      <input class="setting-input" type="number" min="0" step="50" data-key="${key}" value="${value}" />
    </label>
  `;
}

// ── Игра ──

function collectAudioUrlsForPreload(project: ResolvedProject): string[] {
  const urls: string[] = [];
  if (project.settings.bgmUrl) urls.push(project.settings.bgmUrl);
  for (const node of project.scenes.nodes) {
    const p = node.data.audioProfile;
    if (p?.positiveUrl) urls.push(p.positiveUrl);
    if (p?.negativeUrl) urls.push(p.negativeUrl);
    if (node.data.sfxUrl) urls.push(node.data.sfxUrl);
  }
  return urls;
}

function launchGame(project: ResolvedProject): void {
  document.title = project.title;

  const audio = new GameAudio({
    bgmVolume: project.settings.bgmVolume ?? 0.3,
    sfxVolume: project.settings.sfxVolume ?? 0.5,
    crossfadeDurationMs: project.settings.crossfadeDurationMs ?? 2000,
  });
  audio.preload(collectAudioUrlsForPreload(project)).catch(() => {});

  const manifest = project.settings.world;
  const worldState =
    manifest && manifest.locations.length > 0
      ? new WorldState(manifest, project.scenes)
      : null;

  const engine = new GameEngine(project.scenes, project.settings, (node, isEnd) => {
    worldState?.onScene(node);
    renderer.renderScene(node, isEnd);
  });
  engine.setProjectMeta(project.title, project.projectFile, project.scenesFile);
  renderer.bind(engine);
  renderer.bindAudio(audio);
  renderer.mount();

  renderer.setTopLabel(() => {
    const cur = worldState?.getCurrent();
    return cur ? worldState!.nameOf(cur) : project.title;
  });

  if (worldState) {
    const map = new WorldMap(renderer.getMapRoot(), worldState, (loc) => {
      const outId = worldState.travelOutputId(loc);
      if (!outId) return;
      worldState.setPending(loc);
      renderer.runAction(() => engine.choose(outId));
    });
    renderer.setMap(true, () => map.open(worldState.canTravel(engine.getCurrentNode())));
  } else {
    renderer.setMap(false, () => {});
  }

  renderer.onBack(() => {
    audio.dispose();
    document.title = "Движок новелл";
    showProjectScreen();
  });

  engine.start();
}

// ── Утилиты ──

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "project";
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
