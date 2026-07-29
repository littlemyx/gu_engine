/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ArtPalette from './ArtPalette';

afterEach(cleanup);

const COLORS = ['d8c8b6', 'a4b8a2', '5a6b7c', '1f2a30'];

describe('ArtPalette', () => {
  it('рисует по свотчу на каждый цвет', () => {
    render(<ArtPalette colors={COLORS} />);

    expect(COLORS.map(hex => screen.getByText(`#${hex}`)).length).toBe(COLORS.length);
  });

  it('показывает hex-подпись под каждым свотчем по умолчанию', () => {
    render(<ArtPalette colors={COLORS} />);

    expect(screen.getByText('#d8c8b6')).toBeTruthy();
    expect(screen.getByText('#1f2a30')).toBeTruthy();
  });

  it('showHex=false прячет подписи', () => {
    render(<ArtPalette colors={COLORS} showHex={false} />);

    expect(screen.queryByText('#d8c8b6')).toBeNull();
  });

  it('нормализует hex без решётки и с ней одинаково', () => {
    render(<ArtPalette colors={['#d8c8b6']} />);

    expect(screen.getByText('#d8c8b6')).toBeTruthy();
  });

  it('withAdd=true по умолчанию рисует кнопку добавления', () => {
    render(<ArtPalette colors={COLORS} />);

    expect(screen.getByRole('button', { name: 'добавить цвет' })).toBeTruthy();
  });

  it('withAdd=false прячет кнопку добавления', () => {
    render(<ArtPalette colors={COLORS} withAdd={false} />);

    expect(screen.queryByRole('button', { name: 'добавить цвет' })).toBeNull();
  });

  it('без onPick свотчи не кликабельны', () => {
    render(<ArtPalette colors={COLORS} />);

    expect(screen.queryAllByRole('button').filter(btn => btn.getAttribute('aria-label') !== 'добавить цвет')).toEqual(
      [],
    );
  });

  it('клик по свотчу зовёт onPick с индексом и нормализованным hex', () => {
    const onPick = vi.fn();
    render(<ArtPalette colors={COLORS} onPick={onPick} />);

    const swatchButton = screen.getByText('#a4b8a2').closest('button') as HTMLButtonElement;
    fireEvent.click(swatchButton);

    expect(onPick).toHaveBeenCalledWith(1, '#a4b8a2');
  });

  it('клик по кнопке добавления зовёт onAdd', () => {
    const onAdd = vi.fn();
    render(<ArtPalette colors={COLORS} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: 'добавить цвет' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
