import type { Brief, SegmentIssue } from './types';
import type { Calendar, CastPlan, CharacterSchedule, SpinePlan } from './calendarTypes';
import { actSlotWindow, daypartOfSlot } from './calendarTypes';
import { assignBeatSlots } from './beatSchedule';

/**
 * Полный солвер расписания (B1, фаза 4 docs/plans/calendar-branching.md).
 *
 * Детерминирован и без LLM: одинаковые входы + seed дают одно расписание,
 * поэтому оно дёшево перепроверяется валидатором и переигрывается.
 *
 * Приоритет размещения:
 *   1. Пины битов: участник назначенного на слот бита стоит в локации бита.
 *   2. Weekly-паттерн агенды: тег выбирается по весам детерминированно —
 *      целочисленный хэш h(charId, slot, seed) вместо Math.random; локация
 *      тега ротируется тем же хэшем по списку tagMap[tag] (разнообразие).
 *   3. Ремонт покрытия: (а) в каждом слоте ≥2 различных локаций держат
 *      хотя бы одного LI (или бит); (б) каждый LI на сцене не меньше
 *      ceil(слотов_акта / 3) слотов в каждом акте.
 */

/** Доля слотов акта, которые LI обязан провести на сцене (floor = ceil(n/3)). */
const ON_STAGE_ACT_DIVISOR = 3;

/** FNV-1a-подобный 32-битный хэш от (строка, слот, seed) — без Math.random. */
function hash32(key: string, slot: number, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= slot + 0x9e3779b9;
  h = Math.imul(h, 16777619);
  return h >>> 0;
}

type WeightedTag = { tag: string; weight: number };

/** Детерминированный выбор тега по весам: точка h % totalWeight на кумулятиве. */
function pickWeightedTag(entries: WeightedTag[], h: number): WeightedTag | null {
  const positive = entries.filter(e => e.weight > 0);
  if (positive.length === 0) return entries[0] ?? null;
  // Масштаб ×1000 сохраняет дробные веса без плавающей точки в модульной арифметике.
  const scaled = positive.map(e => ({ e, w: Math.max(1, Math.round(e.weight * 1000)) }));
  const total = scaled.reduce((sum, s) => sum + s.w, 0);
  let r = h % total;
  for (const s of scaled) {
    r -= s.w;
    if (r < 0) return s.e;
  }
  return scaled[scaled.length - 1].e;
}

/** Локация тега: первая из tagMap[tag], ротированная хэшем для разнообразия. */
function tagLocation(
  tag: string,
  tagMap: Record<string, string[]> | null,
  charId: string,
  slot: number,
  seed: number,
): string | null {
  const locs = tagMap?.[tag] ?? [];
  if (locs.length === 0) return null;
  return locs[hash32(`${charId}:${tag}`, slot, seed) % locs.length];
}

/** Слот → id бита, назначенного на него (обратный индекс assignBeatSlots). */
function beatBySlot(spine: SpinePlan, calendar: Calendar): Map<number, string> {
  const bySlot = new Map<number, string>();
  const assigned = assignBeatSlots(spine, calendar);
  for (const [beatId, slot] of Object.entries(assigned)) bySlot.set(slot, beatId);
  return bySlot;
}

