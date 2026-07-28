/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PrimaryButton, { type PrimaryButtonSize } from './PrimaryButton';

afterEach(cleanup);

const SIZES: PrimaryButtonSize[] = ['regular', 'compact'];

const button = () => screen.getByRole('button') as HTMLButtonElement;

describe.each(SIZES)('PrimaryButton, размер %s', size => {
  it('печатает подпись и смету в самой кнопке', () => {
    render(<PrimaryButton label="Сгенерировать" price="≈$0.02" size={size} />);

    expect(button().textContent).toContain('Сгенерировать');
    expect(button().textContent).toContain('≈$0.02');
  });

  it('кликается, когда доступна', () => {
    const onClick = vi.fn();
    render(<PrimaryButton label="Сгенерировать" size={size} onClick={onClick} />);

    fireEvent.click(button());
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('PrimaryButton, состояния', () => {
  it('disabled запирает кнопку и не пускает клик', () => {
    const onClick = vi.fn();
    render(<PrimaryButton label="Сгенерировать" disabled onClick={onClick} />);

    expect(button().disabled).toBe(true);
    fireEvent.click(button());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading не отключает кнопку, но клик всё равно не проходит', () => {
    const onClick = vi.fn();
    render(<PrimaryButton label="Сгенерировать" loading onClick={onClick} />);

    expect(button().disabled).toBe(false);
    fireEvent.click(button());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('во время загрузки глиф уступает место спиннеру', () => {
    render(<PrimaryButton label="Сгенерировать" glyph="▶" loading />);

    expect(button().textContent).not.toContain('▶');
  });

  it('глиф показан, когда загрузки нет', () => {
    render(<PrimaryButton label="Сгенерировать" glyph="▶" />);

    expect(button().textContent).toContain('▶');
  });

  it('компактная кнопка реперов не носит', () => {
    const { container } = render(<PrimaryButton label="Сгенерировать" size="compact" marks />);

    expect(container.querySelectorAll('i').length).toBe(0);
  });

  it('обычная кнопка размечена четырьмя реперами', () => {
    const { container } = render(<PrimaryButton label="Сгенерировать" />);

    expect(container.querySelectorAll('i').length).toBe(4);
  });

  it('без marks реперов нет', () => {
    const { container } = render(<PrimaryButton label="Сгенерировать" marks={false} />);

    expect(container.querySelectorAll('i').length).toBe(0);
  });
});
