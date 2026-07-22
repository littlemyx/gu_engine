import { GameRenderer } from "./renderer";
import { CalendarState } from "./calendarState";
import { WorldMap } from "./map";
import { GameAudio } from "./audio";
import { StoryletHost } from "./storyletHost";
import { StoryletWorld } from "./storyletWorld";
import { hasSave, loadGame, saveGame, clearGame } from "./save";
import {
  STORY_BUNDLE_FORMAT_VERSION,
  validateStoryBundle,
  type StoryBundleV2,
} from "gu-engine-story-core";
import "./style.css";

declare const __GU_PROJECT__: StoryBundleV2 | undefined;

/** Бандл v2 — единственный формат, который понимает движок. */
function isStoryBundle(v: unknown): v is StoryBundleV2 {
  return Boolean(v) && (v as StoryBundleV2).formatVersion === STORY_BUNDLE_FORMAT_VERSION;
}

const app = document.getElementById("app")!;
const renderer = new GameRenderer(app);

// ?bundle=<url> — открыть бандл сразу, без диалога выбора файла. Нужно, чтобы
// прогонять историю из фикстуры в дев-сервере и в автотестах.
const bundleParam = new URLSearchParams(location.search).get("bundle");

if (typeof __GU_PROJECT__ !== "undefined") {
  launchStorylet(__GU_PROJECT__);
} else if (bundleParam) {
  fetch(bundleParam)
    .then((r) => r.json())
    .then((data) => {
      if (!isStoryBundle(data)) throw new Error("это не бандл v2");
      launchStorylet(data);
    })
    .catch((e) => {
      app.innerHTML = `<div class="load-screen"><h1>Не удалось открыть бандл</h1><p>${String(e)}</p></div>`;
    });
} else {
  showStartScreen();
}

// ── Стартовый экран ──

function showStartScreen(): void {
  app.innerHTML = `
    <div class="load-screen">
      <h1>Движок новелл</h1>
      <p class="load-hint">Откройте storylet-бандл — файл .gu.json из плейграунда.</p>
      <div class="load-actions">
        <button class="load-btn" id="open-btn">Открыть историю</button>
      </div>
      <input type="file" id="file-input" accept=".json,.gu.json" hidden />
    </div>
  `;

  const input = document.getElementById("file-input") as HTMLInputElement;
  document.getElementById("open-btn")!.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isStoryBundle(parsed)) {
        alert(
          "Это не storylet-бандл. Движок читает только формат v2 — " +
            "нажмите «Скачать storylet-бандл (v2)» в плейграунде.",
        );
        return;
      }
      // Бандл самодостаточен: ни scenes.json, ни экрана проекта не нужно.
      const issues = validateStoryBundle(parsed).filter((i) => i.severity === "error");
      if (issues.length > 0) {
        alert(`Бандл не прошёл проверку:\n${issues.map((i) => `• ${i.message}`).join("\n")}`);
        return;
      }
      launchStorylet(parsed);
    } catch (e) {
      alert(`Ошибка чтения файла: ${(e as Error).message}`);
    }
  });
}

// ── Игра на storylet-пуле (формат v2) ──

function collectBundleAudioUrls(bundle: StoryBundleV2): string[] {
  const urls: string[] = [];
  if (bundle.audio.bgmUrl) urls.push(bundle.audio.bgmUrl);
  for (const url of Object.values(bundle.audio.ambientByMood ?? {})) urls.push(url);
  for (const url of Object.values(bundle.audio.ambientBySpecial ?? {})) urls.push(url);
  for (const unit of bundle.units) {
    if (unit.audioProfile?.positiveUrl) urls.push(unit.audioProfile.positiveUrl);
    if (unit.audioProfile?.negativeUrl) urls.push(unit.audioProfile.negativeUrl);
    if (unit.sfxUrl) urls.push(unit.sfxUrl);
  }
  return urls;
}

