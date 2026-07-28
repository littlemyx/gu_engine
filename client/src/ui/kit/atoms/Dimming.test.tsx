/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Dimming from './Dimming';

afterEach(cleanup);

describe('Dimming', () => {
  it('применяет opacity по умолчанию 0.4 и не съедает содержимое', () => {
    const { container } = render(
      <Dimming>
        <span>сцена</span>
      </Dimming>,
    );

    expect(screen.getByText('сцена')).toBeTruthy();
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).toBe('0.4');
  });

  it('принимает произвольный level', () => {
    const { container } = render(
      <Dimming level={0.15}>
        <span>сцена</span>
      </Dimming>,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).toBe('0.15');
  });

  it('без children и без placeholder не рендерит ничего внутри', () => {
    const { container } = render(<Dimming />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.textContent).toBe('');
  });

  it('без children показывает placeholder', () => {
    render(<Dimming placeholder="Д2в · Кафе — вне ветки" />);

    expect(screen.getByText('Д2в · Кафе — вне ветки')).toBeTruthy();
  });

  describe('на тёмном', () => {
    it('placeholder получает отдельный класс, а не тот же, что на светлом', () => {
      const { container: light } = render(<Dimming placeholder="вне ветки" />);
      const lightClass = light.querySelector('span')?.className ?? '';
      cleanup();

      const { container: dark } = render(<Dimming placeholder="вне ветки" onDark />);
      const darkClass = dark.querySelector('span')?.className ?? '';

      expect(darkClass).not.toBe(lightClass);
    });
  });
});
