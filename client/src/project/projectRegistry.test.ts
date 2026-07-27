import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteProject, getProject, listProjects, PROJECT_KEY_BASES, upsertProject } from './projectRegistry';
import { resetLocalStorage, storageKeys } from './testStorage';

beforeEach(() => {
  resetLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('реестр проектов', () => {
  it('заводит проект и отдаёт его по id', () => {
    upsertProject('p1', 'Взморье');

    expect(getProject('p1')).toMatchObject({ id: 'p1', name: 'Взморье' });
  });

  it('без имени проект называется «без названия»', () => {
    upsertProject('p1');

    expect(getProject('p1')?.name).toBe('без названия');
  });

  it('повторный upsert без имени не затирает уже известное название', () => {
    upsertProject('p1', 'Взморье');
    upsertProject('p1');

    expect(getProject('p1')?.name).toBe('Взморье');
  });

  it('переименовывает проект, когда имя передано', () => {
    upsertProject('p1', 'Взморье');
    upsertProject('p1', 'Хребет');

    expect(getProject('p1')?.name).toBe('Хребет');
    expect(listProjects()).toHaveLength(1);
  });

  it('сортирует список от свежих к старым', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    upsertProject('old', 'Старый');
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    upsertProject('new', 'Новый');

    expect(listProjects().map(p => p.id)).toEqual(['new', 'old']);
    vi.restoreAllMocks();
  });

  it('битый реестр не запирает редактор', () => {
    localStorage.setItem('gu-projects', 'не json');

    expect(listProjects()).toEqual([]);
  });
});

describe('удаление проекта', () => {
  it('сносит запись реестра и все пер-проектные ключи', () => {
    upsertProject('p1', 'Взморье');
    upsertProject('p2', 'Соседний');
    for (const base of PROJECT_KEY_BASES) {
      localStorage.setItem(`${base}:p1`, '{"state":{}}');
      localStorage.setItem(`${base}:p2`, '{"state":{}}');
    }

    deleteProject('p1');

    expect(listProjects().map(p => p.id)).toEqual(['p2']);
    expect(storageKeys().filter(k => k.endsWith(':p1'))).toEqual([]);
    // Соседний проект не задет — ключи различаются только неймспейсом.
    expect(storageKeys().filter(k => k.endsWith(':p2'))).toHaveLength(PROJECT_KEY_BASES.length);
  });

  it('не трогает глобальные сторы', () => {
    upsertProject('p1');
    localStorage.setItem('gu-prefab-library', '{"state":{}}');
    localStorage.setItem('gu-settings', '{"state":{}}');
    localStorage.setItem('gu-studio-ui', '{"state":{}}');

    deleteProject('p1');

    expect(localStorage.getItem('gu-prefab-library')).not.toBeNull();
    expect(localStorage.getItem('gu-settings')).not.toBeNull();
    expect(localStorage.getItem('gu-studio-ui')).not.toBeNull();
  });
});
