import { GameEngine } from "./engine";
import { GameAudio } from "./audio";
import { SceneNode, SceneType } from "./types";
import { parseSpeaker } from "./speaker";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BG_PRELOAD_TIMEOUT = 1500;

/**
 * Кинематографичный рендерер: постоянный DOM-каркас строится один раз,
 * renderScene мутирует только контент. Переходы секвенятся вокруг
 * синхронного движка — сначала играем exit-анимации, затем зовём действие
 * движка (которое синхронно вызывает renderScene с enter-анимациями).
 */
export class GameRenderer {
  private root: HTMLElement;
  private engine: GameEngine | null = null;
  private audio: GameAudio | null = null;
  private backCallback: (() => void) | null = null;
  private topLabelProvider: (() => string) | null = null;
  // Возвращает URL эмбиент-подложки для текущей локации (mood-бед), либо undefined
  // → фолбэк на settings.bgmUrl. Локационная семантика живёт в main.ts/WorldState.
  private baseBedProvider: (() => string | undefined) | null = null;
  private mapAvailable = false;
  private onMapOpen: (() => void) | null = null;
  private busy = false;
  private mounted = false;

  // Ссылки на элементы каркаса.
  private stage!: HTMLElement;
  private bgA!: HTMLElement;
  private bgB!: HTMLElement;
  private activeBg: "a" | "b" = "a";
  private spritesEl!: HTMLElement;
  private topLabelEl!: HTMLElement;
  private backBtn!: HTMLButtonElement;
  private mapBtn!: HTMLButtonElement;
  private contentEl!: HTMLElement;
  private textEl!: HTMLElement;
  private choicesEl!: HTMLElement;
  private mapRoot!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  bind(engine: GameEngine): void {
    this.engine = engine;
  }

  bindAudio(audio: GameAudio): void {
    this.audio = audio;
  }

  onBack(callback: () => void): void {
    this.backCallback = callback;
    if (this.mounted) this.backBtn.hidden = !callback;
  }

  setTopLabel(provider: () => string): void {
    this.topLabelProvider = provider;
  }

  /** Провайдер эмбиент-подложки для текущей локации (см. baseBedProvider). */
  setBaseBedProvider(provider: () => string | undefined): void {
    this.baseBedProvider = provider;
  }

  setMap(available: boolean, onOpen: () => void): void {
    this.mapAvailable = available;
    this.onMapOpen = onOpen;
    if (this.mounted) this.mapBtn.hidden = !available;
  }

  getMapRoot(): HTMLElement {
    this.mount();
    return this.mapRoot;
  }

