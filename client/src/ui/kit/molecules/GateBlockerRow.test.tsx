/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import GateBlockerRow from './GateBlockerRow';

afterEach(cleanup);

describe('GateBlockerRow, содержимое', () => {
  it('показывает текст блокера', () => {
    render(<GateBlockerRow text="QA-отчёт #7 устарел — прогнан до правки Б5 · гейту нужен свежий" />);
    expect(screen.getByText('QA-отчёт #7 устарел — прогнан до правки Б5 · гейту нужен свежий')).toBeTruthy();
  });

  it('по умолчанию state="активный": глиф stale и дефолтное действие с ценой', () => {
    render(<GateBlockerRow text="блокер" />);
    expect(screen.getByRole('img', { name: 'stale' })).toBeTruthy();
    expect(screen.getByText('перегнать ≈$0.40')).toBeTruthy();
  });

  it('state="решён": глиф ok и дефолтное действие «готово ✓»', () => {
    render(<GateBlockerRow text="блокер" state="решён" />);
    expect(screen.getByRole('img', { name: 'ok' })).toBeTruthy();
    expect(screen.getByText('готово ✓')).toBeTruthy();
  });

  it('принимает произвольный текст действия вместо дефолтного', () => {
    render(<GateBlockerRow text="блокер" action="перегенерировать ≈$1.20" />);
    expect(screen.getByText('перегенерировать ≈$1.20')).toBeTruthy();
    expect(screen.queryByText('перегнать ≈$0.40')).toBeNull();
  });

  it('action="" убирает действие целиком', () => {
    render(<GateBlockerRow text="блокер" action="" onAction={() => {}} />);
    expect(screen.queryByText('перегнать ≈$0.40')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('GateBlockerRow, интерактивность действия', () => {
  it('state="активный" + onAction: действие рисуется кнопкой и колбэк срабатывает по клику', () => {
    let clicks = 0;
    render(<GateBlockerRow text="блокер" onAction={() => (clicks += 1)} />);
    const button = screen.getByRole('button', { name: 'перегнать ≈$0.40' });
    fireEvent.click(button);
    expect(clicks).toBe(1);
  });

  it('без onAction действие не кликабельно: кнопки нет', () => {
    render(<GateBlockerRow text="блокер" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('перегнать ≈$0.40')).toBeTruthy();
  });

  it('state="решён" с onAction всё равно не рисует кнопку', () => {
    render(<GateBlockerRow text="блокер" state="решён" onAction={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('готово ✓')).toBeTruthy();
  });
});
