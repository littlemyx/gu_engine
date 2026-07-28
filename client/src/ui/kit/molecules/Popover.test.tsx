/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Popover from './Popover';

afterEach(cleanup);

const BASE_PROPS = {
  anchor: 'seed 91427',
  kicker: 'Seed прогона',
  value: '91427',
  actionLabel: 'Перебросить',
  hint: 'тот же seed + тот же бриф = тот же план',
};

describe('Popover', () => {
  it('раскрыт по умолчанию и показывает содержимое панели', () => {
    render(<Popover {...BASE_PROPS} />);

    expect(screen.getByText('Seed прогона')).toBeTruthy();
    expect(screen.getByDisplayValue('91427')).toBeTruthy();
    expect(screen.getByText('тот же seed + тот же бриф = тот же план')).toBeTruthy();
  });

  it('open={false} скрывает панель', () => {
    render(<Popover {...BASE_PROPS} open={false} />);

    expect(screen.queryByText('Seed прогона')).toBeNull();
    expect(screen.queryByDisplayValue('91427')).toBeNull();
  });

  it('анкер несёт глиф раскрытия по состоянию open', () => {
    const { rerender } = render(<Popover {...BASE_PROPS} open />);
    expect(screen.getByText('seed 91427 ▴')).toBeTruthy();

    rerender(<Popover {...BASE_PROPS} open={false} />);
    expect(screen.getByText('seed 91427 ▾')).toBeTruthy();
  });

  it('с колбэком onToggle анкер — кнопка и вызывает его по клику', () => {
    const onToggle = vi.fn();
    render(<Popover {...BASE_PROPS} onToggle={onToggle} />);

    const btn = screen.getByRole('button', { name: 'seed 91427 ▴' }) as HTMLButtonElement;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    btn.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('без колбэка onToggle анкер не кнопка', () => {
    render(<Popover {...BASE_PROPS} />);
    expect(screen.queryByRole('button', { name: 'seed 91427 ▴' })).toBeNull();
  });

  it('вызывает onChange при вводе значения', () => {
    const onChange = vi.fn();
    render(<Popover {...BASE_PROPS} onChange={onChange} />);

    const input = screen.getByDisplayValue('91427') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10203' } });

    expect(onChange).toHaveBeenCalledWith('10203');
  });

  it('вызывает onAction по клику кнопки-действия', () => {
    const onAction = vi.fn();
    render(<Popover {...BASE_PROPS} onAction={onAction} />);

    screen.getByRole('button', { name: 'Перебросить' }).click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('без onAction кнопка-действие не кликабельна', () => {
    render(<Popover {...BASE_PROPS} />);
    expect(screen.queryByRole('button', { name: 'Перебросить' })).toBeNull();
    expect(screen.getByText('Перебросить')).toBeTruthy();
  });

  it('по умолчанию на светлом хроме', () => {
    render(<Popover {...BASE_PROPS} onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: 'seed 91427 ▴' });
    expect(btn.className).not.toContain('onDark');
  });

  it('onDark переключает класс анкера', () => {
    render(<Popover {...BASE_PROPS} onToggle={() => {}} onDark />);
    const btn = screen.getByRole('button', { name: 'seed 91427 ▴' });
    expect(btn.className).toContain('onDark');
  });

  it('ширина панели по умолчанию — 220px', () => {
    render(<Popover {...BASE_PROPS} />);
    const panel = screen.getByText('Seed прогона').closest('div[style]') as HTMLElement;
    expect(panel?.style.width).toBe('220px');
  });

  it('ширина панели переопределяется пропом', () => {
    render(<Popover {...BASE_PROPS} width={300} />);
    const panel = screen.getByText('Seed прогона').closest('div[style]') as HTMLElement;
    expect(panel?.style.width).toBe('300px');
  });
});
