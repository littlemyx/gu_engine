import React from 'react';

import RoleCard from './RoleCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RoleCard';

export const cases: GalleryCase[] = [
  {
    title: 'linked · есть обновление (кликабельный diff)',
    node: (
      <RoleCard
        slot="LI-1"
        roleName="Кира"
        cast="linked"
        castLabel="префаб «Кира» v2"
        note="2 оверрайда: speechPattern, палитра"
        hasUpdate
        updateLabel="есть v3 · diff ▾"
        onDiff={() => {}}
      />
    ),
  },
  {
    title: 'linked · без обновления',
    node: (
      <RoleCard
        slot="LI-1"
        roleName="Кира"
        cast="linked"
        castLabel="префаб «Кира» v2"
        note="2 оверрайда: speechPattern, палитра"
        hasUpdate={false}
      />
    ),
  },
  {
    title: 'linked · выделена',
    node: (
      <RoleCard slot="LI-1" roleName="Кира" cast="linked" castLabel="префаб «Кира» v2" hasUpdate={false} selected />
    ),
  },
  {
    title: 'manual · назначена руками',
    node: <RoleCard slot="LI-2" roleName="Феликс" cast="manual" note="правки диалога вручную" hasUpdate={false} />,
  },
  {
    title: 'generated · сгенерирована',
    node: <RoleCard slot="LI-3" roleName="Ада" cast="generated" note="" hasUpdate={false} />,
  },
  {
    title: 'unassigned · роль не назначена',
    node: <RoleCard slot="LI-4" roleName="???" cast="unassigned" note="" hasUpdate={false} />,
  },
];
