import { describe, expect, it } from 'vitest';
import { normalizeSpineWindows, guardFromRequires } from './calendarTypes';
import type { Calendar, SpineBeat, SpinePlan } from './calendarTypes';
import { assignBeatSlots } from './beatSchedule';
import { validateSpine, enumerateLeafAssignments, playableBeatsForLeaf } from './validateSpine';
import { SAMPLE_BRIEF } from './sampleBrief';

// 4 дня × 3 части дня = 12 слотов; акты по дню: act1=[0,2] act2=[3,5] act3=[6,8] act4=[9,11].
const cal: Calendar = {
  days: 4,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 12,
  actBoundaries: [0, 1, 2, 3],
};

const beat = (patch: Partial<SpineBeat> & Pick<SpineBeat, 'id'>): SpineBeat => ({
  kind: 'beat',
  act: 1,
  window: { fromSlot: 0, toSlot: 2 },
  locationId: 'loc_a',
  participants: [],
  summary: 'событие',
  establishes: [],
  guard: { all: [] },
  ...patch,
});

/**
 * Реконструкция реального хребта из E2E-прогона: две НЕЗАВИСИМЫЕ развилки
 * (asel_dilemma, kira_dilemma), их ветвевые биты в акте 3 с вырожденными
 * однослотовыми окнами. asel_path и kira_rivalry — из разных развилок → co-play
 * на листе {duty,rivalry}, но оба в окне [6,6] → раньше «окна пережаты».
 */
function branchySpine(): SpinePlan {
  return {
    title: 'Осенние тени',
    logline: '',
    beats: [
      beat({ id: 'first_meeting_kira', act: 1, window: { fromSlot: 0, toSlot: 1 }, establishes: ['met_kira'] }),
      beat({ id: 'quiet_encounter_yuki', act: 1, window: { fromSlot: 2, toSlot: 2 }, establishes: ['met_yuki'] }),
      beat({
        id: 'asel_dilemma',
        kind: 'branchPoint',
        act: 2,
        window: { fromSlot: 3, toSlot: 3 },
        guard: guardFromRequires(['met_yuki']),
        establishes: ['asel_faced'],
        outcomes: [
          { id: 'o_duty', label: 'долг', setsFlag: 'asel_chose_duty', summary: '' },
          { id: 'o_free', label: 'свобода', setsFlag: 'asel_chose_freedom', summary: '' },
        ],
      }),
      beat({
        id: 'kira_dilemma',
        kind: 'branchPoint',
        act: 2,
        window: { fromSlot: 4, toSlot: 5 },
        guard: guardFromRequires(['met_kira']),
        establishes: ['kira_faced'],
        outcomes: [
          { id: 'o_peace', label: 'мир', setsFlag: 'kira_accepted_peace', summary: '' },
          { id: 'o_riv', label: 'вражда', setsFlag: 'kira_kept_rivalry', summary: '' },
        ],
      }),
      beat({
        id: 'asel_path_act3',
        act: 3,
        window: { fromSlot: 6, toSlot: 6 },
        guard: guardFromRequires(['asel_chose_duty']),
        establishes: ['asel_bonded'],
      }),
      beat({
        id: 'asel_rebellion_act3',
        act: 3,
        window: { fromSlot: 7, toSlot: 7 },
        guard: guardFromRequires(['asel_chose_freedom']),
        establishes: ['asel_bonded'],
      }),
      beat({
        id: 'kira_peace_act3',
        act: 3,
        window: { fromSlot: 8, toSlot: 8 },
        guard: guardFromRequires(['kira_accepted_peace']),
        establishes: ['kira_bonded'],
      }),
      beat({
        id: 'kira_rivalry_act3',
        act: 3,
        window: { fromSlot: 6, toSlot: 6 },
        guard: guardFromRequires(['kira_kept_rivalry']),
        establishes: ['kira_bonded'],
      }),
      beat({
        id: 'yuki_support',
        act: 3,
        window: { fromSlot: 7, toSlot: 7 },
        guard: guardFromRequires(['met_yuki']),
        establishes: ['yuki_supportive'],
      }),
      beat({
        id: 'finale_scene',
        kind: 'finale',
        act: 4,
        window: { fromSlot: 9, toSlot: 11 },
        establishes: ['story_concluded'],
      }),
    ],
    endings: [
      { id: 'good_kira', kind: 'good', liId: 'kira', guard: guardFromRequires(['kira_bonded']) },
      { id: 'normal_end', kind: 'normal', liId: null, guard: guardFromRequires([]) },
      { id: 'bad_end', kind: 'bad', liId: null, guard: guardFromRequires([]) },
    ],
  };
}

