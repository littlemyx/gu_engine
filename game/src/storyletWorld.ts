import { StoryletDirector } from "gu-engine-story-core";
import { WorldView, LocationStatus } from "./map";
import { WorldMapLocation } from "./types";

/**
 * Карта мира поверх режиссёра.
 *
 * Графовый WorldState выводил положение героя из id узлов (`hub_<loc>`) — оно
 * было побочным продуктом раскладки графа. Здесь положение спрашивается прямо
 * у режиссёра, а «куда можно пойти» — это смежность из бандла. Меньше
 * догадок: карта показывает то же, что видит логика.
 */
export class StoryletWorld implements WorldView {
  private visited = new Set<string>();

  constructor(private director: StoryletDirector) {
    this.visited.add(director.location);
  }

  /** Вызывается после каждой смены сцены — отмечает посещённое. */
  sync(): void {
    this.visited.add(this.director.location);
  }

  getCurrent(): string {
    return this.director.location;
  }

  locations(): WorldMapLocation[] {
    return this.director.bundle.world.locations.map((l) => ({
      id: l.id,
      name: l.name,
      mood: l.mood,
      specialKind: l.specialKind,
    }));
  }

  edges(): Array<[string, string]> {
    return this.director.bundle.world.edges.map((e) => [e.from, e.to] as [string, string]);
  }

  nameOf(loc: string): string {
    return this.director.locationOf(loc)?.name ?? loc;
  }

  statusOf(loc: string): LocationStatus {
    if (loc === this.director.location) return "current";
    const reachable = this.director
      .bundle.world.edges.some(
        (e) =>
          (e.from === this.director.location && e.to === loc) ||
          (e.to === this.director.location && e.from === loc),
      );
    if (reachable) return "available";
    return this.visited.has(loc) ? "visited" : "locked";
  }
}
