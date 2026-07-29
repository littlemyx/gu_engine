/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReleaseActions, { type ReleaseAction } from './ReleaseActions';

afterEach(cleanup);

const ITEMS: ReleaseAction[] = [
  { label: '▶ Сыграть' },
  { label: 'Скачать .gu.json' },
  { label: 'Восстановить как черновик', accent: true },
];

describe('ReleaseActions, состав', () => {
  it('печатает подпись каждой кнопки', () => {
    render(<ReleaseActions items={ITEMS} onPick={() => {}} />);

    expect(screen.getByRole('button', { name: '▶ Сыграть' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скачать .gu.json' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Восстановить как черновик' })).toBeTruthy();
  });

  it('без items не рисует ни одной кнопки', () => {
    render(<ReleaseActions items={[]} onPick={() => {}} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ReleaseActions, тон', () => {
  it('акцентная кнопка несёт класс accent, обычная — neutral', () => {
    render(<ReleaseActions items={ITEMS} onPick={() => {}} />);

    const neutral = screen.getByRole('button', { name: '▶ Сыграть' });
    const accent = screen.getByRole('button', { name: 'Восстановить как черновик' });

    expect(neutral.className).toMatch(/neutral/);
    expect(accent.className).toMatch(/accent/);
  });
});

describe('ReleaseActions, колбэк', () => {
  it('клик по кнопке зовёт onPick с индексом и подписью', () => {
    const onPick = vi.fn();
    render(<ReleaseActions items={ITEMS} onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Скачать .gu.json' }));

    expect(onPick).toHaveBeenCalledWith(1, 'Скачать .gu.json');
  });

  it('без onPick кнопки не интерактивны', () => {
    render(<ReleaseActions items={ITEMS} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('▶ Сыграть')).toBeTruthy();
  });
});

describe('ReleaseActions, состояние disabled', () => {
  it('disabled запирает все кнопки и не пускает клик', () => {
    const onPick = vi.fn();
    render(<ReleaseActions items={ITEMS} disabled onPick={onPick} />);

    const buttons = screen.getAllByRole('button') as HTMLButtonElement[];
    expect(buttons.every(button => button.disabled)).toBe(true);

    fireEvent.click(buttons[0]);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('ReleaseActions, хром', () => {
  it('по умолчанию живёт на светлом хроме', () => {
    render(<ReleaseActions items={ITEMS} onPick={() => {}} />);

    const button = screen.getByRole('button', { name: '▶ Сыграть' });
    expect(button.className).not.toMatch(/onDark/);
  });

  it('onDark переключает хром кнопок', () => {
    render(<ReleaseActions items={ITEMS} onPick={() => {}} onDark />);

    const button = screen.getByRole('button', { name: '▶ Сыграть' });
    expect(button.className).toMatch(/onDark/);
  });
});
