/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TranscriptBar, { type TranscriptChipItem } from './TranscriptBar';

afterEach(cleanup);

const ITEMS: TranscriptChipItem[] = [
  { label: 'Д1а Двор' },
  { label: 'Д2д Кафе', tone: 'current' },
  { label: 'промотка остановлена', tone: 'warning' },
];

describe('TranscriptBar', () => {
  it('показывает подпись кикера по умолчанию', () => {
    render(<TranscriptBar items={ITEMS} />);

    expect(screen.getByText('ТРАНСКРИПТ · клик = детерминированный откат')).toBeTruthy();
  });

  it('пустая строка label прячет кикер', () => {
    render(<TranscriptBar label="" items={ITEMS} />);

    expect(screen.queryByText('ТРАНСКРИПТ · клик = детерминированный откат')).toBeNull();
  });

  it('свой label заменяет кикер по умолчанию', () => {
    render(<TranscriptBar label="ТРАНСКРИПТ" items={ITEMS} />);

    expect(screen.getByText('ТРАНСКРИПТ')).toBeTruthy();
  });

  it('показывает метку каждого чипа', () => {
    render(<TranscriptBar items={ITEMS} />);

    expect(screen.getByText('Д1а Двор')).toBeTruthy();
    expect(screen.getByText(/Д2д Кафе/)).toBeTruthy();
    expect(screen.getByText(/промотка остановлена/)).toBeTruthy();
  });

  it('обычный чип без глифа-приставки', () => {
    render(<TranscriptBar items={ITEMS} onPick={() => {}} />);

    const normal = screen.getByRole('button', { name: 'Д1а Двор' });
    expect(normal.textContent).toBe('Д1а Двор');
  });

  it('текущий чип несёт приставку ►', () => {
    render(<TranscriptBar items={ITEMS} onPick={() => {}} />);

    const current = screen.getByRole('button', { name: /Д2д Кафе/ });
    expect(current.textContent).toBe('► Д2д Кафе');
  });

  it('предупреждающий чип несёт приставку ⚠', () => {
    render(<TranscriptBar items={ITEMS} onPick={() => {}} />);

    const warning = screen.getByRole('button', { name: /промотка остановлена/ });
    expect(warning.textContent).toBe('⚠ промотка остановлена');
  });

  it('клик по чипу зовёт onPick с его индексом', () => {
    const onPick = vi.fn();
    render(<TranscriptBar items={ITEMS} onPick={onPick} />);

    screen.getByRole('button', { name: /Д2д Кафе/ }).click();

    expect(onPick).toHaveBeenCalledWith(1);
  });

  it('без onPick чипы не кликабельны', () => {
    render(<TranscriptBar items={ITEMS} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('по умолчанию живёт на светлом хроме', () => {
    render(<TranscriptBar items={ITEMS} onPick={() => {}} />);

    const chip = screen.getByRole('button', { name: 'Д1а Двор' });
    expect(chip.className).not.toMatch(/onDark/);
  });

  it('onDark переключает хром чипов', () => {
    render(<TranscriptBar items={ITEMS} onPick={() => {}} onDark />);

    const chip = screen.getByRole('button', { name: 'Д1а Двор' });
    expect(chip.className).toMatch(/onDark/);
  });
});
