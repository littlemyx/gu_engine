/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StageCard, { type StageCardPriceTone, type StageCardTone } from './StageCard';

afterEach(cleanup);

describe('StageCard, содержимое', () => {
  it('показывает код стадии и счёт слотов', () => {
    render(<StageCard kicker="2 · ПРОЗА" stats="31 готово · 9 устарело · 4 нет" />);
    expect(screen.getByText('2 · ПРОЗА')).toBeTruthy();
    expect(screen.getByText('31 готово · 9 устарело · 4 нет')).toBeTruthy();
  });

  it('без price строка сметы не рисуется', () => {
    render(<StageCard kicker="2 · ПРОЗА" stats="31 готово" />);
    expect(screen.queryByText(/довести/)).toBeNull();
  });

  it('с price строка сметы видна', () => {
    render(<StageCard kicker="2 · ПРОЗА" stats="31 готово" price="довести ≈$1.36" />);
    expect(screen.getByText('довести ≈$1.36')).toBeTruthy();
  });
});

describe('StageCard, кликабельность', () => {
  it('без onClick рендерится нейтральным элементом, а не кнопкой', () => {
    render(<StageCard kicker="2 · ПРОЗА" stats="31 готово" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерится кнопкой и вызывает колбэк по клику', () => {
    const onClick = vi.fn();
    render(<StageCard kicker="2 · ПРОЗА" stats="31 готово" onClick={onClick} />);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

const TONES: StageCardTone[] = ['active', 'default', 'attention', 'running'];

describe.each(TONES)('StageCard, тон стадии %s', tone => {
  it('рендерится без ошибок и показывает счёт слотов', () => {
    render(<StageCard kicker="2 · ПРОЗА" stats="31 готово · 9 устарело · 4 нет" tone={tone} />);
    expect(screen.getByText('31 готово · 9 устарело · 4 нет')).toBeTruthy();
  });

  it('тон меняет класс корня карточки', () => {
    const { container: base } = render(<StageCard kicker="К" stats="С" tone="active" />);
    const baseClass = base.firstElementChild?.className ?? '';
    cleanup();

    const { container: other } = render(<StageCard kicker="К" stats="С" tone={tone} />);
    if (tone !== 'active') {
      expect(other.firstElementChild?.className).not.toBe(baseClass);
    }
  });
});

const PRICE_TONES: StageCardPriceTone[] = ['auto', 'accent', 'muted', 'error'];

describe.each(PRICE_TONES)('StageCard, тон сметы %s', priceTone => {
  it('показывает смету указанным тоном', () => {
    render(<StageCard kicker="2 · ПРОЗА" stats="31 готово" price="довести ≈$1.36" priceTone={priceTone} />);
    expect(screen.getByText('довести ≈$1.36')).toBeTruthy();
  });
});
