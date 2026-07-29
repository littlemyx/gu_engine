/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ReachabilityChart, { type ReachabilityRow } from './ReachabilityChart';

afterEach(cleanup);

const ROWS: ReachabilityRow[] = [
  { label: 'примирение', percent: 68, count: '34' },
  { label: 'расставание', percent: 52, count: '26', tone: 'quiet' },
  { label: 'тайна маяка', percent: 8, count: '4', tone: 'warn' },
];

describe('ReachabilityChart', () => {
  it('показывает заголовок и строки', () => {
    render(<ReachabilityChart title="ДОСТИЖИМОСТЬ КОНЦОВОК · 50 ПРОГОНОВ" rows={ROWS} />);

    expect(screen.getByText('ДОСТИЖИМОСТЬ КОНЦОВОК · 50 ПРОГОНОВ')).toBeTruthy();
    expect(screen.getByText('примирение')).toBeTruthy();
    expect(screen.getByText('расставание')).toBeTruthy();
    expect(screen.getByText('тайна маяка')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
    expect(screen.getByText('26')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('передаёт долю в progressbar каждой строки', () => {
    render(<ReachabilityChart title="т" rows={ROWS} />);
    const tracks = screen.getAllByRole('progressbar');
    expect(tracks).toHaveLength(3);
    expect(tracks[0].getAttribute('aria-valuenow')).toBe('68');
    expect(tracks[1].getAttribute('aria-valuenow')).toBe('52');
    expect(tracks[2].getAttribute('aria-valuenow')).toBe('8');
  });

  it('зажимает долю в диапазон 0–100', () => {
    render(
      <ReachabilityChart
        title="т"
        rows={[
          { label: 'через край', percent: 140, count: '99' },
          { label: 'в минус', percent: -30, count: '0' },
        ]}
      />,
    );
    const tracks = screen.getAllByRole('progressbar');
    expect(tracks[0].getAttribute('aria-valuenow')).toBe('100');
    expect(tracks[1].getAttribute('aria-valuenow')).toBe('0');
  });

  it('тон default красит полосу и число акцентным/блюпринт-токеном, подпись — обычная', () => {
    render(<ReachabilityChart title="т" rows={[ROWS[0]]} />);
    const track = screen.getByRole('progressbar');
    const fill = track.firstElementChild as HTMLElement;
    expect(fill.className).toMatch(/fillDefault/);

    const count = screen.getByText('34');
    expect(count.className).toMatch(/countDefault/);
  });

  it('тон quiet красит полосу и число приглушённо, подпись остаётся обычной', () => {
    render(<ReachabilityChart title="т" rows={[ROWS[1]]} />);
    const track = screen.getByRole('progressbar');
    const fill = track.firstElementChild as HTMLElement;
    expect(fill.className).toMatch(/fillQuiet/);

    const count = screen.getByText('26');
    expect(count.className).toMatch(/countQuiet/);
  });

  it('тон warn красит полосу и число тревожно и приглушает подпись', () => {
    render(<ReachabilityChart title="т" rows={[ROWS[2]]} />);
    const track = screen.getByRole('progressbar');
    const fill = track.firstElementChild as HTMLElement;
    expect(fill.className).toMatch(/fillWarn/);

    const count = screen.getByText('4');
    expect(count.className).toMatch(/countWarn/);

    const label = screen.getByText('тайна маяка');
    expect(label.className).toMatch(/muted/);
  });
});
