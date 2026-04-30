import { GameEngine } from "./engine";
import { SceneNode } from "./types";

export class GameRenderer {
  private root: HTMLElement;
  private engine: GameEngine | null = null;
  private backCallback: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  bind(engine: GameEngine): void {
    this.engine = engine;
  }

  onBack(callback: () => void): void {
    this.backCallback = callback;
  }

  renderScene(node: SceneNode, isEnd: boolean): void {
    if (!this.engine) return;

    const connectedOutputs = this.engine.getConnectedOutputIds();
    const activeOutputs = node.data.outputs.filter((o) =>
      connectedOutputs.has(o.id),
    );

    const settings = this.engine.getSettings();

    const imageHtml = node.data.image
      ? `<img class="scene-image" src="${escapeHtml(node.data.image)}" alt="" />`
      : `<div class="scene-image-placeholder">Нет изображения</div>`;

    const spriteHtml = node.data.sprite
      ? `<img class="scene-sprite" src="${escapeHtml(node.data.sprite)}" alt="" />`
      : "";

    const choicesHtml =
      activeOutputs.length > 0
        ? activeOutputs
            .map(
              (output, i) =>
                `<button class="choice-btn" data-output-id="${escapeHtml(output.id)}" style="animation-delay: ${i * settings.choiceAppearDelayMs}ms">${escapeHtml(output.text)}</button>`,
            )
            .join("")
        : "";

    const endHtml =
      isEnd || activeOutputs.length === 0
        ? `<div class="scene-end" style="animation: fadeIn ${settings.endFadeInMs}ms ease">
            <p>Конец</p>
            <button class="restart-btn" id="restart-btn">Начать сначала</button>
          </div>`
        : "";

    const backHtml = this.backCallback
      ? `<button class="restart-btn" id="back-btn" style="margin-top: 8px">Назад к проекту</button>`
      : "";

    this.root.innerHTML = `
      <div class="scene" style="animation: fadeIn ${settings.sceneFadeInMs}ms ease">
        <div class="scene-image-container">
          ${imageHtml}
          ${spriteHtml}
        </div>
        <div class="scene-body">
          <div class="scene-label">${escapeHtml(node.data.label)}</div>
          <div class="scene-choices">
            ${choicesHtml}
          </div>
          ${endHtml}
          ${backHtml}
        </div>
      </div>
    `;

    this.root.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const outputId = (btn as HTMLElement).dataset.outputId!;
        this.engine?.choose(outputId);
      });
    });

    const restartBtn = document.getElementById("restart-btn");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => this.engine?.start());
    }

    const backBtn = document.getElementById("back-btn");
    if (backBtn && this.backCallback) {
      const cb = this.backCallback;
      backBtn.addEventListener("click", () => cb());
    }
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
