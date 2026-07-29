/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SpriteTakeCell, { type SpriteTakeCellState } from './SpriteTakeCell';

afterEach(cleanup);

const STATES: SpriteTakeCellState[] = ['accepted', 'ordinary'];

describe.each(STATES)('SpriteTakeCell, состояние %s', state => {
  it('показывает номер и статусную подпись', () => {
    render(<SpriteTakeCell num={2} label="принят" state={state} />);
    expect(screen.getByText('№2')).toBeTruthy();
    expect(screen.getByText('принят')).toBeTruthy();
  });
});

describe('SpriteTakeCell, значения по умолчанию', () => {
  it('без state рендерится как «принят»', () => {
    render(<SpriteTakeCell num={2} label="принят" />);
    expect(screen.getByText('№2')).toBeTruthy();
  });

  it('без width/height берёт размеры макета 150×90', () => {
    render(<SpriteTakeCell num={2} label="принят" />);
    const label = screen.getByText('принят');
    const body = label.parentElement?.parentElement as HTMLElement;
    expect(body.style.width).toBe('150px');
    expect(body.style.height).toBe('90px');
  });

  it('width/height применяются к ячейке', () => {
    render(<SpriteTakeCell num={3} label="#12" width={200} height={140} />);
    const label = screen.getByText('#12');
    const body = label.parentElement?.parentElement as HTMLElement;
    expect(body.style.width).toBe('200px');
    expect(body.style.height).toBe('140px');
  });

  it('width="fill" растягивает ячейку на всю ширину', () => {
    render(<SpriteTakeCell num={3} label="#12" width="fill" />);
    const label = screen.getByText('#12');
    const body = label.parentElement?.parentElement as HTMLElement;
    expect(body.style.width).toBe('100%');
  });
});

describe('SpriteTakeCell, кликабельность', () => {
  it('без onClick ячейка не кликабельна', () => {
    render(<SpriteTakeCell num={2} label="принят" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick ячейка рендерится кнопкой и вызывает колбэк по клику', () => {
    let calls = 0;
    render(<SpriteTakeCell num={2} label="принят" onClick={() => (calls += 1)} />);
    const cell = screen.getByRole('button', { name: /№2.*принят/ });
    fireEvent.click(cell);
    expect(calls).toBe(1);
  });

  it('состояние «обычная» тоже кликабельно с onClick', () => {
    let calls = 0;
    render(<SpriteTakeCell num={3} label="#12" state="ordinary" onClick={() => (calls += 1)} />);
    const cell = screen.getByRole('button', { name: /№3.*#12/ });
    fireEvent.click(cell);
    expect(calls).toBe(1);
  });
});
