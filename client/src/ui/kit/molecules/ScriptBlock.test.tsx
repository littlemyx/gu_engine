/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ScriptBlock, { type ScriptRow } from './ScriptBlock';

afterEach(cleanup);

describe('ScriptBlock', () => {
  it('показывает заголовок сцены', () => {
    render(<ScriptBlock heading="День 3 · вечер · кафе «Прибой»" rows={[]} />);
    expect(screen.getByText('День 3 · вечер · кафе «Прибой»')).toBeTruthy();
  });

  it('рисует строку-переход на всю ширину грида', () => {
    const rows: ScriptRow[] = [{ kind: 'transition', id: 't1', text: 'Утро следующего дня' }];
    render(<ScriptBlock heading="h" rows={rows} />);
    const node = screen.getByText('Утро следующего дня');
    expect(node.className).toMatch(/transitionRow/);
  });

  it('рисует обычную прозу курсивным блоком без прощальной границы', () => {
    const rows: ScriptRow[] = [{ kind: 'prose', id: 'p1', text: 'Лампы притушены.' }];
    render(<ScriptBlock heading="h" rows={rows} />);
    const wrap = screen.getByText('Лампы притушены.').closest('div');
    expect(wrap?.className).toMatch(/prose/);
    expect(wrap?.className).not.toMatch(/farewell/);
  });

  it('прощальная проза несёт класс farewell', () => {
    const rows: ScriptRow[] = [{ kind: 'prose', id: 'p2', text: 'Увидимся!', farewell: true }];
    render(<ScriptBlock heading="h" rows={rows} />);
    const wrap = screen.getByText('Увидимся!').closest('div');
    expect(wrap?.className).toMatch(/farewell/);
  });

  it('рисует реплику с именем, эмоцией и текстом в кавычках', () => {
    const rows: ScriptRow[] = [{ kind: 'speech', id: 's1', name: 'Кира', emotion: 'смущённо', text: 'Ты помнишь?' }];
    render(<ScriptBlock heading="h" rows={rows} />);
    expect(screen.getByText('Кира')).toBeTruthy();
    expect(screen.getByText('(смущённо)')).toBeTruthy();
    expect(screen.getByText('«Ты помнишь?»')).toBeTruthy();
  });

  it('реплика без эмоции не рисует скобки', () => {
    const rows: ScriptRow[] = [{ kind: 'speech', id: 's2', name: 'Кира', text: 'Привет.' }];
    render(<ScriptBlock heading="h" rows={rows} />);
    expect(screen.queryByText(/^\(.*\)$/)).toBeNull();
  });

  it('рисует выбор с лидом, текстом и подсказкой', () => {
    const rows: ScriptRow[] = [
      {
        kind: 'choice',
        id: 'c1',
        lead: 'Выбран тёплый:',
        text: '«Конечно помню.»',
        hint: '(нейтральный свёрнут)',
      },
    ];
    render(<ScriptBlock heading="h" rows={rows} />);
    expect(screen.getByText('Выбран тёплый:')).toBeTruthy();
    expect(screen.getByText('«Конечно помню.»')).toBeTruthy();
    expect(screen.getByText('(нейтральный свёрнут)')).toBeTruthy();
  });

  it('рисует приглушённую аннотацию моно-текстом', () => {
    const rows: ScriptRow[] = [{ kind: 'prose', id: 'p3', text: 'т', annotation: ['сцена: unit_kira_s3'] }];
    render(<ScriptBlock heading="h" rows={rows} />);
    expect(screen.getByText('сцена: unit_kira_s3')).toBeTruthy();
  });

  it('рисует акцентную аннотацию своим тоном', () => {
    const rows: ScriptRow[] = [
      {
        kind: 'speech',
        id: 's3',
        name: 'Кира',
        text: 'т',
        annotation: ['flag(gallery_secret)'],
        annotationTone: 'accent',
      },
    ];
    render(<ScriptBlock heading="h" rows={rows} />);
    const node = screen.getByText('flag(gallery_secret)');
    expect(node.className).toMatch(/annotationAccent/);
  });

  it('без аннотации строка не рисует пустой служебный текст', () => {
    const rows: ScriptRow[] = [{ kind: 'choice', id: 'c2', lead: 'Лид:', text: 'текст' }];
    render(<ScriptBlock heading="h" rows={rows} />);
    expect(screen.queryByText(/flag|сцена/)).toBeNull();
  });
});
