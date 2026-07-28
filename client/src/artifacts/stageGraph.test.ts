import { describe, expect, it } from 'vitest';

import { ALL_STAGES, STAGE_INPUTS, downstreamOf, topoOrder, upstreamOf } from './stageGraph';

import type { ArtifactStage } from './types';

describe('граф стадий', () => {
  it('ацикличен — иначе конвейер невозможно было бы посчитать', () => {
    expect(() => topoOrder()).not.toThrow();
    expect(topoOrder()).toHaveLength(ALL_STAGES.length);
  });

  it('в топологическом порядке каждая стадия стоит после своих входов', () => {
    const order = topoOrder();
    for (const stage of ALL_STAGES) {
      for (const input of STAGE_INPUTS[stage]) {
        expect(order.indexOf(input)).toBeLessThan(order.indexOf(stage));
      }
    }
  });

  it('все входы — существующие стадии', () => {
    for (const inputs of Object.values(STAGE_INPUTS)) {
      for (const input of inputs) expect(ALL_STAGES).toContain(input);
    }
  });

  it('бриф — единственный корень: у всего остального есть вход', () => {
    const roots = ALL_STAGES.filter(s => STAGE_INPUTS[s].length === 0);
    expect(roots).toEqual(['brief']);
  });
});

/**
 * Сверка с таблицей CASCADE из narrative/calendarRunState.ts. Она —
 * единственное место, где сегодня записано, что чем сносится; граф обязан
 * давать ровно то же, иначе новая модель начнёт считать свежим то, что старый
 * прогон честно перегенерировал.
 */
describe('каскад совпадает со старой таблицей CASCADE', () => {
  const CASCADE: Record<string, ArtifactStage[]> = {
    cast: ['calendar', 'spine', 'schedule', 'event_pool', 'dialogue_units', 'beat_prose', 'ending_prose'],
    world: ['spine', 'schedule', 'event_pool', 'dialogue_units', 'beat_prose', 'ending_prose'],
    spine: ['schedule', 'event_pool', 'dialogue_units', 'beat_prose', 'ending_prose'],
    schedule: ['event_pool', 'dialogue_units'],
  };

  it.each(Object.entries(CASCADE))('регенерация %s протухает то же, что раньше', (stage, expected) => {
    const actual = downstreamOf(stage as ArtifactStage);
    for (const field of expected) expect(actual).toContain(field);
  });

  it('каст не трогает модель мира', () => {
    expect(downstreamOf('cast')).not.toContain('world');
  });

  it('расписание не трогает прозу битов и концовки', () => {
    expect(downstreamOf('schedule')).not.toContain('beat_prose');
    expect(downstreamOf('schedule')).not.toContain('ending_prose');
  });
});

describe('upstreamOf', () => {
  it('собирает косвенные зависимости', () => {
    expect(upstreamOf('dialogue_units')).toEqual(
      expect.arrayContaining(['schedule', 'spine', 'calendar', 'cast', 'world', 'brief']),
    );
  });

  it('у брифа входов нет', () => {
    expect(upstreamOf('brief')).toEqual([]);
  });

  it('релиз зависит от брифа через всю цепочку', () => {
    expect(upstreamOf('release')).toContain('brief');
  });
});
