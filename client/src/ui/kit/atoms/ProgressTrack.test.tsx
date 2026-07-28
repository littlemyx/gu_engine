/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ProgressTrack, { type ProgressTrackSize, type ProgressTrackTone } from './ProgressTrack';

afterEach(cleanup);

const SIZES: ProgressTrackSize[] = ['thin', 'toolbar'];
const TONES: ProgressTrackTone[] = ['loading', 'error'];

describe.each(SIZES)('ProgressTrack, размер %s', size => {
  describe.each(TONES)('тон %s', tone => {
    it('выставляет aria-атрибуты прогресс-бара по значению', () => {
      render(<ProgressTrack value={62} label="генерация" size={size} tone={tone} />);

      const track = screen.getByRole('progressbar');
      expect(track.getAttribute('aria-valuemin')).toBe('0');
      expect(track.getAttribute('aria-valuemax')).toBe('100');
      expect(track.getAttribute('aria-valuenow')).toBe('62');
    });
  });
});

describe('ProgressTrack, подпись', () => {
  it('показывает заголовок и значение, когда showLabel не задан (по умолчанию true)', () => {
    render(<ProgressTrack value={40} label="генерация" />);

    expect(screen.getByText('генерация')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('прячет строку с подписью при showLabel={false}', () => {
    render(<ProgressTrack value={40} label="генерация" showLabel={false} />);

    expect(screen.queryByText('генерация')).toBeNull();
    expect(screen.queryByText('40%')).toBeNull();
  });
});

describe('ProgressTrack, значение', () => {
  it('зажимает значение выше 100', () => {
    render(<ProgressTrack value={140} label="генерация" />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('зажимает отрицательное значение в 0', () => {
    render(<ProgressTrack value={-10} label="генерация" />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByText('0%')).toBeTruthy();
  });
});

describe('ProgressTrack, метка-лимит', () => {
  it('не рисует метку без limit', () => {
    const { container } = render(<ProgressTrack value={50} label="генерация" />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('рисует метку-лимит, когда limit > 0', () => {
    const { container } = render(<ProgressTrack value={50} label="генерация" limit={80} />);

    const mark = container.querySelector('[aria-hidden="true"]');
    expect(mark).toBeTruthy();
    expect((mark as HTMLElement).style.left).toBe('80%');
  });
});

describe('ProgressTrack, на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<ProgressTrack value={50} label="генерация" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<ProgressTrack value={50} label="генерация" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
