/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Frame, { type FrameTone } from './Frame';

afterEach(cleanup);

const TONES: FrameTone[] = ['light', 'dark', 'accent'];

describe.each(TONES)('Frame, тон %s', tone => {
  it('оборачивает содержимое и получает свой класс тона', () => {
    render(
      <Frame tone={tone}>
        <span>контент рамки</span>
      </Frame>,
    );

    const content = screen.getByText('контент рамки');
    const root = content.parentElement as HTMLElement;
    expect(root.className).toContain(tone);
  });
});

describe('Frame, состояния', () => {
  it('по умолчанию интерактивна и фокусируема', () => {
    render(
      <Frame>
        <span>дефолт</span>
      </Frame>,
    );

    const root = screen.getByText('дефолт').parentElement as HTMLElement;
    expect(root.tabIndex).toBe(0);
  });

  it('interactive={false} снимает рамку из последовательности табуляции', () => {
    render(
      <Frame interactive={false}>
        <span>неинтерактивная</span>
      </Frame>,
    );

    const root = screen.getByText('неинтерактивная').parentElement as HTMLElement;
    expect(root.getAttribute('tabindex')).toBeNull();
  });

  it('selected добавляет отдельный класс отметки выбора', () => {
    const { container: plain } = render(
      <Frame>
        <span>обычная</span>
      </Frame>,
    );
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    render(
      <Frame selected>
        <span>выбранная</span>
      </Frame>,
    );
    const selectedRoot = screen.getByText('выбранная').parentElement as HTMLElement;

    expect(selectedRoot.className).not.toBe(plainClass);
    expect(selectedRoot.className).toContain('selected');
  });

  it('padding по умолчанию — 12px', () => {
    render(
      <Frame>
        <span>дефолтный отступ</span>
      </Frame>,
    );

    const root = screen.getByText('дефолтный отступ').parentElement as HTMLElement;
    expect(root.style.padding).toBe('12px');
  });

  it('padding переопределяется пропом', () => {
    render(
      <Frame padding={20}>
        <span>отступ</span>
      </Frame>,
    );

    const root = screen.getByText('отступ').parentElement as HTMLElement;
    expect(root.style.padding).toBe('20px');
  });

  it('не рендерит кнопку — рамка сама по себе некликабельна', () => {
    render(
      <Frame>
        <span>контент</span>
      </Frame>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});
