/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BriefGenPanel, { type BriefGenPhase } from './BriefGenPanel';

afterEach(cleanup);

const NOTES = 'маяк на краю городка; героиня возвращается после училища';
const DIRECTIVES = [
  { target: 'тон', text: 'тёплый, без иронии' },
  { target: 'сеттинг', text: 'маяк, приморский городок' },
];

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('BriefGenPanel, фаза заметки (idle)', () => {
  it('показывает заметки и кнопку заполнения со сметой', () => {
    render(<BriefGenPanel phase="idle" notes={NOTES} directives={DIRECTIVES} price="≈$0.04" />);

    expect(screen.getByText(NOTES)).toBeTruthy();
    expect(screen.getByText('смета на кнопке — до клика')).toBeTruthy();
    expect(button('Заполнить пробелы ≈$0.04').disabled).toBe(false);
    // Директивы разложены только после начала генерации — на idle их не видно.
    expect(screen.queryByText('тон «тёплый, без иронии»')).toBeNull();
  });

  it('клик по кнопке вызывает onGenerate', () => {
    const onGenerate = vi.fn();
    render(<BriefGenPanel phase="idle" notes={NOTES} onGenerate={onGenerate} />);

    button('Заполнить пробелы').click();
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

describe('BriefGenPanel, фаза разбор (parsing)', () => {
  it('кнопка занята, показывает статус разбора', () => {
    render(<BriefGenPanel phase="parsing" notes={NOTES} />);

    expect(screen.getByText('фаза 1/2 · разбор заметок')).toBeTruthy();
    expect(button('Разбор заметок…').disabled).toBe(true);
  });
});

describe('BriefGenPanel, фаза заполнение (filling)', () => {
  it('директивы показаны фишками, статус несёт счётчик полей', () => {
    render(<BriefGenPanel phase="filling" notes={NOTES} directives={DIRECTIVES} gaps={9} filled={6} />);

    expect(screen.getByText('фаза 2/2 · заполнение · 6 из 9 полей')).toBeTruthy();
    expect(screen.getByText('тон «тёплый, без иронии»')).toBeTruthy();
    expect(screen.getByText('сеттинг «маяк, приморский городок»')).toBeTruthy();
    expect(button('Заполняем 6/9…').disabled).toBe(true);
  });

  it('отброшенные директивы печатаются рядом с фишками', () => {
    render(<BriefGenPanel phase="filling" notes={NOTES} directives={DIRECTIVES} droppedCount="2" />);

    expect(screen.getByText('+2 на заполненные — отброшены')).toBeTruthy();
  });
});

describe('BriefGenPanel, фаза ретрай (retry)', () => {
  it('показывает номер попытки в статусе и в кнопке', () => {
    render(<BriefGenPanel phase="retry" notes={NOTES} attempt="2/3" />);

    expect(screen.getByText('попытка 2/3 · ошибки проверки уехали в фидбек')).toBeTruthy();
    expect(button('Попытка 2/3…').disabled).toBe(true);
  });
});

describe('BriefGenPanel, фаза готово (done)', () => {
  it('кнопка генерации сменяется на «Откатить»', () => {
    render(<BriefGenPanel phase="done" notes={NOTES} gaps={9} onRollback={vi.fn()} />);

    expect(screen.getByText('✓ заполнено 9 полей — проверьте и поправьте')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Заполнить|Заполняем|Разбор|Попытка/ })).toBeNull();
    expect(button('Откатить')).toBeTruthy();
  });

  it('клик по «Откатить» вызывает onRollback', () => {
    const onRollback = vi.fn();
    render(<BriefGenPanel phase="done" notes={NOTES} onRollback={onRollback} />);

    button('Откатить').click();
    expect(onRollback).toHaveBeenCalledTimes(1);
  });
});

describe('BriefGenPanel, подробность', () => {
  it('печатает уровень 1–5', () => {
    render(<BriefGenPanel phase="idle" notes={NOTES} verbosity={4} />);

    expect(screen.getByText('4/5')).toBeTruthy();
  });

  it('зажимает значение вне диапазона', () => {
    render(<BriefGenPanel phase="idle" notes={NOTES} verbosity={9} />);

    expect(screen.getByText('5/5')).toBeTruthy();
  });
});

const PHASES: BriefGenPhase[] = ['idle', 'parsing', 'filling', 'done', 'retry'];

describe.each(PHASES)('BriefGenPanel, фаза %s', phase => {
  it('рендерится без ошибок', () => {
    render(<BriefGenPanel phase={phase} notes={NOTES} directives={DIRECTIVES} />);
    expect(screen.getByText(NOTES)).toBeTruthy();
  });
});
