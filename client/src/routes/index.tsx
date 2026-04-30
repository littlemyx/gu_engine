import React from 'react';
import { RouteObject } from 'react-router-dom';
import Layout from '@/pages/layout';
import Main from '@/pages/main';
import Playground from '@/pages/playground';
import NotFound from '@/pages/NotFound';

export default [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Main /> },
      { path: 'playground', element: <Playground /> },
    ],
  },
  {
    path: '/*',
    element: <NotFound />,
  },
] as RouteObject[];
