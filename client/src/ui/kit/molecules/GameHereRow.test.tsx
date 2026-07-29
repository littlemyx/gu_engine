/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GameHereRow from './GameHereRow';

afterEach(cleanup);

describe('GameHereRow, активная строка', () => {
  it('показывает глиф, подпись и подсказку', () => {
    render(<GameHereRow glyph="◈" label="Б3 Шторм" hint="игра здесь" />);
    expect(screen.getByText('◈')).toBeTruthy();
    expect(screen.getByText('Б3 Шторм')).toBeTruthy();
    expect(screen.getByText('игра здесь')).toBeTruthy();
  });

  it('подпись жирная и полнояркая (класс labelActive)', () => {
    render(<GameHereRow glyph="◈" label="Б3 Шторм" hint="игра здесь" />);
    const label = screen.getByText('Б3 Шторм');
    expect(label.className).toMatch(/labelActive/);
  });

  it('без onPlay кнопка «играть отсюда» неинтерактивна', () => {
    render(<GameHereRow glyph="◈" label="Б3 Шторм" hint="игра здесь" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTitle('играть отсюда')).toBeTruthy();
  });

  it('с onPlay рисует кнопку и вызывает колбэк по клику', () => {
    let clicked = 0;
    render(
      <GameHereRow
        glyph="◈"
        label="Б3 Шторм"
        hint="игра здесь"
        onPlay={() => {
          clicked += 1;
        }}
      />,
    );
    const button = screen.getByRole('button', { name: 'играть отсюда' });
    fireEvent.click(button);
    expect(clicked).toBe(1);
  });
});

describe('GameHereRow, неактивная строка', () => {
  it('не показывает подсказку и кнопку', () => {
    render(<GameHereRow glyph="◇" label="Б2 Затишье" hint="игра здесь" active={false} />);
    expect(screen.queryByText('игра здесь')).toBeNull();
    expect(screen.queryByTitle('играть отсюда')).toBeNull();
  });

  it('подпись без класса labelActive', () => {
    render(<GameHereRow glyph="◇" label="Б2 Затишье" hint="игра здесь" active={false} />);
    const label = screen.getByText('Б2 Затишье');
    expect(label.className).not.toMatch(/labelActive/);
  });

  it('игнорирует onPlay, когда строка неактивна', () => {
    const onPlay = vi.fn();
    render(<GameHereRow glyph="◇" label="Б2 Затишье" hint="игра здесь" active={false} onPlay={onPlay} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();
  });
});
