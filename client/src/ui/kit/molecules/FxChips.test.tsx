/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FxChips, { type FxChipItem } from './FxChips';

afterEach(cleanup);

const ITEMS: FxChipItem[] = [{ text: 'reverb 18%' }, { text: 'lowpass 4k' }, { text: 'fade-in 1.2s' }];

describe('FxChips', () => {
  it('показывает текст каждой фишки', () => {
    render(<FxChips items={ITEMS} />);

    expect(screen.getByText('reverb 18%')).toBeTruthy();
    expect(screen.getByText('lowpass 4k')).toBeTruthy();
    expect(screen.getByText('fade-in 1.2s')).toBeTruthy();
  });

  it('без removable крестика нет', () => {
    render(<FxChips items={ITEMS} />);

    expect(screen.queryByText('✕')).toBeNull();
  });

  it('с removable у каждой фишки есть крестик', () => {
    render(<FxChips items={ITEMS} removable onRemove={() => {}} />);

    expect(screen.getAllByText('✕')).toHaveLength(ITEMS.length);
  });

  it('клик по крестику зовёт onRemove с текстом фишки', () => {
    const onRemove = vi.fn();
    render(<FxChips items={ITEMS} removable onRemove={onRemove} />);

    screen.getByRole('button', { name: 'Убрать lowpass 4k' }).click();

    expect(onRemove).toHaveBeenCalledWith('lowpass 4k');
  });

  it('показывает подпись кнопки добавления по умолчанию', () => {
    render(<FxChips items={ITEMS} onAdd={() => {}} />);

    expect(screen.getByText('+ FX')).toBeTruthy();
  });

  it('подпись кнопки добавления настраивается', () => {
    render(<FxChips items={ITEMS} addLabel="+ обработка" onAdd={() => {}} />);

    expect(screen.getByText('+ обработка')).toBeTruthy();
  });

  it('клик по кнопке добавления зовёт onAdd', () => {
    const onAdd = vi.fn();
    render(<FxChips items={ITEMS} onAdd={onAdd} />);

    screen.getByRole('button', { name: '+ FX' }).click();

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('без onAdd кнопки добавления нет, но подпись видна', () => {
    render(<FxChips items={ITEMS} />);

    expect(screen.queryByRole('button', { name: '+ FX' })).toBeNull();
    expect(screen.getByText('+ FX')).toBeTruthy();
  });

  it('по умолчанию живёт на светлом хроме', () => {
    render(<FxChips items={ITEMS} onAdd={() => {}} />);

    expect(screen.getByText('+ FX').className).not.toMatch(/onDark/);
  });

  it('onDark переключает хром подписи добавления', () => {
    render(<FxChips items={ITEMS} onAdd={() => {}} onDark />);

    expect(screen.getByText('+ FX').className).toMatch(/onDark/);
  });
});
