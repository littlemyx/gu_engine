/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TakeChips, { type TakeChipItem } from './TakeChips';

afterEach(cleanup);

const ITEMS: TakeChipItem[] = [
  { label: '№1', count: '9' },
  { label: '№2', count: '12', status: 'compared' },
  { label: '№3', status: 'accepted' },
];

describe('TakeChips', () => {
  it('показывает метку каждой фишки', () => {
    render(<TakeChips items={ITEMS} onPick={() => {}} />);

    expect(screen.getByText('№1')).toBeTruthy();
    expect(screen.getByText('№2')).toBeTruthy();
    expect(screen.getByText('№3')).toBeTruthy();
  });

  it('показывает счётчик рядом с меткой, если он задан', () => {
    render(<TakeChips items={ITEMS} onPick={() => {}} />);

    expect(screen.getByText('#9')).toBeTruthy();
    expect(screen.getByText('#12')).toBeTruthy();
  });

  it('без счётчика у фишки он не рисуется', () => {
    render(<TakeChips items={[{ label: '№1' }]} onPick={() => {}} />);

    expect(screen.queryByText(/^#/)).toBeNull();
  });

  it('обычная фишка без галочки', () => {
    render(<TakeChips items={ITEMS} onPick={() => {}} />);

    const normal = screen.getByRole('button', { name: /№1/ });
    expect(normal.textContent).not.toContain('✓');
  });

  it('сравниваемая фишка несёт свой класс, но без галочки', () => {
    render(<TakeChips items={ITEMS} onPick={() => {}} />);

    const compared = screen.getByRole('button', { name: /№2/ });
    expect(compared.textContent).not.toContain('✓');
  });

  it('принятая фишка несёт галочку', () => {
    render(<TakeChips items={ITEMS} onPick={() => {}} />);

    const accepted = screen.getByRole('button', { name: /№3/ });
    expect(accepted.textContent).toContain('✓');
  });

  it('клик по фишке зовёт onPick с её индексом', () => {
    const onPick = vi.fn();
    render(<TakeChips items={ITEMS} onPick={onPick} />);

    screen.getByRole('button', { name: /№2/ }).click();

    expect(onPick).toHaveBeenCalledWith(1);
  });

  it('клик по уже принятой фишке тоже зовёт onPick', () => {
    const onPick = vi.fn();
    render(<TakeChips items={ITEMS} onPick={onPick} />);

    screen.getByRole('button', { name: /№3/ }).click();

    expect(onPick).toHaveBeenCalledWith(2);
  });

  it('без onPick фишки не кликабельны', () => {
    render(<TakeChips items={ITEMS} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('по умолчанию живёт на светлом хроме', () => {
    render(<TakeChips items={ITEMS} onPick={() => {}} />);

    const normal = screen.getByRole('button', { name: /№1/ });
    expect(normal.className).not.toMatch(/onDark/);
  });

  it('onDark переключает хром фишек', () => {
    render(<TakeChips items={ITEMS} onPick={() => {}} onDark />);

    const normal = screen.getByRole('button', { name: /№1/ });
    expect(normal.className).toMatch(/onDark/);
  });
});
