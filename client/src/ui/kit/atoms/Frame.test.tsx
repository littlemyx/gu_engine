/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Frame, { type FrameFill, type FrameTone } from './Frame';

afterEach(cleanup);

const TONES: FrameTone[] = ['light', 'dark', 'accent', 'blueprint-400', 'blueprint-700'];

describe.each(TONES)('Frame, тон %s', tone => {
  it('оборачивает содержимое и получает свой класс тона', () => {
    render(
      <Frame tone={tone}>
        <span>контент рамки</span>
      </Frame>,
    );

    const content = screen.getByText('контент рамки');
    const root = content.parentElement as HTMLElement;
    expect(root.className).toContain(tone.replace('-', ''));
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

describe('Frame, асимметричный паддинг', () => {
  it('paddingX и paddingY задают раздельные отступы (пример макета: 8px 10px)', () => {
    render(
      <Frame paddingY={8} paddingX={10}>
        <span>асимметрия</span>
      </Frame>,
    );

    const root = screen.getByText('асимметрия').parentElement as HTMLElement;
    expect(root.style.padding).toBe('8px 10px');
  });

  it('paddingX/paddingY переопределяют только свою ось, вторая берётся из padding', () => {
    render(
      <Frame padding={12} paddingX={10}>
        <span>частичная асимметрия</span>
      </Frame>,
    );

    const root = screen.getByText('частичная асимметрия').parentElement as HTMLElement;
    expect(root.style.padding).toBe('12px 10px');
  });
});

describe('Frame, пунктирная рамка', () => {
  it('dashed добавляет класс пунктира, по умолчанию его нет', () => {
    render(
      <Frame>
        <span>сплошная</span>
      </Frame>,
    );
    const solidRoot = screen.getByText('сплошная').parentElement as HTMLElement;
    expect(solidRoot.className).not.toContain('dashed');
    cleanup();

    render(
      <Frame dashed>
        <span>пунктир</span>
      </Frame>,
    );
    const dashedRoot = screen.getByText('пунктир').parentElement as HTMLElement;
    expect(dashedRoot.className).toContain('dashed');
  });
});

describe('Frame, заливка фона', () => {
  it('fill по умолчанию — none, отдельного класса заливки нет', () => {
    render(
      <Frame>
        <span>без заливки</span>
      </Frame>,
    );
    const root = screen.getByText('без заливки').parentElement as HTMLElement;
    expect(root.className).not.toContain('fill');
  });

  const FILLS: Exclude<FrameFill, 'none'>[] = ['paper', 'blueprint'];

  describe.each(FILLS)('fill=%s', fill => {
    it('добавляет соответствующий класс заливки', () => {
      render(
        <Frame fill={fill}>
          <span>{`заливка ${fill}`}</span>
        </Frame>,
      );
      const root = screen.getByText(`заливка ${fill}`).parentElement as HTMLElement;
      expect(root.className.toLowerCase()).toContain(`fill${fill}`.toLowerCase());
    });
  });
});

describe('Frame, block', () => {
  it('block={false} по умолчанию не добавляет класс block', () => {
    render(
      <Frame>
        <span>инлайн</span>
      </Frame>,
    );
    const root = screen.getByText('инлайн').parentElement as HTMLElement;
    expect(root.className).not.toContain('block');
  });

  it('block добавляет класс, растягивающий рамку на всю ширину', () => {
    render(
      <Frame block>
        <span>блочная</span>
      </Frame>,
    );
    const root = screen.getByText('блочная').parentElement as HTMLElement;
    expect(root.className).toContain('block');
  });
});

describe('Frame, кликабельность', () => {
  it('с onClick рендерит <button type="button"> с видимым текстом как доступным именем', () => {
    render(<Frame onClick={() => {}}>кликабельная рамка</Frame>);

    const button = screen.getByRole('button', { name: 'кликабельная рамка' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('клик вызывает переданный колбэк', () => {
    let calls = 0;
    render(<Frame onClick={() => (calls += 1)}>жми</Frame>);

    fireEvent.click(screen.getByRole('button', { name: 'жми' }));
    expect(calls).toBe(1);
  });

  it('без onClick кнопки нет, даже если остальные пропсы совпадают', () => {
    render(<Frame>не жми</Frame>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('interactive={false} с onClick выводит кнопку из последовательности табуляции, но клик остаётся рабочим', () => {
    let calls = 0;
    render(
      <Frame onClick={() => (calls += 1)} interactive={false}>
        неинтерактивная кнопка
      </Frame>,
    );

    const button = screen.getByRole('button', { name: 'неинтерактивная кнопка' });
    expect(button.tabIndex).toBe(-1);

    fireEvent.click(button);
    expect(calls).toBe(1);
  });
});
