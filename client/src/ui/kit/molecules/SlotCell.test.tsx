/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SlotCell, { type SlotCellState } from './SlotCell';

afterEach(cleanup);

const STATES: SlotCellState[] = ['loc', 'offscreen', 'done', 'open', 'locked', 'failed', 'empty'];

describe.each(STATES)('SlotCell, состояние %s', state => {
  it('без onClick рендерится нейтральным элементом с текстом', () => {
    render(<SlotCell text="КФ" state={state} />);

    const cell = screen.getByText('КФ');
    expect(cell.tagName).toBe('SPAN');
  });

  it('с onClick рендерится кнопкой и обрабатывает клик', () => {
    const onClick = vi.fn();
    render(<SlotCell text="КФ" state={state} onClick={onClick} />);

    const cell = screen.getByRole('button', { name: 'КФ' }) as HTMLButtonElement;
    expect(cell.tagName).toBe('BUTTON');
    expect(cell.type).toBe('button');

    cell.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('SlotCell, подсказка', () => {
  it('title берётся из tip, если он задан', () => {
    render(<SlotCell text="КФ" tip="Кофейня, флешбэк" />);

    expect(screen.getByTitle('Кофейня, флешбэк')).toBeTruthy();
  });

  it('без tip title дублирует текст ячейки', () => {
    render(<SlotCell text="КФ" />);

    expect(screen.getByTitle('КФ')).toBeTruthy();
  });

  it('по умолчанию состояние loc', () => {
    render(<SlotCell text="КФ" />);

    expect(screen.getByText('КФ').className).toContain('loc');
  });
});
