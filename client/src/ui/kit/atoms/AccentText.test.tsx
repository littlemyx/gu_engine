/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import AccentText, { type AccentTextTone } from './AccentText';

afterEach(cleanup);

const TONES: AccentTextTone[] = ['info', 'accent', 'error', 'warn'];

describe.each(TONES)('AccentText, тон %s', tone => {
  it('показывает текст', () => {
    render(<AccentText text="черновик" tone={tone} />);

    expect(screen.getByText('черновик')).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<AccentText text="черновик" tone={tone} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<AccentText text="черновик" tone={tone} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('AccentText, вид', () => {
  it('bold задаёт полужирное начертание', () => {
    render(<AccentText text="важно" bold />);

    const node = screen.getByText('важно') as HTMLElement;
    expect(node.style.fontWeight).toBe('600');
  });

  it('без bold начертание обычное', () => {
    render(<AccentText text="обычно" />);

    const node = screen.getByText('обычно') as HTMLElement;
    expect(node.style.fontWeight).toBe('400');
  });

  it('size задаёт кегль в px', () => {
    render(<AccentText text="крупно" size={14} />);

    const node = screen.getByText('крупно') as HTMLElement;
    expect(node.style.fontSize).toBe('14px');
  });

  it('по умолчанию кегль 11px', () => {
    render(<AccentText text="дефолт" />);

    const node = screen.getByText('дефолт') as HTMLElement;
    expect(node.style.fontSize).toBe('11px');
  });
});
