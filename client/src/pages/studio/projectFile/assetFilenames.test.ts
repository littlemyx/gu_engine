import { describe, expect, it } from 'vitest';

import { collectAssetFilenames, mapAssetFilenames, remapAssetFilenames } from './assetFilenames';

import type { ProjectNarrativeSlice } from './projectFileFormat';

/**
 * Фикстура намеренно задевает КАЖДОЕ поле, хранящее имя файла, и вдобавок
 * незавершённые статусы: сбор обязан находить только готовое, а ремап —
 * не терять ни одной ссылки. Забытое в визиторе поле роняет именно этот тест.
 */
const slice = (): ProjectNarrativeSlice =>
  ({
    images: {
      'loc:beach': { status: 'done', filename: 'bg_beach.png', locationHash: 'h1' },
      'loc:pier': { status: 'generating', batchId: 'b1' },
      'loc:cafe': { status: 'failed', error: 'нет ответа' },
    },
    characters: {
      li_a: { status: 'done', idleFilename: 'sprite_a.png', poseFilenames: { happy: 'a_happy.png', sad: 'a_sad.png' } },
      li_b: { status: 'done', idleFilename: 'sprite_b.png' },
      li_c: { status: 'pending' },
    },
    audioBase: { status: 'done', filenames: ['base_1.mp3', 'base_2.mp3'], selected: 0 },
    audioMoodBeds: { tense: { status: 'done', filenames: ['mood_tense.mp3'], selected: 0 } },
    audioSpecialBeds: { club: { status: 'done', filenames: ['special_club.mp3'], selected: 0 } },
    audioByLi: {
      li_a: {
        positive: { status: 'done', filenames: ['a_pos.mp3'], selected: 0 },
        negative: { status: 'generating', batchId: 'b2' },
      },
    },
    audioSfx: { happy: 'sfx_happy.mp3', sad: 'sfx_sad.mp3' },
    audioSfxState: { status: 'done', filenames: ['sfx_happy.mp3', 'sfx_sad.mp3'], selected: 0 },
    endings: {},
    worldModel: null,
    castPlan: null,
    calendar: null,
    tagMap: null,
    anchorNarrations: null,
    spine: null,
    schedule: null,
    eventUnits: {},
    // Проза содержит слово, совпадающее с именем файла: целевой обход не
    // должен её трогать — тем и лучше generic-замены по всему объекту.
    unitProse: { enc_a: [{ id: 'u1', nodes: [{ text: 'на экране bg_beach.png' }] }] },
    spineBeatProse: {},
    storyQA: null,
  } as unknown as ProjectNarrativeSlice);

describe('collectAssetFilenames', () => {
  it('находит имена только готовых ассетов', () => {
    const { images, audio } = collectAssetFilenames(slice());

    expect([...images].sort()).toEqual(
      ['a_happy.png', 'a_sad.png', 'bg_beach.png', 'sprite_a.png', 'sprite_b.png'].sort(),
    );
    expect([...audio].sort()).toEqual(
      [
        'a_pos.mp3',
        'base_1.mp3',
        'base_2.mp3',
        'mood_tense.mp3',
        'sfx_happy.mp3',
        'sfx_sad.mp3',
        'special_club.mp3',
      ].sort(),
    );
  });

  it('не считает ассетом имя, встреченное в прозе', () => {
    const { images } = collectAssetFilenames(slice());
    // bg_beach.png есть и в фоне, и в тексте реплики — но ровно один раз как ассет.
    expect(images.has('bg_beach.png')).toBe(true);
    expect(images.size).toBe(5);
  });
});

describe('remapAssetFilenames', () => {
  const imageMap = new Map([
    ['bg_beach.png', 'new_bg.png'],
    ['sprite_a.png', 'new_sprite_a.png'],
    ['a_happy.png', 'new_a_happy.png'],
  ]);
  const audioMap = new Map([
    ['base_1.mp3', 'new_base_1.mp3'],
    ['a_pos.mp3', 'new_a_pos.mp3'],
    ['sfx_happy.mp3', 'new_sfx_happy.mp3'],
  ]);

  it('переписывает все ссылки и оставляет неотображённые как есть', () => {
    const next = remapAssetFilenames(slice(), imageMap, audioMap);

    expect(next.images['loc:beach']).toMatchObject({ filename: 'new_bg.png', locationHash: 'h1' });
    expect(next.characters.li_a).toMatchObject({
      idleFilename: 'new_sprite_a.png',
      poseFilenames: { happy: 'new_a_happy.png', sad: 'a_sad.png' },
    });
    expect(next.characters.li_b).toMatchObject({ idleFilename: 'sprite_b.png' });
    expect(next.audioBase).toMatchObject({ filenames: ['new_base_1.mp3', 'base_2.mp3'] });
    expect(next.audioByLi.li_a.positive).toMatchObject({ filenames: ['new_a_pos.mp3'] });
    expect(next.audioSfx).toEqual({ happy: 'new_sfx_happy.mp3', sad: 'sfx_sad.mp3' });
    expect(next.audioSfxState).toMatchObject({ filenames: ['new_sfx_happy.mp3', 'sfx_sad.mp3'] });
  });

  it('не трогает прозу и незавершённые генерации', () => {
    const next = remapAssetFilenames(slice(), imageMap, audioMap);

    expect(JSON.stringify(next.unitProse)).toContain('bg_beach.png');
    expect(next.images['loc:pier']).toEqual({ status: 'generating', batchId: 'b1' });
    expect(next.audioByLi.li_a.negative).toEqual({ status: 'generating', batchId: 'b2' });
  });

  it('не мутирует вход', () => {
    const input = slice();
    const snapshot = JSON.stringify(input);
    remapAssetFilenames(input, imageMap, audioMap);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('возвращает тот же объект, когда переименовывать нечего', () => {
    const input = slice();
    expect(remapAssetFilenames(input, new Map(), new Map())).toBe(input);
  });
});

describe('mapAssetFilenames', () => {
  it('пропускает через визитор ровно те же имена, что находит сбор', () => {
    const seen: string[] = [];
    mapAssetFilenames(slice(), (_kind, filename) => {
      seen.push(filename);
      return filename;
    });

    const { images, audio } = collectAssetFilenames(slice());
    expect(new Set(seen)).toEqual(new Set([...images, ...audio]));
  });
});