export function buildSchedule(
  brief: Brief,
  spine: SpinePlan,
  calendar: Calendar,
  castPlan: CastPlan | null,
  tagMap: Record<string, string[]> | null,
  seed: number = brief.seed ?? 0,
): CharacterSchedule {
  const slotCount = calendar.slotCount;
  const memberById = new Map((castPlan?.members ?? []).map(m => [m.id, m]));
  const beatSlots = assignBeatSlots(spine, calendar);
  const beatById = new Map(spine.beats.map(b => [b.id, b]));

  const schedule: CharacterSchedule = {};
  /** Вес назначения per (char, slot): пин = Infinity, паттерн = вес тега. */
  const assignWeight = new Map<string, number>();
  const wKey = (charId: string, slot: number) => `${charId}@${slot}`;
  const pinned = new Set<string>();

  const liIds = brief.loveInterests.map(li => li.id);

  // ── 2. Weekly-паттерны (пины лягут поверх). ─────────────────────────────
  for (const liId of liIds) {
    const slots: (string | null)[] = new Array<string | null>(slotCount).fill(null);
    const agenda = memberById.get(liId)?.agenda;
    if (agenda && tagMap) {
      for (let s = 0; s < slotCount; s++) {
        const entries = agenda.weeklyPattern[daypartOfSlot(s, calendar)] ?? [];
        const picked = pickWeightedTag(entries, hash32(liId, s, seed));
        const loc = picked ? tagLocation(picked.tag, tagMap, liId, s, seed) : null;
        if (loc && picked) {
          slots[s] = loc;
          assignWeight.set(wKey(liId, s), picked.weight);
        }
      }
    }
    schedule[liId] = slots;
  }

  // ── 1. Пины битов поверх паттернов. ─────────────────────────────────────
  for (const beat of spine.beats) {
    const s = beatSlots[beat.id];
    if (s == null) continue;
    for (const p of beat.participants) {
      if (!schedule[p]) continue; // плейсхолдеры "$role" резолвит компилятор
      schedule[p][s] = beat.locationId;
      assignWeight.set(wKey(p, s), Infinity);
      pinned.add(wKey(p, s));
    }
  }

  // Все теги персонажа, отсортированные по убыванию веса (для ремонта).
  const rankedTags = (liId: string): WeightedTag[] => {
    const agenda = memberById.get(liId)?.agenda;
    if (!agenda) return [];
    const byTag = new Map<string, number>();
    for (const entries of Object.values(agenda.weeklyPattern)) {
      for (const e of entries) byTag.set(e.tag, Math.max(byTag.get(e.tag) ?? 0, e.weight));
    }
    return [...byTag.entries()]
      .map(([tag, weight]) => ({ tag, weight }))
      .sort((a, b) => b.weight - a.weight || (a.tag < b.tag ? -1 : 1));
  };

  // ── 3а. Покрытие слота: ≥2 различных локаций с LI (или битом). ──────────
  const bySlotBeat = beatBySlot(spine, calendar);
  for (let s = 0; s < slotCount; s++) {
    const occupied = () => {
      const set = new Set<string>();
      for (const liId of liIds) {
        const loc = schedule[liId][s];
        if (loc) set.add(loc);
      }
      const beatId = bySlotBeat.get(s);
      const beatLoc = beatId ? beatById.get(beatId)?.locationId : null;
      if (beatLoc) set.add(beatLoc);
      return set;
    };

    let occ = occupied();
    if (occ.size >= 2) continue;

    // Сначала выводим на сцену закадрового LI в отличную от толпы локацию.
    for (const liId of liIds) {
      if (occ.size >= 2) break;
      if (schedule[liId][s] != null) continue;
      for (const t of rankedTags(liId)) {
        const loc = tagLocation(t.tag, tagMap, liId, s, seed);
        if (loc && !occ.has(loc)) {
          schedule[liId][s] = loc;
          assignWeight.set(wKey(liId, s), t.weight);
          occ = occupied();
          break;
        }
      }
    }
    if (occ.size >= 2) continue;

    // Затем двигаем LI с самым лёгким назначением в другой тег (пины не трогаем).
    const movable = liIds
      .filter(liId => schedule[liId][s] != null && !pinned.has(wKey(liId, s)))
      .sort((a, b) => (assignWeight.get(wKey(a, s)) ?? 0) - (assignWeight.get(wKey(b, s)) ?? 0) || (a < b ? -1 : 1));
    for (const liId of movable) {
      if (occ.size >= 2) break;
      for (const t of rankedTags(liId)) {
        const loc = tagLocation(t.tag, tagMap, liId, s, seed);
        if (loc && !occ.has(loc)) {
          schedule[liId][s] = loc;
          assignWeight.set(wKey(liId, s), t.weight);
          occ = occupied();
          break;
        }
      }
    }
  }

  // ── 3б. Пол присутствия: LI на сцене ≥ ceil(слотов_акта/3) в каждом акте. ─
  for (let act = 1; act <= calendar.actBoundaries.length; act++) {
    const win = actSlotWindow(act, calendar);
    const actSlots = win.toSlot - win.fromSlot + 1;
    const floor = Math.ceil(actSlots / ON_STAGE_ACT_DIVISOR);
    for (const liId of liIds) {
      let onStage = 0;
      for (let s = win.fromSlot; s <= win.toSlot; s++) if (schedule[liId][s] != null) onStage++;
      if (onStage >= floor) continue;
      const tags = rankedTags(liId);
      for (let s = win.fromSlot; s <= win.toSlot && onStage < floor; s++) {
        if (schedule[liId][s] != null) continue;
        for (const t of tags) {
          const loc = tagLocation(t.tag, tagMap, liId, s, seed);
          if (loc) {
            schedule[liId][s] = loc;
            assignWeight.set(wKey(liId, s), t.weight);
            onStage++;
            break;
          }
        }
      }
    }
  }

  return schedule;
}

