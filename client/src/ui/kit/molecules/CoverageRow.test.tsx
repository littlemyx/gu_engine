/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CoverageRow, { type CoverageCell } from './CoverageRow';

afterEach(cleanup);

const MIXED_CELLS: CoverageCell[] = [{ tone: 'scene' }, { tone: 'filler' }, { tone: 'empty', tip: 'слот без событий' }];

// root.children[0] — обёртка подписи, root.children[1..] — ячейки по порядку cells.
const rowChildren = (container: HTMLElement) =>
  Array.from(container.firstElementChild?.children ?? []) as HTMLElement[];

describe('CoverageRow', () => {
  it('показывает подпись', () => {
    render(<CoverageRow label="Покрытие" cells={MIXED_CELLS} />);
    expect(screen.getByText('Покрытие')).toBeTruthy();
  });

  it('рисует по одной ячейке на каждую запись cells', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={MIXED_CELLS} />);
    const [, ...cells] = rowChildren(container);
    expect(cells).toHaveLength(3);
  });

  it('тон scene отдаёт StatusGlyph fresh (●) через доступное имя', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={[{ tone: 'scene' }]} />);
    const [, cell] = rowChildren(container);
    const glyph = screen.getByRole('img', { name: 'fresh' });
    expect(cell.contains(glyph)).toBe(true);
    expect(glyph.textContent).toBe('●');
  });

  it('тон filler отдаёт StatusGlyph none (○) через доступное имя', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={[{ tone: 'filler' }]} />);
    const [, cell] = rowChildren(container);
    const glyph = screen.getByRole('img', { name: 'none' });
    expect(cell.contains(glyph)).toBe(true);
    expect(glyph.textContent).toBe('○');
  });

  it('тон empty рисуется локально: глиф ⚠ без роли img (не StatusGlyph)', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={[{ tone: 'empty' }]} />);
    const [, cell] = rowChildren(container);
    expect(cell.textContent).toBe('⚠');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('тултип ячейки уходит в атрибут title её обёртки', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={[{ tone: 'empty', tip: 'слот без событий' }]} />);
    const [, cell] = rowChildren(container);
    expect(cell.getAttribute('title')).toBe('слот без событий');
  });

  it('без tip атрибут title не проставляется', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={[{ tone: 'scene' }]} />);
    const [, cell] = rowChildren(container);
    expect(cell.hasAttribute('title')).toBe(false);
  });

  it('по умолчанию labelWidth 88px и cellWidth 33px', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={[{ tone: 'scene' }]} />);
    const [labelWrap, cell] = rowChildren(container);
    expect(labelWrap.style.width).toBe('88px');
    expect(cell.style.width).toBe('33px');
  });

  it('labelWidth и cellWidth настраиваются пропами', () => {
    const { container } = render(
      <CoverageRow label="Покрытие" cells={[{ tone: 'scene' }]} labelWidth={120} cellWidth={40} />,
    );
    const [labelWrap, cell] = rowChildren(container);
    expect(labelWrap.style.width).toBe('120px');
    expect(cell.style.width).toBe('40px');
  });

  it('пустой список cells не рисует ни одной ячейки-глифа', () => {
    const { container } = render(<CoverageRow label="Покрытие" cells={[]} />);
    const [, ...cells] = rowChildren(container);
    expect(cells).toHaveLength(0);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Покрытие')).toBeTruthy();
  });
});
