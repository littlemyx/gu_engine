import React from 'react';

import BriefGenPanel from './BriefGenPanel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BriefGenPanel';

const NOTES =
  'маяк на краю городка; героиня возвращается после училища; вайб — тёплое электричество перед грозой; Кира — колючая, но верная';

const DIRECTIVES = [
  { target: 'тон', text: 'тёплый, без иронии' },
  { target: 'сеттинг', text: 'маяк, приморский городок' },
  { target: 'LI Кира', text: 'колючая, но верная' },
];

export const cases: GalleryCase[] = [
  {
    title: 'заметки (idle)',
    node: <BriefGenPanel phase="idle" notes={NOTES} price="≈$0.04" />,
  },
  {
    title: 'разбор заметок (parsing)',
    node: <BriefGenPanel phase="parsing" notes={NOTES} directives={DIRECTIVES} />,
  },
  {
    title: 'заполнение (filling)',
    node: <BriefGenPanel phase="filling" notes={NOTES} directives={DIRECTIVES} gaps={9} filled={6} />,
  },
  {
    title: 'заполнение, с отброшенными директивами',
    node: <BriefGenPanel phase="filling" notes={NOTES} directives={DIRECTIVES} gaps={9} filled={6} droppedCount="2" />,
  },
  {
    title: 'готово (done)',
    node: <BriefGenPanel phase="done" notes={NOTES} directives={DIRECTIVES} gaps={9} filled={9} />,
  },
  {
    title: 'ретрай (retry)',
    node: <BriefGenPanel phase="retry" notes={NOTES} directives={DIRECTIVES} attempt="2/3" />,
  },
  {
    title: 'подробность 1/5',
    node: <BriefGenPanel phase="idle" notes={NOTES} verbosity={1} price="≈$0.02" />,
  },
  {
    title: 'подробность 5/5',
    node: <BriefGenPanel phase="idle" notes={NOTES} verbosity={5} price="≈$0.07" />,
  },
  {
    title: 'узкая панель, width 420',
    node: <BriefGenPanel phase="idle" notes="черновая заметка, ещё почти пусто" width={420} />,
  },
];
