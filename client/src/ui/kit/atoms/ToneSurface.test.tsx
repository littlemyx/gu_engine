/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ToneSurface, { type ToneSurfaceTone } from './ToneSurface';

afterEach(cleanup);

const TONES: ToneSurfaceTone[] = ['accent', 'whiteOnDark', 'error', 'warn', 'darkAccent'];

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
