/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TakeRow, { type TakeRowStatus } from './TakeRow';

afterEach(cleanup);

const STATUSES: TakeRowStatus[] = ['принят', 'черновик', 'отклонён', 'генерируется'];

describe.each(STATUSES)('TakeRow, статус %s', status => {
  it('показывает номер, подпись и текст статуса', () => {
    render(<TakeRow num={3} label="✎ ручная правка" status={status} />);
    expect(screen.getByText('№3')).toBeTruthy();
    expect(screen.getByText('✎ ручная правка')).toBeTruthy();
    expect(screen.getByText(new RegExp(status))).toBeTruthy();
  });
});

describe('TakeRow, текст статуса по умолчанию для каждого статуса', () => {
  it('«принят» получает галочку', () => {
    render(<TakeRow num={1} label="дубль" status="принят" />);
    expect(screen.getByText('принят ✓')).toBeTruthy();
  });

  it('«черновик» без глифа', () => {
    render(<TakeRow num={1} label="дубль" status="черновик" />);
    expect(screen.getByText('черновик')).toBeTruthy();
  });

  it('«отклонён» получает крест', () => {
    render(<TakeRow num={1} label="дубль" status="отклонён" />);
    expect(screen.getByText('отклонён ✕')).toBeTruthy();
  });

  it('«генерируется» получает крутилку спереди и многоточие', () => {
    render(<TakeRow num={1} label="дубль" status="генерируется" />);
    expect(screen.getByText('⟳ генерируется…')).toBeTruthy();
  });
});

describe('TakeRow, переопределение action', () => {
  it('action заменяет текст статуса', () => {
    render(<TakeRow num={2} label="дубль" status="принят" action="дубль от Иры" />);
    expect(screen.getByText('дубль от Иры')).toBeTruthy();
    expect(screen.queryByText('принят ✓')).toBeNull();
  });
});

describe('TakeRow, кликабельность', () => {
  it('без onClick строка не кликабельна', () => {
    render(<TakeRow num={4} label="дубль" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick строка рендерится кнопкой и вызывает колбэк по клику', () => {
    let calls = 0;
    render(<TakeRow num={4} label="✎ ручная правка" onClick={() => (calls += 1)} />);
    const row = screen.getByRole('button', { name: /✎ ручная правка/ });
    fireEvent.click(row);
    expect(calls).toBe(1);
  });
});

describe('TakeRow, состояние выбора', () => {
  it('selected по умолчанию выключен и не ломает рендер', () => {
    render(<TakeRow num={5} label="дубль" />);
    expect(screen.getByText('№5')).toBeTruthy();
  });

  it('selected рендерится наравне с обычной строкой', () => {
    render(<TakeRow num={5} label="дубль" selected onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /дубль/ })).toBeTruthy();
  });
});
