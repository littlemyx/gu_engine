/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SpriteCell, { type SpriteCellState } from './SpriteCell';

afterEach(cleanup);

const STATES: SpriteCellState[] = ['accepted', 'awaiting'];

describe.each(STATES)('SpriteCell, состояние %s', state => {
  it('показывает подпись с глифом-статусом', () => {
    render(<SpriteCell label="идл · №2" state={state} />);
    const glyph = state === 'accepted' ? '✓' : '○';
    expect(screen.getByText(`идл · №2 ${glyph}`)).toBeTruthy();
  });
});

describe('SpriteCell, значения по умолчанию', () => {
  it('без state рендерится как «принят»', () => {
    render(<SpriteCell label="joy" />);
    expect(screen.getByText('joy ✓')).toBeTruthy();
  });

  it('без width/height берёт размеры макета 52×84', () => {
    render(<SpriteCell label="joy" />);
    const label = screen.getByText('joy ✓');
    const body = label.parentElement?.parentElement as HTMLElement;
    expect(body.style.width).toBe('52px');
    expect(body.style.height).toBe('84px');
  });

  it('width/height применяются к ячейке', () => {
    render(<SpriteCell label="joy" width={80} height={120} />);
    const label = screen.getByText('joy ✓');
    const body = label.parentElement?.parentElement as HTMLElement;
    expect(body.style.width).toBe('80px');
    expect(body.style.height).toBe('120px');
  });
});

describe('SpriteCell, кликабельность', () => {
  it('без onClick ячейка не кликабельна', () => {
    render(<SpriteCell label="joy" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick ячейка рендерится кнопкой и вызывает колбэк по клику', () => {
    let calls = 0;
    render(<SpriteCell label="joy" onClick={() => (calls += 1)} />);
    const cell = screen.getByRole('button', { name: /joy ✓/ });
    fireEvent.click(cell);
    expect(calls).toBe(1);
  });

  it('состояние «ожидает» тоже кликабельно с onClick', () => {
    let calls = 0;
    render(<SpriteCell label="joy" state="awaiting" onClick={() => (calls += 1)} />);
    const cell = screen.getByRole('button', { name: /joy ○/ });
    fireEvent.click(cell);
    expect(calls).toBe(1);
  });
});
