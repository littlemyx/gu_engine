import { describe, it, expect } from 'vitest';
import { compileWorldGameProject } from '../src/narrative/compileWorldGame';
import type { Brief, StoryOutlinePlan, WorldModel } from '../src/narrative/types';

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
    },
    {
      id: 'b',
      name: 'Порт',
      description: 'опис B',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'c', via: 'мост' }],
    },
    {
      id: 'c',
      name: 'Таверна',
      description: 'опис C',
      pointsOfInterest: [],
      adjacent: [{ locationId: 'b', via: 'обратный путь' }],
    },
  ],
  anchorLocations: { a1: 'a' },
};

describe('compileWorldGameProject — манифест мира', () => {
  const { project, scenes } = compileWorldGameProject(brief, outline, worldModel, {});

  it('эмитит все локации (id + имя)', () => {
    const world = project.settings.world;
    expect(world).toBeDefined();
    expect(world!.locations).toEqual([
      { id: 'a', name: 'Маяк' },
      { id: 'b', name: 'Порт' },
      { id: 'c', name: 'Таверна' },
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
