/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import FlagsSeed, { type FlagsSeedFlag } from './FlagsSeed';

afterEach(cleanup);

const FLAGS: FlagsSeedFlag[] = [
  { id: 'storm_seen', active: true },
  { id: 'kira_secret', active: false },
];

describe('FlagsSeed', () => {
  it('показывает подпись по умолчанию и id всех флагов', () => {
    render(<FlagsSeed flags={FLAGS} seedLabel="seed 12345 · снапшот на каждой смене сцены" />);

    expect(screen.getByText('флаги:')).toBeTruthy();
    expect(screen.getByText('storm_seen')).toBeTruthy();
    expect(screen.getByText('kira_secret')).toBeTruthy();
  });

  it('принимает свою подпись флагов', () => {
    render(<FlagsSeed flagsLabel="метки:" flags={FLAGS} seedLabel="seed 1" />);

    expect(screen.getByText('метки:')).toBeTruthy();
  });

  it('показывает строку сида целиком', () => {
    render(<FlagsSeed flags={FLAGS} seedLabel="seed 12345 · снапшот на каждой смене сцены" />);

    expect(screen.getByText('seed 12345 · снапшот на каждой смене сцены')).toBeTruthy();
  });

  it('выставленный флаг получает глиф ✓', () => {
    render(<FlagsSeed flags={FLAGS} seedLabel="seed 1" />);

    const glyph = screen.getByRole('img', { name: 'ok' });
    expect(glyph.textContent).toBe('✓');
  });

  it('невыставленный флаг получает тире, а не глиф', () => {
    render(<FlagsSeed flags={FLAGS} seedLabel="seed 1" />);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryAllByRole('img')).toHaveLength(1);
  });

  it('разделяет несколько флагов точкой', () => {
    render(<FlagsSeed flags={FLAGS} seedLabel="seed 1" />);

    expect(screen.getByText('·')).toBeTruthy();
  });

  it('без флагов рисует только подпись и разделитель отсутствует', () => {
    render(<FlagsSeed flags={[]} seedLabel="seed 1" />);

    expect(screen.getByText('флаги:')).toBeTruthy();
    expect(screen.queryByText('·')).toBeNull();
  });

  it('на тёмном хроме получает отдельный класс', () => {
    const { container: light } = render(<FlagsSeed flags={FLAGS} seedLabel="seed 1" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<FlagsSeed flags={FLAGS} seedLabel="seed 1" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});
