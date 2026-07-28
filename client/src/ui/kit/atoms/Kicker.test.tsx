/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Kicker, { type KickerTone } from './Kicker';

afterEach(cleanup);

const TONES: KickerTone[] = ['neutral', 'accent', 'error'];

describe.each(TONES)('Kicker, тон %s', tone => {
  it('показывает текст', () => {
    render(<Kicker text="Лейбл поля" tone={tone} />);
    expect(screen.getByText('Лейбл поля')).toBeTruthy();
  });
});

describe('Kicker на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<Kicker text="Код секции" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Kicker text="Код секции" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});

describe('Kicker, размер', () => {
  it('по умолчанию 9px', () => {
    render(<Kicker text="Код секции" />);
    const node = screen.getByText('Код секции') as HTMLElement;
    expect(node.style.fontSize).toBe('9px');
  });

  it('size управляет инлайновым font-size', () => {
    render(<Kicker text="Код секции" size={8.5} />);
    const node = screen.getByText('Код секции') as HTMLElement;
    expect(node.style.fontSize).toBe('8.5px');
  });
});
