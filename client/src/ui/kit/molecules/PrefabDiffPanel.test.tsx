/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PrefabDiffPanel from './PrefabDiffPanel';

afterEach(cleanup);

const BASE_PROPS = {
  title: 'Кира: v2 (закастована) → v3 (в библиотеке)',
  note: 'апгрейд — осознанное действие',
  conflict: 'конфликт speechPattern: ваше «мягче, без иронии» · v3 «суше, ироничнее» — выбираете вы, мержа нет',
  takeLabel: 'Взять v3, оверрайд решить',
  stayLabel: 'Остаться на v2',
};

describe('PrefabDiffPanel', () => {
  it('показывает заголовок и пояснительную заметку', () => {
    render(<PrefabDiffPanel {...BASE_PROPS} />);
    expect(screen.getByText(BASE_PROPS.title)).toBeTruthy();
    expect(screen.getByText(BASE_PROPS.note)).toBeTruthy();
  });

  it('без children показывает текст конфликта', () => {
    render(<PrefabDiffPanel {...BASE_PROPS} />);
    expect(screen.getByText(BASE_PROPS.conflict)).toBeTruthy();
  });

  it('с children показывает тело диффа, а не conflict', () => {
    render(
      <PrefabDiffPanel {...BASE_PROPS}>
        <span>кастомный дифф</span>
      </PrefabDiffPanel>,
    );
    expect(screen.getByText('кастомный дифф')).toBeTruthy();
    expect(screen.queryByText(BASE_PROPS.conflict)).toBeNull();
  });

  it('кнопка «взять» вызывает onTake', () => {
    const onTake = vi.fn();
    render(<PrefabDiffPanel {...BASE_PROPS} onTake={onTake} />);
    fireEvent.click(screen.getByRole('button', { name: BASE_PROPS.takeLabel }));
    expect(onTake).toHaveBeenCalledTimes(1);
  });

  it('кнопка «остаться» вызывает onStay', () => {
    const onStay = vi.fn();
    render(<PrefabDiffPanel {...BASE_PROPS} onStay={onStay} />);
    fireEvent.click(screen.getByRole('button', { name: BASE_PROPS.stayLabel }));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it('без onStay кнопка «остаться» не интерактивна', () => {
    render(<PrefabDiffPanel {...BASE_PROPS} />);
    expect(screen.queryByRole('button', { name: BASE_PROPS.stayLabel })).toBeNull();
    expect(screen.getByText(BASE_PROPS.stayLabel)).toBeTruthy();
  });

  it('без footnote сноска не рендерится', () => {
    render(<PrefabDiffPanel {...BASE_PROPS} />);
    expect(screen.queryByText('сноска')).toBeNull();
  });

  it('с footnote сноска показывается у строки кнопок', () => {
    render(<PrefabDiffPanel {...BASE_PROPS} footnote="решение необратимо" />);
    expect(screen.getByText('решение необратимо')).toBeTruthy();
  });
});
