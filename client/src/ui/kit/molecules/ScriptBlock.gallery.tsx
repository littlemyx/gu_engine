import React from 'react';

import ScriptBlock, { type ScriptRow } from './ScriptBlock';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ScriptBlock';

const fullScene: ScriptRow[] = [
  {
    kind: 'prose',
    id: 'p1',
    text: 'Лампы над стойкой уже притушены; Кира протирает кофемашину так, будто это ритуал прощания с днём.',
    annotation: ['сцена: unit_kira_s3', 'селектор: ступень › сюжет › филлер'],
  },
  {
    kind: 'speech',
    id: 's1',
    name: 'Кира',
    emotion: 'смущённо',
    text: 'Ты правда помнишь, что я люблю лаванду?',
    annotation: ['спрайт: kira_shy · муз.: тёплая'],
  },
  {
    kind: 'choice',
    id: 'c1',
    lead: 'Выбран тёплый:',
    text: '«Конечно помню. Ты рассказывала в мой первый день здесь.»',
    hint: '(нейтральный свёрнут ›)',
    annotation: ['trust(kira) 0.40 → 0.50 · выделено'],
    annotationTone: 'accent',
  },
  {
    kind: 'speech',
    id: 's2',
    name: 'Кира',
    emotion: 'тепло',
    text: '…Никому раньше не рассказывала про галерею. Отец до сих пор думает, что я готовлюсь к его кафедре.',
    annotation: ['flag(gallery_secret)'],
    annotationTone: 'accent',
  },
  {
    kind: 'prose',
    id: 'p2',
    text: 'Прощание: «Увидимся! Забегай завтра — суббота, будет тише.»',
    farewell: true,
    annotation: ['фаза вечера потрачена'],
  },
];

export const cases: GalleryCase[] = [
  {
    title: 'полная сцена (переход · проза · реплики · выбор)',
    node: (
      <ScriptBlock
        heading="День 3 · вечер · кафе «Прибой»"
        rows={[{ kind: 'transition', id: 't0', text: 'Вечер, кафе «Прибой»' }, ...fullScene]}
      />
    ),
  },
  {
    title: 'переход',
    node: (
      <ScriptBlock heading="День 4 · утро" rows={[{ kind: 'transition', id: 't1', text: 'Утро следующего дня' }]} />
    ),
  },
  {
    title: 'проза',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        rows={[{ kind: 'prose', id: 'p1', text: 'Лампы над стойкой уже притушены.' }]}
      />
    ),
  },
  {
    title: 'проза · прощание',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        rows={[{ kind: 'prose', id: 'p2', text: 'Увидимся! Забегай завтра.', farewell: true }]}
      />
    ),
  },
  {
    title: 'реплика · с эмоцией',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        rows={[{ kind: 'speech', id: 's1', name: 'Кира', emotion: 'смущённо', text: 'Ты правда помнишь?' }]}
      />
    ),
  },
  {
    title: 'реплика · без эмоции',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        rows={[{ kind: 'speech', id: 's2', name: 'Дэн', text: 'Привет. Как дела?' }]}
      />
    ),
  },
  {
    title: 'выбор',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        rows={[
          {
            kind: 'choice',
            id: 'c1',
            lead: 'Выбран тёплый:',
            text: '«Конечно помню. Ты рассказывала в мой первый день здесь.»',
            hint: '(нейтральный свёрнут ›)',
          },
        ]}
      />
    ),
  },
  {
    title: 'аннотация · приглушённая',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        rows={[
          {
            kind: 'prose',
            id: 'p3',
            text: 'Лампы притушены.',
            annotation: ['сцена: unit_kira_s3', 'селектор: ступень › сюжет'],
          },
        ]}
      />
    ),
  },
  {
    title: 'аннотация · акцентная',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        rows={[
          {
            kind: 'speech',
            id: 's3',
            name: 'Кира',
            text: '…Никому раньше не рассказывала про галерею.',
            annotation: ['flag(gallery_secret)'],
            annotationTone: 'accent',
          },
        ]}
      />
    ),
  },
  {
    title: 'узкая колонка аннотаций (annotationWidth=120)',
    node: (
      <ScriptBlock
        heading="День 3 · вечер"
        annotationWidth={120}
        rows={[
          { kind: 'prose', id: 'p4', text: 'Компактный вариант с узкой колонкой заметок.', annotation: ['id: p4'] },
        ]}
      />
    ),
  },
];
