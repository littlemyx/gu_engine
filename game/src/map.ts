import { layoutMap, Point } from "./mapLayout";
import { WorldState } from "./worldState";

const PANEL_ANIM_MS = 380;
const DEPART_ANIM_MS = 250;
const MOBILE_QUERY = "(max-width: 640px)";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Карта мира: выезжающая панель (десктоп) / нижняя шторка (мобайл). Одна
 * компонента, режим переключается media-query. Перемещение отдаётся наружу
 * колбэком onTravel — резолвинг ребра и запуск перехода делает вызывающий.
 */
export class WorldMap {
  private scrim: HTMLElement;
  private panel: HTMLElement;
  private graphEl: HTMLElement;
  private footerEl: HTMLElement;
  private ctaEl: HTMLButtonElement;
  private isOpen = false;
  private canTravelNow = false;
  private selected: string | null = null;
  private lastMobile = false;
  private escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.close();
  };
  private resizeHandler = () => {
    if (!this.isOpen) return;
    // Пересобираем граф при смене брейкпоинта (panel↔sheet — разные размеры
    // и режим взаимодействия) или изменении размеров области.
    const mobile = this.isMobile();
    if (mobile !== this.lastMobile) this.selected = null;
    this.renderGraph();
  };

  constructor(
    private root: HTMLElement,
    private world: WorldState,
    private onTravel: (loc: string) => void | Promise<void>,
  ) {
    this.root.classList.add("map-root");
    this.root.innerHTML = `
      <div class="map-scrim" data-role="scrim"></div>
      <div class="map-panel" data-role="panel">
        <div class="map-handle" data-role="handle"></div>
        <div class="map-header">
          <div class="map-title">Куда отправиться</div>
          <button class="map-close" data-role="close" aria-label="Закрыть">✕</button>
        </div>
        <div class="map-graph" data-role="graph"></div>
        <div class="map-footer" data-role="footer"></div>
        <button class="map-cta" data-role="cta" hidden></button>
      </div>`;

    this.scrim = this.root.querySelector('[data-role="scrim"]')!;
    this.panel = this.root.querySelector('[data-role="panel"]')!;
    this.graphEl = this.root.querySelector('[data-role="graph"]')!;
    this.footerEl = this.root.querySelector('[data-role="footer"]')!;
    this.ctaEl = this.root.querySelector('[data-role="cta"]')!;

    this.scrim.addEventListener("click", () => this.close());
    this.root.querySelector('[data-role="close"]')!.addEventListener("click", () => this.close());
    this.ctaEl.addEventListener("click", () => {
      if (this.selected) this.travel(this.selected);
    });
    this.setupSwipe(this.root.querySelector('[data-role="handle"]')!);
  }

  get opened(): boolean {
    return this.isOpen;
  }

  open(canTravel: boolean): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.canTravelNow = canTravel;
    this.selected = null;
    this.renderGraph();
    // reflow → плавный вход
    this.root.classList.add("is-visible");
    void this.panel.offsetWidth;
    this.root.classList.add("is-open");
    document.addEventListener("keydown", this.escHandler);
    window.addEventListener("resize", this.resizeHandler);
  }

  async close(): Promise<void> {
    if (!this.isOpen) return;
    this.isOpen = false;
    document.removeEventListener("keydown", this.escHandler);
    window.removeEventListener("resize", this.resizeHandler);
    this.panel.style.transform = "";
    this.root.classList.remove("is-open");
    await wait(PANEL_ANIM_MS);
    if (!this.isOpen) this.root.classList.remove("is-visible");
  }

  private isMobile(): boolean {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  private renderGraph(): void {
    this.lastMobile = this.isMobile();
    const box = this.graphEl.getBoundingClientRect();
    const w = Math.max(220, box.width || 376);
    const h = Math.max(260, box.height || 470);

    const ids = this.world.locations().map((l) => l.id);
    const pos = layoutMap(ids, this.world.edges(), w, h);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "map-edges");
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));

    for (const [a, b] of this.world.edges()) {
      const pa = pos.get(a);
      const pb = pos.get(b);
      if (!pa || !pb) continue;
      const locked =
        this.world.statusOf(a) === "locked" || this.world.statusOf(b) === "locked";
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", String(pa.x));
      line.setAttribute("y1", String(pa.y));
      line.setAttribute("x2", String(pb.x));
      line.setAttribute("y2", String(pb.y));
      line.setAttribute("class", locked ? "map-edge map-edge--locked" : "map-edge");
      svg.appendChild(line);
    }

    this.graphEl.innerHTML = "";
    this.graphEl.appendChild(svg);

    for (const loc of this.world.locations()) {
      const p = pos.get(loc.id);
      if (!p) continue;
      this.graphEl.appendChild(this.makeNode(loc.id, p));
    }

    this.updateFooterAndCta();
  }

  private makeNode(loc: string, p: Point): HTMLElement {
    const status = this.world.statusOf(loc);
    const el = document.createElement("div");
    el.className = `map-node map-node--${status}`;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.dataset.loc = loc;

    const label =
      status === "current"
        ? `${this.world.nameOf(loc)} · вы здесь`
        : status === "locked"
          ? "???"
          : this.world.nameOf(loc);

    el.innerHTML = `<div class="map-dot"></div><div class="map-node-label">${escapeHtml(label)}</div>`;

    const clickable = status === "available" && this.canTravelNow;
    if (clickable) {
      el.classList.add("is-clickable");
      el.addEventListener("click", () => {
        if (this.isMobile()) {
          this.selectNode(loc);
        } else {
          this.travel(loc);
        }
      });
    }
    return el;
  }

  private selectNode(loc: string): void {
    this.selected = loc;
    this.graphEl.querySelectorAll(".map-node").forEach((n) => {
      n.classList.toggle("is-selected", (n as HTMLElement).dataset.loc === loc);
    });
    this.updateFooterAndCta();
  }

  private updateFooterAndCta(): void {
    if (!this.canTravelNow) {
      this.footerEl.textContent = "Завершите сцену, чтобы отправиться в путь.";
      this.ctaEl.hidden = true;
      return;
    }
    this.footerEl.textContent = this.isMobile()
      ? "Выберите узел и подтвердите переход."
      : "Клик по светлому узлу — переход в локацию. Пунктир — пути ещё закрыты.";

    if (this.isMobile() && this.selected) {
      this.ctaEl.hidden = false;
      this.ctaEl.textContent = `Отправиться в ${this.world.nameOf(this.selected)}`;
    } else {
      this.ctaEl.hidden = true;
    }
  }

  private async travel(loc: string): Promise<void> {
    const nodeEl = this.graphEl.querySelector<HTMLElement>(`.map-node[data-loc="${loc}"]`);
    nodeEl?.classList.add("is-departing");
    await wait(DEPART_ANIM_MS);
    await this.close();
    await this.onTravel(loc);
  }

  private setupSwipe(handle: HTMLElement): void {
    handle.addEventListener("pointerdown", (e: PointerEvent) => {
      if (!this.isMobile()) return;
      handle.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const t0 = performance.now();
      let dy = 0;
      this.panel.style.transition = "none";

      const move = (ev: PointerEvent) => {
        dy = Math.max(0, ev.clientY - startY);
        this.panel.style.transform = `translateY(${dy}px)`;
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        this.panel.style.transition = "";
        const v = dy / (performance.now() - t0); // px/ms
        if (dy > 120 || v > 0.5) {
          this.close();
        } else {
          this.panel.style.transform = "";
        }
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up, { once: true });
    });
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
