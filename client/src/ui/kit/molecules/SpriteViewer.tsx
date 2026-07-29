import React from 'react';

import Badge from '../atoms/Badge';
import CheckerBg from '../atoms/CheckerBg';
import Glyph from '../atoms/Glyph';
import MonoText from '../atoms/MonoText';

import styles from './SpriteViewer.module.css';

export interface SpriteViewerProps {
  /** Подпись бейджа в углу превью, например «прозрачный PNG · хромакей снят». Пусто — бейдж не рисуется. */
  badge?: string;
  /** Служебные строки под превью, разделённые «;»: путь, ключ файла и т.п. Пусто — подпись не рисуется. */
  caption?: string;
  /** Ширина превью, px (140–400 в макете); высота считается от соотношения сторон 2:3. */
  width?: number;
}

/**
 * Порт `design_ref/components/SpriteViewer.dc.html` (molecules.json#p002,
 * «ПРОСМОТРЩИК СПРАЙТА (шахматка + бейдж-оверлей)»). Превью прозрачного PNG на
 * шахматной подложке `CheckerBg`: символ спрайта `Glyph` внизу по центру,
 * необязательный статус-бейдж `Badge` в верхнем правом углу, под превью —
 * моноширинные служебные строки `MonoText` (путь, ключ файла), по одной на
 * `caption`, разбитый по «;».
 */
const SpriteViewer = ({
  badge = 'прозрачный PNG · хромакей снят',
  caption = ':3007/images/mia_happy.png;poseFilenames.happy',
  width = 220,
}: SpriteViewerProps) => {
  const hasBadge = Boolean(badge);
  const glyphSize = Math.round(width * 0.5);
  const height = Math.round(width * 1.5);
  const captionLines = caption
    .split(';')
    .map(line => line.trim())
    .filter(Boolean);
  const hasCaption = captionLines.length > 0;

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <CheckerBg width={width} height={height} cell={16} framed>
        <span className={styles.stage}>
          <Glyph glyph="◐" tone="accent" size={glyphSize} />
        </span>
        {hasBadge && (
          <span className={styles.badgeSlot}>
            <Badge label={badge} tone="neutral" />
          </span>
        )}
      </CheckerBg>
      {hasCaption && (
        <div className={styles.caption}>
          {captionLines.map((line, index) => (
            <div key={`${line}-${index}`} className={styles.captionLine}>
              <MonoText text={line} muted size={10} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpriteViewer;
