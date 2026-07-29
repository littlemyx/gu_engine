/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BatchBand, { type BatchBandTone } from './BatchBand';

afterEach(cleanup);

const TONES: BatchBandTone[] = ['accent', 'quiet'];

describe.each(TONES)('BatchBand, тон %s', tone => {
  it('показывает подпись и счётчик', () => {
    render(<BatchBand label="ПОРЦИЯ 2 · СТУПЕНЬ 2 · КИРА — ИДЁТ" meta="4/9" tone={tone} />);
    expect(screen.getByText('ПОРЦИЯ 2 · СТУПЕНЬ 2 · КИРА — ИДЁТ')).toBeTruthy();
    expect(screen.getByText('· 4/9')).toBeTruthy();
  });
});

describe('BatchBand, тона получают разные классы', () => {
  it('accent и quiet красятся по-разному', () => {
    const { container: accent } = render(<BatchBand label="Полоса" tone="accent" />);
    const accentClass = accent.firstElementChild?.className ?? '';
    cleanup();

    const { container: quiet } = render(<BatchBand label="Полоса" tone="quiet" />);
    const quietClass = quiet.firstElementChild?.className ?? '';

    expect(quietClass).not.toBe(accentClass);
  });
});

describe('BatchBand, счётчик', () => {
  it('по умолчанию тон акцентная', () => {
    const { container } = render(<BatchBand label="Полоса" />);
    const root = container.firstElementChild as HTMLElement;
    const { container: accentContainer } = render(<BatchBand label="Полоса" tone="accent" />);
    const accentRoot = accentContainer.firstElementChild as HTMLElement;
    expect(root.className).toBe(accentRoot.className);
  });

  it('без meta счётчик не рисуется', () => {
    render(<BatchBand label="ПОРЦИЯ 1 · СТУПЕНЬ 1 · ВСТУПЛЕНИЕ" />);
    expect(screen.queryByText(/^·/)).toBeNull();
  });

  it('с meta счётчик показывает разделитель и значение', () => {
    render(<BatchBand label="ПОРЦИЯ 3" meta="2/5" />);
    expect(screen.getByText('· 2/5')).toBeTruthy();
  });
});
