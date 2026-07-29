/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RunControls from './RunControls';

afterEach(cleanup);

const toggleButton = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('RunControls, состав по умолчанию', () => {
  it('печатает подписи по умолчанию', () => {
    render(<RunControls />);

    expect(screen.getByText('⏸ Пауза на границе вызова')).toBeTruthy();
    expect(screen.getByText('■ Стоп')).toBeTruthy();
  });

  it('принимает свои подписи пропсами', () => {
    render(<RunControls pauseLabel="Пауза" resumeLabel="Дальше" stopLabel="Прервать" />);

    expect(screen.getByText('Пауза')).toBeTruthy();
    expect(screen.getByText('Прервать')).toBeTruthy();
  });
});

describe('RunControls, переключатель паузы', () => {
  it('по умолчанию показывает подпись «идёт прогон»', () => {
    render(<RunControls />);

    expect(screen.queryByText('▶ Продолжить')).toBeNull();
  });

  it('клик переключает подпись на «продолжить» и зовёт onPause(true)', () => {
    const onPause = vi.fn();
    render(<RunControls onPause={onPause} />);

    fireEvent.click(toggleButton('⏸ Пауза на границе вызова'));

    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledWith(true);
    expect(screen.getByText('▶ Продолжить')).toBeTruthy();
  });

  it('повторный клик возвращает подпись «идёт прогон» и зовёт onPause(false)', () => {
    const onPause = vi.fn();
    render(<RunControls onPause={onPause} />);

    fireEvent.click(toggleButton('⏸ Пауза на границе вызова'));
    fireEvent.click(toggleButton('▶ Продолжить'));

    expect(onPause).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('⏸ Пауза на границе вызова')).toBeTruthy();
  });

  it('работает без onPause — переключение локальное', () => {
    render(<RunControls />);

    fireEvent.click(toggleButton('⏸ Пауза на границе вызова'));

    expect(screen.getByText('▶ Продолжить')).toBeTruthy();
  });

  it('стартует на паузе, если передан paused', () => {
    render(<RunControls paused />);

    expect(screen.getByText('▶ Продолжить')).toBeTruthy();
    expect(screen.queryByText('⏸ Пауза на границе вызова')).toBeNull();
  });
});

describe('RunControls, кнопка стопа', () => {
  it('без onStop кнопки нет — только текст', () => {
    render(<RunControls />);

    expect(screen.queryByRole('button', { name: '■ Стоп' })).toBeNull();
    expect(screen.getByText('■ Стоп')).toBeTruthy();
  });

  it('с onStop клик доходит до колбэка', () => {
    const onStop = vi.fn();
    render(<RunControls onStop={onStop} />);

    fireEvent.click(toggleButton('■ Стоп'));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('клик по стопу не трогает состояние паузы', () => {
    const onStop = vi.fn();
    render(<RunControls onStop={onStop} />);

    fireEvent.click(toggleButton('■ Стоп'));

    expect(screen.getByText('⏸ Пауза на границе вызова')).toBeTruthy();
  });
});
