import type {
  BeatPlan,
  Brief,
  DialogueVariant,
  AnchorBeat,
  StoryAnchor,
  StoryOutlinePlan,
  WorldModel,
  LocationMood,
} from './types';
import { LOCATION_MOOD_LABELS, SPECIAL_AMBIENT_KIND_LABELS, isLocationMood } from './types';
import { topoOrderAnchors } from './anchorOrder';
import type { EventDef, SceneRef } from './events';

/**
 * Монтажная модель playground-а («Монтажный стол», макет 4a): срезы времени
 * z = топологический порядок якорей outline, позиции персонажей per-срез,
 * производный реестр EventDef и данные для ленты кадров / таймлайна /
 * мини-карты переходов.
 *
 * Источник правды — существующие артефакты пайплайна (outline, beatPlan,
 * dialogueVariants, worldModel); модель ничего не персистит, всё выводится
 * на лету. Маппинг по спеке «Модель событий» §5:
 *   - availableLIs  → участники + at(char, loc)
 *   - establishes   → state_change с setFlag-эффектами
 *   - dialogueVariants (positive/neutral/negative) → ветки bracket(affection)
 *   - смена локации между соседними срезами → move-событие
 */

export type MontageCharacter = {
  id: string;
  name: string;
  color: string;
  /** 1-2 буквы для фишки-токена. */
  initial: string;
  archetype: string;
};

export type SliceEventView = {
  def: EventDef;
  /** Сквозной номер-метка: e1, e2, … (связывает ромб на линии и карточку). */
  n: string;
  z: number;
  /** Основной участник (цвет ромба/карточки); null → нейтральный (акт). */
  charId: string | null;
  title: string;
  /** «Если» — компакт для карточки (полный guard — в инспекторе). */
  condText: string;
  effectText: string;
  hasScene: boolean;
  sceneStatus: { done: number; total: number } | null;
  kindIcon: string;
};

export type MontageSlice = {
  z: number;
  anchor: StoryAnchor;
  locationId: string | null;
  locationName: string;
  /** Подпись эмбиента локации: «весёлая · клуб» или null. */
  ambientLabel: string | null;
  /** charId → locationId; отсутствие/null = за кадром. */
  placements: Record<string, string | null>;
  presentCharIds: string[];
  events: SliceEventView[];
};

export type CharacterMove = {
  charId: string;
  fromZ: number;
  toZ: number;
  fromLoc: string;
  toLoc: string;
};

export type MontageLocation = {
  id: string;
  name: string;
  shortName: string;
};

export type MontageModel = {
  slices: MontageSlice[];
  characters: MontageCharacter[];
  /** Смены локаций между соседними срезами (рёбра мини-карты, стрелки). */
  moves: CharacterMove[];
  /** Дорожки присутствия для таймлайна: charId → [zFrom, zTo] интервалы. */
  presence: Record<string, Array<[number, number]>>;
  locations: MontageLocation[];
  /** Допустимые пути между локациями (серые рёбра мини-карты). */
  adjacency: Array<[string, string]>;
  acts: Array<{ act: number; fromZ: number; toZ: number }>;
};

/** Палитра линий LI — в тон макету (Кира/Юки/Асель) + запас на большой каст. */
export const LI_LINE_PALETTE = ['#b45309', '#0369a1', '#be185d', '#0f766e', '#7c3aed', '#4d7c0f'];

export function liLineColor(index: number): string {
  return LI_LINE_PALETTE[index % LI_LINE_PALETTE.length];
}

const shorten = (name: string, max = 8): string => {
  const first = name.split(/[,«»]/)[0].trim();
  return first.length <= max ? first : `${first.slice(0, max - 1)}.`;
};

const truncate = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

export type MontageInputs = {
  brief: Brief;
  outline: StoryOutlinePlan;
  worldModel: WorldModel | null;
  beatPlan: BeatPlan | null;
  /** Ключ — `${anchorId}:${liId}` (encounterKey нарратив-стора). */
  dialogueVariants: Record<string, DialogueVariant[]>;
  anchorBeats: Record<string, AnchorBeat>;
};

