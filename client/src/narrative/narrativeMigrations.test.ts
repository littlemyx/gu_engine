import { describe, expect, it } from 'vitest';
import { migratePersistedNarrativeState, NARRATIVE_STORE_VERSION } from './narrativeMigrations';
import { locationFingerprint } from './imageFingerprint';
import type { Calendar, EventUnit } from './calendarTypes';
import { guardFiredIds } from './events';
import { applyBeatChain } from './beatChain';
import { effectiveStageCount } from './ladderGuards';

describe('migratePersistedNarrativeState', () => {
  it('v10 → v11: новые поля дозаполняются, кэши генерации не трогаются', () => {
    const v10 = {
      images: { 'loc:cafe': { status: 'done', filename: 'a.png' } },
      characters: {},
      endings: { normal: { kind: 'normal' } },
      worldModel: { locations: [{ id: 'cafe', mood: 'warm_cozy', specialKind: null }], anchorLocations: {} },
      castPlan: { members: [{ id: 'kira' }] },
      calendar: { slotCount: 12 },
      tagMap: { cafe: ['cafe'] },
      spine: { title: 'x', beats: [], endings: [] },
      schedule: { byChar: {} },
      eventUnits: { enc_kira: { id: 'enc_kira' } },
      unitProse: { enc_kira: [{ bracket: 'positive', nodes: [] }] },
      spineBeatProse: { b1: { anchorId: 'b1' } },
      audioBase: null,
      audioMoodBeds: {},
      audioSpecialBeds: {},
      audioByLi: {},
      audioSfx: {},
    };

    const migrated = migratePersistedNarrativeState(v10);

    expect(NARRATIVE_STORE_VERSION).toBe(14);
    expect(migrated.calendarRun).toBeNull();
    expect(migrated.storyQA).toBeNull();
    expect(migrated.audioSfxState).toBeNull();
    expect(migrated.spine).toEqual(v10.spine);
    expect(migrated.eventUnits).toEqual(v10.eventUnits);
    // Фон сохраняется, но получает отпечаток локации (v11→v12, см. ниже).
    expect(migrated.images['loc:cafe']).toMatchObject({ status: 'done', filename: 'a.png' });
  });

  it('v11→v12: готовым фонам проставляется отпечаток текущих локаций', () => {
    const cafe = { id: 'cafe', name: 'Кафе', description: 'тёплое кафе', pointsOfInterest: [], mood: 'warm_cozy' };
    const migrated = migratePersistedNarrativeState({
      worldModel: { locations: [cafe], anchorLocations: {} },
      images: {
        'loc:cafe': { status: 'done', filename: 'cafe.png' },
        'loc:ghost': { status: 'done', filename: 'ghost.png' },
        'loc:park': { status: 'failed', error: 'нет' },
      },
    });

    const cafeImage = migrated.images['loc:cafe'];
    expect(cafeImage.status === 'done' && cafeImage.locationHash).toBe(locationFingerprint(cafe));
    // Локации нет в мире — отпечаток не выдумываем (сироту вычистит коммит).
    const ghost = migrated.images['loc:ghost'];
    expect(ghost.status === 'done' && ghost.locationHash).toBeUndefined();
    expect(migrated.images['loc:park'].status).toBe('failed');
  });

  it('v12→v13: переносится только завершённый отчёт Story QA', () => {
    const doneReport = { state: 'done', issues: [], policyReports: [] };
    expect(migratePersistedNarrativeState({ storyQA: doneReport }).storyQA).toEqual(doneReport);
    expect(
      migratePersistedNarrativeState({ storyQA: { state: 'running', issues: [], policyReports: [] } }).storyQA,
    ).toBeNull();
  });

  it('незавершённый прогон переносится как есть (санитайзит init-система)', () => {
    const run = { status: 'running', phase: 'spine', draft: { castPlan: { members: [] } } };
    expect(migratePersistedNarrativeState({ calendarRun: run }).calendarRun).toEqual(run);
  });

  it('старая форма unitProse (без nodes) выбрасывается', () => {
    const migrated = migratePersistedNarrativeState({
      unitProse: { legacy: [{ bracket: 'positive', text: 'старьё' }], fresh: [{ bracket: 'positive', nodes: [] }] },
    });
    expect(Object.keys(migrated.unitProse)).toEqual(['fresh']);
  });

  it('локации без mood/specialKind получают дефолты', () => {
    const migrated = migratePersistedNarrativeState({
      worldModel: { locations: [{ id: 'cafe' }], anchorLocations: {} },
    });
    expect(migrated.worldModel?.locations[0].mood).toBeDefined();
    expect(migrated.worldModel?.locations[0].specialKind).toBeNull();
  });

  it('пустое хранилище даёт валидные дефолты', () => {
    const migrated = migratePersistedNarrativeState(undefined);
    expect(migrated.spine).toBeNull();
    expect(migrated.eventUnits).toEqual({});
    expect(migrated.calendarRun).toBeNull();
  });

  /**
   * Порядок битов НЕ хранится: цепочка выводится при чтении (applyBeatChain), и
   * персистнутый хребет с пустыми requires чинится на компиляции. Поэтому фикс
   * прогрессии не требует ни бампа версии, ни переписывания сохранённых историй.
   */
  it('сохранённый хребет с пустыми requires упорядочивается на компиляции — без бампа версии', () => {
    const persisted = {
      spine: {
        title: 'Старая история',
        logline: '',
        beats: [
          {
            id: 'b_late',
            kind: 'beat',
            act: 3,
            window: { fromSlot: 6, toSlot: 8 },
            locationId: 'cafe',
            participants: ['kira'],
            summary: '',
            establishes: [],
            guard: { all: [] }, // requires пуст — LLM порядок не проставил
          },
          {
            id: 'b_early',
            kind: 'beat',
            act: 1,
            window: { fromSlot: 0, toSlot: 2 },
            locationId: 'cafe',
            participants: ['kira'],
            summary: '',
            establishes: [],
            guard: { all: [] },
          },
        ],
        endings: [],
      },
    };

    const migrated = migratePersistedNarrativeState(persisted);
    // Миграция хребет не трогает — переносит как есть.
    expect(NARRATIVE_STORE_VERSION).toBe(14);
    expect(migrated.spine?.beats).toHaveLength(2);
    expect(guardFiredIds(migrated.spine!.beats[0].guard)).toEqual([]);

    // Зато чтение через applyBeatChain даёт порядок: поздний бит ждёт раннего.
    const cal: Calendar = { days: 4, dayparts: ['утро', 'день', 'вечер'], slotCount: 12, actBoundaries: [0, 1, 2, 3] };
    const chained = applyBeatChain(migrated.spine!, cal, new Set(['kira']));
    const late = chained.beats.find(b => b.id === 'b_late')!;
    expect(guardFiredIds(late.guard)).toEqual(['b_early']);
  });

  /**
   * Лестница отношений тоже выводится при чтении: персистнутая история со
   * старым трёхступенчатым пулом грузится как есть и гейтится ТРЁХступенчатой
   * лестницей — пороги не едут вверх без ведома автора. Новое N включается
   * только когда автор сам перегенерирует.
   */
  it('сохранённый трёхступенчатый пул гейтится своей лестницей — без бампа версии', () => {
    const persisted = {
      castPlan: {
        members: [{ id: 'kira', isLI: true, agenda: { goals: [{ id: 'g1', description: 'd', arcStage: 1 }] } }],
      },
      eventUnits: {
        evt_kira_u1: { id: 'evt_kira_u1', arcStage: 1 },
        evt_kira_u3: { id: 'evt_kira_u3', arcStage: 3 },
      },
    };
    const migrated = migratePersistedNarrativeState(persisted);

    expect(NARRATIVE_STORE_VERSION).toBe(14);
    // Агенда без новых полей (ideal/worst) грузится как есть — они опциональны.
    expect(migrated.castPlan?.members[0].agenda.goals).toHaveLength(1);
    expect(migrated.castPlan?.members[0].agenda.idealRelationship).toBeUndefined();
    // Пул перенесён без изменений: гейты не хранятся.
    expect(Object.keys(migrated.eventUnits)).toEqual(['evt_kira_u1', 'evt_kira_u3']);

    const cal: Calendar = { days: 4, dayparts: ['утро', 'день', 'вечер'], slotCount: 12, actBoundaries: [0, 1, 2, 3] };
    const units = Object.values(migrated.eventUnits) as EventUnit[];
    // Календарь на 4 дня целится в 5 ступеней, но лестница берётся по факту пула.
    expect(effectiveStageCount(units, cal)).toBe(3);
  });
});

describe('v13 → v14: якорные переходы', () => {
  it('старый стор без anchorNarrations мигрирует в null — история играбельна на статичных подписях', () => {
    // Кнопки «Подождать» больше нет: часть дня двигают якорные переходы. Их
    // нарации — колорит, а не условие работоспособности, поэтому миграция
    // ничего не генерирует и ничего не требует.
    const migrated = migratePersistedNarrativeState({ tagMap: null });
    expect(migrated.anchorNarrations).toBeNull();
  });

  it('готовые нарации переживают миграцию', () => {
    const narrations = { 0: { label: 'Пойти на занятия', narration: 'Ты идёшь к корпусу.' } };
    const migrated = migratePersistedNarrativeState({ anchorNarrations: narrations });
    expect(migrated.anchorNarrations).toEqual(narrations);
  });
});
