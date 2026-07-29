/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TrackRow from './TrackRow';

afterEach(cleanup);

describe('TrackRow, содержимое', () => {
  it('показывает подпись и таймкод', () => {
    render(<TrackRow label="Вариант A" time="2:47" />);
    expect(screen.getByText('Вариант A')).toBeTruthy();
    expect(screen.getByText('2:47')).toBeTruthy();
  });

  it('без onSelect строка — немой индикатор с role=radio, но без кнопки', () => {
    render(<TrackRow label="Вариант B" time="1:12" />);
    const radio = screen.getByRole('radio');
    expect(radio.getAttribute('aria-checked')).toBe('false');
    expect(radio.hasAttribute('tabIndex')).toBe(false);
  });
});

describe('TrackRow, выбор', () => {
  it('selected=false отражается в aria-checked', () => {
    render(<TrackRow label="Вариант A" time="2:47" selected={false} />);
    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('false');
  });

  it('selected=true отражается в aria-checked', () => {
    render(<TrackRow label="Вариант A" time="2:47" selected />);
    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('true');
  });

  it('с onSelect строка кликабельна и вызывает колбэк по клику на всю строку', () => {
    let calls = 0;
    render(<TrackRow label="Вариант A" time="2:47" onSelect={() => (calls += 1)} />);
    fireEvent.click(screen.getByRole('radio'));
    expect(calls).toBe(1);
  });

  it('клик по кнопке ▶ не вызывает onSelect', () => {
    let selectCalls = 0;
    let playCalls = 0;
    render(
      <TrackRow label="Вариант A" time="2:47" onSelect={() => (selectCalls += 1)} onPlay={() => (playCalls += 1)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'воспроизвести' }));
    expect(playCalls).toBe(1);
    expect(selectCalls).toBe(0);
  });
});

describe('TrackRow, воспроизведение', () => {
  it('без onPlay кнопки ▶ нет', () => {
    render(<TrackRow label="Вариант A" time="2:47" />);
    expect(screen.queryByRole('button', { name: 'воспроизвести' })).toBeNull();
  });

  it('с onPlay клик по ▶ вызывает колбэк', () => {
    let calls = 0;
    render(<TrackRow label="Вариант A" time="2:47" onPlay={() => (calls += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: 'воспроизвести' }));
    expect(calls).toBe(1);
  });
});