export function deriveMontageModel(inputs: MontageInputs): MontageModel {
  const { brief, outline, worldModel, beatPlan, dialogueVariants, anchorBeats } = inputs;

  const characters: MontageCharacter[] = brief.loveInterests.map((li, i) => ({
    id: li.id,
    name: li.name || li.id,
    color: liLineColor(i),
    initial: (li.name || li.id).slice(0, 1).toUpperCase(),
    archetype: li.archetype,
  }));

  const orderedAnchors = topoOrderAnchors(outline);
  const locById = new Map((worldModel?.locations ?? []).map(l => [l.id, l]));

  // Локация среза: worldModel.anchorLocations → id; без модели мира — свободный
  // текст anchor.location как псевдо-id (карта переходов тогда строится по нему).
  const sliceLocationId = (a: StoryAnchor): string | null => {
    const mapped = worldModel?.anchorLocations[a.id];
    if (mapped) return mapped;
    return a.location ? a.location : null;
  };
  const locationName = (locId: string | null, a: StoryAnchor): string => {
    if (locId && locById.has(locId)) return locById.get(locId)!.name || locId;
    return a.location || locId || '—';
  };

  const ambientLabel = (locId: string | null): string | null => {
    const loc = locId ? locById.get(locId) : undefined;
    if (!loc) return null;
    const moodLabel = isLocationMood(loc.mood) ? LOCATION_MOOD_LABELS[loc.mood as LocationMood] : null;
    const specialLabel = loc.specialKind ? SPECIAL_AMBIENT_KIND_LABELS[loc.specialKind] : null;
    if (moodLabel && specialLabel) return `${moodLabel} · ${specialLabel}`;
    return specialLabel ?? moodLabel;
  };

  const encountersByAnchor = new Map<string, { liId: string; goal: string; beatType: string | null }[]>();
  for (const e of beatPlan?.encounters ?? []) {
    const list = encountersByAnchor.get(e.anchorId) ?? [];
    list.push({ liId: e.liId, goal: e.goal, beatType: e.beatType });
    encountersByAnchor.set(e.anchorId, list);
  }

  const charName = (id: string) => characters.find(c => c.id === id)?.name ?? id;

  // ── Срезы: позиции и производные события ─────────────────────────────────
  const slices: MontageSlice[] = orderedAnchors.map((anchor, z) => {
    const locId = sliceLocationId(anchor);
    const placements: Record<string, string | null> = {};
    for (const c of characters) {
      placements[c.id] = anchor.availableLIs.includes(c.id) ? locId : null;
    }
    const presentCharIds = characters.filter(c => placements[c.id] != null).map(c => c.id);

    const events: SliceEventView[] = [];

    // Диалоги: запланированные встречи; без beatPlan — каждый присутствующий LI.
    const encounterLis =
      encountersByAnchor.get(anchor.id)?.filter(e => presentCharIds.includes(e.liId)) ??
      presentCharIds.map(liId => ({ liId, goal: '', beatType: null }));
    for (const enc of encounterLis) {
      const variants = dialogueVariants[`${anchor.id}:${enc.liId}`] ?? [];
      const scene: SceneRef = { kind: 'dialogue', anchorId: anchor.id, liId: enc.liId };
      const def: EventDef = {
        id: `dlg_${anchor.id}_${enc.liId}`,
        kind: 'dialogue',
        at: { anchorId: anchor.id, locationId: locId ?? undefined },
        participants: [enc.liId],
        guard: { at: { char: enc.liId, loc: locId ?? '' } },
        effects: [],
        scene,
        priority: 10 + events.length,
      };
      events.push({
        def,
        n: '',
        z,
        charId: enc.liId,
        title: `${charName(enc.liId)} × героиня`,
        condText: variants.length > 0 ? 'bracket(affection)' : `co-location · ${locationName(locId, anchor)}`,
        effectText: enc.goal ? truncate(enc.goal, 60) : '—',
        hasScene: true,
        sceneStatus: { done: variants.length, total: 3 },
        kindIcon: 'Д',
      });
    }

    // Событие якоря: establishes → setFlag; сцена — anchor beat, если есть.
    if (anchor.establishes.length > 0 || anchorBeats[anchor.id]) {
      const beat = anchorBeats[anchor.id];
      const def: EventDef = {
        id: `flag_${anchor.id}`,
        kind: 'state_change',
        at: { anchorId: anchor.id, locationId: locId ?? undefined },
        participants: [],
        guard: { all: [] },
        effects: anchor.establishes.map(f => ({ setFlag: f })),
        scene: beat ? { kind: 'beat', anchorId: anchor.id } : null,
        priority: 50,
      };
      events.push({
        def,
        n: '',
        z,
        charId: null,
        title: truncate(anchor.summary || anchor.id, 40),
        condText: 'true',
        effectText: anchor.establishes.length > 0 ? anchor.establishes.map(f => `+${f}`).join(' · ') : '—',
        hasScene: Boolean(beat),
        sceneStatus: beat ? { done: 1, total: 1 } : null,
        kindIcon: '⚑',
      });
    }

    return {
      z,
      anchor,
      locationId: locId,
      locationName: locationName(locId, anchor),
      ambientLabel: ambientLabel(locId),
      placements,
      presentCharIds,
      events,
    };
  });

  // ── Перемещения между соседними срезами → move-события + рёбра карты ─────
  const moves: CharacterMove[] = [];
  for (const c of characters) {
    for (let z = 1; z < slices.length; z++) {
      const from = slices[z - 1].placements[c.id];
      const to = slices[z].placements[c.id];
      if (from && to && from !== to) {
        moves.push({ charId: c.id, fromZ: z - 1, toZ: z, fromLoc: from, toLoc: to });
        const def: EventDef = {
          id: `move_${slices[z].anchor.id}_${c.id}`,
          kind: 'move_in',
          at: { anchorId: slices[z].anchor.id, locationId: to },
          participants: [c.id],
          guard: { at: { char: c.id, loc: from } },
          effects: [{ move: { char: c.id, to } }],
          scene: null,
          priority: 30,
        };
        slices[z].events.push({
          def,
          n: '',
          z,
          charId: c.id,
          title: `${charName(c.id)} → ${shorten(locationName(to, slices[z].anchor), 14)}`,
          condText: `at(${c.id}, ${from})`,
          effectText: `move(${c.id} → ${to})`,
          hasScene: false,
          sceneStatus: null,
          kindIcon: 'П',
        });
      }
    }
  }

  // ── Сквозная нумерация e1…eN: по z, затем по priority ────────────────────
  let counter = 0;
  for (const slice of slices) {
    slice.events.sort((a, b) => a.def.priority - b.def.priority);
    for (const ev of slice.events) {
      counter++;
      ev.n = `e${counter}`;
    }
  }

  // ── Дорожки присутствия для таймлайна ────────────────────────────────────
  const presence: Record<string, Array<[number, number]>> = {};
  for (const c of characters) {
    const ranges: Array<[number, number]> = [];
    let start: number | null = null;
    slices.forEach((s, z) => {
      const here = s.placements[c.id] != null;
      if (here && start === null) start = z;
      if (!here && start !== null) {
        ranges.push([start, z - 1]);
        start = null;
      }
    });
    if (start !== null) ranges.push([start, slices.length - 1]);
    presence[c.id] = ranges;
  }

  // ── Локации и допустимые пути для мини-карты ─────────────────────────────
  const usedLocIds = new Set<string>();
  for (const s of slices) if (s.locationId) usedLocIds.add(s.locationId);
  for (const m of moves) {
    usedLocIds.add(m.fromLoc);
    usedLocIds.add(m.toLoc);
  }
  const locations: MontageLocation[] = worldModel
    ? worldModel.locations.map(l => ({ id: l.id, name: l.name || l.id, shortName: shorten(l.name || l.id) }))
    : [...usedLocIds].map(id => ({ id, name: id, shortName: shorten(id) }));

  const adjacency: Array<[string, string]> = [];
  const seenPairs = new Set<string>();
  const addPair = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (a === b || seenPairs.has(key)) return;
    seenPairs.add(key);
    adjacency.push(a < b ? [a, b] : [b, a]);
  };
  if (worldModel) {
    for (const loc of worldModel.locations) {
      for (const adj of loc.adjacent) addPair(loc.id, adj.locationId);
    }
  } else {
    // Без модели мира — рёбра из фактических переходов персонажей и героини.
    for (const m of moves) addPair(m.fromLoc, m.toLoc);
    for (let z = 1; z < slices.length; z++) {
      const a = slices[z - 1].locationId;
      const b = slices[z].locationId;
      if (a && b) addPair(a, b);
    }
  }

  // ── Полоса актов ─────────────────────────────────────────────────────────
  const acts: Array<{ act: number; fromZ: number; toZ: number }> = [];
  for (const s of slices) {
    const last = acts[acts.length - 1];
    if (last && last.act === s.anchor.act) last.toZ = s.z;
    else acts.push({ act: s.anchor.act, fromZ: s.z, toZ: s.z });
  }

  return { slices, characters, moves, presence, locations, adjacency, acts };
}
