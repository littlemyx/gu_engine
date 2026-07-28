import React from 'react';

import MenuBar, { type MenuBarMenu } from './MenuBar';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MenuBar';

const MENUS: MenuBarMenu[] = [
  {
    name: 'Файл',
    items: [
      { label: 'Создать проект', hotkey: '⌘N' },
      { label: 'Открыть…', hotkey: '⌘O' },
      { label: 'Сохранить', hotkey: '⌘S' },
      { label: 'Экспорт сборки…', hotkey: '⇧⌘E', separator: true },
    ],
  },
  {
    name: 'Правка',
    items: [
      { label: 'Отменить', hotkey: '⌘Z' },
      { label: 'Повторить', hotkey: '⇧⌘Z' },
      { label: 'Найти в проекте', hotkey: '⌘F', separator: true },
    ],
  },
  {
    name: 'Проект',
    items: [
      { label: 'Настройки зоны…' },
      { label: 'Словарь токенов…' },
      { label: 'Пересобрать индекс', hotkey: '⌥⌘R', separator: true },
    ],
  },
  {
    name: 'Прогон',
    items: [
      { label: 'Сгенерировать сцену', hotkey: '⌘G', price: '≈$0.04' },
      { label: 'Прогнать акт', hotkey: '⇧⌘G', price: '≈$0.31' },
      { label: 'Строгий режим', mark: 'check', separator: true },
      { label: 'Только черновики', mark: 'radio' },
      { label: 'Недоступно пока', disabled: true },
    ],
  },
];

export const cases: GalleryCase[] = [
  {
    title: 'закрыт',
    dark: true,
    node: <MenuBar items={MENUS} project="Лето на Взморье.guproj" />,
  },
  {
    title: 'столбец «Прогон» подсвечен как активный',
    dark: true,
    node: <MenuBar items={MENUS} active="Прогон" project="Лето на Взморье.guproj" />,
  },
  {
    title: 'без имени проекта',
    dark: true,
    node: <MenuBar items={MENUS} />,
  },
  {
    title: 'кастомный логотип и onPick подключён',
    dark: true,
    node: <MenuBar items={MENUS} logoText="Студия" onPick={() => {}} project="черновик.guproj" />,
  },
];
