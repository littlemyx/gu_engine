import type {
  AnchorBeat,
  Brief,
  DialogueVariant,
  EndingVariant,
  StoryAnchor,
  StoryOutlinePlan,
  WorldLocation,
  WorldModel,
} from './types';
import { DEFAULT_LOCATION_MOOD, isLocationMood, isSpecialAmbientKind } from './types';
import type { CharacterGenState, ImageGenState, AudioTrackState, LiAudioState } from './narrativeStore';
import type {
  GameProjectFile,
  GameSceneEdge,
  GameSceneGraph,
  GameSceneNode,
  GameSceneOutput,
  GameSpriteEntry,
  GameStateCondition,
  GameWorldManifest,
} from './convertToGameProject';
import {
  BRACKET_WIRE_ORDER,
  assignPositions,
  bracketCondition,
  buildStoryStateSchema,
  escapeNL,
  imageUrlFor,
  renderDraftSceneText,
} from './convertToGameProject';
import { ARCHETYPES } from './archetypes';
import { pickCharacterEmotion, resolveEmotionToSpriteUrl } from './emotionResolver';
import { audioUrlFor, buildSceneAudioProfile, resolveSfxUrl, selectedTrackFile } from './audioResolver';
import { directPredecessors, topoOrderAnchors } from './anchorOrder';

/**
 * Компиляция игры из трёх осей мира:
 *
 *   1. ПОЗИЦИЯ — граф локаций WorldModel как стейт-машина перемещения.
 *      Каждая локация = hub-узел, выходы = adjacency (детерминированные,
 *      никакой LLM-генерации маршрутов). Игрок свободно ходит по карте.
 *   2. СТРЕЛА ВРЕМЕНИ — переменная time. Перемещение её НЕ двигает;
 *      двигают значимые действия: ключевые события (+1) и диалоги-встречи
 *      (+1 на выходе). Каждое действие одноразово, абьюз «зашёл-вышел-повторил»
 *      невозможен.
 *   3. ГРАДУС ОТНОШЕНИЙ — relationship[li].affection (спектр −1..1),
 *      двигается только эффектами внутри диалогов; брекеты positive/neutral/
 *      negative выбирают вариант диалога по текущему значению.
 *
 * Доступные действия = f(локация, время, отношения):
 *   - вход в локацию идёт через router `enter_<loc>`, который проверяет
 *     «созрело ли здесь ключевое событие» (любой предок по DAG случился,
 *     само ещё нет — evt-переменные) и играет его, иначе пускает в hub;
 *   - encounter-кнопки на hub-е гейтятся evt (событие этапа уже было)
 *     и met (встреча ещё не состоялась);
 *   - ключевые события упорядочены DAG-ом outline.anchorEdges — это и есть
 *     каузальная стрела истории, а не жёсткий маршрут.
 *
 * LLM-контент, который используется: beat-сцены якорей (beatText), диалоги
 * (dialogueVariants), эпилоги (endings), описания локаций из WorldModel.
 * Narration webs НЕ нужны — маршруты больше не сочиняются текстом.
 */

export type WorldCompileStats = {
  locations: number;
  events: number;
  encountersWired: number;
  dialogueScenes: number;
  endingScenes: number;
  totalNodes: number;
  totalEdges: number;
};

export type WorldCompileResult = {
  project: GameProjectFile;
  scenes: GameSceneGraph;
  stats: WorldCompileStats;
};

const hubId = (locId: string) => `hub_${locId}`;
const enterId = (locId: string) => `enter_${locId}`;
const evtVar = (anchorId: string) => `evt[${anchorId}]`;
const metVar = (liId: string, anchorId: string) => `met[${liId}].${anchorId}`;
const TIME_VAR = 'time';

/** Диегетическая подпись перемещения: «Пойти: название (как добраться)». */
function movementLabel(to: WorldLocation, via: string): string {
  const v = via.trim();
  return v ? `Пойти: ${to.name} (${v})` : `Пойти: ${to.name}`;
}

export type WorldAudioInput = {
  base: AudioTrackState | null;
  /** Банк эмбиентов по настроению локации (LocationMood → трек). */
  moodBeds: Record<string, AudioTrackState>;
  /** Диегетические беды особых локаций (SpecialAmbientKind → трек). */
  specialBeds: Record<string, AudioTrackState>;
  byLi: Record<string, LiAudioState>;
  sfx: Record<string, string>;
};

