import React from 'react';

import styles from './BreadcrumbPath.module.css';

export interface BreadcrumbPathProps {
  /** Строка пути, сегменты разделены символом `›` (напр. «Акт II › слот Д5в › Б5 «Ссора»»). */
  path: string;
  /** Выделять последний сегмент жирным — это текущее место в пути. */
  bold?: boolean;
  /** Размер шрифта, px. */
  size?: number;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/BreadcrumbPath.dc.html` (atoms.json#BreadcrumbPath).
 * Хлебная крошка чертёжного пути: сегменты через «›», последний сегмент —
 * текущее место — подсвечен акцентным цветом и, по умолчанию, жирным.
 */
const BreadcrumbPath = ({ path, bold = true, size = 10.5, onDark = false }: BreadcrumbPathProps) => {
  const segments = path
    .split('›')
    .map(segment => segment.trim())
    .filter(Boolean);

  const rootClass = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClass} style={{ fontSize: `${size}px` }}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const segmentClass = [styles.segment, isLast ? styles.current : '', isLast && bold ? styles.bold : '']
          .filter(Boolean)
          .join(' ');

        return (
          <React.Fragment key={`${index}-${segment}`}>
            {index > 0 && (
              <span className={styles.separator} aria-hidden="true">
                ›
              </span>
            )}
            <span className={segmentClass}>{segment}</span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default BreadcrumbPath;
