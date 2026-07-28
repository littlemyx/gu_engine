/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TokenHighlight from './TokenHighlight';

afterEach(cleanup);

describe('TokenHighlight', () => {
  it('оборачивает токен в фигурные скобки', () => {
    render(<TokenHighlight token="biome" inSentence={false} />);
    expect(screen.getByText('{biome}')).toBeTruthy();
  });

  it('в предложении показывает before и after вокруг токена', () => {
    const { container } = render(<TokenHighlight token="biome" before="Опиши локацию" after="в тоне сеттинга." />);
    expect(container.textContent).toBe('Опиши локацию {biome} в тоне сеттинга.');
  });

  it('вне предложения скрывает before и after', () => {
    const { container } = render(
      <TokenHighlight token="biome" inSentence={false} before="Опиши локацию" after="в тоне сеттинга." />,
    );
    expect(container.textContent).toBe('{biome}');
  });

  it('на тёмном хроме получает отдельный класс', () => {
    const { container: light } = render(<TokenHighlight token="biome" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<TokenHighlight token="biome" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
