/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import RelationMeter, { type RelationMeterTrend } from './RelationMeter';

afterEach(cleanup);

const TRENDS: RelationMeterTrend[] = ['рост', 'спад', 'нет'];

describe.each(TRENDS)('RelationMeter, тренд %s', trend => {
  it('показывает имя и значение со стрелкой тренда', () => {
    render(<RelationMeter name="Кира" value={62} trend={trend} />);
    expect(screen.getByText('Кира')).toBeTruthy();

    const arrow = trend === 'рост' ? ' ▲' : trend === 'спад' ? ' ▼' : '';
    expect(screen.getByText(`62${arrow}`)).toBeTruthy();
  });
});

describe('RelationMeter', () => {
  it('зажимает значение в диапазон 0–100', () => {
    render(<RelationMeter name="Кира" value={140} trend="нет" />);
    expect(screen.getByText('100')).toBeTruthy();

    cleanup();

    render(<RelationMeter name="Кира" value={-20} trend="нет" />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('передаёт долю прогресса в трек', () => {
    render(<RelationMeter name="Кира" value={62} trend="рост" />);
    const track = screen.getByRole('progressbar');
    expect(track.getAttribute('aria-valuenow')).toBe('62');
  });

  it('на светлом хроме использует светлый тон значения по умолчанию', () => {
    render(<RelationMeter name="Кира" value={62} trend="рост" />);
    const value = screen.getByText('62 ▲');
    expect(value.className).not.toMatch(/onDark/);
  });

  it('на тёмном хроме помечает значение классом onDark', () => {
    render(<RelationMeter name="Кира" value={62} trend="рост" onDark />);
    const value = screen.getByText('62 ▲');
    expect(value.className).toMatch(/onDark/);
  });
});
