import React from 'react';

import Glyph from '../atoms/Glyph';
import MonoText from '../atoms/MonoText';

import styles from './IssueRoute.module.css';

export interface IssueRouteLine {
  text: string;
}

export interface IssueRouteProps {
  /** Строки маршрута: зона → идентификатор дубля → куда осядет фидбек. */
  lines: IssueRouteLine[];
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/IssueRoute.dc.html` (molecules.json#k091 «МАРШРУТ ПРОБЛЕМЫ»).
 * Моноширинная хлебная крошка: путь фидбека по конвейеру. Сегменты строки —
 * атом `MonoText`, стрелки между ними — атом `Glyph`, оба приглушены тоном `muted`.
 */
const IssueRoute = ({ lines, onDark = false }: IssueRouteProps) => (
  <div className={styles.root}>
    {lines.map((line, lineIndex) => {
      const segments = line.text.split('→');

      return (
        <div className={styles.line} key={lineIndex}>
          {segments.map((segment, segmentIndex) => (
            <React.Fragment key={segmentIndex}>
              {segment !== '' && <MonoText text={segment} onDark={onDark} muted size={9.5} />}
              {segmentIndex < segments.length - 1 && <Glyph glyph="→" tone="muted" onDark={onDark} size={9.5} />}
            </React.Fragment>
          ))}
        </div>
      );
    })}
  </div>
);

export default IssueRoute;
