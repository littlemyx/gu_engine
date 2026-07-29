/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import RunProgress, { type RunProgressTone } from './RunProgress';

afterEach(cleanup);

describe('RunProgress', () => {
  it('показывает подпись прогона', () => {
    render(<RunProgress percent={54} label="14 из 26 · $0.41" />);
    expect(screen.getByText('14 из 26 · $0.41')).toBeTruthy();
  });

  it('прокидывает процент в трек как aria-valuenow', () => {
    render(<RunProgress percent={54} label="ход" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('54');
  });

  it('зажимает процент в диапазон 0–100', () => {
    render(<RunProgress percent={140} label="перебор" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('не рендерит собственную подпись-заголовок трека', () => {
    render(<RunProgress percent={30} label="ход" />);
    // ProgressTrack со showLabel=false не печатает строку с числом-процентом.
    expect(screen.queryByText('30%')).toBeNull();
  });
});

const TONES: RunProgressTone[] = ['loading', 'error'];

describe.each(TONES)('RunProgress, тон %s', tone => {
  it('рендерит трек прогона', () => {
    render(<RunProgress percent={38} label="генерация" tone={tone} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});

describe.each([false, true])('RunProgress, onDark=%s', onDark => {
  it('рендерится и на светлом, и на тёмном хроме', () => {
    render(<RunProgress percent={38} label="генерация" onDark={onDark} />);
    expect(screen.getByText('генерация')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});
