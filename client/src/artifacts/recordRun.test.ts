import { beforeEach, describe, expect, it } from 'vitest';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import { useArtifactStore } from './artifactStore';
import { migrateExisting } from './migrate';
import { onUserEdit } from './transitions';
import { recordRunCommit } from './recordRun';

import type { Brief } from '@/narrative/types';

/**
 * Учёт коммитится тем же шагом, что и стек. Проверяется главное различие:
 * машинная работа заводит дубль, а решение автора «оставить моё» — нет.
 */

const briefWith = (logline: string) => ({ ...useBriefStore.getState().brief, logline } as unknown as Brief);

/** История есть, отпечатки посчитаны по «летнему» брифу. */
const seed = () => {
  useBriefStore.setState({ brief: briefWith('лето') });
  useNarrativeStore.setState({
    castPlan: { members: [] } as never,
    spine: { title: 'т' } as never,
    worldModel: null,
    calendar: null,
    schedule: null,
    eventUnits: {},
    unitProse: {},
    spineBeatProse: {},
    endings: {},
    anchorNarrations: null,
    images: {},
  });
  const brief = useBriefStore.getState().brief;
  useArtifactStore
    .getState()
    .replaceIndex(migrateExisting({ brief: [''], cast: [''], spine: [''] }, { 'brief/': brief }));
};

const index = () => useArtifactStore.getState().index;

describe('учёт прогона', () => {
  beforeEach(() => {
    seed();
    // Хребет автор написал сам, потом бриф уехал — классический конфликт.
    useArtifactStore.getState().replaceIndex({
      ...index(),
      'spine/': onUserEdit(index()['spine/'], index()['spine/'].fingerprint ?? ''),
    });
    useBriefStore.setState({ brief: briefWith('зима') });
  });

  it('«оставить моё» освежает отпечаток, но дубля не заводит', () => {
    const takesBefore = index()['spine/'].takes.length;

    recordRunCommit('r1', 1, ['spine/']);

    const spine = index()['spine/'];
    expect(spine.takes).toHaveLength(takesBefore);
    expect(spine.ownership).toBe('authored');
    // Конфликт закрыт: строка больше не протухшая, в следующей смете не всплывёт.
    expect(spine.provenance?.runId).toBeUndefined();
  });

  it('соседняя позиция получает дубль как обычно — её прогон делал', () => {
    recordRunCommit('r1', 1, ['spine/']);

    const cast = index()['cast/'];
    expect(cast.takes.at(-1)?.origin).toBe('generated');
    expect(cast.provenance?.runId).toBe('r1');
  });

  it('без решений всё считается машинной работой', () => {
    recordRunCommit('r1', 1);

    expect(index()['spine/'].takes.at(-1)?.origin).toBe('generated');
  });
});
