import { CalendarSettings } from "./types";

export type CalendarPoint = {
  /** День 0-based. */
  day: number;
  /** Название части дня («утро»). */
  daypart: string;
  /** Акт 1-based по границам дней. */
  act: number;
};

/**
 * Состояние календаря поверх format-agnostic движка — слой по образцу
 * WorldState: наблюдает смену сцен (onScene) и читает переменную slot из
 * state движка через переданный ридер. Движок про календарь ничего не знает —
 * slot для него обычная численная переменная, которую двигают эффекты сцен.
 */
export class CalendarState {
  private slot = 0;

  constructor(
    private settings: CalendarSettings,
    /** Читает текущий slot из движка: () => engine.getState()['slot'] ?? 0. */
    private readSlot: () => number,
  ) {}

  /** Вызывается при каждом рендере сцены (из main.ts onSceneChange). */
  onScene(): void {
    this.slot = this.readSlot();
  }

  getSlot(): number {
    return this.slot;
  }

  current(): CalendarPoint {
    const perDay = Math.max(1, this.settings.dayparts.length);
    // Слот может упереться в потолок slotCount — клампим к последнему индексу.
    const slot = Math.max(0, Math.min(this.slot, this.settings.slotCount - 1));
    const day = Math.floor(slot / perDay);
    const daypart = this.settings.dayparts[slot % perDay] ?? "";
    let act = 1;
    for (let i = 1; i < this.settings.actBoundaries.length; i++) {
      if (day >= this.settings.actBoundaries[i]) act = i + 1;
    }
    return { day, daypart, act };
  }

  /** HUD-подпись: «День 3 · вечер» (день 1-based для человека). */
  label(): string {
    const { day, daypart } = this.current();
    return daypart ? `День ${day + 1} · ${daypart}` : `День ${day + 1}`;
  }
}
