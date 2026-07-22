import type { AnchorBeat, Brief, DraftScene, EndingVariant, WorldModel } from './types';
import {
  DEFAULT_LOCATION_MOOD,
  COMMON_RELATIONSHIP_VARS,
  endingKey,
  isLocationMood,
  isSpecialAmbientKind,
} from './types';
import type { DialogueUnit, DialogueUnitNode } from './dialogueUnit';
import type { CharacterGenState, ImageGenState, AudioTrackState, LiAudioState } from './narrativeStore';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { PHASES_PER_SLOT, CHOICE_PATH_DELTA_CAP } from './calendarTypes';
import { unitEstablishes } from './parseEventPool';
import { applyBeatChain } from './beatChain';
import { applyLadderGuards } from './ladderGuards';
import { ARCHETYPES } from './archetypes';
import { assignPositions, escapeNL, imageUrlFor } from './convertToGameProject';
import { pickCharacterEmotion, resolveEmotionToSpriteUrl } from './emotionResolver';
import { audioUrlFor, buildSceneAudioProfile, resolveSfxUrl, selectedTrackFile } from './audioResolver';
import {
  DEFAULT_BUNDLE_SETTINGS,
  DEFAULT_SELECTOR_CONFIG,
  STORY_BUNDLE_FORMAT_VERSION,
  bracketThresholdsFor,
  type BundleAnchor,
  type BundleCastMember,
  type BundleLocation,
  type CompiledBeat,
  type CompiledEnding,
  type Effect,
  type Guard,
  type RenderedLine,
  type RenderedSprite,
  type SelectorConfig,
  type StoryBundleV2,
  type StoryletUnit,
  type UnitSceneNode,
  type UnitVariant,
} from 'gu-engine-story-core';

/**
 * Сборщик storylet-бандла (`.gu.json` v2) — единственный компилятор историй.
 *
 * Компилятор больше НЕ разворачивает пул в граф. Он делает ровно то, что
 * обязано случиться один раз на этапе генерации, и ни шагом больше:
 *
 *   1. применяет канонные идемпотентные трансформы — гейты лестницы
 *      (applyLadderGuards) и цепочку порядка битов (applyBeatChain);
 *   2. рендерит прозу в строки со спрайтами и звуком (эмоции → позы → URL);
 *   3. запекает то, что в рантайме уже не вычислить: пороги тона по архетипу,
 *      условия концовок, дефолты отношений;
 *   4. сериализует пул.
 *
 * Всё остальное — созревание битов, открытие встреч, выбор тона, продолжение
 * разговора, прощание, маршрутизация концовок — стало ПРАВИЛОМ РАНТАЙМА
 * (story_core/director.ts). Поэтому здесь нет ни узлов, ни рёбер, ни порядка
 * их проводки: класс багов «guard выразили условием не в том порядке» исчез
 * вместе с трансляцией.
 */

export type StoryletBundleAudioInput = {
  base: AudioTrackState | null;
  moodBeds: Record<string, AudioTrackState>;
  specialBeds: Record<string, AudioTrackState>;
  byLi: Record<string, LiAudioState>;
  sfx: Record<string, string>;
};

export type StoryletAnchorsInput = {
  narrations?: Record<number, { label: string; narration: string }>;
  tagMap?: Record<string, string[]> | null;
};

export type StoryletBundleStats = {
  locations: number;
  units: number;
  /** Юнитов, отброшенных без прозы — они бы не сыграли. */
  unitsWithoutProse: number;
  variants: number;
  sceneNodes: number;
  beats: number;
  beatsWired: number;
  branchPoints: number;
  /**
   * Ветвовых битов: guard требует флаг исхода развилки — контент одной ветки.
   * Инвариант линейного роста: ветка добавляет ровно эти биты, а не копии
   * графа (ассерт в тестах).
   */
  branchExclusiveBeats: number;
  endings: number;
  slotCount: number;
};

export type StoryletBundleResult = {
  bundle: StoryBundleV2;
  stats: StoryletBundleStats;
};

