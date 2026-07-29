/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SpeechLine from './SpeechLine';

afterEach(cleanup);

describe('SpeechLine', () => {
  it('показывает имя и реплику', () => {
    render(<SpeechLine name="Мия" text="«Ты правда дождался меня после пары?»" />);
    expect(screen.getByText('Мия')).toBeTruthy();
    expect(screen.getByText('«Ты правда дождался меня после пары?»')).toBeTruthy();
  });

  it('рисует эмоцию в скобках, когда она задана', () => {
    render(<SpeechLine name="Мия" emotion="нежно" text="Привет" />);
    expect(screen.getByText('(нежно)')).toBeTruthy();
  });

  it('не рисует скобки без эмоции', () => {
    const { container } = render(<SpeechLine name="Мия" text="Привет" />);
    expect(container.textContent ?? '').not.toContain('(');
  });

  it('по умолчанию ширина 400px', () => {
    const { container } = render(<SpeechLine name="Мия" text="Привет" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('400px');
  });

  it('применяет ширину из пропа', () => {
    const { container } = render(<SpeechLine name="Мия" text="Привет" width={640} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('640px');
  });
});