/**
 * Инварианты расписания (гейт стадии schedule в пайплайне):
 *   - error: участник бита не пришпилен к его локации в назначенный слот;
 *   - error: слот с ≥2 доступными локациями держит <2 занятых
 *     (доступность считается по фактически используемым локациям расписания
 *     и битов — без tagMap инвариант проверяем консервативно);
 *   - warning: LI на сцене меньше ceil(слотов_акта/3) слотов в акте.
 */
export function validateSchedule(
  schedule: CharacterSchedule,
  spine: SpinePlan,
  calendar: Calendar,
  brief: Brief,
): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const liIds = brief.loveInterests.map(li => li.id).filter(id => id in schedule);
  const beatSlots = assignBeatSlots(spine, calendar);
  const beatById = new Map(spine.beats.map(b => [b.id, b]));
  const bySlotBeat = beatBySlot(spine, calendar);

  // Пины участников битов.
  for (const beat of spine.beats) {
    const s = beatSlots[beat.id];
    if (s == null) continue;
    for (const p of beat.participants) {
      if (!(p in schedule)) continue; // "$role"-плейсхолдеры вне расписания
      if (schedule[p][s] !== beat.locationId) {
        issues.push({
          severity: 'error',
          scope: `beats/${beat.id}`,
          message: `участник "${p}" бита "${beat.id}" не в его локации "${beat.locationId}" в слот ${s} (стоит: ${
            schedule[p][s] ?? 'за кадром'
          })`,
        });
      }
    }
  }

  // Доступные локации: всё, что расписание и биты вообще используют.
  const available = new Set<string>();
  for (const liId of liIds) for (const loc of schedule[liId]) if (loc) available.add(loc);
  for (const beat of spine.beats) available.add(beat.locationId);

  // Покрытие слотов.
  for (let s = 0; s < calendar.slotCount; s++) {
    const occupied = new Set<string>();
    for (const liId of liIds) {
      const loc = schedule[liId][s];
      if (loc) occupied.add(loc);
    }
    const beatId = bySlotBeat.get(s);
    const beatLoc = beatId ? beatById.get(beatId)?.locationId : null;
    if (beatLoc) occupied.add(beatLoc);

    const maxOccupants = liIds.length + (beatLoc ? 1 : 0);
    const required = Math.min(2, available.size, maxOccupants);
    if (occupied.size < required) {
      issues.push({
        severity: 'error',
        scope: `slots/${s}`,
        message: `слот ${s}: занято локаций ${occupied.size} из требуемых ${required} — игроку не из чего выбирать`,
      });
    }
  }

  // Пол присутствия по актам.
  for (let act = 1; act <= calendar.actBoundaries.length; act++) {
    const win = actSlotWindow(act, calendar);
    const floor = Math.ceil((win.toSlot - win.fromSlot + 1) / ON_STAGE_ACT_DIVISOR);
    for (const liId of liIds) {
      let onStage = 0;
      for (let s = win.fromSlot; s <= win.toSlot; s++) if (schedule[liId][s] != null) onStage++;
      if (onStage < floor) {
        issues.push({
          severity: 'warning',
          scope: `coverage/${liId}`,
          message: `LI "${liId}" на сцене ${onStage} слотов в акте ${act} — меньше пола ${floor}`,
        });
      }
    }
  }

  return issues;
}
