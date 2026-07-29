import React from 'react';

import EstimateRow from './EstimateRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'EstimateRow';

export const cases: GalleryCase[] = [
  {
    title: 'position — позиция верхнего уровня',
    node: (
      <EstimateRow
        kind="position"
        text="Проза бита Б5 «Ссора» — изменился Б4 · каскад: 2 потомка ниже"
        price="≈$0.02"
        status="stale"
      />
    ),
  },
  {
    title: 'position — свежая',
    node: <EstimateRow kind="position" text="Проза бита Б3 «Отъезд»" price="≈$0.01" status="fresh" />,
  },
  {
    title: 'cascade — вложенный потомок',
    node: <EstimateRow kind="cascade" text="unit_kira_s2_pier · каскад от Б5" price="≈$0.08" />,
  },
  {
    title: 'cascade — вторая ступень отступа',
    node: <EstimateRow kind="cascade" text="unit_kira_s3_dock · каскад от Б6" price="≈$0.05" indentLevel={2} />,
  },
  {
    title: 'group — свёрнутая группа',
    node: <EstimateRow kind="group" text="ещё 7 позиций" onClick={() => {}} />,
  },
  {
    title: 'locked — залочено, пропускаем',
    node: <EstimateRow kind="locked" text="Залочено — пропускаем · 3 позиции · переживают любой каскад" price="$0" />,
  },
  {
    title: 'frame: bottom — разделитель списка',
    node: <EstimateRow kind="cascade" text="unit_kira_s2_pier · каскад от Б5" price="≈$0.08" frame="bottom" />,
  },
  {
    title: 'frame: none — без обвода',
    node: <EstimateRow kind="cascade" text="unit_kira_s2_pier · каскад от Б5" price="≈$0.08" frame="none" />,
  },
  {
    title: 'кликабельная строка',
    node: <EstimateRow kind="position" text="Концовки — 2 позиции" price="≈$0.30" onClick={() => {}} />,
  },
];
