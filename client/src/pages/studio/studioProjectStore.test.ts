import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_STUDIO_PROJECT, useStudioProjectStore } from './studioProjectStore';

import type { CastRef } from './studioProjectStore';

const ref: CastRef = { prefabId: 'p1', version: 2, mode: 'linked', name: 'Кира', snapshot: {} };

beforeEach(() => {
  useStudioProjectStore.setState({ ...EMPTY_STUDIO_PROJECT });
});

describe('кастинг-слоты', () => {
  it('назначение роли запоминает префаб', () => {
    useStudioProjectStore.getState().castRole('li:kira', ref);

    expect(useStudioProjectStore.getState().castSlots['li:kira']).toEqual(ref);
  });

  it('снятие роли удаляет слот, а не оставляет пустой', () => {
    const { castRole } = useStudioProjectStore.getState();
    castRole('li:kira', ref);
    castRole('li:kira', null);

    expect('li:kira' in useStudioProjectStore.getState().castSlots).toBe(false);
  });

  it('роли не мешают друг другу', () => {
    const { castRole } = useStudioProjectStore.getState();
    castRole('li:kira', ref);
    castRole('world', { ...ref, prefabId: 'p2', name: 'Взморье' });

    expect(Object.keys(useStudioProjectStore.getState().castSlots).sort()).toEqual(['li:kira', 'world']);
  });
});

/**
 * Версия проектного стора поднялась вместе с кастинг-столом. Без миграции
 * zustand выбрасывает состояние старой версии целиком — и проект, сохранённый
 * до кастинга, терял бы выбор веток на ровном месте.
 */
describe('миграция с версии без кастинга', () => {
  const migrate = (persisted: unknown) => ({ ...EMPTY_STUDIO_PROJECT, ...(persisted as object) });

  it('сохранённые поля переживают подъём версии', () => {
    const old = { branchAssignment: { bp1: 'out2' }, prefabProvenance: [], scriptBracket: 'warm' };

    const migrated = migrate(old);

    expect(migrated.branchAssignment).toEqual({ bp1: 'out2' });
    expect(migrated.scriptBracket).toBe('warm');
  });

  it('поле, которого в старой версии не было, получает пустое умолчание', () => {
    const migrated = migrate({ branchAssignment: { bp1: 'out2' } });

    expect(migrated.castSlots).toEqual({});
  });
});