export function compileWorldGameProject(
  brief: Brief,
  outline: StoryOutlinePlan,
  worldModel: WorldModel,
  dialogueVariants: Record<string, DialogueVariant[]>,
  anchorBeats: Record<string, AnchorBeat> = {},
  endings: Record<string, EndingVariant> = {},
  images: Record<string, ImageGenState> = {},
  characters: Record<string, CharacterGenState> = {},
  audio: WorldAudioInput = { base: null, moodBeds: {}, specialBeds: {}, byLi: {}, sfx: {} },
): WorldCompileResult {
  const nodes: GameSceneNode[] = [];
  const edges: GameSceneEdge[] = [];
  const allIds = new Set<string>();
  const stateVars = new Map<string, { range: [number, number]; default: number }>();

  let encountersWired = 0;
  let dialogueSceneCount = 0;
  let endingSceneCount = 0;

  const uniqueId = (base: string): string => {
    let id = base;
    let i = 0;
    while (allIds.has(id)) id = `${base}__${++i}`;
    allIds.add(id);
    return id;
  };

  const locById = new Map(worldModel.locations.map(l => [l.id, l]));
  const bgForLocation = (locId: string): string => imageUrlFor(images[`loc:${locId}`]);
  const liNameById = new Map(brief.loveInterests.map(li => [li.id, li.name]));

  // Adjacency симметризуется (как в locationRoute/validateWorldModel):
  // LLM-модель мира часто объявляет связь только с одной стороны.
  const neighbors = new Map<string, { locationId: string; via: string }[]>();
  const addNeighbor = (a: string, b: string, via: string) => {
    if (!neighbors.has(a)) neighbors.set(a, []);
    if (!neighbors.get(a)!.some(n => n.locationId === b)) neighbors.get(a)!.push({ locationId: b, via });
  };
  for (const l of worldModel.locations) {
    for (const adj of l.adjacent) {
      if (!locById.has(adj.locationId)) continue;
      addNeighbor(l.id, adj.locationId, adj.via);
      addNeighbor(adj.locationId, l.id, adj.via);
    }
  }

  const topoAnchors = topoOrderAnchors(outline);
  // Якоря по локациям (в топо-порядке — роутер проверяет события истории
  // в порядке стрелы времени).
  const anchorsByLoc = new Map<string, StoryAnchor[]>();
  for (const anchor of topoAnchors) {
    const locId = worldModel.anchorLocations[anchor.id];
    if (!locId || !locById.has(locId)) continue;
    if (!anchorsByLoc.has(locId)) anchorsByLoc.set(locId, []);
    anchorsByLoc.get(locId)!.push(anchor);
  }

  // Резервируем стабильные id.
  for (const a of outline.anchors) allIds.add(a.id);
  for (const l of worldModel.locations) {
    allIds.add(hubId(l.id));
    allIds.add(enterId(l.id));
  }
  for (const a of outline.anchors) stateVars.set(evtVar(a.id), { range: [0, 1], default: 0 });
  stateVars.set(TIME_VAR, { range: [0, 999], default: 0 });

  const resolutionAnchor = outline.anchors.find(a => a.type === 'resolution');
  const hasEndings = Boolean(resolutionAnchor) && Object.keys(endings).length > 0;
  const endingRouterId = hasEndings ? uniqueId('ending_router') : null;

  // ── 1. Узлы событий (якоря) ─────────────────────────────────────────────
  for (const anchor of topoAnchors) {
    const locId = worldModel.anchorLocations[anchor.id];
    const image = locId ? bgForLocation(locId) : '';
    const isResolution = anchor.id === resolutionAnchor?.id && hasEndings;
    const autoId = uniqueId(`${anchor.id}__done`);
    const outputs: GameSceneOutput[] = [
      {
        id: autoId,
        text: '',
        // Событие случилось: фиксируем в evt и двигаем стрелу времени.
        effects: { stateDeltas: { [evtVar(anchor.id)]: 1, [TIME_VAR]: 1 } },
      },
    ];
    nodes.push({
      id: anchor.id,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: {
        label: anchorBeats[anchor.id]?.beatText?.trim() || escapeNL(anchor.summary) || `[якорь ${anchor.id}]`,
        image,
        outputs,
        sceneType: 'narration',
      },
    });
    edges.push({
      id: `e_${autoId}`,
      source: anchor.id,
      sourceHandle: autoId,
      // После события игрок оказывается в hub-е локации; resolution уводит
      // в маршрутизатор концовок.
      target: isResolution && endingRouterId ? endingRouterId : hubId(locId ?? worldModel.locations[0].id),
    });
  }

  // ── 2. Слой перемещения: enter-роутер + hub на локацию ──────────────────
  for (const loc of worldModel.locations) {
    // enter-роутер: события этой локации в топо-порядке. Событие созрело,
    // если оно ещё не случилось И случился хотя бы один его DAG-предок
    // (несколько предков = альтернативные ветки, любая открывает событие).
    // Якорь без предков — старт истории, он играется из start-узла.
    const routerNode: GameSceneNode = {
      id: enterId(loc.id),
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs: [], sceneType: 'router' },
    };
    nodes.push(routerNode);

    for (const anchor of anchorsByLoc.get(loc.id) ?? []) {
      const preds = directPredecessors(outline, anchor.id);
      for (const pred of preds) {
        const outId = uniqueId(`${enterId(loc.id)}__${anchor.id}__via_${pred}`);
        routerNode.data.outputs.push({ id: outId, text: '' });
        edges.push({
          id: `e_${outId}`,
          source: enterId(loc.id),
          sourceHandle: outId,
          target: anchor.id,
          condition: [
            { path: evtVar(anchor.id), lte: 0 },
            { path: evtVar(pred), gte: 1 },
          ],
        });
      }
    }
    // Fallback: событий нет — обычный вход в локацию.
    const fallbackId = uniqueId(`${enterId(loc.id)}__hub`);
    routerNode.data.outputs.push({ id: fallbackId, text: '' });
    edges.push({ id: `e_${fallbackId}`, source: enterId(loc.id), sourceHandle: fallbackId, target: hubId(loc.id) });

    // hub: описание локации + действия.
    const hubOutputs: GameSceneOutput[] = [];
    const hubNode: GameSceneNode = {
      id: hubId(loc.id),
      type: 'scene',
      position: { x: 0, y: 0 },
      data: {
        label: escapeNL(loc.description) || loc.name,
        image: bgForLocation(loc.id),
        outputs: hubOutputs,
        sceneType: 'branch',
      },
    };
    nodes.push(hubNode);

    // 2a. Encounter-кнопки: (событие этапа случилось) && (встреча ещё нет).
    for (const anchor of anchorsByLoc.get(loc.id) ?? []) {
      for (const liId of anchor.availableLIs) {
        const variants = dialogueVariants[`${anchor.id}:${liId}`];
        if (!variants || variants.length === 0) continue;

        const met = metVar(liId, anchor.id);
        stateVars.set(met, { range: [0, 1], default: 0 });

        const outId = uniqueId(`${hubId(loc.id)}__meet_${liId}_${anchor.id}`);
        // Без склонения имени (иначе нужна морфология): «Подойти: Кира».
        hubOutputs.push({ id: outId, text: `Подойти: ${liNameById.get(liId) ?? liId}` });

        const encRouterId = uniqueId(`enc_${anchor.id}_${liId}`);
        edges.push({
          id: `e_${outId}`,
          source: hubId(loc.id),
          sourceHandle: outId,
          target: encRouterId,
          condition: [
            { path: evtVar(anchor.id), gte: 1 },
            { path: met, lte: 0 },
          ],
        });

        wireEncounter(encRouterId, liId, met, variants, loc.id);
        encountersWired++;
      }
    }

    // 2b. Перемещение: рёбра графа локаций, детерминированные подписи.
    for (const adj of neighbors.get(loc.id) ?? []) {
      const target = locById.get(adj.locationId);
      if (!target) continue;
      const outId = uniqueId(`${hubId(loc.id)}__go_${adj.locationId}`);
      hubOutputs.push({ id: outId, text: movementLabel(target, adj.via) });
      edges.push({ id: `e_${outId}`, source: hubId(loc.id), sourceHandle: outId, target: enterId(adj.locationId) });
    }
  }

  // Диалоговый encounter: router по брекетам отношений → сцены варианта →
  // возврат в hub локации. Выход из диалога помечает met и двигает время.
  function wireEncounter(
    encRouterId: string,
    liId: string,
    met: string,
    variantsRaw: DialogueVariant[],
    locId: string,
  ): void {
    const returnTarget = hubId(locId);
    const routerNode: GameSceneNode = {
      id: encRouterId,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs: [], sceneType: 'router' },
    };
    nodes.push(routerNode);

    // Безусловный neutral обязан идти последним — роутер берёт первое активное.
    const variants = [...variantsRaw].sort((a, b) => BRACKET_WIRE_ORDER[a.bracket] - BRACKET_WIRE_ORDER[b.bracket]);

    const exitEffects = (extraDeltas: Record<string, number>): Record<string, number> => ({
      ...extraDeltas,
      [met]: 1,
      [TIME_VAR]: 1,
    });

    // Аудио-профиль ветки персонажа: один на все сцены encounter-а
    // (включая choice-less narration-сцены — они внутри той же ветки).
    const audioProfile = buildSceneAudioProfile(liId, audio.byLi[liId]);

    for (const variant of variants) {
      const condition = bracketCondition(liId, variant.bracket);

      const sceneIdMap = new Map<string, string>();
      for (const vs of variant.scenes) {
        sceneIdMap.set(vs.id, uniqueId(vs.id));
      }

      const routerOutId = uniqueId(`${encRouterId}__${variant.bracket}`);
      routerNode.data.outputs.push({ id: routerOutId, text: '' });
      const condEdge: GameSceneEdge = {
        id: `e_${routerOutId}`,
        source: encRouterId,
        sourceHandle: routerOutId,
        target: sceneIdMap.get(variant.entrySceneId) ?? variant.entrySceneId,
      };
      if (condition.length > 0) condEdge.condition = condition;
      edges.push(condEdge);

      for (const vs of variant.scenes) {
        const vsId = sceneIdMap.get(vs.id)!;
        dialogueSceneCount++;

        const positions = assignPositions(vs.charactersPresent.length);
        const sprites: GameSpriteEntry[] = [];
        for (let ci = 0; ci < vs.charactersPresent.length; ci++) {
          const charId = vs.charactersPresent[ci];
          const emotion = pickCharacterEmotion(vs, charId);
          const { url } = resolveEmotionToSpriteUrl(characters[charId], emotion);
          if (url) sprites.push({ url, position: positions[ci] ?? 'center' });
        }

        const vsOutputs: GameSceneOutput[] = [];
        if (vs.choices.length === 0) {
          const autoId = uniqueId(`${vsId}__auto`);
          const nextVs = variant.scenes[variant.scenes.indexOf(vs) + 1];
          const isExit = !nextVs;
          vsOutputs.push(
            isExit ? { id: autoId, text: '', effects: { stateDeltas: exitEffects({}) } } : { id: autoId, text: '' },
          );
          edges.push({
            id: `e_${autoId}`,
            source: vsId,
            sourceHandle: autoId,
            target: nextVs ? sceneIdMap.get(nextVs.id) ?? nextVs.id : returnTarget,
          });
        } else {
          for (const c of vs.choices) {
            const cId = uniqueId(c.id);
            const isExit = c.nextSceneId === null;
            const deltas: Record<string, number> = isExit
              ? exitEffects(c.effects.stateDeltas)
              : { ...c.effects.stateDeltas };
            const hasEff =
              Object.keys(deltas).length > 0 || c.effects.flagSet.length > 0 || c.effects.flagClear.length > 0;
            const out: GameSceneOutput = { id: cId, text: c.text };
            if (hasEff) {
              out.effects = {
                stateDeltas: Object.keys(deltas).length > 0 ? deltas : undefined,
                flagSet: c.effects.flagSet.length > 0 ? c.effects.flagSet : undefined,
                flagClear: c.effects.flagClear.length > 0 ? c.effects.flagClear : undefined,
              };
            }
            vsOutputs.push(out);
            edges.push({
              id: `e_${cId}`,
              source: vsId,
              sourceHandle: cId,
              target: isExit ? returnTarget : sceneIdMap.get(c.nextSceneId!) ?? c.nextSceneId!,
            });
          }
        }

        nodes.push({
          id: vsId,
          type: 'scene',
          position: { x: 0, y: 0 },
          data: {
            label: renderDraftSceneText(vs.narration, vs.dialogue),
            image: bgForLocation(locId),
            sprite: sprites[0]?.url,
            sprites: sprites.length ? sprites : undefined,
            outputs: vsOutputs,
            sceneType: vs.choices.length === 0 ? 'narration' : 'dialogue',
            audioProfile,
            sfxUrl: resolveSfxUrl(pickCharacterEmotion(vs, liId), audio.sfx),
          },
        });
      }
    }

    // Страховка от ROUTER_DEAD_END при отсутствии neutral-варианта.
    const hasUnconditional = variants.some(v => bracketCondition(liId, v.bracket).length === 0);
    if (!hasUnconditional) {
      const fallbackId = uniqueId(`${encRouterId}__fallback`);
      routerNode.data.outputs.push({ id: fallbackId, text: '' });
      edges.push({ id: `e_${fallbackId}`, source: encRouterId, sourceHandle: fallbackId, target: returnTarget });
    }
  }

  // ── 3. Старт: узел без входящих рёбер → первое событие истории ──────────
  const startAnchor = topoAnchors[0];
  const startId = uniqueId('game_start');
  const startOutId = uniqueId('game_start__go');
  nodes.push({
    id: startId,
    type: 'scene',
    position: { x: 0, y: 0 },
    data: { label: '', image: '', outputs: [{ id: startOutId, text: '' }], sceneType: 'router' },
  });
  edges.push({ id: `e_${startOutId}`, source: startId, sourceHandle: startOutId, target: startAnchor.id });

  // ── 4. Концовки: resolution → ending_router → эпилоги по state ──────────
  if (hasEndings && endingRouterId && resolutionAnchor) {
    const endingRouter: GameSceneNode = {
      id: endingRouterId,
      type: 'scene',
      position: { x: 0, y: 0 },
      data: { label: '', image: '', outputs: [], sceneType: 'router' },
    };
    nodes.push(endingRouter);

    const resolutionLocId = worldModel.anchorLocations[resolutionAnchor.id];
    const endingImage = resolutionLocId ? bgForLocation(resolutionLocId) : '';

    const affectionMid = (liId: string): number => {
      const li = brief.loveInterests.find(l => l.id === liId);
      const init = li ? ARCHETYPES[li.archetype]?.initialState?.affection : undefined;
      return init ? (init[0] + init[1]) / 2 : 0;
    };
    const clampCond = (v: number) => Math.max(-1, Math.min(1, v));

    const wireEndingChain = (variant: EndingVariant, keySuffix: string): string => {
      const sceneIds = variant.scenes.map((sc, i) => uniqueId(sc.id || `ending_${keySuffix}_${i + 1}`));
      variant.scenes.forEach((sc, i) => {
        const isLast = i === variant.scenes.length - 1;
        const outputs: GameSceneOutput[] = [];
        if (!isLast) {
          const chainAutoId = uniqueId(`${sceneIds[i]}__auto`);
          outputs.push({ id: chainAutoId, text: '' });
          edges.push({
            id: `e_${chainAutoId}`,
            source: sceneIds[i],
            sourceHandle: chainAutoId,
            target: sceneIds[i + 1],
          });
        }
        nodes.push({
          id: sceneIds[i],
          type: 'scene',
          position: { x: 0, y: 0 },
          data: { label: escapeNL(sc.narration), image: endingImage, outputs, sceneType: 'narration' },
        });
        endingSceneCount++;
      });
      return sceneIds[0];
    };

    const wireRouterEdge = (target: string, suffix: string, condition?: GameStateCondition[]) => {
      const outId = uniqueId(`${endingRouterId}__${suffix}`);
      endingRouter.data.outputs.push({ id: outId, text: '' });
      const e: GameSceneEdge = { id: `e_${outId}`, source: endingRouterId, sourceHandle: outId, target };
      if (condition && condition.length > 0) e.condition = condition;
      edges.push(e);
    };

    let hasUnconditionalEnding = false;
    let lastEntry = '';

    for (const li of brief.loveInterests) {
      const variant = endings[`good:${li.id}`];
      if (!variant) continue;
      const entry = wireEndingChain(variant, `good_${li.id}`);
      lastEntry = entry;
      wireRouterEdge(entry, `good_${li.id}`, [
        { path: `relationship[${li.id}].affection`, gte: clampCond(affectionMid(li.id) + 0.25) },
      ]);
    }

    if (endings.bad) {
      const entry = wireEndingChain(endings.bad, 'bad');
      lastEntry = entry;
      wireRouterEdge(
        entry,
        'bad',
        brief.loveInterests.map(li => ({
          path: `relationship[${li.id}].affection`,
          lte: clampCond(affectionMid(li.id) - 0.15),
        })),
      );
    }

    if (endings.normal) {
      const entry = wireEndingChain(endings.normal, 'normal');
      lastEntry = entry;
      wireRouterEdge(entry, 'normal');
      hasUnconditionalEnding = true;
    }

    if (!hasUnconditionalEnding && lastEntry) {
      wireRouterEdge(lastEntry, 'fallback');
    }
  }

  // ── 5. Метаданные проекта ────────────────────────────────────────────────
  const stateSchema = buildStoryStateSchema(brief, outline);
  for (const [key, decl] of stateVars) {
    stateSchema.vars[key] = { range: decl.range, default: decl.default };
  }

  // Манифест мира для карты в плеере: локации (id+имя) и уникальные
  // неориентированные рёбра. Дедуп из исходной объявленной adjacency, чтобы
  // сохранить авторский via (первое объявленное направление выигрывает).
  const seenPairs = new Set<string>();
  const worldEdges: GameWorldManifest['edges'] = [];
  for (const l of worldModel.locations) {
    for (const adj of l.adjacent) {
      if (!locById.has(adj.locationId)) continue;
      const key = [l.id, adj.locationId].sort().join('|');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      worldEdges.push({ from: l.id, to: adj.locationId, via: adj.via?.trim() || undefined });
    }
  }
  const world: GameWorldManifest = {
    // Коэрсим mood/specialKind: persisted-локации из до-Phase-1 модели мира могут
    // не иметь этих полей — эмитим валидный дефолт, не undefined.
    locations: worldModel.locations.map(l => ({
      id: l.id,
      name: l.name,
      mood: isLocationMood(l.mood) ? l.mood : DEFAULT_LOCATION_MOOD,
      ...(isSpecialAmbientKind(l.specialKind) ? { specialKind: l.specialKind } : {}),
    })),
    edges: worldEdges,
  };

  const title = outline.title?.trim() || `${brief.world.setting.place} — пилот`;
  const bgmUrl = audioUrlFor(selectedTrackFile(audio.base));

  // Банк эмбиентов для рантайма: настроение локации → URL беда. neutral_calm
  // резолвится в базу (bgmUrl), остальные — в mood-беды. Рендерер выбирает
  // подложку по mood текущей локации, а bgmUrl остаётся ultimate-фолбэком.
  const ambientByMood: Record<string, string> = {};
  if (bgmUrl) ambientByMood[DEFAULT_LOCATION_MOOD] = bgmUrl;
  for (const [mood, track] of Object.entries(audio.moodBeds ?? {})) {
    const url = audioUrlFor(selectedTrackFile(track));
    if (url) ambientByMood[mood] = url;
  }
  const hasAmbient = Object.keys(ambientByMood).length > 0;

  // Диегетические беды особых локаций: specialKind → URL. Рендерер отдаёт им
  // приоритет над mood-бедом (special ?? mood ?? bgmUrl).
  const ambientBySpecial: Record<string, string> = {};
  for (const [kind, track] of Object.entries(audio.specialBeds ?? {})) {
    const url = audioUrlFor(selectedTrackFile(track));
    if (url) ambientBySpecial[kind] = url;
  }
  const hasSpecial = Object.keys(ambientBySpecial).length > 0;

  const project: GameProjectFile = {
    title,
    scenes: './scenes.json',
    settings: {
      sceneFadeInMs: 600,
      sceneFadeOutMs: 400,
      choiceAppearDelayMs: 120,
      endFadeInMs: 400,
      stateSchema,
      world,
      ...(bgmUrl ? { bgmUrl, crossfadeDurationMs: 2000, bgmVolume: 0.3, sfxVolume: 0.5 } : {}),
      ...(hasAmbient ? { ambientByMood } : {}),
      ...(hasSpecial ? { ambientBySpecial } : {}),
    },
  };

  return {
    project,
    scenes: { nodes, edges },
    stats: {
      locations: worldModel.locations.length,
      events: outline.anchors.length,
      encountersWired,
      dialogueScenes: dialogueSceneCount,
      endingScenes: endingSceneCount,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    },
  };
}
