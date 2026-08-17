import React from 'react';
import { RouteObject } from 'react-router-dom';
import Layout from '@/pages/layout';
import Main from '@/pages/main';
import Playground from '@/pages/playground';
import Studio from '@/pages/studio';
import KitGallery from '@/pages/studio/KitGallery';
import StudioNext from '@/pages/studio/next';
import NotFound from '@/pages/NotFound';
import ProjectGate from '@/project/ProjectGate';

export default [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Main /> },
      // Конвейерный шелл занял основной адрес (M7-врезка); /playground —
      // исторический алиас того же экрана, /studio-next — адрес стройки,
      // оставлен ради закладок и открытых вкладок.
      // ProjectGate: без ?project=<id> вкладка показывает выбор проекта.
      {
        path: 'studio',
        element: (
          <ProjectGate>
            <StudioNext />
          </ProjectGate>
        ),
      },
      {
        path: 'playground',
        element: (
          <ProjectGate>
            <StudioNext />
          </ProjectGate>
        ),
      },
      {
        path: 'studio-next',
        element: (
          <ProjectGate>
            <StudioNext />
          </ProjectGate>
        ),
      },
      // Старый IDE-шелл — донор ещё не перенесённых кусков (запуск
      // медиа-дорожек живёт пока только здесь).
      {
        path: 'studio-legacy',
        element: (
          <ProjectGate>
            <Studio />
          </ProjectGate>
        ),
      },
      { path: 'playground-legacy', element: <Playground /> },
      // Витрина кита: проект не нужен, ProjectGate не оборачиваем.
      { path: 'studio/kit', element: <KitGallery /> },
    ],
  },
  {
    path: '/*',
    element: <NotFound />,
  },
] as RouteObject[];
