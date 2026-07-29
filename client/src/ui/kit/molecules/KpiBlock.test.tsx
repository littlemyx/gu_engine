/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import KpiBlock, { type KpiBlockItem } from './KpiBlock';

afterEach(cleanup);

const ITEMS: KpiBlockItem[] = [
  { value: '2', label: 'блокера', tone: 'normal' },
  { value: '12', label: 'заметки', tone: 'accent' },
  { value: 'D4', label: 'тихий', tone: 'quiet' },
];

describe('KpiBlock', () => {
  it('рисует значение и подпись для каждого пункта', () => {
    render(<KpiBlock items={ITEMS} />);

    ITEMS.forEach(item => {
      expect(screen.getByText(item.value)).toBeTruthy();
      expect(screen.getByText(item.label)).toBeTruthy();
    });
  });

  it('пустой список пунктов не рисует ни одной цифры', () => {
    const { container } = render(<KpiBlock items={[]} />);
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('передаёт size в кегль цифры каждого пункта', () => {
    render(<KpiBlock items={ITEMS} size={30} />);
    expect(screen.getByText('2').style.fontSize).toBe('30px');
    expect(screen.getByText('12').style.fontSize).toBe('30px');
  });

  it('по умолчанию size — 22px', () => {
    render(<KpiBlock items={ITEMS} />);
    expect(screen.getByText('2').style.fontSize).toBe('22px');
  });

  it('onDark передаётся в цифру и подпись каждого пункта', () => {
    const { rerender } = render(<KpiBlock items={ITEMS} />);
    expect(screen.getByText('блокера').className).toMatch(/onLight/);

    rerender(<KpiBlock items={ITEMS} onDark />);
    expect(screen.getByText('блокера').className).toMatch(/onDark/);
  });

  it('KpiBlock не рисует ни одной кнопки — это статичная строка', () => {
    render(<KpiBlock items={ITEMS} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
