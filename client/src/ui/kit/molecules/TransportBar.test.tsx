/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TransportBar from './TransportBar';

afterEach(cleanup);

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('TransportBar, состав по умолчанию', () => {
  it('печатает подписи и таймкод по умолчанию', () => {
    render(<TransportBar />);

    expect(screen.getByText('Пауза')).toBeTruthy();
    expect(screen.getByText('■ Стоп')).toBeTruthy();
    expect(screen.getByText('⟲ С начала слота')).toBeTruthy();
    expect(screen.getByText('луп слота')).toBeTruthy();
    expect(screen.getByText('0:34 / 1:48')).toBeTruthy();
  });

  it('принимает свои подписи и таймкод пропсами', () => {
    render(
      <TransportBar
        pauseLabel="Держим"
        resumeLabel="Дальше"
        stopLabel="Прервать"
        restartLabel="Заново"
        loopLabel="повтор"
        time="1:02"
        total="2:15"
      />,
    );

    expect(screen.getByText('Держим')).toBeTruthy();
    expect(screen.getByText('Прервать')).toBeTruthy();
    expect(screen.getByText('Заново')).toBeTruthy();
    expect(screen.getByText('повтор')).toBeTruthy();
    expect(screen.getByText('1:02 / 2:15')).toBeTruthy();
  });
});

describe('TransportBar, переключатель воспроизведения', () => {
  it('по умолчанию показывает подпись «идёт воспроизведение»', () => {
    render(<TransportBar />);

    expect(screen.queryByText('Продолжить')).toBeNull();
  });

  it('клик переключает подпись на «продолжить» и зовёт onPause(false)', () => {
    const onPause = vi.fn();
    render(<TransportBar onPause={onPause} />);

    fireEvent.click(button('Пауза'));

    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledWith(false);
    expect(screen.getByText('Продолжить')).toBeTruthy();
  });

  it('работает без onPause — переключение локальное', () => {
    render(<TransportBar />);

    fireEvent.click(button('Пауза'));

    expect(screen.getByText('Продолжить')).toBeTruthy();
  });

  it('стартует на паузе, если передан playing={false}', () => {
    render(<TransportBar playing={false} />);

    expect(screen.getByText('Продолжить')).toBeTruthy();
    expect(screen.queryByText('Пауза')).toBeNull();
  });
});

describe('TransportBar, луп', () => {
  it('по умолчанию луп включён', () => {
    render(<TransportBar />);

    expect(button('луп слота').getAttribute('aria-pressed')).toBe('true');
  });

  it('клик переключает луп и зовёт onLoop(false)', () => {
    const onLoop = vi.fn();
    render(<TransportBar onLoop={onLoop} />);

    fireEvent.click(button('луп слота'));

    expect(onLoop).toHaveBeenCalledTimes(1);
    expect(onLoop).toHaveBeenCalledWith(false);
    expect(button('луп слота').getAttribute('aria-pressed')).toBe('false');
  });

  it('стартует выключенным, если передан loop={false}', () => {
    render(<TransportBar loop={false} />);

    expect(button('луп слота').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('TransportBar, стоп и перемотка', () => {
  it('без колбэков кнопок нет — только текст', () => {
    render(<TransportBar />);

    expect(screen.queryByRole('button', { name: '■ Стоп' })).toBeNull();
    expect(screen.queryByRole('button', { name: '⟲ С начала слота' })).toBeNull();
  });

  it('с onStop клик доходит до колбэка', () => {
    const onStop = vi.fn();
    render(<TransportBar onStop={onStop} />);

    fireEvent.click(button('■ Стоп'));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('с onRestart клик доходит до колбэка', () => {
    const onRestart = vi.fn();
    render(<TransportBar onRestart={onRestart} />);

    fireEvent.click(button('⟲ С начала слота'));

    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
