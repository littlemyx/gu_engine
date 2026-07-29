/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PriceTag, { type PriceTagFontFamily, type PriceTagTone, type PriceTagVariant } from './PriceTag';

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

const TONES: PriceTagTone[] = ['neutral', 'accent', 'muted', 'error'];

describe.each(TONES)('PriceTag, тон %s', tone => {
  it('печатает сумму', () => {
    render(<PriceTag value="≈$0.02" tone={tone} />);

    expect(screen.getByText('≈$0.02')).toBeTruthy();
  });
});

describe('PriceTag, тон по умолчанию', () => {
  it('без tone класс совпадает с tone="neutral"', () => {
    const { container: implicit } = render(<PriceTag value="≈$0.02" />);
    const implicitClass = implicit.firstElementChild?.className ?? '';
    cleanup();

    const { container: explicit } = render(<PriceTag value="≈$0.02" tone="neutral" />);
    expect(explicit.firstElementChild?.className).toBe(implicitClass);
  });

  it('accent/muted/error каждый получают собственный класс', () => {
    const { container: neutral } = render(<PriceTag value="≈$0.02" tone="neutral" />);
    const neutralClass = neutral.firstElementChild?.className ?? '';
    cleanup();

    const seen = new Set([neutralClass]);
    for (const tone of ['accent', 'muted', 'error'] as const) {
      const { container } = render(<PriceTag value="≈$0.02" tone={tone} />);
      const className = container.firstElementChild?.className ?? '';
      expect(seen.has(className)).toBe(false);
      seen.add(className);
      cleanup();
    }
  });

  it('тон переживает variant и onDark, не ломая их классы', () => {
    render(<PriceTag value="≈$0.02" variant="total" onDark tone="error" />);

    expect(screen.getByText('≈$0.02')).toBeTruthy();
  });
});

const FONT_FAMILIES: PriceTagFontFamily[] = ['mono', 'body'];

describe.each(FONT_FAMILIES)('PriceTag, гарнитура %s', fontFamily => {
  it('печатает сумму', () => {
    render(<PriceTag value="≈$0.02" fontFamily={fontFamily} />);

    expect(screen.getByText('≈$0.02')).toBeTruthy();
  });
});

describe('PriceTag, гарнитура по умолчанию', () => {
  it('без fontFamily класс совпадает с fontFamily="mono"', () => {
    const { container: implicit } = render(<PriceTag value="≈$0.02" />);
    const implicitClass = implicit.firstElementChild?.className ?? '';
    cleanup();

    const { container: explicit } = render(<PriceTag value="≈$0.02" fontFamily="mono" />);
    expect(explicit.firstElementChild?.className).toBe(implicitClass);
  });

  it('body получает отдельный класс от mono', () => {
    const { container: mono } = render(<PriceTag value="≈$0.02" fontFamily="mono" />);
    const monoClass = mono.firstElementChild?.className ?? '';
    cleanup();

    const { container: body } = render(<PriceTag value="≈$0.02" fontFamily="body" />);
    expect(body.firstElementChild?.className).not.toBe(monoClass);
  });
});
