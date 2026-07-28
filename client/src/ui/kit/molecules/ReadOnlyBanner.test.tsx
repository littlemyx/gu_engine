/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ReadOnlyBanner from './ReadOnlyBanner';

afterEach(cleanup);

describe('ReadOnlyBanner', () => {
  it('по умолчанию показывает текст макета', () => {
    render(<ReadOnlyBanner />);
    expect(screen.getByText('Только просмотр — редактирование от 1024px. Прогоны продолжаются.')).toBeTruthy();
  });

  it('текст переопределяется пропом', () => {
    render(<ReadOnlyBanner text="Идёт фоновый прогон, дождитесь завершения." />);
    expect(screen.getByText('Идёт фоновый прогон, дождитесь завершения.')).toBeTruthy();
  });

  it('по умолчанию рисует глиф ◳', () => {
    render(<ReadOnlyBanner />);
    expect(screen.getByText('◳')).toBeTruthy();
  });

  it('глиф переопределяется пропом', () => {
    render(<ReadOnlyBanner glyph="⏳" />);
    expect(screen.getByText('⏳')).toBeTruthy();
    expect(screen.queryByText('◳')).toBeNull();
  });

  it('глиф декоративен и скрыт от читалок', () => {
    render(<ReadOnlyBanner />);
    expect(screen.getByText('◳').getAttribute('aria-hidden')).toBe('true');
  });

  it('баннер некликабелен — кнопок нет', () => {
    render(<ReadOnlyBanner />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
