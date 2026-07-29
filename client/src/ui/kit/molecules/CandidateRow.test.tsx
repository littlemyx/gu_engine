/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CandidateRow from './CandidateRow';

afterEach(cleanup);

const LABEL = '◈ Б4 «Фестиваль» — бит хребта';
const OUTCOME = 'победит';

describe('CandidateRow', () => {
  it('без onClick рендерится нерактивным div, а не кнопкой', () => {
    render(<CandidateRow label={LABEL} outcome={OUTCOME} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(LABEL)).toBeTruthy();
    expect(screen.getByText(OUTCOME)).toBeTruthy();
  });

  it('с onClick рендерится кнопкой и зовёт колбэк по клику', () => {
    const onClick = vi.fn();
    render(<CandidateRow label={LABEL} outcome={OUTCOME} onClick={onClick} />);

    const el = screen.getByRole('button') as HTMLButtonElement;
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.textContent).toContain(LABEL);
    expect(el.textContent).toContain(OUTCOME);

    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('лидер (winner) показывает текст и итог', () => {
    render(<CandidateRow label={LABEL} outcome={OUTCOME} winner />);

    expect(screen.getByText(LABEL)).toBeTruthy();
    expect(screen.getByText(OUTCOME)).toBeTruthy();
  });

  it('обычная строка (не лидер) показывает текст и итог', () => {
    render(<CandidateRow label={LABEL} outcome={OUTCOME} winner={false} />);

    expect(screen.getByText(LABEL)).toBeTruthy();
    expect(screen.getByText(OUTCOME)).toBeTruthy();
  });

  it('применяет заданную ширину строки', () => {
    render(<CandidateRow label={LABEL} outcome={OUTCOME} width={340} />);

    const root = screen.getByText(LABEL).closest('div') as HTMLDivElement;
    expect(root.style.width).toBe('340px');
  });

  it('onDark не ломает рендер и содержимое остаётся тем же', () => {
    render(<CandidateRow label={LABEL} outcome={OUTCOME} onDark />);

    expect(screen.getByText(LABEL)).toBeTruthy();
    expect(screen.getByText(OUTCOME)).toBeTruthy();
  });
});
