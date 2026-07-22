import {
  StoryletDirector,
  type ActiveTalk,
  type CompiledBeat,
  type CompiledEnding,
  type DirectorSnapshot,
  type RenderedLine,
  type StoryBundleV2,
} from "gu-engine-story-core";
import { SceneHost } from "./sceneHost";
import { ProjectSettings, SceneNode, SceneOutput, SceneType } from "./types";

/**
 * Storylet-рантайм: превращает решения режиссёра в кадры для рендерера.
 *
 * Графа сцен здесь нет вообще. Хаб, разговор, якорь, концовка — не узлы, а
 * СОСТОЯНИЯ этого объекта; каждое умеет описать себя как кадр (SceneNode
 * остался чистой view-моделью) и обработать выбор игрока.
 *
 * Порядок «вошёл в локацию → созревший бит или хаб» повторяет прежний
 * enter-роутер, но проверкой в момент входа, а не заранее проведёнными рёбрами.
 */

type Mode =
  | { kind: "intro" }
  | { kind: "beat"; beat: CompiledBeat }
  | { kind: "hub" }
  | { kind: "talk"; talk: ActiveTalk }
  | { kind: "farewell"; lines: RenderedLine[] }
  | { kind: "continuation"; unitId: string; liName: string; farewell: RenderedLine[] | null }
  | { kind: "anchor"; narration: string }
  | { kind: "ending"; ending: CompiledEnding; index: number };

const OUT_ADVANCE = "__advance";
const OUT_CONTINUE = "__continue";
const OUT_FAREWELL = "__farewell";

export class StoryletHost implements SceneHost {
  readonly director: StoryletDirector;
  private readonly bundle: StoryBundleV2;
  private mode: Mode = { kind: "intro" };
  private node: SceneNode | null = null;
  private onSceneChange: ((host: StoryletHost) => void) | null = null;
  private onPersist: (() => void) | null = null;

  constructor(bundle: StoryBundleV2, opts: { seed?: number } = {}) {
    this.bundle = bundle;
    this.director = new StoryletDirector(bundle, opts);
  }

  bindSceneChange(cb: (host: StoryletHost) => void): void {
    this.onSceneChange = cb;
  }

  /** Вызывается в местах, где сейв безопасен (хаб). */
  bindPersist(cb: () => void): void {
    this.onPersist = cb;
  }

  // ── SceneHost ───────────────────────────────────────────────────────────

  getSettings(): ProjectSettings {
    const b = this.bundle;
    return {
      ...b.settings,
      world: {
        locations: b.world.locations.map((l) => ({
          id: l.id,
          name: l.name,
          mood: l.mood,
          specialKind: l.specialKind,
        })),
        edges: b.world.edges,
      },
      calendar: {
        slotCount: b.calendar.slotCount,
        dayparts: b.calendar.dayparts,
        actBoundaries: b.calendar.actBoundaries,
        phasesPerSlot: b.calendar.phasesPerSlot,
      },
      ...b.audio,
    };
  }

  getSceneType(): SceneType {
    return this.node?.data.sceneType ?? "dialogue";
  }

  getCurrentNode(): SceneNode | null {
    return this.node;
  }

  getConnectedOutputIds(): Set<string> {
    return new Set((this.node?.data.outputs ?? []).map((o) => o.id));
  }

  /**
   * Плоское состояние для аудио: у отношений в ядре структура, а банк
   * профилей исторически адресуется путём relationship[<li>].affection.
   */
  getState(): Readonly<Record<string, number>> {
    const flat: Record<string, number> = {
      slot: this.director.slot,
      phase: this.director.phase,
    };
    for (const [li, rel] of Object.entries(this.director.slice.relationships)) {
      flat[`relationship[${li}].affection`] = rel.affection;
      flat[`relationship[${li}].trust`] = rel.trust;
      flat[`relationship[${li}].tension`] = rel.tension;
    }
    return flat;
  }

  start(): void {
    // Полный сброс, а не только режим: start() зовёт и первый запуск, и
    // «Начать сначала» с экрана конца. Без сброса режиссёра прошлое
    // прохождение оставалось в состоянии (fired-лог, слот у потолка), интро
    // играло — а первый же вход в локацию видел shouldEnd() и снова
    // показывал «Конец».
    this.director.reset();
    this.mode = { kind: "intro" };
    this.render();
  }

