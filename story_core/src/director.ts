/**
 * StoryletDirector — режиссёр: то, что раньше было развёрнутым графом.
 *
 * Хабы, enter-роутеры, брекетные роутеры, цепочки продолжений и маршрутизатор
 * концовок компилятор больше не строит. Все эти узлы были ЗАПЕЧЁННЫМ решением
 * («в такой ситуации играй такое ребро»); здесь решение принимается на месте,
 * из состояния и пула.
 *
 * Режиссёр headless и без DOM: его гоняет и движок, и симуляция политик в
 * story QA. Отсюда же исчезает рассинхрон симуляции с игрой — исполнитель
 * ровно один.
 *
 * Власть режиссёра ограничена ВЫБОРОМ: он ранжирует то, что доступно там, куда
 * игрок пришёл сам, и никогда не двигает мир под сюжет. Расписание персонажей
 * — детерминированная истина о том, кто где находится.
 */

import {
  bracketOfAffection,
  type BracketThresholds,
  LEGACY_BRACKET_THRESHOLDS,
  type AffectionBracket,
} from './brackets';
import type {
  BundleAnchor,
  BundleLocation,
  CompiledBeat,
  CompiledEnding,
  DialogueBracket,
  RenderedLine,
  StoryBundleV2,
  StoryletUnit,
  UnitSceneNode,
  UnitVariant,
} from './bundle';
import { applyEffect, type Effect } from './effects';
import { evalGuard, type Guard } from './guards';
import { SeededRng, hashSeed } from './rng';
import { selectUnit, utilityScore, type ScoreFn, type ScoreView, type SelectionTrace } from './selector';
import { createSliceState, type EventContext, type SliceState } from './state';

/** Сериализуемый снимок прохождения: сейв — это просто данные. */
export type DirectorSnapshot = {
  slot: number;
  phase: number;
  location: string;
  relationships: SliceState['relationships'];
  flags: string[];
  fired: Array<{ eventId: string; z: number }>;
  recentLis: string[];
  rngState: number;
  seed: number;
};

export type HubAction =
  | { kind: 'talk'; unitId: string; li: string; liName: string; label: string }
  | { kind: 'move'; locationId: string; label: string }
  | { kind: 'anchor'; daypartIndex: number; label: string };

export type HubActions = {
  location: BundleLocation;
  talks: Extract<HubAction, { kind: 'talk' }>[];
  moves: Extract<HubAction, { kind: 'move' }>[];
  anchor: Extract<HubAction, { kind: 'anchor' }> | null;
};

export type ActiveTalk = {
  unit: StoryletUnit;
  variant: UnitVariant;
  node: UnitSceneNode;
};

export type TalkClose = {
  /** Следующая ступень доступна в ТОЙ ЖЕ посиделке — предложить продолжить. */
  continuation: { unitId: string; li: string; liName: string } | null;
  /** Проза прощания сыгранного варианта; играется только при реальном уходе. */
  farewell: RenderedLine[] | null;
};

export type DirectorOptions = {
  seed?: number;
  score?: ScoreFn;
};

const clampRel: [number, number] = [-1, 1];

export class StoryletDirector {
  readonly bundle: StoryBundleV2;
  private readonly score: ScoreFn;
  private readonly unitById = new Map<string, StoryletUnit>();
  private readonly beatById = new Map<string, CompiledBeat>();
  private readonly locById = new Map<string, BundleLocation>();
  private readonly thresholdsByChar = new Map<string, BracketThresholds>();
  private readonly nameByChar = new Map<string, string>();
  private readonly neighbors = new Map<string, Array<{ locationId: string; via?: string }>>();
  private readonly unitsByLoc = new Map<string, StoryletUnit[]>();
  private readonly beatsByLoc = new Map<string, CompiledBeat[]>();

  slot = 0;
  phase = 0;
  location = '';
  slice: SliceState = createSliceState();
  /** Персонажи последних закрытых сцен, свежие первыми (окно разнообразия). */
  recentLis: string[] = [];
  readonly seed: number;
  private rng: SeededRng;

  /** Последний розыгрыш селектора — для ?gudebug. */
  lastSelection: SelectionTrace | null = null;

  private activeTalk: { unit: StoryletUnit; variant: UnitVariant; nodeId: string } | null = null;

