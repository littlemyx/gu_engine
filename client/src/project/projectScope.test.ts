import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetLocalStorage, storageKeys, stubTabUrl } from './testStorage';

/**
 * projectScope вычисляется при импорте модуля — одна вкладка держит один
 * проект всю свою жизнь. Поэтому каждый случай грузит модуль заново, а не
 * дёргает сеттер: сеттера нет намеренно.
 */
async function loadScope(id: string | null) {
  vi.resetModules();
  stubTabUrl(id);
  return import('./projectScope');
}

beforeEach(() => {
  resetLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('привязка вкладки к проекту', () => {
  it('читает id из ?project= и неймспейсит ключи', async () => {
    const scope = await loadScope('proj-1');

    expect(scope.projectId).toBe('proj-1');
    expect(scope.isBound).toBe(true);
    expect(scope.storageKey('gu-narrative-state')).toBe('gu-narrative-state:proj-1');
  });

  it('без параметра вкладка не привязана и пишет в заглушку', async () => {
    const scope = await loadScope(null);

    expect(scope.projectId).toBeNull();
    expect(scope.isBound).toBe(false);
    expect(scope.storageKey('gu-run-log')).toBe('gu-run-log:__unbound__');
  });

  it('разные проекты не делят ни одного ключа', async () => {
    const a = await loadScope('proj-a');
    const keyA = a.storageKey('gu-narrative-state');
    const b = await loadScope('proj-b');

    expect(b.storageKey('gu-narrative-state')).not.toBe(keyA);
  });

  it('строит адрес студии с экранированным id', async () => {
    const scope = await loadScope('proj-1');

    expect(scope.studioUrl('a b&c')).toBe('/studio?project=a%20b%26c');
  });

  it('выдаёт разные id подряд', async () => {
    const scope = await loadScope('proj-1');

    expect(scope.newProjectId()).not.toBe(scope.newProjectId());
  });
});

describe('чистка ключей эпохи одного проекта', () => {
  it('сносит плоские ключи и не трогает скоупленные и глобальные', async () => {
    localStorage.setItem('gu-narrative-state', '{}');
    localStorage.setItem('gu-run-cost', '{}');
    localStorage.setItem('gu-narrative-state:proj-1', '{"state":{}}');
    localStorage.setItem('gu-prefab-library', '{}');
    localStorage.setItem('gu-settings', '{}');
    localStorage.setItem('gu-studio-ui', '{}');

    const scope = await loadScope('proj-1');
    scope.cleanupLegacyKeys();

    expect(storageKeys().sort()).toEqual(
      ['gu-narrative-state:proj-1', 'gu-prefab-library', 'gu-settings', 'gu-studio-ui'].sort(),
    );
  });
});
