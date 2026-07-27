import { describe, expect, it } from 'vitest';

import { deriveAudioModel, SFX_EMOTIONS } from './audioModel';

import type { AudioModelInputs } from './audioModel';
import type { AudioTrackState } from '@/narrative/narrativeStore';
import type { Brief, WorldModel } from '@/narrative';

const done: AudioTrackState = { status: 'done', filenames: ['a.mp3', 'b.mp3'], selected: 0 };
const generating: AudioTrackState = { status: 'generating', batchId: 'x' };
const failed: AudioTrackState = { status: 'failed', error: 'suno 500' };

const brief = (...names: string[]): Brief =>
  ({
    loveInterests: names.map(name => ({ id: name.toLowerCase(), name })),
  } as unknown as Brief);

const world = (locs: Array<{ id: string; mood?: string; specialKind?: string | null }>): WorldModel =>
  ({
    locations: locs.map(l => ({
      id: l.id,
      name: l.id,
      description: '',
      pointsOfInterest: [],
      adjacent: [],
      mood: l.mood ?? 'neutral_calm',
      specialKind: l.specialKind ?? null,
    })),
    anchorLocations: {},
  } as WorldModel);

const inputs = (over: Partial<AudioModelInputs> = {}): AudioModelInputs => ({
  brief: brief('Асель', 'Мия'),
  worldModel: world([
    { id: 'library', mood: 'melancholic_sad' },
    { id: 'cafe', mood: 'cozy_tender' },
    { id: 'bar', mood: 'tense_anxious', specialKind: 'bar_tavern' },
    { id: 'dorm' },
  ]),
  audioBase: null,
  audioMoodBeds: {},
  audioSpecialBeds: {},
  audioByLi: {},
  audioSfx: {},
  audioSfxState: null,
  ...over,
});

describe('deriveAudioModel', () => {
  it('считает план прогона: база + используемые беды + диегетика + 2×LI + SFX-эмоции', () => {
    const model = deriveAudioModel(inputs());
    // 1 база + 3 mood (melancholic, cozy, tense) + 1 special + 2 LI × 2 + 7 SFX
    expect(model.total).toBe(1 + 3 + 1 + 4 + SFX_EMOTIONS.length);
    expect(model.done).toBe(0);
    expect(model.generating).toBe(false);
  });

  it('neutral_calm — не отдельный трек, а базовая подложка', () => {
    const model = deriveAudioModel(inputs());
    const neutral = model.moodRows.find(r => r.key === 'neutral_calm');
    expect(neutral?.status).toBe('unused');
    expect(neutral?.statusText).toBe('= базовая подложка');
  });

  it('настроения и типы без локаций приглушены как «нет таких локаций»', () => {
    const model = deriveAudioModel(inputs());
    expect(model.moodRows.find(r => r.key === 'romantic')?.statusText).toBe('нет таких локаций');
    expect(model.specialRows.find(r => r.key === 'party_club')?.statusText).toBe('нет таких локаций');
    // а использованный бар — ожидает генерации
    expect(model.specialRows.find(r => r.key === 'bar_tavern')?.status).toBe('missing');
  });

  it('пример локации печатается в моно-приписке диегетики', () => {
    const model = deriveAudioModel(inputs());
    expect(model.specialRows.find(r => r.key === 'bar_tavern')?.mono).toBe('bar_tavern · bar');
  });

  it('считает готовое и замечает генерацию и ошибки', () => {
    const model = deriveAudioModel(
      inputs({
        audioBase: done,
        audioMoodBeds: { melancholic_sad: done, cozy_tender: generating },
        audioSpecialBeds: { bar_tavern: failed },
        audioByLi: { асель: { positive: done, negative: done } },
        audioSfx: { happy: 'h.mp3', sad: 's.mp3' },
      }),
    );
    // база 1 + melancholic 1 + вариации 2 + sfx 2
    expect(model.done).toBe(6);
    expect(model.generating).toBe(true);
    expect(model.failed).toBe(true);
    const happy = model.sfxChips.find(c => c.emotion === 'happy');
    expect(happy?.status).toBe('done');
  });

  it('SFX-чипы наследуют статус батча, пока файла нет', () => {
    const model = deriveAudioModel(inputs({ audioSfxState: generating, audioSfx: { happy: 'h.mp3' } }));
    expect(model.sfxChips.find(c => c.emotion === 'happy')?.status).toBe('done');
    expect(model.sfxChips.find(c => c.emotion === 'angry')?.status).toBe('generating');
  });
});