  constructor(bundle: StoryBundleV2, opts: DirectorOptions = {}) {
    this.bundle = bundle;
    this.score = opts.score ?? utilityScore;
    this.seed = opts.seed ?? (bundle.selector.seedPolicy === 'fixed' ? bundle.selector.fixedSeed ?? 1 : hashSeed(bundle.title));
    this.rng = new SeededRng(this.seed);

    for (const u of bundle.units) this.unitById.set(u.id, u);
    for (const b of bundle.spine.beats) this.beatById.set(b.id, b);
    for (const l of bundle.world.locations) this.locById.set(l.id, l);
    for (const c of bundle.cast) {
      this.thresholdsByChar.set(c.id, c.bracketThresholds);
      this.nameByChar.set(c.id, c.name);
    }

    // Смежность симметризуется: модель мира от LLM часто односторонняя.
    const addNeighbor = (a: string, b: string, via?: string) => {
      if (!this.locById.has(a) || !this.locById.has(b)) return;
      const list = this.neighbors.get(a) ?? [];
      if (!list.some(n => n.locationId === b)) list.push({ locationId: b, via });
      this.neighbors.set(a, list);
    };
    for (const e of bundle.world.edges) {
      addNeighbor(e.from, e.to, e.via);
      addNeighbor(e.to, e.from, e.via);
    }

    for (const u of bundle.units) {
      const list = this.unitsByLoc.get(u.at.locationId) ?? [];
      list.push(u);
      this.unitsByLoc.set(u.at.locationId, list);
    }
    // Биты проверяются по (window.toSlot, id) — самый горящий дедлайн первым,
    // тай-брейк детерминирован. Хребет режиссёр не тасует: сюжет автора.
    for (const b of bundle.spine.beats) {
      const list = this.beatsByLoc.get(b.locationId) ?? [];
      list.push(b);
      this.beatsByLoc.set(b.locationId, list);
    }
    for (const list of this.beatsByLoc.values()) {
      list.sort((a, b) => a.window.toSlot - b.window.toSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }

    this.reset();
  }

  // ── Состояние ────────────────────────────────────────────────────────────

  reset(): void {
    this.slot = 0;
    this.phase = 0;
    this.location = this.bundle.world.startLocationId;
    this.slice = createSliceState({
      relationships: structuredCloneRelationships(this.bundle.stateSchema.relationships),
    });
    this.recentLis = [];
    this.rng = new SeededRng(this.seed);
    this.activeTalk = null;
    this.lastSelection = null;
  }

  snapshot(): DirectorSnapshot {
    return {
      slot: this.slot,
      phase: this.phase,
      location: this.location,
      relationships: structuredCloneRelationships(this.slice.relationships),
      flags: [...this.slice.flags],
      fired: this.slice.fired.map(f => ({ ...f })),
      recentLis: [...this.recentLis],
      rngState: this.rng.state,
      seed: this.seed,
    };
  }

  restore(snap: DirectorSnapshot): void {
    this.slot = snap.slot;
    this.phase = snap.phase;
    this.location = snap.location;
    this.slice = createSliceState({
      relationships: structuredCloneRelationships(snap.relationships),
      flags: new Set(snap.flags),
      fired: snap.fired.map(f => ({ ...f })),
    });
    this.recentLis = [...snap.recentLis];
    this.rng = new SeededRng(snap.rngState);
    this.activeTalk = null;
  }

  static restore(bundle: StoryBundleV2, snap: DirectorSnapshot, opts: DirectorOptions = {}): StoryletDirector {
    const d = new StoryletDirector(bundle, { ...opts, seed: snap.seed });
    d.restore(snap);
    return d;
  }

  // ── Оценка guard-ов ──────────────────────────────────────────────────────

  private thresholdsOf(charId: string): BracketThresholds {
    return this.thresholdsByChar.get(charId) ?? LEGACY_BRACKET_THRESHOLDS;
  }

  private contextFor(charId: string, locationId: string): EventContext {
    return {
      x: charId,
      y: locationId,
      z: { z: this.slot, slot: this.slot, phase: this.phase },
      R: this.slice.relationships[charId] ?? { affection: 0, trust: 0, tension: 0 },
      H: { flags: this.slice.flags, fired: this.slice.fired },
    };
  }

  private holds(guard: Guard, charId: string, locationId: string): boolean {
    return evalGuard(guard, this.contextFor(charId, locationId), this.slice, this.thresholdsOf(charId));
  }

  private hasFired(id: string): boolean {
    return this.slice.fired.some(f => f.eventId === id);
  }

  /**
   * Присутствие персонажа — по расписанию, и только по нему. Окно сцены может
   * быть шире рабочего дня персонажа; играть встречу там, где его нет, значит
   * ломать мир ради контента. Персонажа без расписания окно не ограничивает.
   */
  private presentAt(charId: string, locationId: string, slot: number): boolean {
    const row = this.bundle.schedule[charId];
    if (!row) return true;
    return row[slot] === locationId;
  }

  // ── Точка выбора 1: вход в локацию (созревший бит хребта) ────────────────

  /**
   * Созревший бит этой локации: слот в окне, guard выполнен, бит не сыгран.
   * Выбор ДЕТЕРМИНИРОВАН — хребет принадлежит автору, а не селектору.
   */
  maturedBeat(locationId: string = this.location): CompiledBeat | null {
    for (const beat of this.beatsByLoc.get(locationId) ?? []) {
      if (this.hasFired(beat.id)) continue;
      if (this.slot < beat.window.fromSlot || this.slot > beat.window.toSlot) continue;
      const primary = beat.participants.find(p => this.thresholdsByChar.has(p)) ?? '';
      if (!this.holds(beat.guard, primary, locationId)) continue;
      return beat;
    }
    return null;
  }

  /**
   * Бит сыгран. Двигает большую стрелку — сюжет и якорь её единственные
   * двигатели; фаза при этом сбрасывается (в новой части дня персонажи снова
   * восприимчивы).
   */
  completeBeat(beatId: string, outcomeId?: string): void {
    const beat = this.beatById.get(beatId);
    if (!beat) return;
    for (const eff of beat.effects) applyEffect(eff, this.slice);
    if (outcomeId) {
      const outcome = beat.outcomes?.find(o => o.id === outcomeId);
      for (const eff of outcome?.effects ?? []) applyEffect(eff, this.slice);
    }
    this.slice.fired.push({ eventId: beat.id, z: this.slot });
    this.advanceSlot();
  }

  /** Большая стрелка: +1 слот, фаза с нуля. Кламп по календарю. */
  private advanceSlot(): void {
    this.slot = Math.min(this.slot + 1, this.bundle.calendar.slotCount);
    this.phase = 0;
  }

  // ── Точка выбора 2: хаб (салиенс-селектор) ──────────────────────────────

  /** Кандидаты встреч: guard + окна + присутствие + одноразовость. */
  private talkCandidates(locationId: string): StoryletUnit[] {
    const out: StoryletUnit[] = [];
    for (const unit of this.unitsByLoc.get(locationId) ?? []) {
      if (this.hasFired(unit.id)) continue;
      if (this.slot < unit.at.slot.fromSlot || this.slot > unit.at.slot.toSlot) continue;
      if (unit.at.phase && (this.phase < unit.at.phase.fromPhase || this.phase > unit.at.phase.toPhase)) continue;
      if (unit.li && !this.presentAt(unit.li, locationId, this.slot)) continue;
      if (!this.holds(unit.guard, unit.li, locationId)) continue;
      out.push(unit);
    }
    return out;
  }

  /**
   * Есть ли в локации что играть — БЕЗ побочных эффектов.
   *
   * hubActions() крутит ГПСЧ (в этом суть жребия), поэтому «заглянуть, что там»
   * через него нельзя: разведка сдвинула бы поток и сломала воспроизводимость.
   * Этим пользуются и политики симуляции, и подсветка карты.
   */
  hasContentAt(locationId: string): boolean {
    return this.maturedBeat(locationId) !== null || this.talkCandidates(locationId).length > 0;
  }

  /** Кратчайший путь до локации с контентом; пусто — идти некуда. */
  routeToContent(from: string = this.location): string[] {
    const seen = new Set([from]);
    const queue: Array<{ id: string; path: string[] }> = [{ id: from, path: [] }];
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (path.length > 0 && this.hasContentAt(id)) return path;
      for (const n of this.neighbors.get(id) ?? []) {
        if (seen.has(n.locationId)) continue;
        seen.add(n.locationId);
        queue.push({ id: n.locationId, path: [...path, n.locationId] });
      }
    }
    return [];
  }

