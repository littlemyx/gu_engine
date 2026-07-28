/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import IndentSpacer from './IndentSpacer';

afterEach(cleanup);

describe('IndentSpacer', () => {
  it('по умолчанию резервирует level(2) * step(14) = 28px', () => {
    const { container } = render(<IndentSpacer />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.width).toBe('28px');
  });

  it('масштабирует ширину под заданные level и step', () => {
    const { container } = render(<IndentSpacer level={3} step={20} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.width).toBe('60px');
  });

  it('нулевой уровень даёт нулевую ширину', () => {
    const { container } = render(<IndentSpacer level={0} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.width).toBe('0px');
  });

  it('зажимает отрицательный результат ширины в 0', () => {
    const { container } = render(<IndentSpacer level={-3} step={14} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.width).toBe('0px');
  });

  it('скрыт от скринридера', () => {
    const { container } = render(<IndentSpacer />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});
