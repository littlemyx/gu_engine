import React from 'react';

import styles from './CollapsedPanel.module.css';

export interface CollapsedPanelProps {
  /** С какой стороны сетки стоит полоска — от этого зависит бордер и стрелка. */
  side: 'left' | 'right';
  label: string;
  /** В свёрнутой панели есть непросмотренное (ошибка, готовый батч) — точка. */
  attention?: boolean;
  onExpand: () => void;
}

/**
 * Свёрнутая боковая панель. Она не исчезает и не превращается в плавающую
 * кнопку поверх вьюпорта: панель остаётся колонкой сетки, просто узкой —
 * с вертикальной подписью, по которой видно, что именно свёрнуто.
 */
const CollapsedPanel = ({ side, label, attention = false, onExpand }: CollapsedPanelProps) => (
  <button
    type="button"
    className={`${styles.strip} ${side === 'left' ? styles.left : styles.right}`}
    onClick={onExpand}
    // Без title: подпись уже написана на самой полоске, а системный тултип
    // всплывал бы серым прямоугольником поверх вьюпорта.
    aria-label={`Развернуть панель «${label}»${attention ? ' — есть непросмотренное' : ''}`}
    aria-expanded={false}
  >
    <span className={styles.chevron}>{side === 'left' ? '›' : '‹'}</span>
    <span className={styles.label}>{label}</span>
    {attention && <span className={styles.dot} aria-hidden="true" />}
  </button>
);

export default CollapsedPanel;
