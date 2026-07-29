/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ReleasePassport from './ReleasePassport';

afterEach(cleanup);

const LINES = ['n: 2 · 14 июля, 18:02', 'bundle: StoryBundleV2 · 412 КБ', 'qaReport: #5 · 0 блокеров', 'seed: 12345'];

describe('ReleasePassport', () => {
  it('печатает каждую строку паспорта отдельно', () => {
    render(<ReleasePassport lines={LINES} />);
    LINES.forEach(line => {
      expect(screen.getByText(line)).toBeTruthy();
    });
  });

  it('рисует по одной строке-обёртке на каждую строку данных', () => {
    const { container } = render(<ReleasePassport lines={LINES} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.children.length).toBe(LINES.length);
  });

  it('пустой список строк не падает и не рисует строк', () => {
    const { container } = render(<ReleasePassport lines={[]} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.children.length).toBe(0);
  });

  it('карточка не интерактивна: кнопок нет', () => {
    render(<ReleasePassport lines={LINES} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
