import { beforeEach, describe, expect, it } from 'vitest';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import { applyPrefab, captureAudioPrefab, captureCharacterPrefab, captureWorldPrefab } from './applyPrefab';
import { usePrefabStore } from './prefabStore';

import type { Prefab } from './prefabTypes';
import type { LoveInterestCard, WorldModel } from '@/narrative/types';

const li = (id: string, name: string): LoveInterestCard =>
  ({ id, name, archetype: 'slow_burn' } as unknown as LoveInterestCard);

const worldModel = {
  locations: [{ id: 'loc_cafe', name: 'кафе', adjacent: [] }],
  anchorLocations: {},
} as unknown as WorldModel;

const characterPrefab = (id: string, name: string): Prefab => ({
  id: `pf_${id}`,
  kind: 'character',
  name,
  version: 1,
  forkOf: null,
  origin: 'Лето',
  createdAt: 0,
  usedIn: 0,
  payload: {
    li: li(id, name),
    sprite: { status: 'done', idleFilename: `${id}.png` },
    audio: null,
  },
});

describe('applyPrefab', () => {
  beforeEach(() => {
    usePrefabStore.getState().clear();
    useBriefStore.getState().resetToBlank();
    useNarrativeStore.setState({
      characters: {},
      images: {},
      worldModel: null,
      spine: null,
      audioBase: null,
      audioMoodBeds: {},
      audioSpecialBeds: {},
      audioSfx: {},
      audioByLi: {},
    });
  });

  it('персонаж добавляется в каст вместе с оплаченным спрайтом', () => {
    const prefab = characterPrefab('kira', 'Кира');
    usePrefabStore.getState().savePrefab(prefab);

    const result = applyPrefab(usePrefabStore.getState().prefabs[0]);

    expect(result.ok).toBe(true);
    expect(useBriefStore.getState().brief.loveInterests.map(l => l.id)).toEqual(['kira']);
    expect(useNarrativeStore.getState().characters.kira).toMatchObject({ status: 'done' });
  });

  it('повторное применение обновляет карточку, а не плодит двойника', () => {
    usePrefabStore.getState().savePrefab(characterPrefab('kira', 'Кира'));
    const stored = usePrefabStore.getState().prefabs[0];

    applyPrefab(stored);
    applyPrefab(stored);

    expect(useBriefStore.getState().brief.loveInterests).toHaveLength(1);
    expect(usePrefabStore.getState().prefabs[0].usedIn).toBe(2);
  });

  it('вставка в готовую историю сообщает, что её надо перегенерировать', () => {
    useNarrativeStore.setState({ spine: { title: 'Лето', logline: '', beats: [], endings: [] } });
    usePrefabStore.getState().savePrefab(characterPrefab('yuki', 'Юки'));

    expect(applyPrefab(usePrefabStore.getState().prefabs[0]).invalidatesStory).toBe(true);
  });

  it('мир не трогает каст, аудио не трогает историю', () => {
    useBriefStore.getState().addLoveInterestCard(li('kira', 'Кира'));
    useNarrativeStore.setState({ spine: { title: 'Лето', logline: '', beats: [], endings: [] } });

    const world = captureWorldPrefabFrom(worldModel);
    applyPrefab(world);
    expect(useBriefStore.getState().brief.loveInterests).toHaveLength(1);
    expect(useNarrativeStore.getState().worldModel?.locations).toHaveLength(1);

    const audio = captureAudioPrefab('Звук', 'Лето');
    expect(applyPrefab(audio).invalidatesStory).toBe(false);
  });
});

describe('снятие префаба с проекта', () => {
  beforeEach(() => {
    useBriefStore.getState().resetToBlank();
    useNarrativeStore.setState({ characters: {}, images: {}, worldModel: null, audioByLi: {} });
  });

  it('персонаж уносит с собой спрайт', () => {
    useBriefStore.getState().addLoveInterestCard(li('kira', 'Кира'));
    useNarrativeStore.getState().setCharacter('kira', { status: 'done', idleFilename: 'kira.png' });

    const prefab = captureCharacterPrefab('kira', 'Лето');

    expect(prefab?.kind).toBe('character');
    expect(prefab?.kind === 'character' && prefab.payload.sprite).toMatchObject({ status: 'done' });
  });

  it('без мира префаб мира не снимается', () => {
    expect(captureWorldPrefab('Мир', 'Лето')).toBeNull();
  });

  it('мир уносит только фоны локаций, но не спрайты', () => {
    useNarrativeStore.getState().setWorldModel(worldModel);
    useNarrativeStore.getState().setImage('loc:loc_cafe', { status: 'done', filename: 'cafe.png' });
    useNarrativeStore.getState().setImage('char:kira', { status: 'done', filename: 'kira.png' });

    const prefab = captureWorldPrefab('Мир', 'Лето');

    expect(prefab?.kind === 'world' && Object.keys(prefab.payload.images)).toEqual(['loc:loc_cafe']);
  });
});

/** Снимок мира из произвольной модели — для теста «мир не трогает каст». */
function captureWorldPrefabFrom(model: WorldModel): Prefab {
  useNarrativeStore.getState().setWorldModel(model);
  return captureWorldPrefab('Мир', 'Лето') as Prefab;
}
