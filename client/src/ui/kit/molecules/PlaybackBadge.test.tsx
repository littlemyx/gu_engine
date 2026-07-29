/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PlaybackBadge from './PlaybackBadge';

afterEach(cleanup);

describe('PlaybackBadge, состояние играет', () => {
  it('показывает подпись по умолчанию и таймкод', () => {
    render(<PlaybackBadge />);

    expect(screen.getByText('играет в миксе')).toBeTruthy();
    expect(screen.getByText('0:34 / 1:48')).toBeTruthy();
  });

  it('не рендерит кнопку — бейдж некликабельный', () => {
    render(<PlaybackBadge />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('PlaybackBadge, состояние пауза', () => {
  it('показывает подпись «пауза» по умолчанию', () => {
    render(<PlaybackBadge playing={false} />);

    expect(screen.getByText('пауза')).toBeTruthy();
    expect(screen.getByText('0:34 / 1:48')).toBeTruthy();
  });
});

describe('PlaybackBadge, кастомный контент', () => {
  it('принимает свою подпись, время и общую длительность', () => {
    render(<PlaybackBadge label="запись реплики" time="1:02" total="2:15" />);

    expect(screen.getByText('запись реплики')).toBeTruthy();
    expect(screen.getByText('1:02 / 2:15')).toBeTruthy();
  });

  it('на паузе принимает свою подпись', () => {
    render(<PlaybackBadge label="остановлено" playing={false} />);

    expect(screen.getByText('остановлено')).toBeTruthy();
  });
});

describe('PlaybackBadge, разметка состояний', () => {
  it('играет и пауза дают разные корневые классы', () => {
    const { container: playing } = render(<PlaybackBadge />);
    const playingClass = playing.firstElementChild?.className ?? '';
    cleanup();

    const { container: paused } = render(<PlaybackBadge playing={false} />);
    expect(paused.firstElementChild?.className).not.toBe(playingClass);
  });
});
