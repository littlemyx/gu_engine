/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Toggle from './Toggle';

afterEach(cleanup);

describe('Toggle, варианты', () => {
  it('on: дорожка отмечена как включённая', () => {
    render(<Toggle on label="строгий режим" onChange={() => {}} />);
    const el = screen.getByRole('switch', { name: 'строгий режим' });
    expect(el.getAttribute('aria-checked')).toBe('true');
  });

  it('off: дорожка отмечена как выключенная', () => {
    render(<Toggle on={false} label="строгий режим" onChange={() => {}} />);
    const el = screen.getByRole('switch', { name: 'строгий режим' });
    expect(el.getAttribute('aria-checked')).toBe('false');
  });
});

describe('Toggle, состояния', () => {
  it('hover не меняет разметку — переключатель остаётся тегом button', () => {
    render(<Toggle on label="строгий режим" onChange={() => {}} />);
    const el = screen.getByRole('switch', { name: 'строгий режим' });
    expect(el.tagName).toBe('BUTTON');
    expect((el as HTMLButtonElement).disabled).toBe(false);
  });

  it('focus: доступен по клавиатуре', () => {
    render(<Toggle on label="строгий режим" onChange={() => {}} />);
    const el = screen.getByRole('switch', { name: 'строгий режим' }) as HTMLButtonElement;
    el.focus();
    expect(document.activeElement).toBe(el);
  });

  it('disabled: элемент отключён и клик не проходит', () => {
    const onChange = vi.fn();
    render(<Toggle on disabled label="строгий режим" onChange={onChange} />);
    const el = screen.getByRole('switch', { name: 'строгий режим' }) as HTMLButtonElement;
    expect(el.disabled).toBe(true);
    el.click();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Toggle, взаимодействие', () => {
  it('клик вызывает onChange с инвертированным значением', () => {
    const onChange = vi.fn();
    render(<Toggle on label="строгий режим" onChange={onChange} />);
    screen.getByRole('switch', { name: 'строгий режим' }).click();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('без onChange рендерится немым индикатором без тега button', () => {
    render(<Toggle on label="строгий режим" />);
    const el = screen.getByRole('switch', { name: 'строгий режим' });
    expect(el.tagName).not.toBe('BUTTON');
  });

  it('showLabel=false скрывает подпись, но не ломает разметку переключателя', () => {
    render(<Toggle on label="строгий режим" showLabel={false} onChange={() => {}} />);
    expect(screen.queryByText('строгий режим')).toBeNull();
    const el = screen.getByRole('switch');
    expect(el.tagName).toBe('BUTTON');
  });
});
