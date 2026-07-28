/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Counter, { type CounterTone } from './Counter';

afterEach(cleanup);

const TONES: CounterTone[] = ['neutral', 'accent', 'warn', 'error'];

describe.each(TONES)('Counter, тон %s', tone => {
  it('показывает значение', () => {
    render(<Counter value="4/9" tone={tone} />);

    expect(screen.getByText('4/9')).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<Counter value="4/9" tone={tone} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Counter value="4/9" tone={tone} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('Counter, доп. пропсы', () => {
  it('не кликабелен — кнопки не рендерит', () => {
    render(<Counter value="4/9" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('кегль передаётся инлайн-стилем', () => {
    render(<Counter value="4/9" size={13} />);

    const el = screen.getByText('4/9') as HTMLElement;
    expect(el.style.fontSize).toBe('13px');
  });

  it('кегль по умолчанию — 10px', () => {
    render(<Counter value="4/9" />);

    const el = screen.getByText('4/9') as HTMLElement;
    expect(el.style.fontSize).toBe('10px');
  });

  it('поддерживает произвольный формат значения (×n)', () => {
    render(<Counter value="×3" />);

    expect(screen.getByText('×3')).toBeTruthy();
  });
});
