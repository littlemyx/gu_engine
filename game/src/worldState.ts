import { SceneGraph, SceneNode, WorldManifest, WorldMapLocation } from "./types";

export type LocationStatus = "current" | "visited" | "available" | "locked";

const HUB_PREFIX = "hub_";
const ENTER_PREFIX = "enter_";

/**
 * Состояние карты мира поверх format-agnostic движка. Наблюдает смену сцен
 * (onScene) и читает граф напрямую, чтобы найти ребро перемещения. Движок
 * ничего про мир не знает — вся семантика локаций живёт здесь.
 */
export class WorldState {
  private current: string | null = null;
  private pending: string | null = null;
  private visited = new Set<string>();
  private readonly hubToLoc: Map<string, string>;
  private readonly locById: Map<string, WorldMapLocation>;
  private readonly adjacency: Map<string, Set<string>>;

  constructor(
    private manifest: WorldManifest,
    private graph: SceneGraph,
  ) {
    this.locById = new Map(manifest.locations.map((l) => [l.id, l]));
    this.hubToLoc = new Map(manifest.locations.map((l) => [HUB_PREFIX + l.id, l.id]));

    this.adjacency = new Map(manifest.locations.map((l) => [l.id, new Set<string>()]));
    for (const e of manifest.edges) {
      if (!this.locById.has(e.from) || !this.locById.has(e.to)) continue;
      this.adjacency.get(e.from)!.add(e.to);
      this.adjacency.get(e.to)!.add(e.from);
    }
  }

  /** Вызывается при каждом рендере сцены (из main.ts onSceneChange). */
  onScene(node: SceneNode): void {
    const loc = this.hubToLoc.get(node.id);
    if (loc) {
      this.current = loc;
      this.pending = null;
      this.visited.add(loc);
    }
  }

  /** Оптимистично помечаем цель перемещения до прихода на hub. */
  setPending(loc: string): void {
    this.pending = loc;
  }

  getCurrent(): string | null {
    return this.current;
  }

  locations(): WorldMapLocation[] {
    return this.manifest.locations;
  }

  nameOf(loc: string): string {
    return this.locById.get(loc)?.name ?? loc;
  }

  /** Рёбра для отрисовки графа (пары id локаций манифеста). */
  edges(): Array<[string, string]> {
    return this.manifest.edges
      .filter((e) => this.locById.has(e.from) && this.locById.has(e.to))
      .map((e) => [e.from, e.to] as [string, string]);
  }

  statusOf(loc: string): LocationStatus {
    if (loc === this.current) return "current";
    const adjacentToCurrent = this.current
      ? this.adjacency.get(this.current)?.has(loc) ?? false
      : false;
    if (this.visited.has(loc)) return adjacentToCurrent ? "available" : "visited";
    if (adjacentToCurrent) return "available";
    return "locked";
  }

  /** Перемещаться можно только когда движок стоит на hub текущей локации. */
  canTravel(engineNode: SceneNode | null): boolean {
    if (!this.current || !engineNode) return false;
    return engineNode.id === HUB_PREFIX + this.current;
  }

  /**
   * id выхода hub-ноды, ведущего в целевую локацию. Матчим по target ребра
   * (enter_<target>), а не по строке id выхода — устойчивее к именованию.
   */
  travelOutputId(target: string): string | null {
    if (!this.current) return null;
    const source = HUB_PREFIX + this.current;
    const enterTarget = ENTER_PREFIX + target;
    const edge = this.graph.edges.find(
      (e) => e.source === source && e.target === enterTarget,
    );
    return edge?.sourceHandle ?? null;
  }
}
