import { describe, expect, it } from 'vitest';

import { NARRATIVE_STORE_VERSION } from '@/narrative/narrativeMigrations';

import {
  BRIEF_STORE_VERSION,
  GU_PROJECT_FORMAT,
  GU_PROJECT_SCHEMA_VERSION,
  validateProjectJson,
} from './projectFileFormat';

const valid = () => ({
  format: GU_PROJECT_FORMAT,
  schemaVersion: GU_PROJECT_SCHEMA_VERSION,
  savedAt: '2026-07-23T10:00:00.000Z',
  projectName: 'Взморье',
  stores: {
    brief: { version: BRIEF_STORE_VERSION, state: { brief: { loveInterests: [] }, selector: {} } },
    narrative: { version: NARRATIVE_STORE_VERSION, state: { spine: null, images: {} } },
    studio: { version: 0, state: { branchAssignment: { bp1: 'out1' } } },
  },
  prefabRefs: [] as unknown[],
  assets: {
    images: ['a.png'],
    audio: [] as string[],
    missingImages: [] as string[],
    missingAudio: [] as string[],
  },
});

describe('validateProjectJson', () => {
  it('принимает валидный файл без замечаний', () => {
    const result = validateProjectJson(valid());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.problems).toEqual([]);
    expect(result.project.projectName).toBe('Взморье');
    expect(result.project.stores.studio.state.branchAssignment).toEqual({ bp1: 'out1' });
  });

  it('проносит projectId через разбор', () => {
    const result = validateProjectJson({ ...valid(), projectId: 'p-42' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.projectId).toBe('p-42');
  });

  it('принимает файл без projectId — он сохранён до многопроектности', () => {
    const result = validateProjectJson(valid());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Не пустая строка, а именно отсутствие: id такому проекту выдадут при открытии.
    expect(result.project.projectId).toBeUndefined();
    expect(result.problems).toEqual([]);
  });

  it.each([
    ['не объект', 42],
    ['чужой JSON', { hello: 'world' }],
    ['бандл игры вместо проекта', { format: 'gu-story', schemaVersion: 2 }],
  ])('отвергает %s', (_label, value) => {
    expect(validateProjectJson(value).ok).toBe(false);
  });

  it('отвергает файл более новой версии контейнера', () => {
    const result = validateProjectJson({ ...valid(), schemaVersion: GU_PROJECT_SCHEMA_VERSION + 1 });
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.error).toContain('более новой версией');
  });

  it('отвергает историю более новой схемы', () => {
    const file = valid();
    file.stores.narrative.version = NARRATIVE_STORE_VERSION + 1;
    const result = validateProjectJson(file);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.error).toContain('более новой версией схемы');
  });

  it('отвергает файл без брифа или без истории', () => {
    const noBrief = valid();
    // @ts-expect-error намеренно ломаем структуру
    delete noBrief.stores.brief;
    expect(validateProjectJson(noBrief).ok).toBe(false);

    const noNarrative = valid();
    // @ts-expect-error намеренно ломаем структуру
    delete noNarrative.stores.narrative;
    expect(validateProjectJson(noNarrative).ok).toBe(false);
  });

  it('предупреждает про старую схему истории, но открывает файл', () => {
    const file = valid();
    file.stores.narrative.version = NARRATIVE_STORE_VERSION - 1;
    const result = validateProjectJson(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.problems.join(' ')).toContain('старой схемы');
  });

  it('предупреждает про отсутствующие prefabRefs и assets, подставляя пустые', () => {
    const file = valid();
    // @ts-expect-error намеренно ломаем структуру
    delete file.prefabRefs;
    // @ts-expect-error намеренно ломаем структуру
    delete file.assets;
    const result = validateProjectJson(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.problems).toHaveLength(2);
    expect(result.project.prefabRefs).toEqual([]);
    expect(result.project.assets.images).toEqual([]);
  });

  it('называет число ассетов, которых не хватает в архиве', () => {
    const file = valid();
    file.assets.missingImages = ['gone.png', 'lost.png'];
    const result = validateProjectJson(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.problems.join(' ')).toContain('нет 2 ассетов');
  });
});
