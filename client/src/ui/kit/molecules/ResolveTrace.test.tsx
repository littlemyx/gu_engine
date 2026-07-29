/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ResolveTrace, { type ResolveTraceRow } from './ResolveTrace';

afterEach(cleanup);

const ROWS: ResolveTraceRow[] = [
  { segments: [{ text: '«нежно» → ' }, { text: 'gentle', accent: true }] },
  { segments: [{ text: 'EMOTION_TO_POSE: gentle → ' }, { text: 'soft', accent: true }] },
  { segments: [{ text: 'poseFilenames.soft → mia_soft.png ✓' }] },
];

describe('ResolveTrace', () => {
  it('показывает все строки трассы', () => {
    render(<ResolveTrace rows={ROWS} />);

    expect(screen.getByText('«нежно» →', { exact: false })).toBeTruthy();
    expect(screen.getByText('gentle')).toBeTruthy();
    expect(screen.getByText('EMOTION_TO_POSE: gentle →', { exact: false })).toBeTruthy();
    expect(screen.getByText('soft')).toBeTruthy();
    expect(screen.getByText('poseFilenames.soft → mia_soft.png ✓')).toBeTruthy();
  });

  it('без кикера заголовок не рендерится', () => {
    const { container } = render(<ResolveTrace rows={ROWS} />);

    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
    expect(screen.queryByText('Резолв эмоции → спрайт')).toBeNull();
  });

  it('с кикером показывает его текст', () => {
    render(<ResolveTrace rows={ROWS} kicker="Резолв эмоции → спрайт" />);

    expect(screen.getByText('Резолв эмоции → спрайт')).toBeTruthy();
  });

  it('без фолбэка рамка отсутствует', () => {
    render(<ResolveTrace rows={ROWS} />);

    expect(screen.queryByText('fallback:')).toBeNull();
  });

  it('с фолбэком показывает подпись и текст', () => {
    render(<ResolveTrace rows={ROWS} fallback="«злобно» → angry — позы нет → idle (флаг isFallback)" />);

    expect(screen.getByText('fallback:')).toBeTruthy();
    expect(screen.getByText('«злобно» → angry — позы нет → idle (флаг isFallback)')).toBeTruthy();
  });

  it('подпись фолбэка настраивается пропом', () => {
    render(<ResolveTrace rows={ROWS} fallback="нет позы" fallbackLabel="запасной вариант:" />);

    expect(screen.getByText('запасной вариант:')).toBeTruthy();
    expect(screen.queryByText('fallback:')).toBeNull();
  });

  it('ширина применяется инлайн-стилем', () => {
    const { container } = render(<ResolveTrace rows={ROWS} width={420} />);

    expect((container.firstChild as HTMLElement).style.width).toBe('420px');
  });

  it('компонент неинтерактивный: кнопок нет', () => {
    render(<ResolveTrace rows={ROWS} fallback="нет позы" kicker="кикер" />);

    expect(screen.queryAllByRole('button').length).toBe(0);
  });
});
