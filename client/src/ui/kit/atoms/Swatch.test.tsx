/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Swatch from './Swatch';

afterEach(cleanup);

describe('Swatch, вид palette', () => {
  it('показывает hex-подпись по умолчанию', () => {
    render(<Swatch color="#e3b341" />);

    expect(screen.getByText('#e3b341')).toBeTruthy();
  });

  it('showHex=false прячет подпись', () => {
    render(<Swatch color="#e3b341" showHex={false} />);

    expect(screen.queryByText('#e3b341')).toBeNull();
  });

  it('без onClick рендерит некликабельный элемент', () => {
    render(<Swatch color="#e3b341" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерит кнопку и вызывает колбэк', () => {
    const onClick = vi.fn();
    render(<Swatch color="#e3b341" onClick={onClick} />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('size задаёт сторону квадрата', () => {
    const { container } = render(<Swatch color="#e3b341" size={40} />);
    const spans = Array.from(container.querySelectorAll('span'));
    const box = spans.find(el => el.style.width !== '') as HTMLElement;

    expect(box.style.width).toBe('40px');
    expect(box.style.height).toBe('40px');
  });
});

describe('Swatch, вид legend', () => {
  it('показывает словесную подпись', () => {
    render(<Swatch variant="legend" label="небо" />);

    expect(screen.getByText('небо')).toBeTruthy();
  });

  it('не рендерит кнопку — легенда некликабельна', () => {
    render(<Swatch variant="legend" label="небо" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Swatch, вид add', () => {
  it('рендерит кнопку добавления с внятным именем', () => {
    render(<Swatch variant="add" />);

    const btn = screen.getByRole('button', { name: 'добавить цвет' });
    expect(btn.textContent).toBe('+');
  });

  it('вызывает onClick по клику', () => {
    const onClick = vi.fn();
    render(<Swatch variant="add" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'добавить цвет' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