export type StoryletBundleOptions = {
  /**
   * Юнитам без прозы подставить сцену-заглушку вместо того, чтобы выбросить.
   *
   * Нужно story QA: симуляция политик обязана судить СТРУКТУРУ (достижимость
   * ступеней, проходимость лестницы, доходимость финала) ещё до того, как
   * оплачена генерация диалогов. Иначе QA до стадии прозы видел бы пустой пул
   * и радостно докладывал, что всё в порядке. В экспорт игры заглушки не идут:
   * там опция выключена, и юнит без прозы честно выпадает из бандла.
   */
  stubMissingProse?: boolean;
  /** Настройки селектора; нет — дефолтные веса ядра. */
  selector?: SelectorConfig;
};

/**
 * Заглушка сцены: вход с двумя выборами (тёплый/холодный) и закрывающий узел.
 *
 * Выборы обязательны, а не для вида. Канал выборов — половина валюты арки, и
 * заглушка без него сделала бы прилежного и безразличного игрока
 * неразличимыми: симуляция перестала бы отвечать на вопрос «доходима ли
 * лестница вообще» и «нельзя ли проскочить ступень нахрапом». Границы взяты
 * те же, что кламп реальных диалогов (CHOICE_PATH_DELTA_CAP).
 */
function stubVariant(liId: string, liName: string, goal: string): UnitVariant {
  const rel = (delta: number): Effect[] =>
    liId ? [{ rel: { char: liId, var: 'affection', delta, clamp: [-1, 1] } }] : [];
  return {
    bracket: 'neutral',
    entryNodeId: 'stub',
    nodes: [
      {
        id: 'stub',
        lines: [{ speaker: liName, text: `[без прозы: ${goal}]` }],
        choices: [
          { id: 'stub_warm', text: '[тепло]', effects: rel(CHOICE_PATH_DELTA_CAP), next: 'stub_end' },
          { id: 'stub_cold', text: '[холодно]', effects: rel(-CHOICE_PATH_DELTA_CAP), next: 'stub_end' },
        ],
      },
      { id: 'stub_end', lines: [], choices: [] },
    ],
  };
}

/** «Вершина арки этого LI сыграна» — H-гейт good-концовки. */
const arcPeakFlag = (liId: string) => `arc_peak_${liId}`;

const setFlag = (flag: string): Effect => ({ setFlag: flag });

/** Флаги guard-а — для объявления вселенной флагов в схеме. */
function guardFlagNames(guard: Guard): string[] {
  if ('all' in guard) return guard.all.flatMap(guardFlagNames);
  if ('any' in guard) return guard.any.flatMap(guardFlagNames);
  if ('not' in guard) return guardFlagNames(guard.not);
  if ('flag' in guard) return [guard.flag];
  return [];
}

/** Конъюнкция без вложенности пустых all — читаемее в отладке и трейсах. */
function andGuards(parts: Guard[]): Guard {
  const flat = parts.flatMap(g => ('all' in g ? g.all : [g]));
  return { all: flat };
}

