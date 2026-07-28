/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PrefabCard, { type PrefabCardTone } from './PrefabCard';

afterEach(cleanup);

const BASE = {
  glyph: '◐',
  title: 'Кира v3',
  kind: 'персонаж',
  src: 'обновлена 25 июля',
  status: 'закастована v2 → есть v3',
};

const TONES: PrefabCardTone[] = ['ok', 'wait', 'bad', 'muted'];

describe.each(TONES)('PrefabCard, тон %s', tone => {
  it('показывает контент карточки', () => {
    render(<PrefabCard {...BASE} tone={tone} />);

    expect(screen.getByText('Кира v3')).toBeTruthy();
    expect(screen.getByText('персонаж')).toBeTruthy();
    expect(screen.getByText('обновлена 25 июля')).toBeTruthy();
    expect(screen.getByText('закастована v2 → есть v3')).toBeTruthy();
  });
});

describe('PrefabCard, состояния', () => {
  it('без onClick рендерится нейнтерактивным элементом', () => {
    render(<PrefabCard {...BASE} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерится кнопкой и вызывает колбэк по клику', () => {
    let clicks = 0;
    render(
      <PrefabCard
        {...BASE}
        onClick={() => {
          clicks += 1;
        }}
      />,
    );

    const btn = screen.getByRole('button', { name: /Кира v3/ }) as HTMLButtonElement;
    expect(btn.type).toBe('button');

    fireEvent.click(btn);
    expect(clicks).toBe(1);
  });

  it('selected не ломает рендер контента', () => {
    render(<PrefabCard {...BASE} selected />);

    expect(screen.getByText('Кира v3')).toBeTruthy();
  });

  it('dragging не ломает рендер контента', () => {
    render(<PrefabCard {...BASE} dragging />);

    expect(screen.getByText('Кира v3')).toBeTruthy();
  });
});
