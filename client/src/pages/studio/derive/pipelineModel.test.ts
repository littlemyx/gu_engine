import { describe, expect, it } from 'vitest';

import { migrateExisting } from '@/artifacts/migrate';
import { onLock, onUserEdit } from '@/artifacts/transitions';

import { derivePipeline } from './pipelineModel';

import type { PresentItems } from '@/artifacts/migrate';

const LETO = { 'brief/': { logline: 'лето' } };
const ZIMA = { 'brief/': { logline: 'зима' } };

const STORY: PresentItems = {
  brief: [''],
  cast: [''],
  world: [''],
  calendar: [''],
  spine: [''],
  schedule: [''],
  dialogue_units: ['u1'],
};

const zone = (model: ReturnType<typeof derivePipeline>, id: string) => model.zones.find(z => z.id === id)!;

describe('ведомость конвейера', () => {
  it('на свежей истории заполненные зоны готовы', () => {
    const model = derivePipeline({ index: migrateExisting(STORY, LETO), owns: LETO });

    expect(zone(model, 'idea').state).toBe('ready');
    expect(zone(model, 'structure').state).toBe('ready');
  });

  it('зона без артефактов не готова, а не начата', () => {
    const model = derivePipeline({ index: migrateExisting(STORY, LETO), owns: LETO });

    expect(zone(model, 'preview').state).toBe('empty');
    expect(zone(model, 'release').state).toBe('empty');
  });

  it('правка брифа делает зоны устаревшими, а не пустыми', () => {
    const model = derivePipeline({ index: migrateExisting(STORY, LETO), owns: ZIMA });

    expect(zone(model, 'idea').state).toBe('stale');
    expect(zone(model, 'structure').state).toBe('stale');
    expect(model.totalStale).toBeGreaterThan(0);
  });

  it('«Продолжить конвейер» ведёт в первую незакрытую зону', () => {
    const fresh = derivePipeline({ index: migrateExisting(STORY, LETO), owns: LETO });
    expect(fresh.nextIncomplete).toBe('prose');

    const stale = derivePipeline({ index: migrateExisting(STORY, LETO), owns: ZIMA });
    expect(stale.nextIncomplete).toBe('idea');
  });

  it('пустой проект отправляет в самое начало', () => {
    expect(derivePipeline({ index: {} }).nextIncomplete).toBe('idea');
  });

  it('превью в очередь работ не попадает: доделывать там нечего', () => {
    const model = derivePipeline({ index: {} });
    expect(model.zones.find(z => z.id === 'preview')?.total).toBe(0);
  });
});

// Регрессия E2E 2026-08-17: после сбойного прогона «Пайплайн» показывал ноль
// готового при «готово 4» во вкладке «Прогоны» — черновик был невидим.
describe('черновик в ведомости', () => {
  it('протухшее и несозданное, посчитанное в черновике, помечено', () => {
    const model = derivePipeline({
      index: migrateExisting(STORY, LETO),
      owns: ZIMA,
      draft: ['cast/', 'spine/'],
    });

    expect(zone(model, 'idea').rows.find(r => r.stage === 'cast')?.inDraft).toBe(true);
    expect(zone(model, 'structure').rows.find(r => r.stage === 'spine')?.inDraft).toBe(true);
    expect(zone(model, 'idea').rows.find(r => r.stage === 'world')?.inDraft).toBe(false);
  });

  it('свежее черновиком не перекрывается', () => {
    const model = derivePipeline({ index: migrateExisting(STORY, LETO), owns: LETO, draft: ['cast/'] });

    expect(zone(model, 'idea').rows.find(r => r.stage === 'cast')?.inDraft).toBe(false);
  });

  it('плейсхолдер нетронутой стадии покрывается элементами черновика', () => {
    const model = derivePipeline({ index: {}, draft: ['dialogue_units/u1'] });

    const row = zone(model, 'prose').rows.find(r => r.stage === 'dialogue_units');
    expect(row?.placeholder).toBe(true);
    expect(row?.inDraft).toBe(true);
  });
});

describe('строки артефактов', () => {
  it('несут знак состояния', () => {
    const model = derivePipeline({ index: migrateExisting(STORY, LETO), owns: LETO });
    expect(zone(model, 'idea').rows.every(r => r.mark === '●')).toBe(true);

    const stale = derivePipeline({ index: migrateExisting(STORY, LETO), owns: ZIMA });
    expect(zone(stale, 'idea').rows.every(r => r.mark === '◐')).toBe(true);
  });

  it('запертое видно в строке', () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onLock(index['spine/']);

    const model = derivePipeline({ index, owns: LETO });
    expect(zone(model, 'structure').rows.find(r => r.stage === 'spine')?.locked).toBe(true);
  });

  it('протухшее авторское помечено как требующее решения', () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onUserEdit(index['spine/'], index['spine/'].fingerprint ?? '');

    const model = derivePipeline({ index, owns: ZIMA });
    expect(zone(model, 'structure').rows.find(r => r.stage === 'spine')?.needsDecision).toBe(true);
  });

  it('свежее авторское решения не требует', () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onUserEdit(index['spine/'], index['spine/'].fingerprint ?? '');

    const model = derivePipeline({ index, owns: LETO });
    expect(zone(model, 'structure').rows.find(r => r.stage === 'spine')?.needsDecision).toBe(false);
  });

  it('поэлементные стадии дают строку на элемент', () => {
    const index = migrateExisting({ ...STORY, dialogue_units: ['u1', 'u2', 'u3'] }, LETO);
    const model = derivePipeline({ index, owns: LETO });

    const units = zone(model, 'prose').rows.filter(r => r.stage === 'dialogue_units');
    expect(units.map(r => r.item)).toEqual(['u1', 'u2', 'u3']);
  });

  it('непочатая стадия рисуется строкой «не создано», иначе зона выглядела бы готовой', () => {
    const model = derivePipeline({ index: migrateExisting(STORY, LETO), owns: LETO });
    const prose = zone(model, 'prose');

    const untouched = prose.rows.filter(r => r.placeholder);
    expect(untouched.map(r => r.stage).sort()).toEqual(
      ['anchor_transitions', 'beat_prose', 'ending_prose', 'event_pool'].sort(),
    );
    expect(untouched.every(r => r.mark === '○')).toBe(true);
    expect(prose.state).not.toBe('ready');
  });
});
