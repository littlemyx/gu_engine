/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Connector, { type ConnectorKind } from './Connector';

afterEach(cleanup);

const KINDS: ConnectorKind[] = ['основной', 'ветвление', 'маршрут'];

describe.each(KINDS)('Connector, вид %s', kind => {
  it('задаёт толщину и пунктир линии по виду', () => {
    const { container } = render(<Connector kind={kind} length={160} />);
    const path = container.querySelector('path');

    expect(path).toBeTruthy();
    expect(path?.getAttribute('stroke-width')).toBe(kind === 'маршрут' ? '2.5' : '1.5');

    if (kind === 'ветвление') {
      expect(path?.getAttribute('stroke-dasharray')).toBe('4 3');
    } else {
      expect(path?.hasAttribute('stroke-dasharray')).toBe(false);
    }
  });
});

describe('Connector, излом', () => {
  it('без излома рисует прямую линию высотой 12', () => {
    const { container } = render(<Connector length={100} />);

    expect(container.querySelector('svg')?.getAttribute('height')).toBe('12');
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M 0 6 L 100 6');
  });

  it('с изломом рисует ломаную высотой 48', () => {
    const { container } = render(<Connector length={100} elbow />);

    expect(container.querySelector('svg')?.getAttribute('height')).toBe('48');
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M 0 42 L 50 42 L 50 6 L 100 6');
  });
});

describe('Connector, тон', () => {
  it('accent красится акцентным токеном', () => {
    const { container } = render(<Connector tone="accent" />);
    expect(container.querySelector('path')?.getAttribute('stroke')).toBe('var(--color-accent-700)');
  });

  it('нейтральный красится нейтральным токеном', () => {
    const { container } = render(<Connector tone="нейтральный" />);
    expect(container.querySelector('path')?.getAttribute('stroke')).toBe('var(--color-neutral-400)');
  });
});

describe('Connector, длина', () => {
  it('ширина svg равна length', () => {
    const { container } = render(<Connector length={220} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('220');
  });
});
