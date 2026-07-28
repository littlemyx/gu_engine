/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import AccentUnderline from './AccentUnderline';

afterEach(cleanup);

describe('AccentUnderline', () => {
  it('показывает метку как текст, а не разметку', () => {
    render(<AccentUnderline label="Пайплайн" />);
    expect(screen.getByText('Пайплайн')).toBeTruthy();
  });

  it('не рендерит кнопку — компонент некликабельный', () => {
    render(<AccentUnderline label="Пайплайн" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('withBg по умолчанию включён и меняет класс', () => {
    const { container } = render(<AccentUnderline label="Пайплайн" />);
    const withBgClass = container.firstElementChild?.className ?? '';
    cleanup();

    const { container: noBg } = render(<AccentUnderline label="Пайплайн" withBg={false} />);
    const noBgClass = noBg.firstElementChild?.className ?? '';

    expect(withBgClass).not.toBe(noBgClass);
  });

  it('onDark по умолчанию выключен и получает отдельный класс на тёмном', () => {
    const { container: light } = render(<AccentUnderline label="Пайплайн" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<AccentUnderline label="Пайплайн" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
