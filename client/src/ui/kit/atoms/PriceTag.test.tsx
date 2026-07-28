/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PriceTag, { type PriceTagVariant } from './PriceTag';

afterEach(cleanup);

const VARIANTS: PriceTagVariant[] = ['button', 'standalone', 'total'];

describe.each(VARIANTS)('PriceTag, вариант %s', variant => {
  it('печатает сумму', () => {
    render(<PriceTag value="≈$0.02" variant={variant} />);

    expect(screen.getByText('≈$0.02')).toBeTruthy();
  });
});

describe('PriceTag, тёмный хром', () => {
  it('standalone на тёмном получает отдельный класс', () => {
    const { container: light } = render(<PriceTag value="≈$0.02" variant="standalone" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<PriceTag value="≈$0.02" variant="standalone" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });

  it('total на тёмном получает отдельный класс', () => {
    const { container: light } = render(<PriceTag value="≈$0.02" variant="total" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<PriceTag value="≈$0.02" variant="total" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('PriceTag, переопределение размера', () => {
  it('sizePx переопределяет размер шрифта варианта', () => {
    render(<PriceTag value="≈$3.46" variant="total" sizePx={18} />);

    const node = screen.getByText('≈$3.46') as HTMLElement;
    expect(node.style.fontSize).toBe('18px');
  });

  it('без sizePx инлайновый стиль не задан', () => {
    render(<PriceTag value="≈$3.46" variant="total" />);

    const node = screen.getByText('≈$3.46') as HTMLElement;
    expect(node.style.fontSize).toBe('');
  });
});
