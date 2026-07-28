/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BranchRow from './BranchRow';

afterEach(cleanup);

describe('BranchRow', () => {
  it('показывает глиф и собранную подпись «ветка «имя» · N%»', () => {
    render(<BranchRow branch="Примирение" percent={68} />);
    expect(screen.getByText('⇉')).toBeTruthy();
    expect(screen.getByText('ветка «Примирение» · 68%')).toBeTruthy();
  });

  it('без onOpen рисует неинтерактивную строку', () => {
    render(<BranchRow branch="Разрыв" percent={12} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onOpen рисует кнопку и вызывает колбэк с именем ветки по клику', () => {
    let opened: string | null = null;
    render(
      <BranchRow
        branch="Побег"
        percent={40}
        onOpen={branch => {
          opened = branch;
        }}
      />,
    );
    const button = screen.getByRole('button', { name: 'ветка «Побег» · 40%' });
    fireEvent.click(button);
    expect(opened).toBe('Побег');
  });

  it('percent 0 и 100 отображаются корректно', () => {
    const { rerender } = render(<BranchRow branch="Тупик" percent={0} />);
    expect(screen.getByText('ветка «Тупик» · 0%')).toBeTruthy();

    rerender(<BranchRow branch="Финал" percent={100} />);
    expect(screen.getByText('ветка «Финал» · 100%')).toBeTruthy();
  });
});
