import { describe, expect, it } from 'vitest';

import { locationImageKey } from '@/narrative/imageFingerprint';
import { deriveMedia } from './mediaModel';

import type { AudioTrackState, CharacterGenState, ImageGenState } from '@/narrative/narrativeStore';
import type { Brief, WorldModel } from '@/narrative/types';

const brief = {
  loveInterests: [
    { id: 'kira', name: 'Кира' },
    { id: 'yuki', name: '' },
  ],
} as unknown as Brief;

const location = (id: string, name: string) =>
  ({ id, name, description: '', pointsOfInterest: [], adjacent: [], mood: 'neutral_calm', specialKind: null } as const);

const world = (): WorldModel =>
  ({
    locations: [location('library', 'библиотека'), location('alley', '')],
  } as unknown as WorldModel);

describe('дорожка фонов', () => {
  it('без мира дорожка пуста', () => {
    const model = deriveMedia({
      brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.backgrounds).toEqual([]);
  });

  it('одна позиция на локацию, статус берётся из images по loc:<id>', () => {
    const images: Record<string, ImageGenState> = {
      [locationImageKey('library')]: { status: 'done', filename: 'library.png' },
    };
    const model = deriveMedia({
      brief,
      worldModel: world(),
      images,
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.backgrounds).toHaveLength(2);
    const done = model.backgrounds.find(r => r.locId === 'library');
    expect(done?.status).toBe('done');
    expect(done?.filename).toBe('library.png');

    const missing = model.backgrounds.find(r => r.locId === 'alley');
    expect(missing?.status).toBe('missing');
    // Локация без имени показывает id — не пустую строку.
    expect(missing?.name).toBe('alley');
  });

  it('генерация и ошибка различимы по статусу и тексту', () => {
    const images: Record<string, ImageGenState> = {
      [locationImageKey('library')]: { status: 'generating', batchId: 'b1' },
      [locationImageKey('alley')]: { status: 'failed', error: 'таймаут' },
    };
    const model = deriveMedia({
      brief,
      worldModel: world(),
      images,
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.backgrounds.find(r => r.locId === 'library')?.status).toBe('generating');
    const failed = model.backgrounds.find(r => r.locId === 'alley');
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('таймаут');
  });

  it('счётчик считает только готовые', () => {
    const images: Record<string, ImageGenState> = {
      [locationImageKey('library')]: { status: 'done', filename: 'library.png' },
    };
    const model = deriveMedia({
      brief,
      worldModel: world(),
      images,
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.counts.backgrounds).toEqual({ done: 1, total: 2 });
  });
});

describe('дорожка спрайтов', () => {
  it('без love interests дорожка пуста', () => {
    const model = deriveMedia({
      brief: {} as Brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.sprites).toEqual([]);
  });

  it('готовый персонаж: idle принят, остальные канонические позы ждут', () => {
    const characters: Record<string, CharacterGenState> = {
      kira: { status: 'done', idleFilename: 'kira_idle.png', poseFilenames: { happy: 'kira_happy.png' } },
    };
    const model = deriveMedia({
      brief,
      worldModel: null,
      images: {},
      characters,
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    const kira = model.sprites.find(r => r.liId === 'kira');
    expect(kira?.status).toBe('done');
    expect(kira?.poses.find(p => p.pose === 'idle')?.accepted).toBe(true);
    expect(kira?.poses.find(p => p.pose === 'happy')?.accepted).toBe(true);
    expect(kira?.poses.find(p => p.pose === 'sad')?.accepted).toBe(false);
  });

  it('без имени в брифе LI подписан своим id', () => {
    const model = deriveMedia({
      brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.sprites.find(r => r.liId === 'yuki')?.name).toBe('yuki');
  });

  it('ошибка генерации сохраняет текст', () => {
    const characters: Record<string, CharacterGenState> = { kira: { status: 'failed', error: 'нет референса' } };
    const model = deriveMedia({
      brief,
      worldModel: null,
      images: {},
      characters,
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.sprites.find(r => r.liId === 'kira')?.error).toBe('нет референса');
  });
});

describe('дорожка звука', () => {
  it('база присутствует всегда, даже если ничего не сгенерировано', () => {
    const model = deriveMedia({
      brief: {} as Brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi: {},
    });

    expect(model.audio).toHaveLength(1);
    expect(model.audio[0].position).toEqual({ kind: 'base' });
    expect(model.audio[0].status).toBe('missing');
  });

  it('банк эмбиента: известное настроение получает русскую подпись', () => {
    const audioMoodBeds: Record<string, AudioTrackState> = {
      cheerful_warm: { status: 'done', filenames: ['a.mp3', 'b.mp3'], selected: 0 },
    };
    const model = deriveMedia({
      brief: {} as Brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: null,
      audioMoodBeds,
      audioByLi: {},
    });

    const row = model.audio.find(r => r.key === 'audio:mood:cheerful_warm');
    expect(row?.label).toBe('весёлая');
    expect(row?.position).toEqual({ kind: 'mood', mood: 'cheerful_warm' });
    expect(row?.status).toBe('done');
  });

  it('незнакомый ключ настроения падает назад на сырой код', () => {
    const audioMoodBeds: Record<string, AudioTrackState> = { legacy_mood: { status: 'pending' } };
    const model = deriveMedia({
      brief: {} as Brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: null,
      audioMoodBeds,
      audioByLi: {},
    });

    expect(model.audio.find(r => r.key === 'audio:mood:legacy_mood')?.label).toBe('legacy_mood');
  });

  it('вариации по LI: тепло и холодно — раздельные позиции', () => {
    const audioByLi = {
      kira: {
        positive: { status: 'done', filenames: ['w1.mp3', 'w2.mp3'], selected: 1 } as AudioTrackState,
        negative: { status: 'generating', batchId: 'b2' } as AudioTrackState,
      },
    };
    const model = deriveMedia({
      brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: null,
      audioMoodBeds: {},
      audioByLi,
    });

    const warm = model.audio.find(r => r.key === 'audio:li:kira:positive');
    const cold = model.audio.find(r => r.key === 'audio:li:kira:negative');
    expect(warm?.status).toBe('done');
    expect(warm?.position).toEqual({ kind: 'variation', liId: 'kira', tone: 'positive' });
    expect(cold?.status).toBe('generating');
  });

  it('счётчик звука включает базу, беды и обе вариации на LI', () => {
    const audioMoodBeds: Record<string, AudioTrackState> = {
      cheerful_warm: { status: 'done', filenames: ['a.mp3'], selected: 0 },
    };
    const model = deriveMedia({
      brief,
      worldModel: null,
      images: {},
      characters: {},
      audioBase: { status: 'done', filenames: ['base.mp3'], selected: 0 },
      audioMoodBeds,
      audioByLi: {},
    });

    // база(1) + беды(1) + LI(2) × тон(2) = 6 позиций, готово — база и бед.
    expect(model.counts.audio).toEqual({ done: 2, total: 6 });
  });
});
