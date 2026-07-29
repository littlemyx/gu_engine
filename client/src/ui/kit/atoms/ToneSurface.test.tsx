/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ToneSurface, { type ToneSurfaceTone } from './ToneSurface';

afterEach(cleanup);

const TONES: ToneSurfaceTone[] = [
  'accent',
  'whiteOnDark',
  'error',
  'warn',
  'darkAccent',
  'accent200',
  'accent400',
  'accent700',
  'run',
];

describe.each(TONES)('ToneSurface, тон %s', tone => {
  it('оборачивает контент и получает свой класс подложки', () => {
    render(
      <ToneSurface tone={tone}>
        <span>содержимое</span>
      </ToneSurface>,
    );

    const content = screen.getByText('содержимое');
    const root = content.parentElement as HTMLElement;
    expect(root.className).toContain(tone === 'accent' ? 'accent' : tone);
  });
});

describe('ToneSurface, пропсы вида', () => {
  it('padding по умолчанию — 10px', () => {
    render(
      <ToneSurface>
        <span>дефолт</span>
      </ToneSurface>,
    );

    const root = screen.getByText('дефолт').parentElement as HTMLElement;
    expect(root.style.padding).toBe('10px');
  });

  it('padding переопределяется пропом', () => {
    render(
      <ToneSurface padding={20}>
        <span>отступ</span>
      </ToneSurface>,
    );

    const root = screen.getByText('отступ').parentElement as HTMLElement;
    expect(root.style.padding).toBe('20px');
  });

  it('whiteAlpha влияет только на тон whiteOnDark', () => {
    render(
      <ToneSurface tone="whiteOnDark" whiteAlpha={0.14}>
        <span>белая</span>
      </ToneSurface>,
    );

    const root = screen.getByText('белая').parentElement as HTMLElement;
    expect(root.style.getPropertyValue('--tone-alpha')).toBe('14%');
  });

  it('не рендерит кнопку — подложка некликабельна', () => {
    render(
      <ToneSurface>
        <span>контент</span>
      </ToneSurface>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ToneSurface, акцентная рампа', () => {
  it('accent-200, accent-400, accent-700 и accent-900 (darkAccent) получают разные классы подложки', () => {
    const steps: ToneSurfaceTone[] = ['accent200', 'accent400', 'accent700', 'darkAccent'];
    const classNames = steps.map(tone => {
      render(
        <ToneSurface tone={tone}>
          <span>{tone}</span>
        </ToneSurface>,
      );
      const root = screen.getByText(tone).parentElement as HTMLElement;
      cleanup();
      return root.className;
    });

    expect(new Set(classNames).size).toBe(steps.length);
  });

  it('тон run отличается от error и warn — три разных сигнальных класса', () => {
    const signals: ToneSurfaceTone[] = ['run', 'error', 'warn'];
    const classNames = signals.map(tone => {
      render(
        <ToneSurface tone={tone}>
          <span>{tone}</span>
        </ToneSurface>,
      );
      const root = screen.getByText(tone).parentElement as HTMLElement;
      cleanup();
      return root.className;
    });

    expect(new Set(classNames).size).toBe(signals.length);
  });
});
