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
/** Подписи фаз внутри части дня — от «свежей» к «исходу». */
const PHASE_LABELS: Record<number, string[]> = {
  2: ["", "на исходе"],
  3: ["", "в разгаре", "на исходе"],
};

export class CalendarState {
  private slot = 0;
  private phase = 0;

  constructor(
    private settings: CalendarSettings,
    /** Читает текущий slot из движка: () => engine.getState()['slot'] ?? 0. */
    private readSlot: () => number,
    /** Читает малую стрелку: () => engine.getState()['phase'] ?? 0. */
    private readPhase: () => number = () => 0,
  ) {}

  /** Вызывается при каждом рендере сцены (из main.ts onSceneChange). */
  onScene(): void {
    this.slot = this.readSlot();
    this.phase = this.readPhase();
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

  /**
   * HUD-подпись: «День 3 · вечер на исходе» (день 1-based для человека).
   *
   * Малая стрелка показывается словом, а не числом: игрок должен чувствовать,
   * что время внутри части дня уходит (к исходу персонажи менее восприимчивы),
   * но счётчик очков превратил бы это в бухгалтерию. Нет phasesPerSlot в
   * настройках (игры, собранные до реформы) — фаз нет, подпись прежняя.
   */
  label(): string {
    const { day, daypart } = this.current();
    const base = daypart ? `День ${day + 1} · ${daypart}` : `День ${day + 1}`;
    const perSlot = this.settings.phasesPerSlot ?? 0;
    const suffix = PHASE_LABELS[perSlot]?.[Math.max(0, Math.min(this.phase, perSlot - 1))] ?? "";
    return suffix ? `${base} ${suffix}` : base;
  }
}