  /** Продолжение нарративной сцены по клику. */
  advance(): void {
    const outputs = this.node?.data.outputs ?? [];
    if (outputs.length > 0) this.choose(outputs[0].id);
  }

  choose(outputId: string): void {
    switch (this.mode.kind) {
      case "intro":
        this.enterLocation();
        return;

      case "beat": {
        const beat = this.mode.beat;
        // Развилка: id выхода — id исхода; у обычного бита выход один.
        const outcomeId = beat.outcomes?.some((o) => o.id === outputId) ? outputId : undefined;
        this.director.completeBeat(beat.id, outcomeId);
        if (beat.kind === "finale") {
          this.showEnding();
          return;
        }
        this.toHub();
        return;
      }

      case "hub": {
        this.handleHubChoice(outputId);
        return;
      }

      case "talk": {
        const node = this.director.currentNode();
        if (node && node.choices.length === 0) {
          this.closeTalk();
          return;
        }
        const next = this.director.choose(outputId);
        if (!next) {
          this.closeTalk();
          return;
        }
        this.mode = { kind: "talk", talk: { ...this.mode.talk, node: next } };
        this.render();
        return;
      }

      case "continuation": {
        if (outputId === OUT_CONTINUE) {
          const talk = this.director.startTalk(this.mode.unitId);
          if (!talk) {
            this.enterLocation();
            return;
          }
          this.mode = { kind: "talk", talk };
          this.render();
          return;
        }
        // Попрощаться: прощальная проза звучит только здесь — при реальном уходе.
        const farewell = this.mode.farewell;
        if (farewell && farewell.length > 0) {
          this.mode = { kind: "farewell", lines: farewell };
          this.render();
          return;
        }
        this.enterLocation();
        return;
      }

      case "farewell":
        this.enterLocation();
        return;

      case "anchor":
        this.enterLocation();
        return;

      case "ending": {
        const next = this.mode.index + 1;
        if (next < this.mode.ending.scenes.length) {
          this.mode = { kind: "ending", ending: this.mode.ending, index: next };
          this.render();
        }
        return;
      }
    }
  }

  // ── Переходы ────────────────────────────────────────────────────────────

  /** Вход в локацию: созревший бит либо хаб. Прежний enter-роутер. */
  private enterLocation(): void {
    const beat = this.director.maturedBeat();
    // shouldEnd — гарантия анти-софтлока: финал сыгран ЛИБО календарь
    // исчерпан и финалу уже не выстрелить (игрок проспал цепочку битов).
    // Созревший бит здесь и сейчас важнее: пусть последняя сцена сыграет.
    if (!beat && this.director.shouldEnd()) {
      this.showEnding();
      return;
    }
    if (beat) {
      this.mode = { kind: "beat", beat };
      this.render();
      return;
    }
    this.toHub();
  }

  private toHub(): void {
    this.mode = { kind: "hub" };
    this.render();
    this.onPersist?.();
  }

  private handleHubChoice(outputId: string): void {
    const actions = this.director.hubActions();

    const talkAction = actions.talks.find((t) => `talk:${t.unitId}` === outputId);
    if (talkAction) {
      const talk = this.director.startTalk(talkAction.unitId);
      if (talk) {
        this.mode = { kind: "talk", talk };
        this.render();
      }
      return;
    }

    const move = actions.moves.find((m) => `move:${m.locationId}` === outputId);
    if (move) {
      this.director.moveTo(move.locationId);
      this.enterLocation();
      return;
    }

    if (outputId.startsWith("anchor:")) {
      const { narration } = this.director.anchorAdvance();
      this.mode = { kind: "anchor", narration };
      this.render();
      return;
    }
  }

  private closeTalk(): void {
    const close = this.director.closeTalk();
    if (close.continuation) {
      this.mode = {
        kind: "continuation",
        unitId: close.continuation.unitId,
        liName: close.continuation.liName,
        farewell: close.farewell,
      };
      this.render();
      return;
    }
    // Без продолжения закрытие сцены и есть уход: прощальная реплика уже
    // прозвучала в теле, отдельной сцены не нужно.
    this.enterLocation();
  }

  private showEnding(): void {
    const ending = this.director.checkEnding();
    if (!ending) {
      this.mode = { kind: "anchor", narration: "История обрывается." };
      this.render();
      return;
    }
    this.mode = { kind: "ending", ending, index: 0 };
    this.render();
  }

