/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BeatCard, { type BeatCardState } from './BeatCard';

import styles from './BeatCard.module.css';

afterEach(cleanup);

const STATES: BeatCardState[] = ['done', 'failed', 'running', 'locked'];

const DEFAULT_STATUS: Record<BeatCardState, string> = {
  done: 'проза ✓',
  failed: '▨ нет прозы',
  running: '⟳ генерируется…',
  locked: 'заперт календарным полом',
};

describe.each(STATES)('BeatCard, состояние %s', state => {
  it('показывает кикер, заголовок и дефолтный статус', () => {
    render(<BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state={state} />);

    expect(screen.getByText('Бит 04 · Д4д–Д4в')).toBeTruthy();
    expect(screen.getByText('Фестиваль ◈')).toBeTruthy();
    expect(screen.getByText(DEFAULT_STATUS[state])).toBeTruthy();
  });

  it('кастомный statusText вытесняет дефолтный', () => {
    render(<BeatCard kicker="Бит 04" title="Фестиваль ◈" state={state} statusText="в очереди" />);

    expect(screen.getByText('в очереди')).toBeTruthy();
    expect(screen.queryByText(DEFAULT_STATUS[state])).toBeNull();
  });
});

describe('BeatCard, интерактивность', () => {
  it('с onSelect рендерится кнопкой и вызывает колбэк по клику', () => {
    const onSelect = vi.fn();
    render(<BeatCard kicker="Бит 04" title="Фестиваль ◈" onSelect={onSelect} />);

    const button = screen.getByRole('button', { name: /Фестиваль ◈/ }) as HTMLButtonElement;
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('без onSelect кнопки нет', () => {
    render(<BeatCard kicker="Бит 04" title="Фестиваль ◈" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('BeatCard, состояния selected/dimmed', () => {
  it('selected не ломает рендер контента', () => {
    render(<BeatCard kicker="Бит 04" title="Фестиваль ◈" selected />);

    expect(screen.getByText('Фестиваль ◈')).toBeTruthy();
  });

  it('dimmed добавляет класс притушенности к корню', () => {
    const { container } = render(<BeatCard kicker="Бит 04" title="Фестиваль ◈" dimmed />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain(styles.dimmed);
  });

  it('без dimmed класса притушенности нет', () => {
    const { container } = render(<BeatCard kicker="Бит 04" title="Фестиваль ◈" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).not.toContain(styles.dimmed);
  });

  it('ширина применяется инлайн-стилем', () => {
    const onSelect = () => {};
    render(<BeatCard kicker="Бит 04" title="Фестиваль ◈" onSelect={onSelect} width={200} />);

    const button = screen.getByRole('button', { name: /Фестиваль ◈/ }) as HTMLButtonElement;
    expect(button.style.width).toBe('200px');
  });
});
