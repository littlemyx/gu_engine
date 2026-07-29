/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ProseDiffPanel from './ProseDiffPanel';

afterEach(cleanup);

const BASE_PROPS = {
  oldKicker: 'ТЕЙК №2',
  oldPrice: '$0.021',
  oldText: 'КИРА: «Впрочем, неважно. Все вы одинаковые.»',
  newKicker: 'ТЕЙК №3 · ✎ ПРИНЯТ',
  newText: 'КИРА: [пауза · смотрит на воду]',
};

describe('ProseDiffPanel', () => {
  it('показывает кикеры обеих колонок', () => {
    render(<ProseDiffPanel {...BASE_PROPS} />);
    expect(screen.getByText('ТЕЙК №2')).toBeTruthy();
    expect(screen.getByText('ТЕЙК №3 · ✎ ПРИНЯТ')).toBeTruthy();
  });

  it('показывает изменённый фрагмент в обеих колонках', () => {
    render(<ProseDiffPanel {...BASE_PROPS} />);
    expect(screen.getByText(BASE_PROPS.oldText)).toBeTruthy();
    expect(screen.getByText(BASE_PROPS.newText)).toBeTruthy();
  });

  it('без oldPrice цена не рисуется', () => {
    render(<ProseDiffPanel {...BASE_PROPS} oldPrice={undefined} />);
    expect(screen.queryByText('$0.021')).toBeNull();
  });

  it('с oldPrice цена показана рядом с кикером архивной колонки', () => {
    render(<ProseDiffPanel {...BASE_PROPS} />);
    expect(screen.getByText('$0.021')).toBeTruthy();
  });

  it('архивный и принятый фрагмент стилизованы по-разному (зачёркнут только архивный)', () => {
    render(<ProseDiffPanel {...BASE_PROPS} />);
    const oldSpan = screen.getByText(BASE_PROPS.oldText);
    const newSpan = screen.getByText(BASE_PROPS.newText);
    expect(oldSpan.className).not.toBe('');
    expect(newSpan.className).not.toBe('');
    expect(oldSpan.className).not.toBe(newSpan.className);
  });

  it('без before/after строки прозы не рисуются', () => {
    render(<ProseDiffPanel {...BASE_PROPS} />);
    expect(screen.queryByText(/пришла в дом/)).toBeNull();
  });

  it('с before/after строки прозы показаны в обеих колонках', () => {
    render(
      <ProseDiffPanel
        {...BASE_PROPS}
        oldBefore="Она пришла в дом до заката."
        oldAfter="Дверь захлопнулась."
        newBefore="Она пришла в дом до заката."
        newAfter="Дверь захлопнулась."
      />,
    );
    expect(screen.getAllByText('Она пришла в дом до заката.')).toHaveLength(2);
    expect(screen.getAllByText('Дверь захлопнулась.')).toHaveLength(2);
  });

  it('ни одна колонка не рендерится как кнопка', () => {
    render(<ProseDiffPanel {...BASE_PROPS} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
