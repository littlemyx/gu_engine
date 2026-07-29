/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EstimateChips, { type EstimateChipsItem } from './EstimateChips';

afterEach(cleanup);

const ITEMS: EstimateChipsItem[] = [
  { label: 'проза', selected: true },
  { label: 'медиа', price: '+≈$2.10', selected: false },
];

describe('EstimateChips', () => {
  it('показывает подпись каждой фишки', () => {
    render(<EstimateChips items={ITEMS} onToggle={() => {}} />);

    expect(screen.getByText('проза')).toBeTruthy();
    expect(screen.getByText('медиа')).toBeTruthy();
  });

  it('показывает смету рядом с подписью, если она задана', () => {
    render(<EstimateChips items={ITEMS} onToggle={() => {}} />);

    expect(screen.getByText('+≈$2.10')).toBeTruthy();
  });

  it('без сметы у фишки цена не рисуется', () => {
    render(<EstimateChips items={[{ label: 'проза', selected: true }]} onToggle={() => {}} />);

    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('включённая фишка держит aria-pressed=true и галочку', () => {
    render(<EstimateChips items={ITEMS} onToggle={() => {}} />);

    const on = screen.getByRole('button', { name: /проза/ });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.textContent).toContain('✓');
  });

  it('выключенная фишка держит aria-pressed=false и без галочки', () => {
    render(<EstimateChips items={ITEMS} onToggle={() => {}} />);

    const off = screen.getByRole('button', { name: /медиа/ });
    expect(off.getAttribute('aria-pressed')).toBe('false');
    expect(off.textContent).not.toContain('✓');
  });

  it('клик по фишке зовёт onToggle с её индексом', () => {
    const onToggle = vi.fn();
    render(<EstimateChips items={ITEMS} onToggle={onToggle} />);

    screen.getByRole('button', { name: /медиа/ }).click();

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('без onToggle фишки не кликабельны', () => {
    render(<EstimateChips items={ITEMS} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('по умолчанию живёт на светлом хроме', () => {
    render(<EstimateChips items={ITEMS} onToggle={() => {}} />);

    const on = screen.getByRole('button', { name: /проза/ });
    expect(on.className).not.toMatch(/onDark/);
  });

  it('onDark переключает хром фишек', () => {
    render(<EstimateChips items={ITEMS} onToggle={() => {}} onDark />);

    const on = screen.getByRole('button', { name: /проза/ });
    expect(on.className).toMatch(/onDark/);
  });
});