function launchStorylet(bundle: StoryBundleV2): void {
  document.title = bundle.title;

  const debug = new URLSearchParams(location.search).has("gudebug");

  const audio = new GameAudio({
    bgmVolume: bundle.audio.bgmVolume ?? 0.3,
    sfxVolume: bundle.audio.sfxVolume ?? 0.5,
    crossfadeDurationMs: bundle.audio.crossfadeDurationMs ?? 2000,
  });
  audio.preload(collectBundleAudioUrls(bundle)).catch(() => {});

  const host = new StoryletHost(bundle);
  const world = new StoryletWorld(host.director);

  // HUD календаря читает обе стрелки прямо у режиссёра: переменных-путей,
  // из которых их приходилось выковыривать, больше нет.
  const calendarState = new CalendarState(
    {
      slotCount: bundle.calendar.slotCount,
      dayparts: bundle.calendar.dayparts,
      actBoundaries: bundle.calendar.actBoundaries,
      phasesPerSlot: bundle.calendar.phasesPerSlot,
    },
    () => host.director.slot,
    () => host.director.phase,
  );

  host.bindSceneChange((h) => {
    world.sync();
    calendarState.onScene();
    if (debug) {
      const sel = h.director.lastSelection;
      // eslint-disable-next-line no-console
      console.log("[gu]", {
        slot: h.director.slot,
        phase: h.director.phase,
        location: h.director.location,
        fired: h.director.slice.fired.map((f) => f.eventId),
        flags: [...h.director.slice.flags],
        selection: sel && {
          picked: sel.picked,
          draw: sel.draw,
          candidates: sel.candidates.map((c) => ({ id: c.unit.id, score: +c.score.toFixed(3), terms: c.terms })),
        },
      });
    }
    renderer.renderScene(h.getCurrentNode()!, h.isEnd());
  });

  host.bindPersist(() => saveGame(bundle.title, host.snapshot()));

  renderer.bind(host);
  renderer.bindAudio(audio);
  renderer.mount();

  renderer.setTopLabel(() => `${world.nameOf(host.director.location)} · ${calendarState.label()}`);

  const map = new WorldMap(renderer.getMapRoot(), world, (loc) => {
    renderer.runAction(() => host.choose(`move:${loc}`));
  });
  renderer.setMap(true, () =>
    // Ходить можно только из хаба: посреди сцены карта смотрится, но не водит.
    map.open((host.getCurrentNode()?.id ?? "").startsWith("hub_")),
  );

  renderer.onBack(() => {
    audio.dispose();
    document.title = "Движок новелл";
    showStartScreen();
  });

  const ambientByMood = bundle.audio.ambientByMood ?? {};
  const ambientBySpecial = bundle.audio.ambientBySpecial ?? {};
  renderer.setBaseBedProvider(() => {
    const loc = host.director.locationOf(host.director.location);
    if (!loc) return undefined;
    if (loc.specialKind && ambientBySpecial[loc.specialKind]) return ambientBySpecial[loc.specialKind];
    return loc.mood ? ambientByMood[loc.mood] : undefined;
  });

  // Выбор «продолжить/заново» — обычный экран, а не нативный confirm():
  // тот блокирует страницу целиком (вместе со скриншотами и автотестами)
  // и не стилизуется.
  const saved = loadGame(bundle.title);
  if (!saved) {
    host.start();
    return;
  }
  app.innerHTML = `
    <div class="load-screen">
      <h1>${bundle.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h1>
      <p class="load-hint">Есть сохранённое прохождение.</p>
      <div class="load-actions">
        <button class="load-btn" id="continue-btn">Продолжить</button>
        <button class="load-btn load-btn--secondary" id="restart-btn">Начать заново</button>
      </div>
    </div>
  `;
  document.getElementById("continue-btn")!.addEventListener("click", () => {
    renderer.mount();
    host.restore(saved);
  });
  document.getElementById("restart-btn")!.addEventListener("click", () => {
    clearGame(bundle.title);
    renderer.mount();
    host.start();
  });
}
