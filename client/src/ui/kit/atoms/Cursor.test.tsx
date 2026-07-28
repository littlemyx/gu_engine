/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Cursor, { type CursorTone } from './Cursor';

afterEach(cleanup);

const TONES: CursorTone[] = ['plain', 'accent'];

describe.each(TONES)('Cursor, тон %s', tone => {
  it('рисует глиф ▌ и скрыт от скринридера', () => {
    const { container } = render(<Cursor tone={tone} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.textContent).toBe('▌');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Cursor, состояние blink', () => {
  it('мигает по умолчанию', () => {
    const { container } = render(<Cursor />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.className).toMatch(/blink/);
  });

  it('не мигает при blink={false}', () => {
    const { container } = render(<Cursor blink={false} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.className).not.toMatch(/blink/);
  });
});

describe('Cursor, кегль', () => {
  it('прокидывает size в font-size', () => {
    const { container } = render(<Cursor size={16} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.fontSize).toBe('16px');
  });

  it('по умолчанию 11px', () => {
    const { container } = render(<Cursor />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.fontSize).toBe('11px');
  });
});

describe('Cursor на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<Cursor />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Cursor onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
