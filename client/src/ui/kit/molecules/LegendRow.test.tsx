/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import LegendRow, { type LegendItem } from './LegendRow';

afterEach(cleanup);

const ITEMS: LegendItem[] = [
  { color: '#a9c4dd', label: 'в локации по расписанию' },
  { color: '#5980a6', label: 'встреча — диалоговый юнит' },
  { color: '#2f4a63', label: 'якорный бит' },
];

describe('LegendRow', () => {
  it('рисует подпись и свотч для каждого пункта', () => {
    const { container } = render(<LegendRow items={ITEMS} />);

    ITEMS.forEach(item => {
      expect(screen.getByText(item.label)).toBeTruthy();
    });

    const boxes = container.querySelectorAll('[aria-hidden="true"]');
    expect(boxes.length).toBe(ITEMS.length);
    boxes.forEach(box => {
      expect((box as HTMLElement).style.background).not.toBe('');
    });
  });

  it('пустой список пунктов не рисует ни одного свотча', () => {
    const { container } = render(<LegendRow items={[]} />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it('note рисует пояснение', () => {
    render(<LegendRow items={ITEMS} note="21 слот = 7 дней × 3 фазы" />);
    expect(screen.getByText('21 слот = 7 дней × 3 фазы')).toBeTruthy();
  });

  it('без note пояснение не рисуется', () => {
    render(<LegendRow items={ITEMS} />);
    expect(screen.queryByText(/слот/)).toBeNull();
  });

  it('LegendRow не рисует ни одной кнопки — это статичная строка', () => {
    render(<LegendRow items={ITEMS} note="пояснение" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('onDark передаётся в MutedText пояснения', () => {
    const { rerender } = render(<LegendRow items={ITEMS} note="пояснение" />);
    expect(screen.getByText('пояснение').className).toMatch(/onLight/);

    rerender(<LegendRow items={ITEMS} note="пояснение" onDark />);
    expect(screen.getByText('пояснение').className).toMatch(/onDark/);
  });
});
