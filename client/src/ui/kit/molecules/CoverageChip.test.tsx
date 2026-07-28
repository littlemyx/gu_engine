/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CoverageChip, { type CoverageChipState } from './CoverageChip';

afterEach(cleanup);

const STATES: CoverageChipState[] = ['ok', 'warn', 'error'];
const GLYPH_BY_STATE: Record<CoverageChipState, string> = {
  ok: 'ok',
  warn: 'warn',
  error: 'fail',
};

describe.each(STATES)('CoverageChip, состояние %s', state => {
  it('показывает подпись и соответствующий глиф статуса', () => {
    render(<CoverageChip label="4 юнита" state={state} />);
    expect(screen.getByText('4 юнита')).toBeTruthy();
    const glyph = screen.getByRole('img', { name: GLYPH_BY_STATE[state] });
    expect(glyph).toBeTruthy();
  });
});

describe('CoverageChip, умолчания', () => {
  it('по умолчанию состояние «ок»', () => {
    render(<CoverageChip label="9 юнитов" />);
    expect(screen.getByRole('img', { name: 'ok' })).toBeTruthy();
  });

  it('по умолчанию живёт на светлом хроме', () => {
    render(<CoverageChip label="9 юнитов" />);
    const glyph = screen.getByRole('img', { name: 'ok' });
    expect(glyph.className).not.toMatch(/onDark/);
  });

  it('onDark переключает хром глифа и счётчика', () => {
    render(<CoverageChip label="9 юнитов" onDark />);
    const glyph = screen.getByRole('img', { name: 'ok' });
    expect(glyph.className).toMatch(/onDark/);
    const label = screen.getByText('9 юнитов');
    expect(label.className).toMatch(/onDark/);
  });
});
