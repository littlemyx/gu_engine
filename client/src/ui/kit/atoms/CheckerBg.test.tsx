/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CheckerBg from './CheckerBg';

afterEach(cleanup);

describe('CheckerBg', () => {
  it('задаёт размер области инлайн-стилем', () => {
    const { container } = render(<CheckerBg width={200} height={100} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.width).toBe('200px');
    expect(root.style.height).toBe('100px');
  });

  it('шаг клетки идёт в background-size', () => {
    const { container } = render(<CheckerBg cell={20} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.backgroundSize).toBe('20px 20px');
  });

  it('без children показывает дефолтный глиф', () => {
    render(<CheckerBg />);

    expect(screen.getByText('◐')).toBeTruthy();
  });

  it('с children показывает переданное содержимое вместо глифа', () => {
    render(
      <CheckerBg>
        <span>спрайт</span>
      </CheckerBg>,
    );

    expect(screen.getByText('спрайт')).toBeTruthy();
    expect(screen.queryByText('◐')).toBeFalsy();
  });

  it('framed по умолчанию рисует рамку, framed=false — другой класс', () => {
    const { container: framedBox } = render(<CheckerBg />);
    const framedRoot = framedBox.firstElementChild as HTMLElement;
    cleanup();

    const { container: plainBox } = render(<CheckerBg framed={false} />);
    const plainRoot = plainBox.firstElementChild as HTMLElement;

    expect(framedRoot.className).not.toBe(plainRoot.className);
  });
});
