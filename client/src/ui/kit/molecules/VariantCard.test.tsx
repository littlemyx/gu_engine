/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import VariantCard from './VariantCard';

afterEach(cleanup);

describe('VariantCard', () => {
  it('показывает литеру и подпись варианта', () => {
    render(<VariantCard letter="B" label="▸ 1:48 · спокойный, гитара" playing={false} />);

    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('▸ 1:48 · спокойный, гитара')).toBeTruthy();
  });

  it('в состоянии «играет» показывает статус и полосу прогресса', () => {
    render(<VariantCard label="трек" playing progress={40} />);

    expect(screen.getByText('играет')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
  });

  it('в состоянии «ждёт» показывает тихую метку и не рисует прогресс', () => {
    render(<VariantCard label="трек" playing={false} />);

    expect(screen.getByText('слушать')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('с колбэком карточка кликабельна', () => {
    const onClick = vi.fn();
    render(<VariantCard letter="A" label="трек" onClick={onClick} />);

    const el = screen.getByRole('button') as HTMLButtonElement;
    el.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('без колбэка кнопки нет', () => {
    render(<VariantCard letter="A" label="трек" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
