/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IconButton, { type IconButtonSize, type IconButtonTone } from './IconButton';

afterEach(cleanup);

const SIZES: IconButtonSize[] = ['inline', 'toolbar'];
const TONES: IconButtonTone[] = ['neutral', 'danger'];

describe.each(SIZES)('IconButton, размер %s', size => {
  describe.each(TONES)('тон %s', tone => {
    it('доступна по подписи hint', () => {
      render(<IconButton glyph="⟳" hint="Обновить" size={size} tone={tone} onClick={() => {}} />);

      expect(screen.getByRole('button', { name: 'Обновить' })).toBeTruthy();
    });
  });
});

describe('IconButton, размер', () => {
  it('тулбарная получает отдельный класс от строчной', () => {
    const { container: inline } = render(<IconButton glyph="⟳" hint="Обновить" onClick={() => {}} />);
    const inlineClass = inline.firstElementChild?.className ?? '';
    cleanup();

    const { container: toolbar } = render(<IconButton glyph="⟳" hint="Обновить" size="toolbar" onClick={() => {}} />);
    expect(toolbar.firstElementChild?.className).not.toBe(inlineClass);
  });
});

describe('IconButton, тон', () => {
  it('danger получает отдельный класс от neutral', () => {
    const { container: neutral } = render(<IconButton glyph="✕" hint="Удалить" onClick={() => {}} />);
    const neutralClass = neutral.firstElementChild?.className ?? '';
    cleanup();

    const { container: danger } = render(<IconButton glyph="✕" hint="Удалить" tone="danger" onClick={() => {}} />);
    expect(danger.firstElementChild?.className).not.toBe(neutralClass);
  });
});

describe('IconButton, тёмный хром', () => {
  it('onDark получает отдельный класс', () => {
    const { container: light } = render(<IconButton glyph="⟳" hint="Обновить" onClick={() => {}} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<IconButton glyph="⟳" hint="Обновить" onDark onClick={() => {}} />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('IconButton, состояния', () => {
  it('вызывает onClick по клику', () => {
    const onClick = vi.fn();
    render(<IconButton glyph="▶" hint="Запустить" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Запустить' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled отключает кнопку и не вызывает onClick', () => {
    const onClick = vi.fn();
    render(<IconButton glyph="▶" hint="Запустить" disabled onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'Запустить' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('получает фокус по клавиатуре (focus-visible через CSS-класс root)', () => {
    render(<IconButton glyph="▶" hint="Запустить" onClick={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Запустить' });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('без onClick рендерит неинтерактивный элемент', () => {
    render(<IconButton glyph="⋯" hint="Ещё" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('⋯')).toBeTruthy();
  });
});
