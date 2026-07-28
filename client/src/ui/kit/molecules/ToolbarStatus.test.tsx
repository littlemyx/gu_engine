/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ToolbarStatus, { type ToolbarStatusTone } from './ToolbarStatus';

afterEach(cleanup);

const TONES: ToolbarStatusTone[] = ['normal', 'info', 'error', 'quiet'];

describe.each(TONES)('ToolbarStatus, тон %s', tone => {
  it('показывает текст статуса', () => {
    render(<ToolbarStatus text="▶ идёт · на заглушках" tone={tone} />);
    expect(screen.getByText('▶ идёт · на заглушках')).toBeTruthy();
  });
});

describe('ToolbarStatus, частные случаи', () => {
  it('без tone по умолчанию обычный', () => {
    render(<ToolbarStatus text="готово" />);
    const node = screen.getByText('готово');
    expect(node.className).toContain('normal');
  });

  it('end прижимает строку к правому краю', () => {
    render(<ToolbarStatus text="готово" end />);
    const node = screen.getByText('готово');
    expect(node.className).toContain('end');
  });

  it('без end класс отсутствует', () => {
    render(<ToolbarStatus text="готово" />);
    const node = screen.getByText('готово');
    expect(node.className).not.toContain('end');
  });

  it('строка не интерактивна: это span, не кнопка', () => {
    render(<ToolbarStatus text="готово" />);
    expect(screen.getByText('готово').tagName).toBe('SPAN');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
