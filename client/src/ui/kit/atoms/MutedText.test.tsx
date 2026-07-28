/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import MutedText from './MutedText';

afterEach(cleanup);

describe('MutedText', () => {
  it('показывает переданный текст', () => {
    render(<MutedText text="черновик · 3 сцены" />);
    expect(screen.getByText('черновик · 3 сцены')).toBeTruthy();
  });

  it('на светлом и на тёмном хроме получает разные классы', () => {
    const { container: light } = render(<MutedText text="мета" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<MutedText text="мета" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });

  it('тихий режим получает свой класс поверх обычного', () => {
    const { container: normal } = render(<MutedText text="мета" />);
    const normalClass = normal.firstElementChild?.className ?? '';
    cleanup();

    const { container: quiet } = render(<MutedText text="мета" quiet />);
    const quietClass = quiet.firstElementChild?.className ?? '';

    expect(quietClass).not.toBe(normalClass);
  });

  it('тихий режим на тёмном отличается и от обычного тёмного, и от тихого светлого', () => {
    const { container: darkNormal } = render(<MutedText text="мета" onDark />);
    const darkNormalClass = darkNormal.firstElementChild?.className ?? '';
    cleanup();

    const { container: darkQuiet } = render(<MutedText text="мета" onDark quiet />);
    const darkQuietClass = darkQuiet.firstElementChild?.className ?? '';
    cleanup();

    const { container: lightQuiet } = render(<MutedText text="мета" quiet />);
    const lightQuietClass = lightQuiet.firstElementChild?.className ?? '';

    expect(darkQuietClass).not.toBe(darkNormalClass);
    expect(darkQuietClass).not.toBe(lightQuietClass);
  });

  it('кегль по умолчанию — 10.5px, задаётся пропом size', () => {
    const { container } = render(<MutedText text="мета" />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.style.fontSize).toBe('10.5px');
    cleanup();

    const { container: custom } = render(<MutedText text="мета" size={13} />);
    const customSpan = custom.firstElementChild as HTMLElement;
    expect(customSpan.style.fontSize).toBe('13px');
  });

  it('не кликабельна — рендерит span, а не button', () => {
    const { container } = render(<MutedText text="мета" />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });
});
