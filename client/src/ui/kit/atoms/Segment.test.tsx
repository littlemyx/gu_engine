/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Segment from './Segment';

afterEach(cleanup);

describe('Segment, варианты', () => {
  it('залитая active — выбранная опция', () => {
    render(<Segment label="Сцены" selected onClick={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Сцены' }) as HTMLButtonElement;
    expect(btn.className).toContain('selected');
    expect(btn.disabled).toBe(false);
  });

  it('контурная — невыбранная опция без заливки', () => {
    render(<Segment label="Сцены" onClick={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Сцены' }) as HTMLButtonElement;
    expect(btn.className).not.toContain('selected');
  });

  it('disabled без явной note подписывается «скоро»', () => {
    render(<Segment label="Карта" disabled onClick={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Карта скоро' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText('скоро')).toBeTruthy();
  });

  it('явная note переопределяет подпись по умолчанию', () => {
    render(<Segment label="Карта" note="бета" onClick={() => {}} />);

    expect(screen.getByText('бета')).toBeTruthy();
    expect(screen.queryByText('скоро')).toBeNull();
  });

  it('без note и без disabled подпись не рисуется', () => {
    render(<Segment label="Сцены" onClick={() => {}} />);

    expect(screen.queryByText('скоро')).toBeNull();
  });
});

describe('Segment, состояния', () => {
  it('вызывает onClick по клику', () => {
    const onClick = vi.fn();
    render(<Segment label="Сцены" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Сцены' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled не вызывает onClick', () => {
    const onClick = vi.fn();
    render(<Segment label="Карта" disabled onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Карта скоро' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('без onClick рендерит неинтерактивный элемент', () => {
    render(<Segment label="Только текст" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Только текст')).toBeTruthy();
  });

  it('на тёмном хроме получает отдельный класс', () => {
    const { container: light } = render(<Segment label="Сцены" onClick={() => {}} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Segment label="Сцены" onDark onClick={() => {}} />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});
