/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CheckGlyph, { type CheckGlyphTone } from './CheckGlyph';

afterEach(cleanup);

const TONES: CheckGlyphTone[] = ['ok', 'muted'];

describe.each(TONES)('CheckGlyph, тон %s', tone => {
  it('рисует галочку и прячет её от скринридера', () => {
    const { container } = render(<CheckGlyph tone={tone} />);
    const glyph = container.firstElementChild as HTMLElement;

    expect(glyph.textContent).toBe('✓');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('CheckGlyph на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<CheckGlyph />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<CheckGlyph onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});

describe('CheckGlyph, кегль', () => {
  it('по умолчанию 11px и меняется пропом size', () => {
    const { container: def } = render(<CheckGlyph />);
    const defGlyph = def.firstElementChild as HTMLElement;
    expect(defGlyph.style.fontSize).toBe('11px');
    cleanup();

    const { container: big } = render(<CheckGlyph size={16} />);
    const bigGlyph = big.firstElementChild as HTMLElement;
    expect(bigGlyph.style.fontSize).toBe('16px');
  });
});
