import React from 'react';

import MenuPanel, { type MenuPanelItem } from './MenuPanel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MenuPanel';

const RUN_ITEMS: MenuPanelItem[] = [
  { label: 'Сгенерировать план', hotkey: '⌘G' },
  { label: 'Продолжить черновик', hotkey: '⇧⌘G' },
  { label: 'Догенерировать выбранное', price: '≈$0.04' },
  { label: 'Остановить прогон', hotkey: '⌘.', disabled: true },
  { label: 'Проверить историю', hotkey: '⌘T', separator: true },
  { label: 'Сбросить черновик…', separator: true, disabled: true },
];

const STATE_ITEMS: MenuPanelItem[] = [
  { label: 'Строгий режим', mark: 'check' },
  { label: 'Только черновики', mark: 'radio' },
  { label: 'Активная сцена', hot: true, separator: true },
  { label: 'Недоступно пока', disabled: true },
];

export const cases: GalleryCase[] = [
  {
    title: 'с заголовком, набор пунктов «Генерация»',
    dark: true,
    node: <MenuPanel title="Генерация" items={RUN_ITEMS} onPick={() => {}} />,
  },
  {
    title: 'без заголовка',
    dark: true,
    node: <MenuPanel items={RUN_ITEMS} onPick={() => {}} />,
  },
  {
    title: 'галка, радио, персистентная подсветка, disabled',
    dark: true,
    node: <MenuPanel title="Опции" items={STATE_ITEMS} onPick={() => {}} />,
  },
  {
    title: 'без onPick — пункты неинтерактивны',
    dark: true,
    node: <MenuPanel title="Просмотр" items={RUN_ITEMS} />,
  },
  {
    title: 'узкая панель, width 200',
    dark: true,
    node: <MenuPanel title="Компактно" items={STATE_ITEMS} width={200} onPick={() => {}} />,
  },
];
