/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ActRow, { type ActRowNoteTone } from './ActRow';

afterEach(cleanup);

const NOTE_TONES: ActRowNoteTone[] = ['error', 'warn', 'neutral'];

describe.each(NOTE_TONES)('ActRow, тон заметки %s', tone => {
  it('показывает подпись акта и заметку', () => {
    render(<ActRow title="Акт II · Сближение · д4–5" note="1 устарел" noteTone={tone} />);
    expect(screen.getByText('Акт II · Сближение · д4–5')).toBeTruthy();
    expect(screen.getByText('1 устарел')).toBeTruthy();
  });
});

describe('ActRow, состояние раскрытия', () => {
  it('развёрнуто по умолчанию — стрелка смотрит вниз', () => {
    render(<ActRow title="Акт I · Завязка" />);
    expect(screen.getByText('▾')).toBeTruthy();
  });

  it('expanded=false — стрелка смотрит вправо', () => {
    render(<ActRow title="Акт I · Завязка" expanded={false} />);
    expect(screen.getByText('▸')).toBeTruthy();
  });
});

describe('ActRow, частные случаи', () => {
  it('без note заметка не рисуется', () => {
    render(<ActRow title="Акт III · Развязка" />);
    expect(screen.queryByText('1 устарел')).toBeNull();
  });

  it('без onToggle рисует неинтерактивную строку', () => {
    render(<ActRow title="Акт I · Завязка" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onToggle рисует кнопку, вызывает колбэк с противоположным expanded и выставляет aria-expanded', () => {
    let calledWith: boolean | null = null;
    render(
      <ActRow
        title="Акт I · Завязка"
        expanded
        onToggle={next => {
          calledWith = next;
        }}
      />,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(calledWith).toBe(false);
  });
});
