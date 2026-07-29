/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CostTable from './CostTable';

afterEach(cleanup);

const ROWS = [
  { label: 'план (хребет + каст + мир)', value: '≈ $0.08' },
  { label: 'диалоги + проза · 21 слот', value: '≈ $0.44' },
  { label: 'медиа · 6 фонов + аудио', value: '≈ $0.19' },
];

const TOTAL = { label: 'итого до бандла', value: '≈ $0.71' };

describe('CostTable, строки', () => {
  it('показывает каждую строку сметы', () => {
    render(<CostTable rows={ROWS} />);

    ROWS.forEach(row => {
      expect(screen.getByText(row.label)).toBeTruthy();
      expect(screen.getByText(row.value)).toBeTruthy();
    });
  });

  it('без total не рендерит итог', () => {
    render(<CostTable rows={ROWS} />);

    expect(screen.queryByText('итого до бандла')).toBeNull();
  });
});

describe('CostTable, итог', () => {
  it('рендерит итоговую строку, когда total передан', () => {
    render(<CostTable rows={ROWS} total={TOTAL} />);

    expect(screen.getByText('итого до бандла')).toBeTruthy();
    expect(screen.getByText('≈ $0.71')).toBeTruthy();
  });
});

describe('CostTable, тёмный/светлый хром', () => {
  it('по умолчанию — тёмный хром, как в макете', () => {
    const { container } = render(<CostTable rows={ROWS} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toMatch(/onDark/);
  });

  it('onDark={false} переключает на светлый хром', () => {
    const { container } = render(<CostTable rows={ROWS} onDark={false} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toMatch(/onLight/);
    expect(root.className).not.toMatch(/onDark/);
  });
});

describe('CostTable, ширина', () => {
  it('width применяется к обёртке', () => {
    const { container } = render(<CostTable rows={ROWS} width={360} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.width).toBe('360px');
  });

  it('по умолчанию ширина 290px', () => {
    const { container } = render(<CostTable rows={ROWS} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.width).toBe('290px');
  });
});
