/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StrictModeToggle from './StrictModeToggle';

afterEach(cleanup);

describe('StrictModeToggle, состояния', () => {
  it('по умолчанию показывает подпись и выключенный глиф', () => {
    render(<StrictModeToggle onChange={() => {}} />);

    const toggle = screen.getByRole('switch', { name: 'строгий режим «как релиз»' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.textContent).toContain('▢');
  });

  it('checked=true показывает включённый глиф и aria-checked=true', () => {
    render(<StrictModeToggle checked onChange={() => {}} />);

    const toggle = screen.getByRole('switch', { name: 'строгий режим «как релиз»' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toContain('▣');
  });

  it('своя подпись приходит пропом', () => {
    render(<StrictModeToggle label="проверять как в проде" onChange={() => {}} />);

    expect(screen.getByRole('switch', { name: 'проверять как в проде' })).toBeTruthy();
  });

  it('вызывает onChange с инвертированным значением по клику', () => {
    const onChange = vi.fn();
    render(<StrictModeToggle checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled отключает кнопку и не вызывает onChange', () => {
    const onChange = vi.fn();
    render(<StrictModeToggle disabled onChange={onChange} />);

    const toggle = screen.getByRole('switch') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    fireEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('без onChange рендерит неинтерактивный элемент', () => {
    render(<StrictModeToggle />);

    expect(screen.queryByRole('button')).toBeNull();
    const toggle = screen.getByRole('switch');
    expect(toggle.tagName).toBe('SPAN');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
