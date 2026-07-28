/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import StatusGlyph, { type StatusGlyphStatus } from './StatusGlyph';

afterEach(cleanup);

const GLYPH: Record<StatusGlyphStatus, string> = {
  fresh: '●',
  stale: '◐',
  none: '○',
  ok: '✓',
  run: '⟳',
  fail: '✗',
  warn: '⚠',
};

const STATUSES = Object.keys(GLYPH) as StatusGlyphStatus[];

describe.each(STATUSES)('StatusGlyph, статус %s', status => {
  it('рисует нужный глиф и подписывает его для скринридера', () => {
    render(<StatusGlyph status={status} />);

    const el = screen.getByRole('img', { name: status });
    expect(el.textContent).toBe(GLYPH[status]);
  });
});

describe('StatusGlyph, вращение', () => {
  it('run со spin по умолчанию крутится', () => {
    render(<StatusGlyph status="run" />);

    const el = screen.getByRole('img', { name: 'run' });
    expect(el.className).toMatch(/spin/);
  });

  it('run со spin=false не крутится', () => {
    render(<StatusGlyph status="run" spin={false} />);

    const el = screen.getByRole('img', { name: 'run' });
    expect(el.className).not.toMatch(/spin/);
  });

  it('другие статусы не крутятся, даже если spin не выключен', () => {
    render(<StatusGlyph status="ok" />);

    const el = screen.getByRole('img', { name: 'ok' });
    expect(el.className).not.toMatch(/spin/);
  });
});

describe('StatusGlyph, светлый и тёмный хром', () => {
  it('на тёмном получает отдельный класс, а не тот же, что на светлом', () => {
    const { unmount: unmountLight } = render(<StatusGlyph status="fresh" />);
    const lightClass = screen.getByRole('img', { name: 'fresh' }).className;
    unmountLight();

    render(<StatusGlyph status="fresh" onDark />);
    const darkClass = screen.getByRole('img', { name: 'fresh' }).className;

    expect(darkClass).not.toBe(lightClass);
  });
});

describe('StatusGlyph, размер', () => {
  it('по умолчанию 11px', () => {
    render(<StatusGlyph status="none" />);

    expect(screen.getByRole('img', { name: 'none' }).style.fontSize).toBe('11px');
  });

  it('принимает кастомный кегль', () => {
    render(<StatusGlyph status="none" size={18} />);

    expect(screen.getByRole('img', { name: 'none' }).style.fontSize).toBe('18px');
  });
});
