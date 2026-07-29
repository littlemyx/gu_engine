import { describe, expect, it } from 'vitest';

import { artifactKeyOf, stageOf } from './runEvents';

describe('стадия прогона → стадия учёта', () => {
  it('стадии, у которых артефакт есть', () => {
    expect(stageOf('cast')).toBe('cast');
    expect(stageOf('spine')).toBe('spine');
    expect(stageOf('dialogue_units')).toBe('dialogue_units');
  });

  // Мир и календарь разведены в учёте (каскад каста сносит календарь, но не
  // мир), а стадия прогона одна — основным адресом назначен календарь.
  it('мир и календарь делают одну стадию', () => {
    expect(stageOf('world_calendar')).toBe('calendar');
  });

  it('служебные стадии артефактов не производят', () => {
    expect(stageOf('prune')).toBeNull();
    expect(stageOf('idle')).toBeNull();
    expect(stageOf('done')).toBeNull();
  });
});

describe('элемент стадии → адрес артефакта', () => {
  it('у скалярной стадии элемента нет', () => {
    expect(artifactKeyOf('spine', null)).toBe('spine/');
    expect(artifactKeyOf('world_calendar', null)).toBe('calendar/');
  });

  it('поэлементные стадии адресуются своим id', () => {
    expect(artifactKeyOf('beat_prose', 'a3')).toBe('beat_prose/a3');
    expect(artifactKeyOf('ending_prose', 'romance:yuki')).toBe('ending_prose/romance:yuki');
  });

  // itemKey диалогов несёт ещё и parse-контекст: генерация брекета, QA-критик,
  // QA-регенерация. Артефакт при этом один на юнит.
  it('брекеты и QA-проходы сходятся в один адрес юнита', () => {
    expect(artifactKeyOf('dialogue_units', 'ev_yuki_1/positive')).toBe('dialogue_units/ev_yuki_1');
    expect(artifactKeyOf('dialogue_units', 'ev_yuki_1/negative/qa')).toBe('dialogue_units/ev_yuki_1');
    expect(artifactKeyOf('dialogue_units', 'ev_yuki_1/neutral/qa-regen')).toBe('dialogue_units/ev_yuki_1');
  });

  // Пул генерируется целиком на персонажа, а учёт ключует по юнитам: адреса
  // «одна позиция = один LI» в индексе не существует, и врать о нём нельзя.
  it('у пула событий адреса нет — генерация и учёт разной зернистости', () => {
    expect(artifactKeyOf('event_pool', 'yuki')).toBeNull();
  });

  it('у служебных стадий адреса нет', () => {
    expect(artifactKeyOf('prune', null)).toBeNull();
  });
});
