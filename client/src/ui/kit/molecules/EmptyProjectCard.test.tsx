/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EmptyProjectCard from './EmptyProjectCard';

afterEach(cleanup);

describe('EmptyProjectCard, дефолтный контент', () => {
  it('показывает заголовок, подзаголовок и обе дорожки', () => {
    render(<EmptyProjectCard />);

    expect(screen.getByText('Пустая история')).toBeTruthy();
    expect(screen.getByText('Два способа начать — их можно совмещать.')).toBeTruthy();
    expect(screen.getByText('1 · С нуля')).toBeTruthy();
    expect(
      screen.getByText('Заполните бриф (жанр, тон, длительность) — конвейер соберёт каст, мир и хребет.'),
    ).toBeTruthy();
    expect(screen.getByText('2 · Из префабов')).toBeTruthy();
    expect(
      screen.getByText('Перетащите персонажей, мир или аудио-сет из дока внизу — генерация допишет остальное дешевле.'),
    ).toBeTruthy();
    expect(screen.getByText('≈ $0.50')).toBeTruthy();
  });
});

describe('EmptyProjectCard, кастомный контент', () => {
  it('пропсы вытесняют дефолтные тексты', () => {
    render(
      <EmptyProjectCard
        title="Новая история"
        sub="Начните с одного из способов"
        t1Title="Дорожка первая"
        t1Desc="Описание первой дорожки"
        t1Action="Начать бриф"
        t1Price="≈ $1.20"
        t2Title="Дорожка вторая"
        t2Desc="Описание второй дорожки"
        t2Action="Взять префаб"
      />,
    );

    expect(screen.getByText('Новая история')).toBeTruthy();
    expect(screen.getByText('Начните с одного из способов')).toBeTruthy();
    expect(screen.getByText('Дорожка первая')).toBeTruthy();
    expect(screen.getByText('Описание первой дорожки')).toBeTruthy();
    expect(screen.getByText('≈ $1.20')).toBeTruthy();
    expect(screen.getByText('Дорожка вторая')).toBeTruthy();
    expect(screen.getByText('Описание второй дорожки')).toBeTruthy();
    expect(screen.queryByText('Пустая история')).toBeNull();
    expect(screen.queryByText('1 · С нуля')).toBeNull();
  });
});

describe('EmptyProjectCard, дорожка 1 (заполнить бриф)', () => {
  it('вызывает onStart1 по клику на кнопку действия', () => {
    const onStart1 = vi.fn();
    render(<EmptyProjectCard onStart1={onStart1} />);

    fireEvent.click(screen.getByRole('button', { name: /Заполнить бриф/ }));

    expect(onStart1).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyProjectCard, дорожка 2 (из префабов)', () => {
  it('вызывает onStart2 по клику на кнопку действия, когда колбэк передан', () => {
    const onStart2 = vi.fn();
    render(<EmptyProjectCard onStart2={onStart2} />);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть библиотеку' }));

    expect(onStart2).toHaveBeenCalledTimes(1);
  });

  it('без onStart2 действие дорожки 2 не кликабельно', () => {
    render(<EmptyProjectCard />);

    expect(screen.queryByRole('button', { name: 'Открыть библиотеку' })).toBeNull();
    expect(screen.getByText('Открыть библиотеку')).toBeTruthy();
  });
});