export function buildStoryletBundle(
  brief: Brief,
  rawSpine: SpinePlan,
  calendar: Calendar,
  schedule: CharacterSchedule,
  worldModel: WorldModel,
  spineBeatProse: Record<string, AnchorBeat> = {},
  unitProse: Record<string, DialogueUnit[]> = {},
  eventUnits: Record<string, EventUnit> = {},
  endings: Record<string, EndingVariant> = {},
  images: Record<string, ImageGenState> = {},
  characters: Record<string, CharacterGenState> = {},
  audio: StoryletBundleAudioInput = { base: null, moodBeds: {}, specialBeds: {}, byLi: {}, sfx: {} },
  anchors: StoryletAnchorsInput = {},
  options: StoryletBundleOptions = {},
): StoryletBundleResult {
  const locById = new Map(worldModel.locations.map(l => [l.id, l]));
  const bgForLocation = (locId: string): string => imageUrlFor(images[`loc:${locId}`]);
  const liNameById = new Map(brief.loveInterests.map(li => [li.id, li.name]));
  const liIds = new Set(brief.loveInterests.map(li => li.id));

  // Канонные точки чтения: лестница и цепочка битов идемпотентны и обязаны
  // звучать одинаково у компилятора, валидаторов и story QA — иначе игра,
  // валидатор и QA разойдутся. Персистнутые истории чинятся прямо здесь,
  // без миграции.
  const ladder = applyLadderGuards(
    Object.values(eventUnits).filter(u => u.kind === 'dialogue' && u.at.locationId != null && u.at.slot != null),
    rawSpine,
    calendar,
    brief,
  );
  const poolUnits = [...ladder.units].sort(
    (a, b) => a.at.slot!.fromSlot - b.at.slot!.fromSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const spine = applyBeatChain(ladder.spine, calendar, liIds, poolUnits);

  /** Персонаж, к чьим отношениям относится сцена (ctx.x модели событий). */
  const primaryLiOf = (participants: string[]): string => participants.find(p => liIds.has(p)) ?? '';

  const thresholdsOf = (liId: string) => bracketThresholdsFor(ladder.plan.startByLi.get(liId) ?? 0.15);

  // ── Рендер прозы: узел диалога → строки со спрайтами ────────────────────

  /** Адаптер узла юнита под DraftScene-хелперы (pickCharacterEmotion и др.). */
  const nodeAsDraftScene = (node: DialogueUnitNode): DraftScene => ({
    id: node.id,
    location: '',
    timeMarker: '',
    charactersPresent: node.charactersPresent,
    characterEmotions: node.characterEmotions,
    narration: node.narration,
    dialogue: node.dialogue,
    choices: [],
  });

  let sceneNodeCount = 0;

  function renderNode(un: DialogueUnitNode): UnitSceneNode {
    sceneNodeCount++;
    const draft = nodeAsDraftScene(un);
    const positions = assignPositions(un.charactersPresent.length);
    const sprites: RenderedSprite[] = [];
    const spriteIndexByChar = new Map<string, number>();
    for (let ci = 0; ci < un.charactersPresent.length; ci++) {
      const charId = un.charactersPresent[ci];
      const emotion = pickCharacterEmotion(draft, charId);
      const { url } = resolveEmotionToSpriteUrl(characters[charId], emotion);
      if (url) {
        spriteIndexByChar.set(charId, sprites.length);
        sprites.push({ url, position: positions[ci] ?? 'center' });
      }
    }

    // Пер-строчный трек: спрайт говорящего следует эмоции ЕГО реплики,
    // остальные персонажи держат эмоцию узла.
    const baseSprites = sprites.length ? sprites : undefined;
    const spritesForLine = (dl: DialogueUnitNode['dialogue'][number]): RenderedSprite[] | undefined => {
      const si = spriteIndexByChar.get(dl.speaker);
      if (si === undefined) return baseSprites;
      const emotion = dl.emotion || pickCharacterEmotion(draft, dl.speaker);
      const { url } = resolveEmotionToSpriteUrl(characters[dl.speaker], emotion);
      if (!url || url === sprites[si].url) return baseSprites;
      return sprites.map((s, i) => (i === si ? { ...s, url } : s));
    };

    const lines: RenderedLine[] = [];
    const narrationText = escapeNL(un.narration);
    if (narrationText) {
      // Нарратив узла — сценическая ремарка к ПЕРВОЙ реплике («её голос
      // становится мягче…»), поэтому наследует её позу, а не узловую.
      const firstLine = un.dialogue[0];
      lines.push({ text: narrationText, sprites: firstLine ? spritesForLine(firstLine) : baseSprites });
    }
    for (const dl of un.dialogue) {
      lines.push({ speaker: liNameById.get(dl.speaker) ?? dl.speaker, text: dl.line, sprites: spritesForLine(dl) });
    }

    return {
      id: un.id,
      lines,
      choices: un.choices.map(c => {
        // Выбор несёт ТОЛЬКО собственные эффекты: движенческие живут на
        // закрытии сцены. Численные пути дельт («relationship[li].affection»)
        // разворачиваются в rel-эффекты алгебры — в бандле нет строковых путей.
        const effects: Effect[] = [];
        for (const [path, delta] of Object.entries(c.effects.stateDeltas ?? {})) {
          const m = /^relationship\[(.+?)\]\.(.+)$/.exec(path);
          if (m) effects.push({ rel: { char: m[1], var: m[2], delta, clamp: [-1, 1] } });
        }
        for (const f of c.effects.flagSet ?? []) effects.push(setFlag(f));
        return { id: c.id, text: c.text, effects, next: c.next };
      }),
    };
  }

  function renderFarewell(u: DialogueUnit): UnitVariant['farewell'] {
    if (!u.farewell || (!u.farewell.narration && u.farewell.dialogue.length === 0)) return undefined;
    const lines: RenderedLine[] = [];
    const narration = escapeNL(u.farewell.narration);
    if (narration) lines.push({ text: narration });
    for (const dl of u.farewell.dialogue) {
      lines.push({ speaker: liNameById.get(dl.speaker) ?? dl.speaker, text: dl.line });
    }
    return lines.length ? { lines } : undefined;
  }

  // ── Юниты пула ─────────────────────────────────────────────────────────
  const units: StoryletUnit[] = [];
  const peakWiredLis = new Set<string>();
  let unitsWithoutProse = 0;
  let variantCount = 0;

  for (const u of poolUnits) {
    const locId = u.at.locationId!;
    if (!locById.has(locId)) continue;

    const prose = (unitProse[u.id] ?? []).filter(p => Array.isArray(p?.nodes));
    if (prose.length === 0) {
      // Без прозы юнит не сыграет; молча ронять его — терять контент незаметно.
      unitsWithoutProse++;
      if (!options.stubMissingProse) continue;
    }

    const liId = primaryLiOf(u.participants) || (u.participants[0] ?? '');

    // Эффекты закрытия. Валюта арки — детерминированный гейн ступени, а НЕ
    // relEffects от LLM: жирные значения фармились бы холодной прогонкой,
    // нулевые делали бы пороги недостижимыми. Вторую половину шага несут выборы.
    const effectsOnClose: Effect[] = unitEstablishes(u).map(setFlag);
    const gain = ladder.plan.closingGain.get(u.id) ?? 0;
    if (gain > 0 && liId) {
      effectsOnClose.push({ rel: { char: liId, var: 'affection', delta: gain, clamp: [-1, 1] } });
    }
    // Вершина арки — флагом, а не «сыгран юнит N»: ступень несут несколько
    // юнитов, и «любой из» иначе не выразить.
    if (liId && (u.arcStage ?? 1) >= ladder.plan.stageCount) {
      effectsOnClose.push(setFlag(arcPeakFlag(liId)));
      peakWiredLis.add(liId);
    }

    const variants: UnitVariant[] =
      prose.length === 0
        ? [stubVariant(liId, liNameById.get(liId) ?? liId, u.goal)]
        : prose.map(p => {
            variantCount++;
            return {
              bracket: p.bracket,
              entryNodeId: p.entryNodeId,
              nodes: p.nodes.map(renderNode),
              farewell: renderFarewell(p),
            };
          });

    units.push({
      id: u.id,
      li: liId,
      participants: u.participants,
      at: { locationId: locId, slot: u.at.slot!, ...(u.at.phase ? { phase: u.at.phase } : {}) },
      guard: u.guard,
      effectsOnClose,
      ...(u.arcStage != null ? { arcStage: u.arcStage } : {}),
      source: u.source,
      // Приоритет пула инвертируется в вес: меньший priority значил «раньше»,
      // селектор же ранжирует по убыванию.
      weight: Math.max(0.1, 1 / Math.max(1, u.priority / 10)),
      goal: u.goal,
      variants,
      ...(liId ? { audioProfile: buildSceneAudioProfile(liId, audio.byLi[liId]) } : {}),
      ...(prose[0]?.nodes[0]
        ? { sfxUrl: resolveSfxUrl(pickCharacterEmotion(nodeAsDraftScene(prose[0].nodes[0]), liId), audio.sfx) }
        : {}),
    });
  }

  // ── Биты хребта ────────────────────────────────────────────────────────
  const wirableBeats = spine.beats.filter(b => locById.has(b.locationId));

  const beats: CompiledBeat[] = wirableBeats.map((beat: SpineBeat) => ({
    id: beat.id,
    kind: beat.kind,
    // Финал достаёт до ПОТОЛКА клампа: последний якорь («лечь спать» в
    // последний вечер) упирает slot в slotCount, и финал с окном до
    // slotCount-1 стал бы недостижим — игра кончалась бы ничем.
    window:
      beat.kind === 'finale'
        ? { fromSlot: beat.window.fromSlot, toSlot: Math.max(beat.window.toSlot, calendar.slotCount) }
        : beat.window,
    locationId: beat.locationId,
    participants: beat.participants,
    guard: beat.guard,
    effects: beat.establishes.map(setFlag),
    ...(beat.outcomes && beat.outcomes.length > 0
      ? {
          outcomes: beat.outcomes.map(o => ({
            id: o.id,
            label: o.label || o.summary || o.id,
            effects: [setFlag(o.setsFlag)],
          })),
        }
      : {}),
    text: spineBeatProse[beat.id]?.beatText?.trim() || escapeNL(beat.summary) || `[бит ${beat.id}]`,
    background: bgForLocation(beat.locationId),
  }));

  // ── Концовки: запекаем пороги, чтобы рантайм не знал про архетипы ──────
  const affectionMid = (liId: string): number => {
    const li = brief.loveInterests.find(l => l.id === liId);
    const init = li ? ARCHETYPES[li.archetype]?.initialState?.affection : undefined;
    return init ? (init[0] + init[1]) / 2 : 0;
  };
  const clampRel = (v: number) => Math.max(-1, Math.min(1, v));

  const finaleBeat = wirableBeats.find(b => b.kind === 'finale') ?? null;
  const endingBackground = finaleBeat ? bgForLocation(finaleBeat.locationId) : '';

  const compiledEndings: CompiledEnding[] = spine.endings
    .map(e => ({ ending: e, variant: endings[endingKey(e.kind, e.liId)] }))
    .filter((w): w is { ending: SpinePlan['endings'][number]; variant: EndingVariant } => Boolean(w.variant))
    .map(({ ending, variant }) => {
      const parts: Guard[] = [ending.guard];
      if (ending.kind === 'good' && ending.liId) {
        parts.push({
          rel: { char: ending.liId, var: 'affection', op: '>=', value: clampRel(affectionMid(ending.liId) + 0.25) },
        });
        // H-компонента: affection можно накопить болтовнёй, а вершину арки —
        // только сыграв. Гейтим лишь тех, чья вершина реально проведена, иначе
        // концовка требовала бы флаг, который никто не ставит.
        if (peakWiredLis.has(ending.liId)) parts.push({ flag: arcPeakFlag(ending.liId) });
      }
      if (ending.kind === 'bad') {
        for (const li of brief.loveInterests) {
          parts.push({ rel: { char: li.id, var: 'affection', op: '<=', value: clampRel(affectionMid(li.id) - 0.15) } });
        }
      }
      return {
        id: ending.id,
        kind: ending.kind,
        liId: ending.liId ?? null,
        guard: andGuards(parts),
        scenes: variant.scenes.map(sc => ({ text: escapeNL(sc.narration) })),
        background: endingBackground,
      };
    });

  // Порядок проверки концовок: сначала условные (в порядке хребта), потом
  // безусловные — режиссёр берёт первую удовлетворённую, и безусловная,
  // оказавшись раньше, закрыла бы собой все остальные.
  compiledEndings.sort((a, b) => {
    const an = guardLeaves(a.guard) === 0 ? 1 : 0;
    const bn = guardLeaves(b.guard) === 0 ? 1 : 0;
    return an - bn;
  });

  // ── Мир, старт, дом ────────────────────────────────────────────────────
  // Стартовая локация — там, где стоит самый ранний бит: игра начинается с
  // сюжета, а не с пустого хаба.
  const startLocationId =
    [...wirableBeats].sort(
      (a, b) =>
        a.window.fromSlot - b.window.fromSlot ||
        a.window.toSlot - b.window.toSlot ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0]?.locationId ??
    worldModel.locations[0]?.id ??
    '';

  // Дом героя: куда уводит сон. Тег 'home' — договорённость tagMap; его нет
  // (старые истории, пустой tagMap) — спим там же, где начали.
  const homeLocationId =
    (anchors.tagMap?.home ?? []).find(id => locById.has(id)) ?? startLocationId ?? worldModel.locations[0]?.id ?? '';

  const locations: BundleLocation[] = worldModel.locations.map(l => ({
    id: l.id,
    name: l.name,
    description: escapeNL(l.description) || l.name,
    mood: isLocationMood(l.mood) ? l.mood : DEFAULT_LOCATION_MOOD,
    ...(isSpecialAmbientKind(l.specialKind) ? { specialKind: l.specialKind } : {}),
    background: bgForLocation(l.id),
  }));

  // Рёбра мира симметризуются на стороне рантайма; здесь — уникальные пары.
  const seenPairs = new Set<string>();
  const worldEdges: StoryBundleV2['world']['edges'] = [];
  for (const l of worldModel.locations) {
    for (const adj of l.adjacent) {
      if (!locById.has(adj.locationId)) continue;
      const key = [l.id, adj.locationId].sort().join('|');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      worldEdges.push({ from: l.id, to: adj.locationId, ...(adj.via?.trim() ? { via: adj.via.trim() } : {}) });
    }
  }

  // ── Якоря: по одному на часть дня ──────────────────────────────────────
  const perDay = calendar.dayparts.length;
  const bundleAnchors: BundleAnchor[] = [];
  for (let d = 0; d < perDay; d++) {
    const isSleep = d === perDay - 1;
    const custom = anchors.narrations?.[d];
    const nextDaypart = calendar.dayparts[(d + 1) % perDay];
    bundleAnchors.push({
      daypartIndex: d,
      label: custom?.label?.trim() || (isSleep ? 'Пойти спать' : `Двигаться дальше: ${nextDaypart}`),
      narration:
        custom?.narration?.trim() ||
        (isSleep
          ? 'Ты возвращаешься домой. День закончился; сон приходит быстро.'
          : `Время идёт своим чередом. Наступает ${nextDaypart}.`),
      isSleep,
    });
  }

  // ── Каст и стартовые отношения ─────────────────────────────────────────
  const cast: BundleCastMember[] = brief.loveInterests.map(li => ({
    id: li.id,
    name: li.name,
    isLI: true,
    bracketThresholds: thresholdsOf(li.id),
  }));

  const relationships: Record<string, StoryBundleV2['stateSchema']['relationships'][string]> = {};
  for (const li of brief.loveInterests) {
    const arch = ARCHETYPES[li.archetype];
    const midOf = (v: string): number => {
      const initial = arch?.initialState?.[v as keyof NonNullable<typeof arch.initialState>];
      return initial ? (initial[0] + initial[1]) / 2 : 0;
    };
    const vars: Record<string, number> = {};
    for (const [k, decl] of Object.entries(arch?.additionalStateVars ?? {})) vars[k] = decl.default;
    relationships[li.id] = {
      affection: midOf('affection'),
      trust: midOf('trust'),
      tension: midOf('tension'),
      ...(Object.keys(vars).length > 0 ? { vars } : {}),
    };
  }
  // Переменные, которых нет в COMMON_RELATIONSHIP_VARS, в спектр не попадают —
  // проверка держит контракт честным, если список когда-нибудь разъедется.
  void COMMON_RELATIONSHIP_VARS;

  const flags = new Set<string>();
  for (const beat of spine.beats) {
    for (const f of beat.establishes) flags.add(f);
    for (const o of beat.outcomes ?? []) flags.add(o.setsFlag);
    for (const f of guardFlagNames(beat.guard)) flags.add(f);
  }
  for (const e of spine.endings) for (const f of guardFlagNames(e.guard)) flags.add(f);
  for (const u of units) {
    for (const f of guardFlagNames(u.guard)) flags.add(f);
    for (const eff of u.effectsOnClose) if ('setFlag' in eff) flags.add(eff.setFlag);
  }

  // ── Аудио ──────────────────────────────────────────────────────────────
  const bgmUrl = audioUrlFor(selectedTrackFile(audio.base));
  const ambientByMood: Record<string, string> = {};
  if (bgmUrl) ambientByMood[DEFAULT_LOCATION_MOOD] = bgmUrl;
  for (const [mood, track] of Object.entries(audio.moodBeds ?? {})) {
    const url = audioUrlFor(selectedTrackFile(track));
    if (url) ambientByMood[mood] = url;
  }
  const ambientBySpecial: Record<string, string> = {};
  for (const [kind, track] of Object.entries(audio.specialBeds ?? {})) {
    const url = audioUrlFor(selectedTrackFile(track));
    if (url) ambientBySpecial[kind] = url;
  }

  const outcomeFlags = new Set<string>();
  for (const beat of spine.beats) for (const o of beat.outcomes ?? []) outcomeFlags.add(o.setsFlag);

  const bundle: StoryBundleV2 = {
    formatVersion: STORY_BUNDLE_FORMAT_VERSION,
    title: spine.title?.trim() || `${brief.world.setting.place} — пилот`,
    meta: { generator: 'buildStoryletBundle' },
    stateSchema: { relationships, flags: [...flags] },
    calendar: {
      days: calendar.days,
      dayparts: calendar.dayparts,
      slotCount: calendar.slotCount,
      actBoundaries: calendar.actBoundaries,
      phasesPerSlot: PHASES_PER_SLOT,
    },
    world: { locations, edges: worldEdges, startLocationId, homeLocationId },
    cast,
    schedule,
    units,
    spine: { beats, endings: compiledEndings, logline: spine.logline ?? '' },
    anchors: bundleAnchors,
    intro: {
      text: escapeNL(spine.logline) || `${brief.world.setting.place}. История начинается.`,
      background: bgForLocation(startLocationId),
    },
    selector: options.selector ?? DEFAULT_SELECTOR_CONFIG,
    audio: {
      ...(bgmUrl ? { bgmUrl, crossfadeDurationMs: 2000, bgmVolume: 0.3, sfxVolume: 0.5 } : {}),
      ...(Object.keys(ambientByMood).length > 0 ? { ambientByMood } : {}),
      ...(Object.keys(ambientBySpecial).length > 0 ? { ambientBySpecial } : {}),
    },
    settings: DEFAULT_BUNDLE_SETTINGS,
  };

  return {
    bundle,
    stats: {
      locations: worldModel.locations.length,
      units: units.length,
      unitsWithoutProse,
      variants: variantCount,
      sceneNodes: sceneNodeCount,
      beats: spine.beats.length,
      beatsWired: wirableBeats.length,
      branchPoints: spine.beats.filter(b => b.kind === 'branchPoint').length,
      branchExclusiveBeats: spine.beats.filter(b => guardFlagNames(b.guard).some(f => outcomeFlags.has(f))).length,
      endings: compiledEndings.length,
      slotCount: calendar.slotCount,
    },
  };
}

/** Число листьев guard-а; 0 = безусловный. */
function guardLeaves(guard: Guard): number {
  if ('all' in guard) return guard.all.reduce((n, g) => n + guardLeaves(g), 0);
  if ('any' in guard) return guard.any.reduce((n, g) => n + guardLeaves(g), 0);
  if ('not' in guard) return guardLeaves(guard.not);
  return 1;
}
