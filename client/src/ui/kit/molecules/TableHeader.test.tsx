/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TableHeader, { type TableHeaderColumn } from './TableHeader';

afterEach(cleanup);

const COLUMNS: TableHeaderColumn[] = [
  { label: 'АРТЕФАКТ' },
  { label: 'ВЛАДЕНИЕ', width: 80 },
  { label: 'СВЕЖЕСТЬ', width: 70 },
  { label: 'ТЕЙК', width: 44 },
  { label: 'ЦЕНА', width: 44, align: 'right' },
];

describe('TableHeader', () => {
  it('показывает подпись каждой колонки', () => {
    render(<TableHeader columns={COLUMNS} />);

    COLUMNS.forEach(column => {
      expect(screen.getByText(column.label)).toBeTruthy();
    });
  });

  it('тянущаяся колонка без width получает flex: 1 1 0%', () => {
    render(<TableHeader columns={COLUMNS} />);

    const cell = screen.getByText('АРТЕФАКТ').parentElement as HTMLElement;
    expect(cell.style.flex).toBe('1 1 0%');
    expect(cell.style.width).toBe('');
  });

  it('колонка с width получает фиксированную ширину и flex: 0 0 auto', () => {
    render(<TableHeader columns={COLUMNS} />);

    const cell = screen.getByText('ВЛАДЕНИЕ').parentElement as HTMLElement;
    expect(cell.style.flex).toBe('0 0 auto');
    expect(cell.style.width).toBe('80px');
  });

  it('по умолчанию колонка выровнена влево', () => {
    render(<TableHeader columns={COLUMNS} />);

    const cell = screen.getByText('ТЕЙК').parentElement as HTMLElement;
    expect(cell.style.textAlign).toBe('left');
  });

  it('align="right" выравнивает подпись вправо', () => {
    render(<TableHeader columns={COLUMNS} />);

    const cell = screen.getByText('ЦЕНА').parentElement as HTMLElement;
    expect(cell.style.textAlign).toBe('right');
  });

  it('шапка не интерактивна: кнопок нет', () => {
    render(<TableHeader columns={COLUMNS} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('onDark прокидывается в подписи колонок', () => {
    render(<TableHeader columns={COLUMNS} onDark />);

    const label = screen.getByText('АРТЕФАКТ');
    expect(label.className).toMatch(/onDark/);
  });

  it('без onDark подписи не несут onDark-класс', () => {
    render(<TableHeader columns={COLUMNS} />);

    const label = screen.getByText('АРТЕФАКТ');
    expect(label.className).not.toMatch(/onDark/);
  });
});
