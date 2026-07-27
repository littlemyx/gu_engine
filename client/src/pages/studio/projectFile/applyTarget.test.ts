import { describe, expect, it } from 'vitest';

import { decideApplyTarget } from './parseProject';

/**
 * Куда ложится открываемый .guproj. Правило решает, окажутся ли две истории
 * в одном неймспейсе (и смешают ли прогоны), поэтому проверяется отдельно от
 * тяжёлого круга сохранение→открытие.
 */
describe('выбор цели применения проекта', () => {
  it('свой же файл применяется на месте', () => {
    expect(decideApplyTarget('p1', 'p1', 'fresh')).toEqual({ mode: 'inPlace' });
  });

  it('файл без id ложится в текущий проект вкладки', () => {
    // Сохранён до многопроектности: автор открыл его в окне своего проекта.
    expect(decideApplyTarget(undefined, 'p1', 'fresh')).toEqual({ mode: 'inPlace' });
  });

  it('файл чужого проекта открывается как отдельный проект', () => {
    expect(decideApplyTarget('p2', 'p1', 'fresh')).toEqual({ mode: 'navigate', id: 'p2' });
  });

  it('непривязанная вкладка уходит на проект из файла', () => {
    expect(decideApplyTarget('p2', null, 'fresh')).toEqual({ mode: 'navigate', id: 'p2' });
  });

  it('непривязанная вкладка и файл без id — заводится новый проект', () => {
    expect(decideApplyTarget(undefined, null, 'fresh')).toEqual({ mode: 'navigate', id: 'fresh' });
  });
});
