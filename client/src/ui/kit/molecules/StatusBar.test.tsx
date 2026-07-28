/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import StatusBar, { type StatusBarItem, type StatusBarTone } from './StatusBar';

afterEach(cleanup);

const TONES: StatusBarTone[] = ['default', 'accent', 'info', 'error', 'warn'];

describe.each(TONES)('StatusBar, тон %s', tone => {
  it('показывает текст сегмента', () => {
    const items: StatusBarItem[] = [{ text: 'слотов 21 · событий 34', tone }];
    render(<StatusBar items={items} />);
    expect(screen.getByText('слотов 21 · событий 34')).toBeTruthy();
  });
});

describe('StatusBar, состояния из реестра (idle/running/paused/blocked/empty)', () => {
  it('idle: несколько сегментов и правая сводка', () => {
    render(
      <StatusBar
        items={[
          { text: 'черновик сохранён 12:41' },
          { text: 'слотов 21 · событий 34' },
          { text: 'QA: не запускался после правок' },
        ]}
        right="seed 12345"
      />,
    );
    expect(screen.getByText('черновик сохранён 12:41')).toBeTruthy();
    expect(screen.getByText('слотов 21 · событий 34')).toBeTruthy();
    expect(screen.getByText('QA: не запускался после правок')).toBeTruthy();
    expect(screen.getByText('seed 12345')).toBeTruthy();
  });

  it('running: ведущий глиф и жирный заголовок допустимы', () => {
    render(
      <StatusBar
        items={[{ text: 'прогон идёт · 2 мин 14 с', glyph: '⟳', tone: 'info' }]}
        right="seed 12345 · web-lock: эта вкладка ведёт прогон"
      />,
    );
    expect(screen.getByText('прогон идёт · 2 мин 14 с')).toBeTruthy();
    expect(screen.getByText('⟳')).toBeTruthy();
  });

  it('paused: заголовок с emphasis рендерится жирным', () => {
    render(<StatusBar items={[{ text: 'чекпоинт · пауза после порции', glyph: '⏸', emphasis: true }]} />);
    const node = screen.getByText('чекпоинт · пауза после порции');
    expect(node.className).toContain('bold');
  });

  it('blocked: сегмент с тоном error использует сигнал ошибки', () => {
    render(<StatusBar items={[{ text: 'экспорт заблокирован', glyph: '⛔', tone: 'error', emphasis: true }]} />);
    const node = screen.getByText('экспорт заблокирован');
    expect(node.className).toContain('error');
  });

  it('empty: работает без правой сводки', () => {
    render(<StatusBar items={[{ text: 'черновик пуст' }, { text: 'потрачено $0.00' }]} />);
    expect(screen.getByText('черновик пуст')).toBeTruthy();
    expect(screen.queryByText(/seed/)).toBeNull();
  });
});

describe('StatusBar, частные случаи', () => {
  it('без сегментов рендерит пустую строку без ошибок', () => {
    render(<StatusBar items={[]} />);
    expect(screen.queryByText(/./)).toBeNull();
  });

  it('разделитель стоит между сегментами, но не перед первым', () => {
    const { container } = render(<StatusBar items={[{ text: 'первый' }, { text: 'второй' }, { text: 'третий' }]} />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('строка не интерактивна: ни одной кнопки', () => {
    render(<StatusBar items={[{ text: 'готово' }]} right="seed 1" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
