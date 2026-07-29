/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BeatCardGhost from './BeatCardGhost';

afterEach(cleanup);

describe('BeatCardGhost', () => {
  it('показывает подпись переноса', () => {
    render(<BeatCardGhost label="Б5 · переносится в Д6у…" />);
    expect(screen.getByText('Б5 · переносится в Д6у…')).toBeTruthy();
  });

  it('некликабельна: кнопки нет', () => {
    render(<BeatCardGhost label="призрак" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('не фокусируема', () => {
    const { container } = render(<BeatCardGhost label="призрак" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('tabindex')).toBeNull();
  });

  it('использует размеры по умолчанию из макета', () => {
    const { container } = render(<BeatCardGhost label="призрак" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('152px');
    expect(root.style.height).toBe('60px');
  });

  it('размеры переопределяются пропами', () => {
    const { container } = render(<BeatCardGhost label="призрак" width={220} height={90} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('220px');
    expect(root.style.height).toBe('90px');
  });

  it('по умолчанию рендерит на светлом хроме', () => {
    const { container } = render(<BeatCardGhost label="призрак" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className.toLowerCase()).not.toContain('ondark');
  });

  it('на тёмном хроме передаёт onDark вниз по атому подписи', () => {
    const { container } = render(<BeatCardGhost label="призрак" onDark />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className.toLowerCase()).toContain('ondark');
    const text = screen.getByText('призрак');
    expect(text.className.toLowerCase()).toContain('ondark');
  });
});
