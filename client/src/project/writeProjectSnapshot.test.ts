import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetLocalStorage, stubTabUrl } from './testStorage';

import type { ProjectSnapshot } from './writeProjectSnapshot';

/**
 * Снимок проекта пишется руками в формате конверта zustand/persist. Связка с
 * внутренностями библиотеки осознанная, и стережёт её именно этот тест: он
 * проигрывает реальный сценарий целиком — вкладка проекта A записывает проект
 * B, затем страница загружается уже привязанной к B и обязана увидеть историю.
 */

const SNAPSHOT = {
  narrative: {
    spine: { title: 'Взморье' },
    images: { 'loc:beach': { status: 'done', filename: 'bg.png' } },
    endings: {},
  },
  brief: { brief: { seed: 4242, loveInterests: [{ id: 'li_a' }] }, selector: { weights: { salience: 1 } } },
  studio: { branchAssignment: { bp1: 'out1' }, prefabProvenance: [], scriptBracket: 'warm' },
} as unknown as ProjectSnapshot;

beforeEach(() => {
  resetLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('снимок проекта в чужой неймспейс', () => {
  it('переживает перезагрузку вкладки на записанный проект', async () => {
    // Вкладка ведёт проект «writer» и открывает файл проекта «target».
    vi.resetModules();
    stubTabUrl('writer');
    const { writeProjectSnapshot } = await import('./writeProjectSnapshot');
    writeProjectSnapshot('target', SNAPSHOT);

    expect(localStorage.getItem('gu-narrative-state:target')).not.toBeNull();
    // Проект вкладки не задет: писали строго в чужой неймспейс.
    expect(localStorage.getItem('gu-narrative-state:writer')).toBeNull();

    // Новая загрузка страницы — уже на проекте «target».
    vi.resetModules();
    stubTabUrl('target');
    const { useNarrativeStore } = await import('@/narrative/narrativeStore');
    const { useBriefStore } = await import('@/narrative/briefStore');
    const { useStudioProjectStore } = await import('@/pages/studio/studioProjectStore');

    expect(useNarrativeStore.getState().spine).toMatchObject({ title: 'Взморье' });
    expect(useNarrativeStore.getState().images['loc:beach']).toMatchObject({ filename: 'bg.png' });
    expect(useBriefStore.getState().brief.seed).toBe(4242);
    expect(useStudioProjectStore.getState().branchAssignment).toEqual({ bp1: 'out1' });
    expect(useStudioProjectStore.getState().scriptBracket).toBe('warm');
  });

  it('не переносит чужой незавершённый прогон', async () => {
    vi.resetModules();
    stubTabUrl('writer');
    const { writeProjectSnapshot } = await import('./writeProjectSnapshot');
    writeProjectSnapshot('target', {
      ...SNAPSHOT,
      narrative: { ...SNAPSHOT.narrative, calendarRun: { status: 'running' } } as never,
    });

    vi.resetModules();
    stubTabUrl('target');
    const { useNarrativeStore } = await import('@/narrative/narrativeStore');

    // Батчи чужого прогона в этом браузере не живут: статус означал бы зомби.
    expect(useNarrativeStore.getState().calendarRun).toBeNull();
  });

  it('не тащит консоль и счётчик расходов — они про сессию, не про проект', async () => {
    vi.resetModules();
    stubTabUrl('writer');
    const { writeProjectSnapshot } = await import('./writeProjectSnapshot');
    writeProjectSnapshot('target', SNAPSHOT);

    expect(localStorage.getItem('gu-run-log:target')).toBeNull();
    expect(localStorage.getItem('gu-run-cost:target')).toBeNull();
  });
});
