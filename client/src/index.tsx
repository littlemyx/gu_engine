import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';

import App from '@/App';
import { initNarrative } from '@/narrative/initNarrative';
import { bootProject } from '@/project/bootProject';
import '@/assets/css/reset.css';
import '@/assets/css/helpers.css';
import '@/assets/css/industry.css';

// Проект вкладки отмечается в реестре до рендера: пикер в соседней вкладке
// должен видеть его сразу, а не после первого сохранения.
bootProject();
// Незавершённые генерации (календарный прогон, медиа-батчи) дожимаются до
// рендера: их состояние живёт в сторе, UI ничего не проверяет сам.
initNarrative();

const container = document.getElementById('root');
const root = createRoot(container!);
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
root.render(app);
