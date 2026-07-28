/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import HintNote from './HintNote';

afterEach(cleanup);

describe('HintNote', () => {
  it('показывает текст подсказки', () => {
    render(<HintNote text="Версии иммутабельны." />);
    expect(screen.getByText('Версии иммутабельны.')).toBeTruthy();
  });

  it('по умолчанию на светлом хроме', () => {
    render(<HintNote text="подсказка" />);
    const wrap = screen.getByText('подсказка').parentElement as HTMLElement;
    expect(wrap.className).not.toContain('onDark');
  });

  it('на тёмном хроме передаёт onDark вниз по атомам', () => {
    render(<HintNote text="подсказка" onDark />);
    const textSpan = screen.getByText('подсказка');
    // MutedText.onLight -> MutedText.onDark: класс меняется на тёмный вариант.
    expect(textSpan.className).not.toBe('');
    expect(textSpan.className.toLowerCase()).not.toContain('onlight');
  });

  it('ширина по умолчанию — 300px', () => {
    render(<HintNote text="подсказка" />);
    const wrap = screen.getByText('подсказка').parentElement as HTMLElement;
    expect(wrap.style.width).toBe('300px');
  });

  it('ширина переопределяется пропом', () => {
    render(<HintNote text="подсказка" width={220} />);
    const wrap = screen.getByText('подсказка').parentElement as HTMLElement;
    expect(wrap.style.width).toBe('220px');
  });

  it('не рендерит кнопку — заметка сама по себе некликабельна', () => {
    render(<HintNote text="подсказка" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('корневой узел не фокусируем', () => {
    const { container } = render(<HintNote text="подсказка" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('tabindex')).toBeNull();
  });
});
