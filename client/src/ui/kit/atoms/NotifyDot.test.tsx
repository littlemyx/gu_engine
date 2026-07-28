/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import NotifyDot, { type NotifyDotTone } from './NotifyDot';

afterEach(cleanup);

const TONES: NotifyDotTone[] = ['yellow', 'accent', 'error'];

describe.each(TONES)('NotifyDot, тон %s', tone => {
  it('рисует одиночную точку', () => {
    const { container } = render(<NotifyDot tone={tone} />);

    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.tagName).toBe('SPAN');
    expect(dot.className.length).toBeGreaterThan(0);
  });

  it('скрыта от скринридера', () => {
    const { container } = render(<NotifyDot tone={tone} />);

    const dot = container.firstElementChild as HTMLElement;
    expect(dot.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('NotifyDot, размер', () => {
  it('по умолчанию 6px', () => {
    const { container } = render(<NotifyDot />);

    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.width).toBe('6px');
    expect(dot.style.height).toBe('6px');
  });

  it('задаётся пропом size', () => {
    const { container } = render(<NotifyDot size={10} />);

    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.width).toBe('10px');
    expect(dot.style.height).toBe('10px');
  });
});

describe('NotifyDot на тёмном', () => {
  it('тон error получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<NotifyDot tone="error" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<NotifyDot tone="error" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
