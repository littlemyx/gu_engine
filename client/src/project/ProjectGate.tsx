import React from 'react';

import ProjectPicker from './ProjectPicker';
import { isBound } from './projectScope';

/**
 * Шлюз проекта: студия монтируется, только если вкладка привязана к проекту.
 *
 * Проверка стоит НАД студией, а не внутри неё, намеренно: без ?project= сторы
 * пишут в неймспейс-заглушку, и любой смонтированный хук студии оставил бы там
 * мусор. Пикер же не читает проектных сторов вовсе.
 */
const ProjectGate = ({ children }: { children: React.ReactNode }) => (isBound ? <>{children}</> : <ProjectPicker />);

export default ProjectGate;
