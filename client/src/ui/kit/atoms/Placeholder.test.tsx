/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Placeholder from './Placeholder';

afterEach(cleanup);

describe('Placeholder', () => {
  it('показывает переданный текст', () => {
    render(<Placeholder text="выбрать локацию…" />);
    expect(screen.getByText('выбрать локацию…')).toBeTruthy();
  });

  it('на светлом и на тёмном хроме получает разные классы', () => {
    const { container: light } = render(<Placeholder text="пусто" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Placeholder text="пусто" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });

  it('кегль по умолчанию — 10.5px, задаётся пропом size', () => {
    const { container } = render(<Placeholder text="пусто" />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.style.fontSize).toBe('10.5px');
    cleanup();

    const { container: custom } = render(<Placeholder text="пусто" size={12} />);
    const customSpan = custom.firstElementChild as HTMLElement;
    expect(customSpan.style.fontSize).toBe('12px');
  });

  it('не кликабелен — рендерит span, а не button', () => {
    const { container } = render(<Placeholder text="пусто" />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });
});
