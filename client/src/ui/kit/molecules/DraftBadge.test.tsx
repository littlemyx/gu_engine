/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DraftBadge from './DraftBadge';

afterEach(cleanup);

describe.each([false, true])('DraftBadge, onDark=%s', onDark => {
  it('показывает текст бейджа', () => {
    render(<DraftBadge text="черновик · прогон #13 идёт" onDark={onDark} />);
    expect(screen.getByText('черновик · прогон #13 идёт')).toBeTruthy();
  });

  it('не рендерит кнопку — бейдж не кликабелен', () => {
    render(<DraftBadge text="черновик" onDark={onDark} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

it('на тёмном хроме получает отдельный класс рамки, а не тот же, что на светлом', () => {
  const { container: light } = render(<DraftBadge text="черновик" />);
  const lightClass = light.firstElementChild?.className ?? '';
  cleanup();

  render(<DraftBadge text="черновик" onDark />);
  const root = screen.getByText('черновик').parentElement as HTMLElement;
  expect(root.className).not.toBe(lightClass);
  expect(root.className).toContain('onDark');
});
