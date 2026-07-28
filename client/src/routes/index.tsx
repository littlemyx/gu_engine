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
      // Шелл «Планирование и генерация» занял основной адрес; старый
      // плейграунд остался под -legacy, пока из него не вычерпают остатки.
      // ProjectGate: без ?project=<id> вкладка показывает выбор проекта.
      {
        path: 'playground',
        element: (
          <ProjectGate>
            <Studio />
          </ProjectGate>
        ),
      },
      {
        path: 'studio',
        element: (
          <ProjectGate>
            <Studio />
          </ProjectGate>
        ),
      },
      { path: 'playground-legacy', element: <Playground /> },
      // Витрина кита: проект не нужен, ProjectGate не оборачиваем.
      { path: 'studio/kit', element: <KitGallery /> },
      // Конвейерный шелл строится на отдельном адресе: рабочая студия не
      // должна падать из-за наполовину собранного экрана.
      {
        path: 'studio-next',
        element: (
          <ProjectGate>
            <StudioNext />
          </ProjectGate>
        ),
      },
    ],
  },
  {
    path: '/*',
    element: <NotFound />,
  },
] as RouteObject[];
