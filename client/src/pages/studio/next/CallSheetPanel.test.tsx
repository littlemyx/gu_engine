/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CallSheetPanel from './CallSheetPanel';

import type { CallSheet, CallSheetPosition } from '@/processes/callSheet';

afterEach(cleanup);

const EMPTY: CallSheet = { positions: [], generate: [], decisions: [], total: 0 };

const cached: CallSheetPosition = {
  key: 'brief/',
  stage: 'brief',
  action: 'cached',
  freshness: 'fresh',
  estCost: 0,
};

const toGenerate: CallSheetPosition = {
  key: 'cast/heroine',
  stage: 'cast',
  action: 'generate',
  freshness: 'missing',
  estCost: 0.2,
};

const lockedSkip: CallSheetPosition = {
  key: 'world/',
  stage: 'world',
  action: 'locked-skip',
  freshness: 'fresh',
  estCost: 0,
};

const decision: CallSheetPosition = {
  key: 'beat_prose/b5',
  stage: 'beat_prose',
  action: 'needs-decision',
  freshness: 'stale',
  estCost: 0,
};

const POPULATED: CallSheet = {
  positions: [cached, toGenerate, lockedSkip, decision],
  generate: [toGenerate],
  decisions: [decision],
  total: 0.2,
};

// PrimaryButton печатает подпись и смету двумя <span> внутри одной кнопки —
// доступное имя матчить неудобно, ищем по вхождению текста, как в SignActions.test.tsx.
const confirmButton = () =>
  (screen.getAllByRole('button') as HTMLButtonElement[]).find(b => b.textContent?.includes('Подписать и запустить'))!;

describe('CallSheetPanel, пустая ведомость', () => {
  it('сообщает, что прогону нечего делать, и не показывает секцию решений', () => {
    render(<CallSheetPanel callSheet={EMPTY} onSign={() => {}} onCancel={() => {}} />);

    expect(screen.getByText('Ведомость пуста — прогону нечего делать.')).toBeTruthy();
    expect(screen.queryByText(/Требуют решения/)).toBeNull();
    expect(screen.getByText('$0')).toBeTruthy();
  });

  it('без конфликтов подпись не заблокирована', () => {
    const onSign = vi.fn();
    render(<CallSheetPanel callSheet={EMPTY} onSign={onSign} onCancel={() => {}} />);

    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onSign).toHaveBeenCalledTimes(1);
  });
});

describe('CallSheetPanel, заполненная ведомость', () => {
  it('печатает все позиции кроме требующих решения и их количество', () => {
    render(<CallSheetPanel callSheet={POPULATED} onSign={() => {}} onCancel={() => {}} />);

    expect(screen.getByText('Позиции · 3')).toBeTruthy();
    expect(screen.getByText(/brief\//)).toBeTruthy();
    expect(screen.getByText(/cast\/heroine/)).toBeTruthy();
    expect(screen.getByText(/world\//)).toBeTruthy();
    // Позиция, требующая решения, не входит в основной список.
    expect(screen.queryByText(/^Замысел · beat_prose\/b5$/)).toBeNull();
  });

  it('печатает итог по сумме generate-позиций', () => {
    render(<CallSheetPanel callSheet={POPULATED} onSign={() => {}} onCancel={() => {}} />);
    // Смета цены генерации встречается и в строке позиции, и в итоге, и в
    // кнопке подписи — проверяем, что все три её несут.
    expect(screen.getAllByText('≈$0.20').length).toBeGreaterThanOrEqual(3);
  });

  it('секция «требуют решения» показывает конфликтующую позицию', () => {
    render(<CallSheetPanel callSheet={POPULATED} onSign={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Требуют решения · 1')).toBeTruthy();
    expect(screen.getByText(/beat_prose\/b5/)).toBeTruthy();
  });

  it('нерешённый конфликт блокирует подпись', () => {
    render(<CallSheetPanel callSheet={POPULATED} onSign={() => {}} onCancel={() => {}} />);
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText('Решите каждый конфликт, чтобы подписать смету.')).toBeTruthy();
  });
});

describe('CallSheetPanel, решение конфликта', () => {
  it('выбор варианта в DecisionRow разблокирует подпись, и подпись зовёт onSign', () => {
    const onSign = vi.fn();
    render(<CallSheetPanel callSheet={POPULATED} onSign={onSign} onCancel={() => {}} />);

    expect(confirmButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'оставить моё' }));

    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it('«Отмена» зовёт onCancel независимо от конфликтов', () => {
    const onCancel = vi.fn();
    render(<CallSheetPanel callSheet={POPULATED} onSign={() => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
