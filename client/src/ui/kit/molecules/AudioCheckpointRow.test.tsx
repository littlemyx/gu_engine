/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import AudioCheckpointRow from './AudioCheckpointRow';

afterEach(cleanup);

describe('AudioCheckpointRow, содержимое', () => {
  it('показывает имя чекпоинта', () => {
    render(<AudioCheckpointRow name="audio_pier_evening" />);
    expect(screen.getByText('audio_pier_evening')).toBeTruthy();
  });

  it('по умолчанию состояние «ждёт» с дефолтным текстом статуса', () => {
    render(<AudioCheckpointRow name="audio_pier_evening" />);
    expect(screen.getByText('ждёт выбора · A / B →')).toBeTruthy();
    expect(screen.getByText('⏸')).toBeTruthy();
  });

  it('состояние «решён» рисует дефолтный текст и другой глиф', () => {
    render(<AudioCheckpointRow name="audio_pier_evening" state="решён" />);
    expect(screen.getByText('тейк A принят')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.queryByText('⏸')).toBeNull();
  });

  it('принимает произвольный текст статуса вместо дефолтного', () => {
    render(<AudioCheckpointRow name="audio_pier_evening" statusText="дубль от Иры" state="решён" />);
    expect(screen.getByText('дубль от Иры')).toBeTruthy();
    expect(screen.queryByText('тейк A принят')).toBeNull();
  });

  it('глиф декоративный: aria-hidden', () => {
    render(<AudioCheckpointRow name="audio_pier_evening" />);
    const glyph = screen.getByText('⏸');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('AudioCheckpointRow, интерактивность', () => {
  it('без onClick рендерит нейтральный элемент без кнопки', () => {
    render(<AudioCheckpointRow name="audio_pier_evening" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерит кнопку и вызывает колбэк по клику', () => {
    let clicks = 0;
    render(<AudioCheckpointRow name="audio_pier_evening" onClick={() => (clicks += 1)} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(clicks).toBe(1);
  });

  it('доступное имя кнопки включает имя чекпоинта и текст статуса', () => {
    render(<AudioCheckpointRow name="audio_pier_evening" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /audio_pier_evening.*ждёт выбора/ })).toBeTruthy();
  });
});
