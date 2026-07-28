/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Logo, { type LogoTone } from './Logo';

afterEach(cleanup);

const TONES: LogoTone[] = ['muted', 'contrast'];

describe.each(TONES)('Logo, тон %s', tone => {
  it('показывает текст', () => {
    render(<Logo text="GU Engine" tone={tone} />);

    expect(screen.getByText('GU Engine')).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<Logo text="GU Engine" tone={tone} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Logo text="GU Engine" tone={tone} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('Logo, вид', () => {
  it('size задаёт кегль в px', () => {
    render(<Logo text="GU Engine" size={20} />);

    const node = screen.getByText('GU Engine') as HTMLElement;
    expect(node.style.fontSize).toBe('20px');
  });

  it('по умолчанию кегль 12px', () => {
    render(<Logo text="GU Engine" />);

    const node = screen.getByText('GU Engine') as HTMLElement;
    expect(node.style.fontSize).toBe('12px');
  });

  it('по умолчанию тон приглушённый', () => {
    const { container: defaultTone } = render(<Logo text="GU Engine" />);
    const defaultClass = defaultTone.firstElementChild?.className ?? '';
    cleanup();

    const { container: mutedTone } = render(<Logo text="GU Engine" tone="muted" />);
    expect(mutedTone.firstElementChild?.className).toBe(defaultClass);
  });
});
