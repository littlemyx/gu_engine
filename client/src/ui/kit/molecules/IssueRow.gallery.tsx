import React from 'react';

import IssueRow from './IssueRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'IssueRow';

export const cases: GalleryCase[] = [
  { title: 'блокер', node: <IssueRow text="2 юнита без прозы — держат гейт" kind="blocker" /> },
  {
    title: 'блокер · с действием',
    node: <IssueRow text="2 юнита без прозы — держат гейт" kind="blocker" action="→ Проза · ≈$0.16" />,
  },
  {
    title: 'предупреждение · с действием',
    node: (
      <IssueRow
        text="D4-критик: «Кира обращается на вы» · unit_kira_s2_pier"
        kind="warning"
        action="→ Проза · дубль ≈$0.08"
      />
    ),
  },
  {
    title: 'кастомный бейдж',
    node: <IssueRow text="ветка не совпадает с базовой" kind="warning" badge="ВЕТКА" />,
  },
  {
    title: 'выделена',
    node: <IssueRow text="2 юнита без прозы — держат гейт" kind="blocker" selected action="→ Проза · ≈$0.16" />,
  },
  {
    title: 'кликабельна',
    node: (
      <IssueRow text="2 юнита без прозы — держат гейт" kind="blocker" action="→ Проза · ≈$0.16" onClick={() => {}} />
    ),
  },
];
