/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OutlineButton, { type OutlineButtonTone } from './OutlineButton';

afterEach(cleanup);

const TONES: OutlineButtonTone[] = ['neutral', 'accent', 'danger'];

describe.each(TONES)('OutlineButton, тон %s', tone => {
  it('показывает подпись', () => {
    render(<OutlineButton label="Отменить" tone={tone} onClick={() => {}} />);

    expect(screen.getByRole('button', { name: 'Отменить' })).toBeTruthy();
  });

  it('на тёмном хроме получает отдельный класс', () => {
    const { container: light } = render(<OutlineButton label="Отменить" tone={tone} onClick={() => {}} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<OutlineButton label="Отменить" tone={tone} onDark onClick={() => {}} />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('OutlineButton, размер', () => {
  it('компактный получает отдельный класс от обычного', () => {
    const { container: regular } = render(<OutlineButton label="Готово" onClick={() => {}} />);
    const regularClass = regular.firstElementChild?.className ?? '';
    cleanup();

    const { container: compact } = render(<OutlineButton label="Готово" size="compact" onClick={() => {}} />);
    expect(compact.firstElementChild?.className).not.toBe(regularClass);
  });
});

describe('OutlineButton, состояния', () => {
  it('вызывает onClick по клику', () => {
    const onClick = vi.fn();
    render(<OutlineButton label="Применить" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled отключает кнопку и не вызывает onClick', () => {
    const onClick = vi.fn();
    render(<OutlineButton label="Применить" disabled onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'Применить' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('получает фокус по клавиатуре (focus-visible через CSS-класс root)', () => {
    render(<OutlineButton label="Применить" onClick={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Применить' });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('без onClick рендерит неинтерактивный элемент', () => {
    render(<OutlineButton label="Только текст" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Только текст')).toBeTruthy();
  });
});