  private scoreView(): ScoreView {
    // Следующая ступень персонажа = максимум сыгранных + 1. Так селектор
    // отличает «ровно то, что дальше по лестнице» от уже пройденного.
    const nextStageByLi = new Map<string, number>();
    for (const f of this.slice.fired) {
      const u = this.unitById.get(f.eventId);
      if (!u || !u.li || u.arcStage == null) continue;
      nextStageByLi.set(u.li, Math.max(nextStageByLi.get(u.li) ?? 1, u.arcStage + 1));
    }
    return {
      slot: this.slot,
      phase: this.phase,
      nextStageByLi,
      recentLis: this.recentLis,
      varietyWindow: this.bundle.selector.varietyWindow,
    };
  }

  /**
   * Действия хаба. Встреча предлагается НЕ БОЛЕЕ ОДНОЙ на персонажа: сцены
   * одного человека конкурируют между собой, а не заваливают игрока списком
   * из пяти реплик одной и той же Киры.
   */
  hubActions(): HubActions {
    const location = this.locById.get(this.location);
    const byLi = new Map<string, StoryletUnit[]>();
    for (const u of this.talkCandidates(this.location)) {
      const list = byLi.get(u.li) ?? [];
      list.push(u);
      byLi.set(u.li, list);
    }

    const talks: HubActions['talks'] = [];
    for (const [li, units] of [...byLi.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const { unit, trace } = selectUnit(
        units,
        this.scoreView(),
        this.bundle.selector.weights,
        this.bundle.selector.topN,
        this.rng,
        this.score,
      );
      this.lastSelection = trace;
      if (!unit) continue;
      const liName = this.nameByChar.get(li) ?? li;
      // Имя в именительном: «Поговорить: Кира», а не «поговорить с Кира».
      talks.push({ kind: 'talk', unitId: unit.id, li, liName, label: `Поговорить: ${liName}` });
    }

    const moves: HubActions['moves'] = (this.neighbors.get(this.location) ?? []).map(n => {
      const target = this.locById.get(n.locationId)!;
      return {
        kind: 'move' as const,
        locationId: n.locationId,
        label: n.via ? `Пойти: ${target.name} (${n.via})` : `Пойти: ${target.name}`,
      };
    });

    return { location: location!, talks, moves, anchor: this.currentAnchorAction() };
  }

  /** Якорь текущей части дня. Всегда ровно один — софтлок невозможен. */
  private currentAnchorAction(): HubActions['anchor'] {
    const anchor = this.currentAnchor();
    if (!anchor) return null;
    return { kind: 'anchor', daypartIndex: anchor.daypartIndex, label: anchor.label };
  }

  currentAnchor(): BundleAnchor | null {
    // Календарь исчерпан — двигать больше нечего. Без этой проверки слот,
    // упёршийся в потолок, давал фантомный якорь по slot % perDay (после
    // последнего сна — «Двигаться дальше: день», хотя HUD честно показывает
    // последний вечер), и время «шло» по кругу, никуда не приходя.
    if (this.timeExhausted()) return null;
    const perDay = this.bundle.calendar.dayparts.length;
    if (perDay === 0) return null;
    const idx = this.slot % perDay;
    return this.bundle.anchors.find(a => a.daypartIndex === idx) ?? null;
  }

  moveTo(locationId: string): void {
    // Перемещение бесплатно: времени не двигает (у времени два двигателя —
    // сюжет и якорь), поэтому исследовать мир не наказывается.
    if (this.locById.has(locationId)) this.location = locationId;
  }

  /**
   * Якорный переход — диегетическая смена части дня. Сон уводит домой:
   * это единственный выход из последней части дня.
   */
  anchorAdvance(): { narration: string; movedTo: string | null } {
    const anchor = this.currentAnchor();
    if (!anchor) return { narration: '', movedTo: null };
    this.advanceSlot();
    let movedTo: string | null = null;
    if (anchor.isSleep && this.bundle.world.homeLocationId) {
      this.location = this.bundle.world.homeLocationId;
      movedTo = this.location;
    }
    return { narration: anchor.narration, movedTo };
  }

  // ── Точка выбора 3: тон сцены ───────────────────────────────────────────

  /**
   * Вариант по тону отношений — решение РАНТАЙМА. В графовой модели это была
   * цепочка условных рёбер, где исход определял порядок проводки
   * (BRACKET_WIRE_ORDER); здесь достаточно посмотреть на affection.
   * Нейтральный вариант — гарантированный фолбэк.
   */
  private pickVariant(unit: StoryletUnit): UnitVariant | null {
    if (unit.variants.length === 0) return null;
    const affection = this.slice.relationships[unit.li]?.affection ?? 0;
    const bracket: AffectionBracket = bracketOfAffection(affection, this.thresholdsOf(unit.li));
    const wanted: DialogueBracket = bracket === 'warm' ? 'positive' : bracket === 'cold' ? 'negative' : 'neutral';
    return (
      unit.variants.find(v => v.bracket === wanted) ??
      unit.variants.find(v => v.bracket === 'neutral') ??
      unit.variants[0]
    );
  }

  startTalk(unitId: string): ActiveTalk | null {
    const unit = this.unitById.get(unitId);
    if (!unit) return null;
    const variant = this.pickVariant(unit);
    if (!variant) return null;
    const node = variant.nodes.find(n => n.id === variant.entryNodeId) ?? variant.nodes[0];
    if (!node) return null;
    this.activeTalk = { unit, variant, nodeId: node.id };
    return { unit, variant, node };
  }

  currentNode(): UnitSceneNode | null {
    if (!this.activeTalk) return null;
    return this.activeTalk.variant.nodes.find(n => n.id === this.activeTalk!.nodeId) ?? null;
  }

  /** Выбор внутри сцены: собственные эффекты + переход к следующему узлу. */
  choose(choiceId: string): UnitSceneNode | null {
    const node = this.currentNode();
    if (!node || !this.activeTalk) return null;
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice) return null;
    for (const eff of choice.effects) applyEffect(clampedEffect(eff), this.slice);
    const next = this.activeTalk.variant.nodes.find(n => n.id === choice.next);
    if (!next) return null;
    this.activeTalk.nodeId = next.id;
    return next;
  }

