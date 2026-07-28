import React from 'react';

import BriefFieldCard from './BriefFieldCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BriefFieldCard';

export const cases: GalleryCase[] = [
  {
    title: 'пусто',
    node: <BriefFieldCard kicker="КАСТ" state="empty" placeholder="заполните поле — чек-лист зоны отметит его ✓" />,
  },
  {
    title: 'авто · не задано',
    node: <BriefFieldCard kicker="СТИЛЬ КАДРА" state="auto" />,
  },
  {
    title: 'авто · решено в прогоне',
    node: <BriefFieldCard kicker="СТИЛЬ КАДРА" state="auto" value="акварель, мягкий свет" />,
  },
  {
    title: 'заполняется',
    node: (
      <BriefFieldCard kicker="ЛОГЛАЙН И ТОН" state="filling" value="Летняя история о возвращении в городок детства" />
    ),
  },
  {
    title: 'предложено',
    node: (
      <BriefFieldCard
        kicker="ЛОГЛАЙН И ТОН"
        state="proposed"
        value="Летняя история о возвращении в городок детства · тон: тёплый, без иронии"
      />
    ),
  },
  {
    title: 'готово · текст',
    node: (
      <BriefFieldCard
        kicker="ЛОГЛАЙН И ТОН"
        state="done"
        value="Летняя история о возвращении в городок детства · тон: тёплый, без иронии"
      />
    ),
  },
  {
    title: 'готово · календарь',
    node: <BriefFieldCard kicker="КАЛЕНДАРЬ" state="done" kind="calendar" days={7} parts={3} />,
  },
  {
    title: 'с директивой из заметок',
    node: (
      <BriefFieldCard
        kicker="ТОН"
        state="done"
        value="тёплый, без иронии"
        directive="держать тепло даже в конфликтных сценах"
      />
    ),
  },
  {
    title: 'с подсказкой',
    node: (
      <BriefFieldCard
        kicker="ЛЮБОВНАЯ ЛИНИЯ"
        state="done"
        value="сосед по крыльцу"
        hint="видно в чек-листе зоны «Замысел»"
      />
    ),
  },
];
