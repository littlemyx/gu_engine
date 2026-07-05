import { describe, it, expect } from 'vitest';
import { compileWorldGameProject } from '../src/narrative/compileWorldGame';
import type { Brief, StoryOutlinePlan, WorldModel } from '../src/narrative/types';
import type { AudioTrackState } from '../src/narrative/narrativeStore';

const doneTrack = (file: string): AudioTrackState => ({ status: 'done', filenames: [file], selected: 0 });

// Минимальные фикстуры. Компилятор из полей брифа читает только
// loveInterests и world.setting.place (фолбэк заголовка), поэтому остальное
// не заполняем и приводим типом.
const brief = {
  world: { setting: { place: 'Порт' } },
  loveInterests: [{ id: 'kira', name: 'Кира', archetype: 'slow_burn' }],
} as unknown as Brief;

const outline = {
  title: 'Тест',
  logline: '',
  acts: [],
  anchors: [
    {
      id: 'a1',
      type: 'setup',
      act: 1,
      location: 'a',
      timeMarker: '',
      summary: 'Начало',
      establishes: [],
      availableLIs: [],
    },
  ],
  anchorEdges: [],
} as unknown as StoryOutlinePlan;

// A→B объявлена односторонне; B↔C объявлена в обе стороны с разными via —
// проверяем дедуп (побеждает первое объявленное направление, via 'мост').
const worldModel: WorldModel = {
  locations: [
    {
      id: 'a',
      name: 'Маяк',
      description: 'опис A',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'b', via: 'тропа' }],
      mood: 'ominous_mysterious',
      specialKind: null,
    },
    {
      id: 'b',
      name: 'Порт',
      description: 'опис B',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'c', via: 'мост' }],
      mood: 'neutral_calm',
      specialKind: null,
    },
    {
      id: 'c',
      name: 'Таверна',
      description: 'опис C',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'b', via: 'обратный путь' }],
      mood: 'cozy_tender',
      specialKind: 'bar_tavern',
    },
  ],
  anchorLocations: { a1: 'a' },
};

describe('compileWorldGameProject — манифест мира', () => {
  const { project, scenes } = compileWorldGameProject(brief, outline, worldModel, {});

  it('эмитит все локации (id + имя + mood + specialKind где есть)', () => {
    const world = project.settings.world;
    expect(world).toBeDefined();
    expect(world!.locations).toEqual([
      { id: 'a', name: 'Маяк', mood: 'ominous_mysterious' },
      { id: 'b', name: 'Порт', mood: 'neutral_calm' },
      { id: 'c', name: 'Таверна', mood: 'cozy_tender', specialKind: 'bar_tavern' },
    ]);
  });

  it('дедуплицирует неориентированные рёбра и сохраняет авторский via', () => {
    const edges = project.settings.world!.edges;
    expect(edges).toHaveLength(2);
    expect(edges).toContainEqual({ from: 'a', to: 'b', via: 'тропа' });
    // B↔C схлопнуто в одно ребро; via — из первого объявления (B→C).
    expect(edges).toContainEqual({ from: 'b', to: 'c', via: 'мост' });
  });

  it('проставляет новые тайминги анимаций', () => {
    expect(project.settings.sceneFadeOutMs).toBe(400);
    expect(project.settings.choiceAppearDelayMs).toBe(120);
  });

  it('строит банк эмбиентов: neutral_calm → база, остальные настроения → mood-беды', () => {
    const withAudio = compileWorldGameProject(
      brief,
      outline,
      worldModel,
      {},
      {},
      {},
      {},
      {},
      {
        base: doneTrack('base.mp3'),
        moodBeds: {
          ominous_mysterious: doneTrack('ominous.mp3'),
          cozy_tender: doneTrack('cozy.mp3'),
        },
        specialBeds: {
          bar_tavern: doneTrack('bar.mp3'),
        },
        byLi: {},
        sfx: {},
      },
    );
    const s = withAudio.project.settings;
    expect(s.bgmUrl).toBe('http://localhost:3008/audio/base.mp3');
    expect(s.ambientByMood).toEqual({
      neutral_calm: 'http://localhost:3008/audio/base.mp3',
      ominous_mysterious: 'http://localhost:3008/audio/ominous.mp3',
      cozy_tender: 'http://localhost:3008/audio/cozy.mp3',
    });
    expect(s.ambientBySpecial).toEqual({
      bar_tavern: 'http://localhost:3008/audio/bar.mp3',
    });
  });

  it('без аудио не эмитит банки эмбиентов', () => {
    expect(project.settings.ambientByMood).toBeUndefined();
    expect(project.settings.ambientBySpecial).toBeUndefined();
    expect(project.settings.bgmUrl).toBeUndefined();
  });

  it('коэрсит отсутствующий mood к neutral_calm (persisted-модель до Phase 1)', () => {
    // Локация 'a' (на неё мапится якорь a1) без mood/specialKind — как из старого
    // localStorage до миграции. Компайлер обязан выдать валидный дефолт, не undefined.
    const stale = {
      locations: [{ id: 'a', name: 'Старая', description: '', pointsOfInterest: [], adjacent: [] }],
      anchorLocations: { a1: 'a' },
    } as unknown as WorldModel;
    const { project: p } = compileWorldGameProject(brief, outline, stale, {});
    expect(p.settings.world!.locations[0]).toEqual({ id: 'a', name: 'Старая', mood: 'neutral_calm' });
  });

  it('сохраняет движковый контракт: hub_/enter_ ноды и hub__go_ выходы', () => {
    const ids = new Set(scenes.nodes.map(n => n.id));
    for (const loc of ['a', 'b', 'c']) {
      expect(ids.has(`hub_${loc}`)).toBe(true);
      expect(ids.has(`enter_${loc}`)).toBe(true);
    }
    // Перемещение из hub A в B провязано выходом hub_a__go_b → enter_b.
    const hubA = scenes.nodes.find(n => n.id === 'hub_a')!;
    const goOut = hubA.data.outputs.find(o => o.id === 'hub_a__go_b');
    expect(goOut).toBeDefined();
    const edge = scenes.edges.find(e => e.source === 'hub_a' && e.sourceHandle === 'hub_a__go_b');
    expect(edge?.target).toBe('enter_b');
  });
});
