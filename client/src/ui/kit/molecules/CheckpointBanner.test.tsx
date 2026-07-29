/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CheckpointBanner, { type CheckpointBannerTone } from './CheckpointBanner';

afterEach(cleanup);

const TONES: CheckpointBannerTone[] = ['default', 'warn'];

describe.each(TONES)('CheckpointBanner, тон %s', tone => {
  it('показывает подпись и пояснение', () => {
    render(<CheckpointBanner label="Пауза после порции 2 включена" note="конвейер остановится" tone={tone} />);
    expect(screen.getByText('Пауза после порции 2 включена')).toBeTruthy();
    expect(screen.getByText('конвейер остановится')).toBeTruthy();
  });
});

describe('CheckpointBanner', () => {
  it('по умолчанию рисует глиф ⏸', () => {
    render(<CheckpointBanner label="метка" note="пояснение" />);
    expect(screen.getByText('⏸')).toBeTruthy();
  });

  it('глиф переопределяется пропом', () => {
    render(<CheckpointBanner glyph="▶" label="метка" note="пояснение" />);
    expect(screen.getByText('▶')).toBeTruthy();
    expect(screen.queryByText('⏸')).toBeNull();
  });

  it('глиф декоративен и скрыт от читалок', () => {
    render(<CheckpointBanner label="метка" note="пояснение" />);
    expect(screen.getByText('⏸').getAttribute('aria-hidden')).toBe('true');
  });

  it('без action кнопки нет', () => {
    render(<CheckpointBanner label="метка" note="пояснение" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с action рисует кнопку и вызывает колбэк по клику', () => {
    const onAction = vi.fn();
    render(<CheckpointBanner label="метка" note="пояснение" action="снять паузу" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'снять паузу' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
