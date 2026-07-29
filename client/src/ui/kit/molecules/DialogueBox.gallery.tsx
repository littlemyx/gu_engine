import React from 'react';

import DialogueBox, { type DialogueChoice } from './DialogueBox';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DialogueBox';

const CHOICES: DialogueChoice[] = [
  { id: 'c1', text: 'Меня пугаешь только ты.' },
  { id: 'c2', text: '[молча смотреть]' },
];

export const cases: GalleryCase[] = [
  {
    title: 'ничего не выбрано, нерактивная (без onPick)',
    node: <DialogueBox speaker="Кира" line="Ты всё-таки пришёл. Я думала, шторм тебя напугал." choices={CHOICES} />,
    dark: true,
  },
  {
    title: 'интерактивная, ничего не выбрано',
    node: (
      <DialogueBox
        speaker="Кира"
        line="Ты всё-таки пришёл. Я думала, шторм тебя напугал."
        choices={CHOICES}
        onPick={() => {}}
      />
    ),
    dark: true,
  },
  {
    title: 'выбран первый вариант',
    node: (
      <DialogueBox
        speaker="Кира"
        line="Ты всё-таки пришёл. Я думала, шторм тебя напугал."
        choices={CHOICES}
        selectedIndex={0}
        onPick={() => {}}
      />
    ),
    dark: true,
  },
  {
    title: 'выбран второй вариант, три реплики',
    node: (
      <DialogueBox
        speaker="Смотритель маяка"
        line="Свет погас в третий раз за неделю. Кто-то режет провода."
        choices={[
          { id: 'c1', text: 'Я разберусь.' },
          { id: 'c2', text: 'Может, само собой.' },
          { id: 'c3', text: '[уйти, не ответив]' },
        ]}
        selectedIndex={1}
        onPick={() => {}}
      />
    ),
    dark: true,
  },
];
