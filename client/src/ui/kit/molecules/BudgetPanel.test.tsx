/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BudgetPanel from './BudgetPanel';

afterEach(cleanup);

const ROWS = [
  { label: 'потрачено', value: '$0.21' },
  { label: 'оценка до конца', value: '≈ $0.31' },
  { label: 'лимит прогона', value: '$1.00', muted: true },
];

const NOTE = 'риска превышения нет · стоп при $1.00 автоматически';

describe('BudgetPanel, строки', () => {
  it('показывает подпись и значение каждой строки', () => {
    render(<BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} />);

    ROWS.forEach(row => {
      expect(screen.getByText(row.label)).toBeTruthy();
      expect(screen.getByText(row.value)).toBeTruthy();
    });
  });

  it('показывает заметку под треком', () => {
    render(<BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} />);

    expect(screen.getByText(NOTE)).toBeTruthy();
  });
});

describe('BudgetPanel, трек', () => {
  it('передаёт percent и limitAt в трек прогресса', () => {
    render(<BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} />);

    const track = screen.getByRole('progressbar');
    expect(track.getAttribute('aria-valuenow')).toBe('21');
  });
});

describe('BudgetPanel, тёмный/светлый хром', () => {
  it('по умолчанию — тёмный хром, как в макете', () => {
    const { container } = render(<BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toMatch(/onDark/);
  });

  it('onDark={false} переключает на светлый хром', () => {
    const { container } = render(<BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} onDark={false} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toMatch(/onLight/);
    expect(root.className).not.toMatch(/onDark/);
  });
});

describe('BudgetPanel, ширина', () => {
  it('width применяется к обёртке', () => {
    const { container } = render(<BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} width={360} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.width).toBe('360px');
  });

  it('по умолчанию ширина 320px', () => {
    const { container } = render(<BudgetPanel rows={ROWS} percent={21} limitAt={52} note={NOTE} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.width).toBe('320px');
  });
});