  /** Постоянный каркас. Идемпотентно; пересобирается, если DOM был очищен
   *  (например, после возврата на экран проекта). */
  mount(): void {
    if (this.mounted && this.stage?.isConnected) return;
    this.activeBg = "a";
    this.root.innerHTML = `
      <div class="stage" data-role="stage">
        <div class="stage-bg stage-bg--a is-active" data-role="bg-a"></div>
        <div class="stage-bg stage-bg--b" data-role="bg-b"></div>
        <div class="stage-sprites" data-role="sprites"></div>
        <div class="stage-scrim"></div>
        <div class="stage-topbar">
          <div class="topbar-left">
            <button class="topbar-back" data-role="back" hidden>← Проект</button>
            <div class="topbar-label" data-role="toplabel"></div>
          </div>
          <button class="map-btn" data-role="mapbtn" hidden>
            <span class="map-btn-ico">◈</span><span class="map-btn-text">Карта</span>
          </button>
        </div>
        <div class="stage-content" data-role="content">
          <div class="stage-text" data-role="text"></div>
          <div class="stage-choices" data-role="choices"></div>
        </div>
      </div>
      <div data-role="maproot"></div>`;

    const q = <T extends HTMLElement>(role: string) =>
      this.root.querySelector(`[data-role="${role}"]`) as T;

    this.stage = q("stage");
    this.bgA = q("bg-a");
    this.bgB = q("bg-b");
    this.spritesEl = q("sprites");
    this.topLabelEl = q("toplabel");
    this.backBtn = q("back");
    this.mapBtn = q("mapbtn");
    this.contentEl = q("content");
    this.textEl = q("text");
    this.choicesEl = q("choices");
    this.mapRoot = q("maproot");

    this.backBtn.hidden = !this.backCallback;
    this.mapBtn.hidden = !this.mapAvailable;

    this.backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.backCallback?.();
    });
    this.mapBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onMapOpen?.();
    });
    this.stage.addEventListener("click", () => {
      if (this.busy) return;
      if (this.engine?.getSceneType() === "narration" && !this.isEndNode()) {
        this.runAction(() => this.engine?.advance());
      }
    });

    this.mounted = true;
  }

  private isEndNode(): boolean {
    return this.engine ? this.engine.getConnectedOutputIds().size === 0 : true;
  }

  /**
   * Engine-колбэк: рендерит новую сцену (enter-фаза). Вызывается синхронно
   * из choose()/advance()/start().
   */
  renderScene(node: SceneNode, isEnd: boolean): void {
    this.mount();
    if (!this.engine) return;

    const settings = this.engine.getSettings();
    const sceneType: SceneType = node.data.sceneType ?? "dialogue";

    // Восстановить контент из leaving-состояния без анимации (свежие дети
    // проиграют enter сами).
    this.clearLeaving();

    this.topLabelEl.textContent = this.topLabelProvider?.() ?? "";
    this.swapBackground(node.data.image, settings.sceneFadeInMs);
    this.renderSprites(node);

    if (this.audio) {
      // Total target function: цель вычисляется на КАЖДОМ рендере — выход из
      // encounter-ветки в сцену без профиля автоматически возвращает базу
      // (или тишину при её отсутствии). Идемпотентность crossfadeTo по
      // targetUrl делает повторные вызовы бесплатными.
      // База = эмбиент текущей локации (mood-бед) с фолбэком на settings.bgmUrl;
      // encounter-audioProfile по-прежнему оверрайдит её по affection.
      const baseBed = this.baseBedProvider?.() ?? settings.bgmUrl;
      const target = this.audio.evaluateAudioState(
        this.engine.getState(),
        node.data.audioProfile,
        baseBed,
      );
      this.audio.crossfadeTo(target);

      if (node.data.sfxUrl) {
        this.audio.playSfx(node.data.sfxUrl);
      }
    }

    const connected = this.engine.getConnectedOutputIds();
    const activeOutputs = node.data.outputs.filter((o) => connected.has(o.id));

    if (isEnd || activeOutputs.length === 0) {
      this.renderEnd(settings.endFadeInMs);
      return;
    }

    if (sceneType === "narration") {
      this.renderNarration(node);
      return;
    }

    this.renderDialogue(node, sceneType, activeOutputs, settings.choiceAppearDelayMs);
  }

  private renderSprites(node: SceneNode): void {
    let html = "";
    if (node.data.sprites?.length) {
      html = node.data.sprites
        .map(
          (s) =>
            `<img class="stage-sprite stage-sprite--${s.position}" src="${escapeAttr(s.url)}" alt="" />`,
        )
        .join("");
    } else if (node.data.sprite) {
      html = `<img class="stage-sprite stage-sprite--center" src="${escapeAttr(node.data.sprite)}" alt="" />`;
    }
    this.spritesEl.innerHTML = html;
  }

  private renderDialogue(
    node: SceneNode,
    sceneType: SceneType,
    activeOutputs: SceneNode["data"]["outputs"],
    delayMs: number,
  ): void {
    const { speaker, text } = parseSpeaker(node.data.label, sceneType);
    const speakerHtml = speaker
      ? `<div class="scene-speaker">${escapeHtml(speaker)}</div>`
      : "";
    this.textEl.innerHTML = `${speakerHtml}<div class="scene-text">${escapeHtml(text)}</div>`;

    this.choicesEl.className = "stage-choices";
    this.choicesEl.innerHTML = activeOutputs
      .map(
        (o, i) =>
          `<button class="choice-btn" data-output-id="${escapeAttr(o.id)}" style="animation-delay:${i * delayMs}ms">${escapeHtml(o.text)}</button>`,
      )
      .join("");

    this.choicesEl.querySelectorAll<HTMLButtonElement>(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.busy) return;
        const outputId = btn.dataset.outputId!;
        this.runAction(() => this.engine?.choose(outputId), this.pressAnimation(btn));
      });
    });
  }

  private renderNarration(node: SceneNode): void {
    const { text } = parseSpeaker(node.data.label, "narration");
    this.textEl.innerHTML = `<div class="scene-text scene-text--narration">${escapeHtml(text)}</div>`;
    this.choicesEl.className = "stage-choices";
    this.choicesEl.innerHTML = `<div class="advance-hint">…</div>`;
  }

  private renderEnd(fadeMs: number): void {
    this.textEl.innerHTML = "";
    this.choicesEl.className = "stage-choices stage-choices--end";
    this.choicesEl.innerHTML = `
      <div class="scene-end" style="animation:contentIn ${fadeMs}ms ease both">
        <p>Конец</p>
        <button class="restart-btn" data-role="restart">Начать сначала</button>
      </div>`;
    this.choicesEl
      .querySelector('[data-role="restart"]')!
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.engine?.start();
      });
  }

  /**
   * Оркестрация перехода: exit-анимации → действие движка (синхронный
   * renderScene с enter). pressAnim — предварительная анимация нажатия выбора.
   */
  async runAction(action: () => void, pressAnim?: Promise<void>): Promise<void> {
    if (this.busy || !this.engine) return;
    this.busy = true;

    const before = this.engine.getCurrentNode();
    const fadeOut = this.engine.getSettings().sceneFadeOutMs;

    if (pressAnim) await pressAnim;
    await this.exitContent(fadeOut);

    action();

    // Если choose() оказался no-op (нет ребра) — renderScene не вызвался,
    // контент остался в leaving. Восстанавливаем.
    if (this.engine.getCurrentNode() === before) {
      this.clearLeaving(true);
    }
    this.busy = false;
  }

  private pressAnimation(btn: HTMLElement): Promise<void> {
    btn.classList.add("is-pressed");
    this.choicesEl.querySelectorAll(".choice-btn").forEach((sib) => {
      if (sib !== btn) sib.classList.add("is-dimmed");
    });
    return wait(200);
  }

  private async exitContent(fadeOutMs: number): Promise<void> {
    this.contentEl.style.setProperty("--fade-out", `${fadeOutMs}ms`);
    this.spritesEl.style.setProperty("--fade-out", `${fadeOutMs}ms`);
    this.contentEl.classList.add("is-leaving");
    this.spritesEl.classList.add("is-leaving");
    await wait(fadeOutMs);
  }

  private clearLeaving(animated = false): void {
    for (const el of [this.contentEl, this.spritesEl]) {
      if (!animated) {
        el.style.transition = "none";
        el.classList.remove("is-leaving");
        void el.offsetWidth;
        el.style.transition = "";
      } else {
        el.classList.remove("is-leaving");
      }
    }
  }

  private swapBackground(url: string, fadeMs: number): void {
    const incoming = this.activeBg === "a" ? this.bgB : this.bgA;
    const outgoing = this.activeBg === "a" ? this.bgA : this.bgB;

    const apply = () => {
      incoming.style.transitionDuration = `${fadeMs}ms`;
      outgoing.style.transitionDuration = `${fadeMs}ms`;
      incoming.style.backgroundImage = url ? `url("${cssUrl(url)}")` : "";
      incoming.classList.add("is-active");
      outgoing.classList.remove("is-active");
      this.activeBg = this.activeBg === "a" ? "b" : "a";
    };

    if (!url) {
      apply();
      return;
    }

    const img = new Image();
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      apply();
    };
    img.onload = go;
    img.onerror = go;
    img.src = url;
    setTimeout(go, BG_PRELOAD_TIMEOUT);
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function cssUrl(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
