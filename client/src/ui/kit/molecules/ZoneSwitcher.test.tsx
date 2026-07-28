/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ZoneSwitcher from './ZoneSwitcher';

afterEach(cleanup);

describe('ZoneSwitcher', () => {
  it('показывает кикер и текущую зону', () => {
    render(<ZoneSwitcher zoneLabel="1 · Структура" />);

    expect(screen.getByText('ЗОНА')).toBeTruthy();
    expect(screen.getByText('1 · Структура')).toBeTruthy();
  });

  it('кикер переопределяется пропом', () => {
    render(<ZoneSwitcher kickerLabel="ЭТАП" zoneLabel="2 · Каст" />);

    expect(screen.getByText('ЭТАП')).toBeTruthy();
    expect(screen.queryByText('ЗОНА')).toBeNull();
  });

  it('с колбэком рендерится как кнопка и вызывает onToggle по клику', () => {
    const onToggle = vi.fn();
    render(<ZoneSwitcher zoneLabel="1 · Структура" onToggle={onToggle} />);

    const btn = screen.getByRole('button', { name: 'ЗОНА 1 · Структура' }) as HTMLButtonElement;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-haspopup')).toBe('listbox');

    btn.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('без колбэка кнопки нет', () => {
    render(<ZoneSwitcher zoneLabel="1 · Структура" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('open управляет aria-expanded и направлением стрелки', () => {
    const { rerender } = render(<ZoneSwitcher zoneLabel="1 · Структура" open={false} onToggle={() => {}} />);

    let btn = screen.getByRole('button', { name: 'ЗОНА 1 · Структура' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.textContent).toContain('▸');

    rerender(<ZoneSwitcher zoneLabel="1 · Структура" open onToggle={() => {}} />);

    btn = screen.getByRole('button', { name: 'ЗОНА 1 · Структура' });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.textContent).toContain('▾');
  });
});
