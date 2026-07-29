/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DecisionRow from './DecisionRow';

afterEach(cleanup);

describe('DecisionRow', () => {
  it('показывает текст и подписи обеих кнопок по умолчанию', () => {
    render(<DecisionRow text="beat_prose/b5 — ваша правка, но изменился Б4" />);
    expect(screen.getByText('beat_prose/b5 — ваша правка, но изменился Б4')).toBeTruthy();
    expect(screen.getByText('оставить моё')).toBeTruthy();
    expect(screen.getByText('дубль ≈$0.02')).toBeTruthy();
  });

  it('принимает свои подписи кнопок', () => {
    render(<DecisionRow text="конфликт" keepLabel="взять моё" redoLabel="перегенерировать ≈$0.05" />);
    expect(screen.getByText('взять моё')).toBeTruthy();
    expect(screen.getByText('перегенерировать ≈$0.05')).toBeTruthy();
  });

  it('без onPick рисует неинтерактивные кнопки', () => {
    render(<DecisionRow text="конфликт" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onPick рисует кнопки и вызывает колбэк с id выбора по клику', () => {
    let picked: string | null = null;
    render(
      <DecisionRow
        text="конфликт"
        onPick={choice => {
          picked = choice;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'оставить моё' }));
    expect(picked).toBe('моё');

    fireEvent.click(screen.getByRole('button', { name: 'дубль ≈$0.02' }));
    expect(picked).toBe('дубль');
  });

  describe.each([
    ['нет', false, false],
    ['моё', true, false],
    ['дубль', false, true],
  ] as const)('chosen %s', (chosen, keepSelected, redoSelected) => {
    it('проставляет aria-pressed на нужной кнопке', () => {
      render(<DecisionRow text="конфликт" chosen={chosen} onPick={() => {}} />);
      const keepButton = screen.getByRole('button', { name: 'оставить моё' });
      const redoButton = screen.getByRole('button', { name: 'дубль ≈$0.02' });

      expect(keepButton.getAttribute('aria-pressed')).toBe(String(keepSelected));
      expect(redoButton.getAttribute('aria-pressed')).toBe(String(redoSelected));
    });
  });
});
