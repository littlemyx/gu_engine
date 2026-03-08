import { GameEngine } from "./engine";
import { SceneGraph, SceneNode } from "./types";
import "./style.css";

const app = document.getElementById("app")!;

let engine: GameEngine | null = null;

function showLoadScreen(): void {
  app.innerHTML = `
    <div class="load-screen">
      <h1>Интерактивная новелла</h1>
      <p>Загрузите файл сцен, экспортированный из редактора</p>
      <button class="load-btn" id="load-btn">Загрузить файл</button>
      <input type="file" id="file-input" accept=".json" hidden />
    </div>
  `;

  const btn = document.getElementById("load-btn")!;
  const input = document.getElementById("file-input") as HTMLInputElement;

  btn.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const graph: SceneGraph = JSON.parse(reader.result as string);
        startGame(graph);
      } catch {
        alert("Не удалось прочитать файл сцен");
      }
    };
    reader.readAsText(file);
  });
}

function startGame(graph: SceneGraph): void {
  engine = new GameEngine(graph, renderScene);
  engine.start();
}

function renderScene(node: SceneNode, isEnd: boolean): void {
  if (!engine) return;

  const connectedOutputs = engine.getConnectedOutputIds();

  const activeOutputs = node.data.outputs.filter((o) =>
    connectedOutputs.has(o.id),
  );

  const imageHtml = node.data.image
    ? `<img class="scene-image" src="${escapeHtml(node.data.image)}" alt="" />`
    : `<div class="scene-image-placeholder">Нет изображения</div>`;

  const choicesHtml =
    activeOutputs.length > 0
      ? activeOutputs
          .map(
            (output) =>
              `<button class="choice-btn" data-output-id="${escapeHtml(output.id)}">${escapeHtml(output.text)}</button>`,
          )
          .join("")
      : "";

  const endHtml =
    isEnd || activeOutputs.length === 0
      ? `<div class="scene-end">
          <p>Конец</p>
          <button class="restart-btn" id="restart-btn">Начать сначала</button>
        </div>`
      : "";

  app.innerHTML = `
    <div class="scene">
      <div class="scene-image-container">
        ${imageHtml}
      </div>
      <div class="scene-body">
        <div class="scene-label">${escapeHtml(node.data.label)}</div>
        <div class="scene-choices">
          ${choicesHtml}
        </div>
        ${endHtml}
      </div>
    </div>
  `;

  document.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const outputId = (btn as HTMLElement).dataset.outputId!;
      engine?.choose(outputId);
    });
  });

  const restartBtn = document.getElementById("restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => engine?.start());
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

showLoadScreen();
