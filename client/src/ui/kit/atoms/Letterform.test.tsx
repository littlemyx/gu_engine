/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Letterform, { type LetterformVariant } from './Letterform';

afterEach(cleanup);

const VARIANTS: LetterformVariant[] = ['outline', 'filled'];

describe.each(VARIANTS)('Letterform, вид %s', variant => {
  it('показывает литеру', () => {
    render(<Letterform letter="Б4" variant={variant} />);

    expect(screen.getByText('Б4')).toBeTruthy();
  });

  it('выделенное состояние получает отдельный класс', () => {
    const { container: plain } = render(<Letterform letter="A" variant={variant} />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: selected } = render(<Letterform letter="A" variant={variant} selected />);
    expect(selected.firstElementChild?.className).not.toBe(plainClass);
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<Letterform letter="A" variant={variant} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Letterform letter="A" variant={variant} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('Letterform, размер', () => {
  it('прокидывает size в CSS-переменную квадрата', () => {
    const { container } = render(<Letterform letter="A" size={30} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--letterform-size')).toBe('30px');
  });

  it('по умолчанию — 22px', () => {
    const { container } = render(<Letterform letter="A" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--letterform-size')).toBe('22px');
  });
});

describe('Letterform, интерактивность', () => {
  it('с onClick рендерится кнопкой и вызывает колбэк', () => {
    const onClick = vi.fn();
    render(<Letterform letter="A" onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'A' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('без onClick кнопки нет', () => {
    render(<Letterform letter="A" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
