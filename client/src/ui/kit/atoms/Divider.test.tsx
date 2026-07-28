/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Divider, { type DividerOrientation } from './Divider';

afterEach(cleanup);

const ORIENTATIONS: DividerOrientation[] = ['vertical', 'horizontal'];

describe.each(ORIENTATIONS)('Divider, ориентация %s', orientation => {
  it('скрыт от скринридера и не несёт текста', () => {
    const { container } = render(<Divider orientation={orientation} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.textContent).toBe('');
  });

  it('вытягивается вдоль своей оси на заданную длину', () => {
    const { container } = render(<Divider orientation={orientation} length={40} />);
    const el = container.firstElementChild as HTMLElement;

    if (orientation === 'vertical') {
      expect(el.style.height).toBe('40px');
      expect(el.style.width).toBe('');
    } else {
      expect(el.style.width).toBe('40px');
      expect(el.style.height).toBe('');
    }
  });
});

describe('Divider, длина по умолчанию', () => {
  it('без пропа length берёт 20px', () => {
    const { container } = render(<Divider />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.height).toBe('20px');
  });
});

describe('Divider, тон и хром', () => {
  it('тихий и тёмный варианты получают собственные классы', () => {
    const { container: base } = render(<Divider />);
    const baseClass = base.firstElementChild?.className ?? '';
    cleanup();

    const { container: quiet } = render(<Divider quiet />);
    const quietClass = quiet.firstElementChild?.className ?? '';
    cleanup();

    const { container: light } = render(<Divider onDark={false} />);
    const lightClass = light.firstElementChild?.className ?? '';

    expect(quietClass).not.toBe(baseClass);
    expect(lightClass).not.toBe(baseClass);
  });

  it('по умолчанию живёт на тёмном хроме — так же, как в макете', () => {
    const { container } = render(<Divider />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.className).toContain('onDark');
  });
});