  /**
   * Закрытие сцены: эффекты ступени, фиксация в логе, малая стрелка +1.
   * Слот НЕ двигается — разговоры большой стрелке не подчиняются (плейтест:
   * беседа начиналась вечером, а после прощания наступало утро).
   */
  closeTalk(): TalkClose {
    const active = this.activeTalk;
    if (!active) return { continuation: null, farewell: null };
    const { unit, variant } = active;

    for (const eff of unit.effectsOnClose) applyEffect(clampedEffect(eff), this.slice);
    this.slice.fired.push({ eventId: unit.id, z: this.slot });
    this.phase = Math.min(this.phase + 1, this.bundle.calendar.phasesPerSlot);

    if (unit.li) {
      this.recentLis = [unit.li, ...this.recentLis.filter(l => l !== unit.li)].slice(
        0,
        Math.max(1, this.bundle.selector.varietyWindow),
      );
    }

    this.activeTalk = null;
    const continuation = this.continuationFor(unit);
    return {
      continuation,
      farewell: variant.farewell?.lines ?? null,
    };
  }

  /**
   * Следующая ступень в ТОЙ ЖЕ посиделке: тот же персонаж, та же локация,
   * ступенью выше, пересекающееся окно.
   *
   * Ради чего: ступени пула разнесены по окнам, поэтому «разговор пошёл
   * хорошо» не значило ничего — следующая ступень ждала своего дня.
   *
   * Восприимчивость (окно фаз) гейтит ЗАВЕДЕНИЕ разговора, а не уже идущий:
   * закрытие первой ступени уже потратило фазу, и требовать здесь её окно
   * значило бы запретить продолжение вовсе. Нужен лишь незакончившийся слот.
   */
  private continuationFor(unit: StoryletUnit): TalkClose['continuation'] {
    if (!unit.li || unit.arcStage == null) return null;
    if (this.phase >= this.bundle.calendar.phasesPerSlot) return null;

    const stage = unit.arcStage;
    const window = unit.at.slot;
    const candidates = (this.unitsByLoc.get(unit.at.locationId) ?? [])
      .filter(u => u.li === unit.li && (u.arcStage ?? 0) === stage + 1)
      .filter(u => !this.hasFired(u.id))
      .filter(u => u.at.slot.fromSlot <= window.toSlot && u.at.slot.toSlot >= window.fromSlot)
      .filter(u => this.slot >= u.at.slot.fromSlot && this.slot <= u.at.slot.toSlot)
      .filter(u => this.holds(u.guard, u.li, unit.at.locationId))
      .sort((a, b) => a.at.slot.fromSlot - b.at.slot.fromSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const next = candidates[0];
    if (!next) return null;
    return { unitId: next.id, li: next.li, liName: this.nameByChar.get(next.li) ?? next.li };
  }

  // ── Точка выбора 4: концовки ────────────────────────────────────────────

  /** Финал сыгран — история обязана кончиться. */
  finaleFired(): boolean {
    const finale = this.bundle.spine.beats.find(b => b.kind === 'finale');
    return finale ? this.hasFired(finale.id) : false;
  }

  /** Календарь исчерпан: слот упёрся в потолок, дальше времени нет. */
  timeExhausted(): boolean {
    return this.slot >= this.bundle.calendar.slotCount;
  }

  /**
   * Финал ещё может выстрелить: не сыгран, окно живо и guard выполним прямо
   * сейчас в его локации. Окно финала компилятор дотягивает до потолка
   * календаря, поэтому «после последнего сна» — легитимное время дойти до него.
   */
  finaleReachable(): boolean {
    const finale = this.bundle.spine.beats.find(b => b.kind === 'finale');
    if (!finale || this.hasFired(finale.id)) return false;
    if (this.slot < finale.window.fromSlot || this.slot > finale.window.toSlot) return false;
    const primary = finale.participants.find(p => this.thresholdsByChar.has(p)) ?? '';
    return this.holds(finale.guard, primary, finale.locationId);
  }

  /**
   * История обязана закончиться СЕЙЧАС.
   *
   * Гарантия анти-софтлока: конец календаря — это концовка, а не вечный хаб.
   * Игрок, проспавший сюжет, ломает цепочку битов — guard финала становится
   * невыполнимым, и без этой проверки он оставался бы в мире, где расписание
   * кончилось (говорить не с кем), якорей нет, а финал не наступит никогда.
   * Плохая концовка и есть честный ответ на такое прохождение.
   */
  shouldEnd(): boolean {
    if (this.finaleFired()) return true;
    return this.timeExhausted() && !this.finaleReachable();
  }

  /**
   * Концовка по состоянию. Порядок в бандле — авторский: условные раньше
   * безусловных, иначе безусловная закрыла бы собой все остальные.
   *
   * Единственное отступление от «первой подошедшей»: если условию удовлетворяют
   * НЕСКОЛЬКО хороших концовок, играется та, чей персонаж роднее по affection.
   * Порядок в списке тут не аргумент — иначе роман с Юки заканчивался бы
   * сценой Киры просто потому, что её линию автор перечислил первой, а
   * affection к ней подрос на сюжетных сценах. Условия ставит автор, выбор
   * между равно допустимыми — состояние.
   */
  checkEnding(): CompiledEnding | null {
    const satisfied = this.bundle.spine.endings.filter(e => this.holds(e.guard, e.liId ?? '', this.location));
    if (satisfied.length === 0) return null;

    const good = satisfied.filter(e => e.kind === 'good' && e.liId);
    if (good.length > 0) {
      return good.reduce((best, e) =>
        (this.slice.relationships[e.liId!]?.affection ?? 0) > (this.slice.relationships[best.liId!]?.affection ?? 0)
          ? e
          : best,
      );
    }
    return satisfied[0];
  }

  // ── Справки для HUD ─────────────────────────────────────────────────────

  locationOf(id: string): BundleLocation | undefined {
    return this.locById.get(id);
  }

  unitOf(id: string): StoryletUnit | undefined {
    return this.unitById.get(id);
  }

  nameOf(charId: string): string {
    return this.nameByChar.get(charId) ?? charId;
  }
}

/** Отношения клонируются поштучно: Object.assign делил бы vars между прогонами. */
function structuredCloneRelationships(src: SliceState['relationships']): SliceState['relationships'] {
  const out: SliceState['relationships'] = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = { ...v, ...(v.vars ? { vars: { ...v.vars } } : {}) };
  }
  return out;
}

/**
 * Отношения живут в спектре −1..1. Кламп ставится здесь, а не в бандле:
 * это инвариант модели, и забыть его в одном из эффектов было бы тихой утечкой
 * (в графовой модели его держал движок через range из stateSchema).
 */
function clampedEffect(effect: Effect): Effect {
  if ('rel' in effect && !effect.rel.clamp) return { rel: { ...effect.rel, clamp: clampRel } };
  return effect;
}
