/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import EstimateTotal, { type EstimateTotalSize } from './EstimateTotal';

import styles from './EstimateTotal.module.css';

afterEach(cleanup);

const SIZES: EstimateTotalSize[] = ['regular', 'large'];

describe.each(SIZES)('EstimateTotal, размер %s', size => {
  it('показывает подпись и сумму', () => {
    render(<EstimateTotal label="итого" price="≈$1.04–1.35" size={size} />);

    expect(screen.getByText('итого')).toBeTruthy();
    expect(screen.getByText('≈$1.04–1.35')).toBeTruthy();
  });
});

describe('EstimateTotal, дефолтный размер', () => {
  it('без size рендерится как regular', () => {
    render(<EstimateTotal label="итого" price="≈$1.04–1.35" />);

    expect(screen.getByText('итого')).toBeTruthy();
    expect(screen.getByText('≈$1.04–1.35')).toBeTruthy();
  });
});

describe('EstimateTotal, тон accent', () => {
  it('без accent сумма не обёрнута акцентным классом', () => {
    render(<EstimateTotal label="итого" price="≈$3.46" />);

    const price = screen.getByText('≈$3.46');
    expect(price.parentElement?.className.includes(styles.priceAccent)).toBe(false);
  });

  it('с accent сумма обёрнута акцентным классом', () => {
    render(<EstimateTotal label="итого" price="≈$3.46" accent />);

    const price = screen.getByText('≈$3.46');
    expect(price.parentElement?.className).toBe(styles.priceAccent);
  });
});

describe('EstimateTotal, контент — не хардкод', () => {
  it('произвольные подпись и сумма приходят пропсами', () => {
    render(<EstimateTotal label="аванс" price="≈$0.50" />);

    expect(screen.getByText('аванс')).toBeTruthy();
    expect(screen.getByText('≈$0.50')).toBeTruthy();
  });
});
