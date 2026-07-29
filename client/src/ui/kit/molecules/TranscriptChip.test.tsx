/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TranscriptChip, { type TranscriptChipTone } from './TranscriptChip';

afterEach(cleanup);

const TONES: TranscriptChipTone[] = ['обычный', 'текущий', 'предупреждение'];

describe.each(TONES)('TranscriptChip, тон %s', tone => {
  it('показывает текст реплики', () => {
    render(<TranscriptChip label="Д2д Кафе" tone={tone} />);
    expect(screen.getByText('Д2д Кафе')).toBeTruthy();
  });

  it('без onClick не рендерит кнопку', () => {
    render(<TranscriptChip label="Д2д Кафе" tone={tone} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерит кнопку с доступным именем по тексту', () => {
    render(<TranscriptChip label="Д2д Кафе" tone={tone} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Д2д Кафе' })).toBeTruthy();
  });

  it('клик вызывает onClick', () => {
    let calls = 0;
    render(<TranscriptChip label="Д2д Кафе" tone={tone} onClick={() => (calls += 1)} />);
    fireEvent.click(screen.getByRole('button'));
    expect(calls).toBe(1);
  });
});

describe('TranscriptChip, глифы по тону', () => {
  it('обычный тон не показывает глиф-префикс', () => {
    render(<TranscriptChip label="Д2д Кафе" tone="обычный" />);
    expect(screen.queryByText('►')).toBeNull();
    expect(screen.queryByText('⚠')).toBeNull();
  });

  it('текущий тон показывает глиф ►', () => {
    render(<TranscriptChip label="Д3в Пирс" tone="текущий" />);
    expect(screen.getByText('►')).toBeTruthy();
  });

  it('предупреждение показывает глиф ⚠', () => {
    render(<TranscriptChip label="история дальше изменилась" tone="предупреждение" />);
    expect(screen.getByText('⚠')).toBeTruthy();
  });

  it('по умолчанию тон — обычный', () => {
    render(<TranscriptChip label="Д2д Кафе" />);
    expect(screen.queryByText('►')).toBeNull();
    expect(screen.queryByText('⚠')).toBeNull();
  });
});
