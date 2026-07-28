/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Timecode from './Timecode';

afterEach(cleanup);

describe('Timecode', () => {
  it('показывает значение по умолчанию', () => {
    render(<Timecode />);
    expect(screen.getByText('0:34')).toBeTruthy();
  });

  it('показывает переданное значение', () => {
    render(<Timecode value="1:48" />);
    expect(screen.getByText('1:48')).toBeTruthy();
  });

  it('применяет кегль как inline font-size', () => {
    render(<Timecode value="0:12" size={13} />);
    const node = screen.getByText('0:12') as HTMLElement;
    expect(node.style.fontSize).toBe('13px');
  });

  it('на светлом (по умолчанию) не получает класс onDark', () => {
    render(<Timecode value="0:12" />);
    const node = screen.getByText('0:12') as HTMLElement;
    expect(node.className).not.toMatch(/onDark/);
  });

  it('на тёмном получает отдельный класс', () => {
    render(<Timecode value="0:12" onDark />);
    const node = screen.getByText('0:12') as HTMLElement;
    expect(node.className).toMatch(/onDark/);
  });

  it('приглушённый вариант получает класс muted', () => {
    render(<Timecode value="0:12" muted />);
    const node = screen.getByText('0:12') as HTMLElement;
    expect(node.className).toMatch(/muted/);
  });

  it('сочетает onDark и muted одновременно', () => {
    render(<Timecode value="0:12" onDark muted />);
    const node = screen.getByText('0:12') as HTMLElement;
    expect(node.className).toMatch(/onDark/);
    expect(node.className).toMatch(/muted/);
  });

  it('рендерит неинтерактивный элемент, без кнопки', () => {
    render(<Timecode value="0:12" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
