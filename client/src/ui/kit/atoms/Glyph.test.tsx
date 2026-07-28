/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Glyph, { type GlyphTone } from './Glyph';

afterEach(cleanup);

const TONES: GlyphTone[] = ['neutral', 'accent', 'info', 'error', 'warn', 'muted'];

describe.each(TONES)('Glyph, тон %s', tone => {
  it('показывает символ и скрыт от скринридера', () => {
    const { container } = render(<Glyph glyph="◈" tone={tone} />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.textContent).toBe('◈');
    expect(node.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Glyph, размер', () => {
  it('по умолчанию 12px', () => {
    const { container } = render(<Glyph glyph="●" />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.style.fontSize).toBe('12px');
  });

  it('переопределяется пропом size', () => {
    const { container } = render(<Glyph glyph="●" size={20} />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.style.fontSize).toBe('20px');
  });
});

describe('Glyph на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<Glyph glyph="◈" tone="accent" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Glyph glyph="◈" tone="accent" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});

describe('Glyph, не интерактивен', () => {
  it('рендерит span, а не button', () => {
    const { container } = render(<Glyph glyph="◈" />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.tagName).toBe('SPAN');
  });
});
