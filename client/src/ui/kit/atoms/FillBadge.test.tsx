/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import FillBadge from './FillBadge';

afterEach(cleanup);

describe('FillBadge', () => {
  it('показывает подпись', () => {
    render(<FillBadge label="ВЫБРАНА" />);

    expect(screen.getByText('ВЫБРАНА')).toBeTruthy();
  });

  it('без arrow не рисует глиф', () => {
    render(<FillBadge label="есть v3" />);

    expect(screen.queryByText('▾')).toBeNull();
  });

  it('c arrow рисует глиф раскрытия', () => {
    render(<FillBadge label="diff" arrow />);

    expect(screen.getByText('▾')).toBeTruthy();
  });

  it('по умолчанию подпись в верхнем регистре (класс uppercase)', () => {
    const { container } = render(<FillBadge label="выбрана" />);

    expect(container.firstElementChild?.className).toContain('uppercase');
  });

  it('uppercase={false} снимает класс верхнего регистра', () => {
    const { container } = render(<FillBadge label="выбрана" uppercase={false} />);

    expect(container.firstElementChild?.className).not.toContain('uppercase');
  });

  it('некликабельный: кнопок не рендерит', () => {
    render(<FillBadge label="ВЫБРАНА" arrow />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