const packingErrors = (spine: SpinePlan) =>
  validateSpine(spine, cal, SAMPLE_BRIEF, null).filter(
    i => i.severity === 'error' && /не удаётся расположить|пережаты|свободного слота/.test(i.message),
  );

/** Инвариант: на КАЖДОМ листе у одновременно сыгранных битов разные слоты. */
function everyLeafHasDistinctSlots(spine: SpinePlan): boolean {
  const slots = assignBeatSlots(spine, cal);
  for (const leaf of enumerateLeafAssignments(spine)) {
    const { played } = playableBeatsForLeaf(spine, cal, leaf.assignment);
    const used = new Map<number, string>();
    for (const id of played) {
      const s = slots[id];
      if (s == null) return false; // бит без слота
      if (used.has(s)) return false; // два одновременных бита в одном слоте
      used.set(s, id);
    }
  }
  return true;
}

describe('spine packing (branch-aware)', () => {
  it('сырые однослотовые окна ветвевых co-play битов → ошибка упаковки (баг воспроизводится)', () => {
    expect(packingErrors(branchySpine()).length).toBeGreaterThan(0);
  });

  it('после нормализации окон упаковка проходит — ошибок нет', () => {
    const normalized = normalizeSpineWindows(branchySpine(), cal);
    expect(packingErrors(normalized)).toEqual([]);
  });

  it('нормализованный хребет: на каждом листе одновременные биты в разных слотах', () => {
    const normalized = normalizeSpineWindows(branchySpine(), cal);
    expect(everyLeafHasDistinctSlots(normalized)).toBe(true);
  });

  it('всем битам назначен слот', () => {
    const normalized = normalizeSpineWindows(branchySpine(), cal);
    const slots = assignBeatSlots(normalized, cal);
    expect(Object.keys(slots).length).toBe(normalized.beats.length);
  });

  it('взаимоисключающие ветки одной развилки МОГУТ делить слот', () => {
    // Минимальный хребет: одна развилка, два исхода, по биту на исход — оба в
    // окне одного акта. Эксклюзивны → делят слот, а не требуют двух.
    const spine: SpinePlan = {
      title: 't',
      logline: '',
      beats: [
        beat({
          id: 'bp',
          kind: 'branchPoint',
          act: 1,
          window: { fromSlot: 0, toSlot: 0 },
          establishes: ['faced'],
          outcomes: [
            { id: 'a', label: 'a', setsFlag: 'chose_a', summary: '' },
            { id: 'b', label: 'b', setsFlag: 'chose_b', summary: '' },
          ],
        }),
        beat({ id: 'path_a', act: 2, window: { fromSlot: 3, toSlot: 5 }, guard: guardFromRequires(['chose_a']) }),
        beat({ id: 'path_b', act: 2, window: { fromSlot: 3, toSlot: 5 }, guard: guardFromRequires(['chose_b']) }),
        beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 } }),
      ],
      endings: [{ id: 'n', kind: 'normal', liId: null, guard: guardFromRequires([]) }],
    };
    const slots = assignBeatSlots(spine, cal);
    expect(slots.path_a).toBe(slots.path_b);
  });

  // Хребет для проверок совместимости пинов: одна развилка, два outcome-бита
  // с настраиваемыми участниками/локациями в широком окне.
  const pinSpine = (a: Partial<SpineBeat>, b: Partial<SpineBeat>, window = { fromSlot: 3, toSlot: 5 }): SpinePlan => ({
    title: 't',
    logline: '',
    beats: [
      beat({
        id: 'bp',
        kind: 'branchPoint',
        act: 1,
        window: { fromSlot: 0, toSlot: 0 },
        establishes: ['faced'],
        outcomes: [
          { id: 'a', label: 'a', setsFlag: 'chose_a', summary: '' },
          { id: 'b', label: 'b', setsFlag: 'chose_b', summary: '' },
        ],
      }),
      beat({ id: 'path_a', act: 2, window, guard: guardFromRequires(['chose_a']), ...a }),
      beat({ id: 'path_b', act: 2, window, guard: guardFromRequires(['chose_b']), ...b }),
      beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 } }),
    ],
    endings: [{ id: 'n', kind: 'normal', liId: null, guard: guardFromRequires([]) }],
  });

  it('эксклюзивные биты с общим участником и РАЗНЫМИ локациями НЕ делят слот', () => {
    // Регрессия: пины расписания затирали друг друга → «участник не в его локации».
    const spine = pinSpine(
      { participants: ['asel'], locationId: 'family_home' },
      { participants: ['asel'], locationId: 'quiet_cafe' },
    );
    const slots = assignBeatSlots(spine, cal);
    expect(slots.path_a).toBeDefined();
    expect(slots.path_b).toBeDefined();
    expect(slots.path_a).not.toBe(slots.path_b);
  });

  it('эксклюзивные биты с общим участником и ОДНОЙ локацией делят слот', () => {
    const spine = pinSpine(
      { participants: ['asel'], locationId: 'quiet_cafe' },
      { participants: ['asel'], locationId: 'quiet_cafe' },
    );
    const slots = assignBeatSlots(spine, cal);
    expect(slots.path_a).toBe(slots.path_b);
  });

  it('эксклюзивные биты без общих участников делят слот при разных локациях', () => {
    const spine = pinSpine(
      { participants: ['asel'], locationId: 'family_home' },
      { participants: ['kira'], locationId: 'quiet_cafe' },
    );
    const slots = assignBeatSlots(spine, cal);
    expect(slots.path_a).toBe(slots.path_b);
  });

  it('ошибка упаковки подсказывает ВЫХОД: назвать соперника и правило одной локации', () => {
    // Сообщение уходит в фидбек ретрая. Живой прогон показал: без подсказки
    // модель раз за разом разводит ветвевые биты одной развилки по разным
    // локациям (правило живёт в планировщике, а промпт о нём молчал) — и три
    // попытки подряд роняют стадию хребта.
    const spine = pinSpine(
      { participants: ['asel'], locationId: 'family_home' },
      { participants: ['asel'], locationId: 'quiet_cafe' },
      { fromSlot: 4, toSlot: 4 },
    );
    const [err] = packingErrors(spine);
    expect(err).toBeTruthy();
    expect(err.message).toContain('ОДНОЙ локации');
    expect(err.message).toMatch(/path_a|path_b/); // назван конкретный бит-соперник
    expect(err.message).toContain('family_home');
  });

  it('конфликт пинов в вырожденном окне → бит не размещён, ошибка упаковки', () => {
    const spine = pinSpine(
      { participants: ['asel'], locationId: 'family_home' },
      { participants: ['asel'], locationId: 'quiet_cafe' },
      { fromSlot: 4, toSlot: 4 },
    );
    const slots = assignBeatSlots(spine, cal);
    const placed = ['path_a', 'path_b'].filter(id => slots[id] != null);
    expect(placed.length).toBe(1);
    expect(packingErrors(spine).length).toBeGreaterThan(0);
  });

  it('переполненный акт (co-play битов больше, чем слотов) → ошибка даже после расширения', () => {
    // 4 ОБЩИХ (не ветвевых) бита в акт3 [6,8] = 3 слота → один не помещается.
    const spine: SpinePlan = {
      title: 't',
      logline: '',
      beats: [
        beat({ id: 'c1', act: 3, window: { fromSlot: 6, toSlot: 8 } }),
        beat({ id: 'c2', act: 3, window: { fromSlot: 6, toSlot: 8 } }),
        beat({ id: 'c3', act: 3, window: { fromSlot: 6, toSlot: 8 } }),
        beat({ id: 'c4', act: 3, window: { fromSlot: 6, toSlot: 8 } }),
        beat({ id: 'fin', kind: 'finale', act: 4, window: { fromSlot: 9, toSlot: 11 } }),
      ],
      endings: [{ id: 'n', kind: 'normal', liId: null, guard: guardFromRequires([]) }],
    };
    expect(packingErrors(normalizeSpineWindows(spine, cal)).length).toBeGreaterThan(0);
  });
});
