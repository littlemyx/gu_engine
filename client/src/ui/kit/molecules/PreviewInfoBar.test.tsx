/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PreviewInfoBar, { type PreviewInfoBarItem } from './PreviewInfoBar';

afterEach(cleanup);

const ITEMS: PreviewInfoBarItem[] = [{ text: 'превью: движок = релизный' }, { text: 'persist: off' }];

describe('PreviewInfoBar', () => {
  it('показывает все сегменты слева', () => {
    render(<PreviewInfoBar items={ITEMS} />);
    expect(screen.getByText('превью: движок = релизный')).toBeTruthy();
    expect(screen.getByText('persist: off')).toBeTruthy();
  });

  it('показывает правую моноширинную сводку, когда она задана', () => {
    render(<PreviewInfoBar items={ITEMS} right="seed 12345 · снапшотов 14" />);
    expect(screen.getByText('seed 12345 · снапшотов 14')).toBeTruthy();
  });

  it('работает без правой сводки', () => {
    render(<PreviewInfoBar items={ITEMS} />);
    expect(screen.queryByText(/seed/)).toBeNull();
  });

  it('без сегментов рендерит пустую строку без ошибок', () => {
    render(<PreviewInfoBar items={[]} right="seed 1" />);
    expect(screen.getByText('seed 1')).toBeTruthy();
  });

  it('строка не интерактивна: ни одной кнопки', () => {
    render(<PreviewInfoBar items={ITEMS} right="seed 12345" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
