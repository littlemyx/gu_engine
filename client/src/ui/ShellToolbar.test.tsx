/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ShellToolbar, { type ShellMode } from './ShellToolbar';

/**
 * Гейт генерации. Раньше он читался только на первом экране: стоило появиться
 * хребту — и «Сгенерировать» запускало пайплайн на сломанном брифе, тратя
 * деньги и время на историю без каста.
 */

afterEach(cleanup);

const REASON = 'нужен хотя бы один LI';

// jest-dom в проекте нет, поэтому смотрим само свойство кнопки.
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const generateButton = () => button('▶ Сгенерировать');

// Режимы, в которых кнопка запускает пайплайн. running — прогон уже идёт
// (там только «Стоп»), readonly заперт целиком и проверяется отдельно.
const LAUNCHING_MODES: ShellMode[] = ['empty', 'blocked', 'idle'];

describe.each(LAUNCHING_MODES)('ShellToolbar, режим %s', mode => {
  it('на сломанном брифе генерация заперта и объясняет причину', () => {
    render(<ShellToolbar mode={mode} briefReady={false} briefReason={REASON} />);

    expect(generateButton().disabled).toBe(true);
    expect(screen.getByText(REASON)).toBeTruthy();
  });

  it('на готовом брифе генерация доступна и причины нет', () => {
    render(<ShellToolbar mode={mode} briefReady />);

    expect(generateButton().disabled).toBe(false);
    expect(screen.queryByText(REASON)).toBeNull();
  });
});

describe('ShellToolbar, частные случаи гейта', () => {
  it('перегенерация с фидбеком QA заперта тем же брифом', () => {
    render(<ShellToolbar mode="blocked" briefReady={false} briefReason={REASON} />);

    expect(button('Перегенерировать с фидбеком QA').disabled).toBe(true);
  });

  it('черновик не продолжить на сломанном брифе, даже когда он есть', () => {
    render(<ShellToolbar mode="idle" canContinueDraft briefReady={false} briefReason={REASON} />);

    expect(button('Продолжить черновик').disabled).toBe(true);
  });

  it('проверка истории остаётся доступной: она читает готовое, а не генерирует', () => {
    render(<ShellToolbar mode="idle" briefReady={false} briefReason={REASON} />);

    expect(button('Проверить историю').disabled).toBe(false);
  });

  it('без причины показывается общая подсказка, а не пустая строка', () => {
    render(<ShellToolbar mode="idle" briefReady={false} />);

    expect(screen.getByText('нужен бриф или каст из префабов')).toBeTruthy();
  });
});