  // ── Кадры ───────────────────────────────────────────────────────────────

  private render(): void {
    this.node = this.buildNode();
    this.onSceneChange?.(this);
  }

  private buildNode(): SceneNode {
    const scene = (
      id: string,
      label: string,
      image: string,
      outputs: SceneOutput[],
      sceneType: SceneType,
      extra: Partial<SceneNode["data"]> = {},
    ): SceneNode => ({
      id,
      type: "scene",
      position: { x: 0, y: 0 },
      data: { label, image, outputs, sceneType, ...extra },
    });

    const bgOf = (locId: string) => this.director.locationOf(locId)?.background ?? "";

    switch (this.mode.kind) {
      case "intro":
        return scene("intro", this.bundle.intro.text, this.bundle.intro.background, [{ id: OUT_ADVANCE, text: "" }], "narration");

      case "beat": {
        const beat = this.mode.beat;
        const outputs: SceneOutput[] =
          beat.outcomes && beat.outcomes.length > 0
            ? beat.outcomes.map((o) => ({ id: o.id, text: o.label }))
            : [{ id: OUT_ADVANCE, text: "" }];
        return scene(beat.id, beat.text, beat.background, outputs, outputs.length > 1 ? "branch" : "narration");
      }

      case "hub": {
        const actions = this.director.hubActions();
        const outputs: SceneOutput[] = [
          ...actions.talks.map((t) => ({ id: `talk:${t.unitId}`, text: t.label })),
          ...actions.moves.map((m) => ({ id: `move:${m.locationId}`, text: m.label })),
          ...(actions.anchor ? [{ id: `anchor:${actions.anchor.daypartIndex}`, text: actions.anchor.label }] : []),
        ];
        return scene(
          `hub_${this.director.location}`,
          actions.location?.description ?? actions.location?.name ?? "",
          bgOf(this.director.location),
          outputs,
          "branch",
        );
      }

      case "talk": {
        const { unit, node } = this.mode.talk;
        const outputs: SceneOutput[] =
          node.choices.length > 0
            ? node.choices.map((c) => ({ id: c.id, text: c.text }))
            : [{ id: OUT_ADVANCE, text: "" }];
        return scene(
          `${unit.id}_${node.id}`,
          node.lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n"),
          bgOf(unit.at.locationId),
          outputs,
          node.choices.length > 0 ? "dialogue" : "narration",
          {
            lines: node.lines,
            sprites: node.lines[0]?.sprites,
            audioProfile: unit.audioProfile,
            sfxUrl: unit.sfxUrl,
          },
        );
      }

      case "farewell":
        return scene(
          "farewell",
          this.mode.lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n"),
          bgOf(this.director.location),
          [{ id: OUT_ADVANCE, text: "" }],
          "narration",
          { lines: this.mode.lines },
        );

      case "continuation":
        return scene(
          "continuation",
          `${this.mode.liName} не спешит уходить. Разговор ещё не окончен.`,
          bgOf(this.director.location),
          [
            { id: OUT_CONTINUE, text: "Продолжить разговор" },
            { id: OUT_FAREWELL, text: "Попрощаться" },
          ],
          "branch",
        );

      case "anchor":
        return scene("anchor", this.mode.narration, bgOf(this.director.location), [{ id: OUT_ADVANCE, text: "" }], "narration");

      case "ending": {
        const { ending, index } = this.mode;
        const isLast = index >= ending.scenes.length - 1;
        return scene(
          `${ending.id}_${index}`,
          ending.scenes[index]?.text ?? "",
          ending.background,
          isLast ? [] : [{ id: OUT_ADVANCE, text: "" }],
          "narration",
        );
      }
    }
  }

  /** Финальный кадр: рендерер показывает экран конца. */
  isEnd(): boolean {
    return this.mode.kind === "ending" && (this.node?.data.outputs.length ?? 0) === 0;
  }

  // ── Сейв ────────────────────────────────────────────────────────────────

  snapshot(): DirectorSnapshot {
    return this.director.snapshot();
  }

  /** Восстановление продолжает игру с хаба: сцены не рвутся посередине. */
  restore(snap: DirectorSnapshot): void {
    this.director.restore(snap);
    this.enterLocation();
  }
}
