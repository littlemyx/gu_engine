/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import MatrixHeader from './MatrixHeader';

afterEach(cleanup);

const DAYS = [{ name: 'День 1' }, { name: 'День 2' }, { name: 'День 3' }, { name: 'Д4 ◈' }];

describe('MatrixHeader', () => {
  it('показывает подпись каждого дня', () => {
    render(<MatrixHeader days={DAYS} />);

    DAYS.forEach(day => {
      expect(screen.getByText(day.name)).toBeTruthy();
    });
  });

  it('без activeDay ни один день не выделен акцентом', () => {
    render(<MatrixHeader days={DAYS} />);

    const label = screen.getByText('День 1') as HTMLElement;
    expect(label.style.fontWeight).toBe('');
  });

  it('активный день подсвечен акцентным жирным текстом', () => {
    render(<MatrixHeader days={DAYS} activeDay={4} />);

    const active = screen.getByText('Д4 ◈') as HTMLElement;
    expect(active.style.fontWeight).toBe('600');

    const inactive = screen.getByText('День 1') as HTMLElement;
    expect(inactive.style.fontWeight).toBe('');
  });

  it('по умолчанию три фазы на день циклируют подписи у/д/в', () => {
    render(<MatrixHeader days={DAYS} />);

    expect(screen.getAllByText('у')).toHaveLength(DAYS.length);
    expect(screen.getAllByText('д')).toHaveLength(DAYS.length);
    expect(screen.getAllByText('в')).toHaveLength(DAYS.length);
  });

  it('phasesPerDay и phaseLabels настраивают число и подписи фазовых колонок', () => {
    render(<MatrixHeader days={DAYS} phasesPerDay={2} phaseLabels={['A', 'B']} />);

    expect(screen.getAllByText('A')).toHaveLength(DAYS.length);
    expect(screen.getAllByText('B')).toHaveLength(DAYS.length);
    expect(screen.queryByText('в')).toBeNull();
  });

  it('рисует разделитель перед каждым днём', () => {
    const { container } = render(<MatrixHeader days={DAYS} />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(DAYS.length);
  });

  it('onDark прокидывается в подписи фаз', () => {
    render(<MatrixHeader days={DAYS} onDark />);

    const phase = screen.getAllByText('у')[0] as HTMLElement;
    expect(phase.className).toMatch(/onDark/);
  });
});
