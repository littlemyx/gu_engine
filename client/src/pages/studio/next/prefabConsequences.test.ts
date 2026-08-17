import { describe, expect, it } from 'vitest';

import { migrateExisting } from '@/artifacts/migrate';
import { briefOwn } from '@/artifacts/presence';
import { newLoveInterest } from '@/narrative/loveInterestCard';
import { blankBrief } from '@/narrative/briefStore';

import { prefabConsequences } from './prefabConsequences';

import type { Brief } from '@/narrative/types';
import type { Prefab } from '@/prefabs/prefabTypes';
import type { StageCost } from '@/processes/callSheet';
import type { PresentItems } from '@/artifacts/migrate';

const STORY: PresentItems = { brief: [''], cast: [''], world: [''], calendar: [''], spine: [''] };
const COST: StageCost = { brief: 0.02, cast: 0.2, world: 0.3, calendar: 0.5, spine: 1.2 };

const character = (li = newLoveInterest()): Prefab => ({
  id: 'pf_char_test',
  kind: 'character',
  name: 'Алина',
  version: 1,
  forkOf: null,
  origin: 'тест',
  createdAt: 1,
  usedIn: 0,
  payload: { li, sprite: null, audio: null },
});

const world = (): Prefab => ({
  id: 'pf_world_test',
  kind: 'world',
  name: 'Университет',
  version: 1,
  forkOf: null,
  origin: 'тест',
  createdAt: 1,
  usedIn: 0,
  payload: { worldModel: { locations: [], anchorLocations: {} }, images: {} },
});

const audioSet = (): Prefab => ({
  id: 'pf_audio_test',
  kind: 'audio_set',
  name: 'Пакет',
  version: 1,
  forkOf: null,
  origin: 'тест',
  createdAt: 1,
  usedIn: 0,
  payload: { base: null, moodBeds: {}, specialBeds: {}, sfx: {} },
});

function freshInput(brief: Brief) {
  const owns = briefOwn(brief);
  return { index: migrateExisting(STORY, owns), owns, cost: COST };
}

describe('prefabConsequences', () => {
  it('персонаж протухает каскад от каста вниз, но не сам бриф', () => {
    const brief = blankBrief();
    const { extra, cost } = prefabConsequences(character(), brief, freshInput(brief));

    const stages = extra.map(p => p.stage).sort();
    expect(stages).toContain('cast');
    expect(stages).toContain('spine');
    // Правка брифа — сама вставка, платить за его «пересборку» не надо.
    expect(stages).not.toContain('brief');
    expect(cost).toBeGreaterThan(0);
  });

  it('мир протухает то, что стоит на мире, — и не берёт денег за сам мир', () => {
    const brief = blankBrief();
    const { extra } = prefabConsequences(world(), brief, freshInput(brief));

    const stages = extra.map(p => p.stage);
    expect(stages).toContain('calendar');
    expect(stages).toContain('spine');
    expect(stages).not.toContain('world');
    // Каст на мире не стоит (STAGE_INPUTS.cast = [brief]) — protухать не должен.
    expect(stages).not.toContain('cast');
  });

  it('аудио-набор текста не трогает: последствий нет', () => {
    const brief = blankBrief();
    expect(prefabConsequences(audioSet(), brief, freshInput(brief))).toEqual({
      extra: [],
      decisions: [],
      cost: 0,
    });
  });

  it('замена карточки с тем же id — тоже правка: каскад протухает', () => {
    const li = newLoveInterest();
    const brief: Brief = { ...blankBrief(), loveInterests: [li] };
    const input = freshInput(brief);

    const same = prefabConsequences(character(li), brief, input);
    expect(same.extra).toEqual([]); // идентичная карточка ничего не меняет

    const renamed = prefabConsequences(character({ ...li, name: 'Другая' }), brief, input);
    expect(renamed.extra.length).toBeGreaterThan(0);
  });
});
