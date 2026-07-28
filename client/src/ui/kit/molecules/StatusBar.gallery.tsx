import React from 'react';

import StatusBar from './StatusBar';

import type { GalleryCase } from '../galleryTypes';

export const title = 'StatusBar';

export const cases: GalleryCase[] = [
  {
    title: 'idle',
    dark: true,
    node: (
      <StatusBar
        items={[
          { text: 'черновик сохранён 12:41' },
          { text: 'слотов 21 · событий 34' },
          { text: 'QA: не запускался после правок' },
        ]}
        right="seed 12345"
      />
    ),
  },
  {
    title: 'running',
    dark: true,
    node: (
      <StatusBar
        items={[{ text: 'прогон идёт · 2 мин 14 с', glyph: '⟳', tone: 'info' }, { text: 'автосохранение 8 с назад' }]}
        right="seed 12345 · web-lock: эта вкладка ведёт прогон"
      />
    ),
  },
  {
    title: 'paused',
    dark: true,
    node: (
      <StatusBar
        items={[
          { text: 'чекпоинт · пауза после порции', glyph: '⏸', tone: 'info', emphasis: true },
          { text: 'прогон ждёт решения — раши уже читаются' },
        ]}
        right="seed 12345 · прогон не убит"
      />
    ),
  },
  {
    title: 'blocked',
    dark: true,
    node: (
      <StatusBar
        items={[
          { text: 'экспорт заблокирован', glyph: '⛔', tone: 'error', emphasis: true },
          { text: 'QA: 1 ошибка · 3 предупреждения', tone: 'error' },
          { text: 'слотов 21 · событий 34' },
        ]}
        right="seed 12345"
      />
    ),
  },
  {
    title: 'empty',
    dark: true,
    node: <StatusBar items={[{ text: 'черновик пуст' }, { text: 'потрачено $0.00' }]} right="seed —" />,
  },
  {
    title: 'тон warn',
    dark: true,
    node: <StatusBar items={[{ text: 'приближение к лимиту сметы', tone: 'warn' }]} right="потрачено $4.80" />,
  },
  {
    title: 'один сегмент, без правой сводки',
    dark: true,
    node: <StatusBar items={[{ text: 'готово к экспорту', tone: 'accent' }]} />,
  },
];
