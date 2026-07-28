/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MenuBar, { type MenuBarMenu } from './MenuBar';

afterEach(cleanup);

const MENUS: MenuBarMenu[] = [
  {
    name: 'Файл',
    items: [
      { label: 'Создать проект', hotkey: '⌘N' },
      { label: 'Открыть…', hotkey: '⌘O' },
      { label: 'Экспорт сборки…', hotkey: '⇧⌘E', separator: true },
    ],
  },
  {
    name: 'Прогон',
    items: [
      { label: 'Сгенерировать сцену', hotkey: '⌘G', price: '≈$0.04' },
      { label: 'Строгий режим', mark: 'check' },
      { label: 'Заблокировано', disabled: true },
    ],
  },
];

describe('MenuBar, состав бара', () => {
  it('показывает логотип, столбцы меню и имя проекта', () => {
    render(<MenuBar items={MENUS} project="Лето на Взморье.guproj" />);

    expect(screen.getByText('GU Engine')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Файл' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Прогон' })).toBeTruthy();
    expect(screen.getByText('Лето на Взморье.guproj')).toBeTruthy();
  });

  it('без project ничего не печатает справа', () => {
    render(<MenuBar items={MENUS} />);

    expect(screen.queryByText(/guproj/)).toBeNull();
  });

  it('logoText переопределяет надпись логотипа', () => {
    render(<MenuBar items={MENUS} logoText="Студия" />);

    expect(screen.getByText('Студия')).toBeTruthy();
  });
});

describe('MenuBar, открытие столбца', () => {
  it('пункты столбца скрыты, пока он не открыт', () => {
    render(<MenuBar items={MENUS} />);

    expect(screen.queryByText('Создать проект')).toBeNull();
  });

  it('клик по заголовку открывает его столбец', () => {
    render(<MenuBar items={MENUS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Файл' }));
    expect(screen.getByText('Создать проект')).toBeTruthy();
  });

  it('повторный клик по тому же заголовку закрывает столбец', () => {
    render(<MenuBar items={MENUS} />);

    const trigger = screen.getByRole('button', { name: 'Файл' });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByText('Создать проект')).toBeNull();
  });

  it('открытие другого столбца закрывает предыдущий', () => {
    render(<MenuBar items={MENUS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Файл' }));
    fireEvent.click(screen.getByRole('button', { name: 'Прогон' }));

    expect(screen.queryByText('Создать проект')).toBeNull();
    expect(screen.getByText('Сгенерировать сцену')).toBeTruthy();
  });

  it('Escape закрывает открытый столбец', () => {
    render(<MenuBar items={MENUS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Файл' }));
    expect(screen.getByText('Создать проект')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Создать проект' }), { key: 'Escape' });
    expect(screen.queryByText('Создать проект')).toBeNull();
  });
});

describe('MenuBar, active', () => {
  it('active-столбец получает отдельный класс от обычного', () => {
    render(<MenuBar items={MENUS} />);
    const plainClass = screen.getByRole('button', { name: 'Прогон' }).className;
    cleanup();

    render(<MenuBar items={MENUS} active="Прогон" />);
    expect(screen.getByRole('button', { name: 'Прогон' }).className).not.toBe(plainClass);
  });
});

describe('MenuBar, выбор пункта', () => {
  it('клик по пункту вызывает onPick с именем столбца и лейблом, и закрывает столбец', () => {
    const onPick = vi.fn();
    render(<MenuBar items={MENUS} onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Прогон' }));
    fireEvent.click(screen.getByRole('button', { name: /Сгенерировать сцену/ }));

    expect(onPick).toHaveBeenCalledWith('Прогон', 'Сгенерировать сцену');
    expect(screen.queryByText('Сгенерировать сцену')).toBeNull();
  });

  it('без onPick пункты рендерятся неинтерактивными', () => {
    render(<MenuBar items={MENUS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Файл' }));
    expect(screen.queryByRole('button', { name: /Создать проект/ })).toBeNull();
    expect(screen.getByText('Создать проект')).toBeTruthy();
  });

  it('disabled-пункт не вызывает onPick', () => {
    const onPick = vi.fn();
    render(<MenuBar items={MENUS} onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Прогон' }));
    const btn = screen.getByRole('button', { name: 'Заблокировано' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fireEvent.click(btn);
    expect(onPick).not.toHaveBeenCalled();
  });
});
