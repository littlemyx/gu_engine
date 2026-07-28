/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PanelInfoBox from './PanelInfoBox';

afterEach(cleanup);

describe('PanelInfoBox', () => {
  it('показывает переданный текст подсказки', () => {
    render(<PanelInfoBox text="Дальше: следующий шаг зоны" />);
    expect(screen.getByText('Дальше: следующий шаг зоны')).toBeTruthy();
  });

  it('по умолчанию — тёмный хром, как в макете сайдбара', () => {
    const { container } = render(<PanelInfoBox text="подсказка" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('onDark');
  });

  it('на светлом и на тёмном хроме получает разные классы', () => {
    const { container: dark } = render(<PanelInfoBox text="подсказка" />);
    const darkClass = dark.firstElementChild?.className ?? '';
    cleanup();

    const { container: light } = render(<PanelInfoBox text="подсказка" onDark={false} />);
    const lightClass = light.firstElementChild?.className ?? '';

    expect(lightClass).not.toBe(darkClass);
  });

  it('не кликабельна — рендерит div, а не button', () => {
    const { container } = render(<PanelInfoBox text="подсказка" />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('div')).not.toBeNull();
  });
});
