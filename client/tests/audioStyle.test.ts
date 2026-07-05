import { describe, it, expect } from 'vitest';
import {
  buildBaseStyle,
  buildAmbientStyle,
  buildSpecialAmbientStyle,
  deriveArtStyleTimbre,
} from '../src/narrative/useBulkAudioGeneration';
import type { ArtStyle, Brief } from '../src/narrative/types';

const artStyle = (referenceDescriptor: string): ArtStyle => ({
  referenceDescriptor,
  colorPalette: [],
  modelPromptTemplate: '',
});

describe('audio style — визуал → эмбиент (убираем задорность)', () => {
  it('deriveArtStyleTimbre выводит инструментовку из визуального стиля', () => {
    expect(deriveArtStyleTimbre(artStyle('soft watercolor painterly backgrounds'))).toMatch(/impressionist/);
    expect(deriveArtStyleTimbre(artStyle('noir ink, high-contrast'))).toMatch(/noir|low strings/);
    expect(deriveArtStyleTimbre(artStyle('anime, cel-shaded'))).toMatch(/celesta|nylon/);
    expect(deriveArtStyleTimbre(artStyle('что-то незнакомое'))).toMatch(/neutral/);
  });

  it('buildAmbientStyle: спокойный underscore, тембр из artStyle, негативы', () => {
    const s = buildAmbientStyle('melancholic_sad', 'impressionist solo piano and harp');
    expect(s).toContain('impressionist solo piano and harp');
    expect(s).toContain('melancholic');
    expect(s).toContain('ambient underscore');
    expect(s).toContain('no drums');
    expect(s).toContain('no beat');
    expect(s).toContain('seamless loop');
    // Роль — фон, не задорная мелодия на переднем плане.
    expect(s).not.toContain('background melody');
    expect(s).not.toMatch(/\bupbeat\b|\bcatchy\b|\bpolka\b/);
  });

  it('buildBaseStyle: нейтральная база с тембром проекта и сеттингом, без "melody"-магнита', () => {
    const brief = {
      world: { setting: { era: 'modern_day', place: 'university' }, tone: { mood: '', themes: [], intensity: 0.4 } },
      artStyle: artStyle('anime, soft pastels'),
    } as unknown as Brief;
    const s = buildBaseStyle(brief);
    expect(s).toContain('ambient underscore');
    expect(s).toContain('setting: modern_day, university');
    expect(s).toContain('no drums');
    expect(s).not.toContain('background melody');
    // тембр из anime-стиля просочился в базу
    expect(s).toMatch(/celesta|nylon/);
  });

  it('buildSpecialAmbientStyle: диегетика с тембром (бар) и без (стадион)', () => {
    const bar = buildSpecialAmbientStyle('bar_tavern', 'warm Rhodes');
    expect(bar).toContain('diegetic bar music');
    expect(bar).toContain('warm Rhodes'); // тембр подставлен
    expect(bar).toContain('seamless loop');

    const stadium = buildSpecialAmbientStyle('sports_stadium', 'warm Rhodes');
    expect(stadium).toContain('crowd');
    expect(stadium).not.toContain('warm Rhodes'); // без {timbre} — плейсхолдера нет
    expect(stadium).not.toContain('{timbre}');
  });
});
