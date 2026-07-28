/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MenuItem, { type MenuItemMark } from './MenuItem';

afterEach(cleanup);

const MARKS: MenuItemMark[] = ['none', 'check', 'radio'];
const MARK_GLYPH: Record<MenuItemMark, string> = { none: '', check: '✓', radio: '•' };

describe.each(MARKS)('MenuItem, mark %s', mark => {
  it('показывает лейбл и нужный глиф', () => {
    render(<MenuItem label="Сгенерировать сцену" mark={mark} onClick={() => {}} />);

    const btn = screen.getByRole('button', { name: /Сгенерировать сцену/ });
    expect(btn.textContent).toContain(MARK_GLYPH[mark]);
  });
});

describe('MenuItem, содержимое', () => {
  it('печатает смету и хоткей', () => {
    render(<MenuItem label="Экспорт" price="120₽" hotkey="⌘E" onClick={() => {}} />);

    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('120₽');
    expect(btn.textContent).toContain('⌘E');
  });

  it('без цены и хоткея не печатает их', () => {
    render(<MenuItem label="Экспорт" onClick={() => {}} />);

    const btn = screen.getByRole('button');
    expect(btn.textContent).toBe('Экспорт');
  });

  it('separator рисует волосяную линию отдельным узлом', () => {
    const { container } = render(<MenuItem label="Новая группа" separator onClick={() => {}} />);

    const sep = container.querySelector('[aria-hidden="true"]');
    expect(sep).toBeTruthy();
    expect(container.firstElementChild?.children.length).toBe(2);
  });
});

describe('MenuItem, hot', () => {
  it('получает отдельный класс от обычного', () => {
    render(<MenuItem label="Пункт" onClick={() => {}} />);
    const plainClass = screen.getByRole('button').className;
    cleanup();

    render(<MenuItem label="Пункт" hot onClick={() => {}} />);
    expect(screen.getByRole('button').className).not.toBe(plainClass);
  });
});

describe('MenuItem, на тёмном', () => {
  it('получает отдельный класс от светлого', () => {
    const { container: light } = render(<MenuItem label="Пункт" onClick={() => {}} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<MenuItem label="Пункт" onDark onClick={() => {}} />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('MenuItem, состояния', () => {
  it('вызывает onClick по клику', () => {
    const onClick = vi.fn();
    render(<MenuItem label="Применить" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled отключает кнопку и не вызывает onClick', () => {
    const onClick = vi.fn();
    render(<MenuItem label="Применить" disabled onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'Применить' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('без onClick рендерит неинтерактивный элемент', () => {
    render(<MenuItem label="Только текст" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Только текст')).toBeTruthy();
  });
});
