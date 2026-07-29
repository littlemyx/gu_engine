import React from 'react';

import MonoText from '../atoms/MonoText';
import MutedText from '../atoms/MutedText';
import ToneSurface from '../atoms/ToneSurface';

import styles from './PreviewInfoBar.module.css';

export interface PreviewInfoBarItem {
  /** Один сегмент строки: «превью: движок = релизный», «persist: off». */
  text: string;
}

export interface PreviewInfoBarProps {
  /** Сегменты слева направо, через тонкий пробел (без разделителя-черты). */
  items: PreviewInfoBarItem[];
  /** Служебная моноширинная сводка справа: seed, число снапшотов. */
  right?: string;
}

/**
 * Порт `design_ref/components/PreviewInfoBar.dc.html` (molecules.json#k068,
 * «ИНФО-БАР ПРЕВЬЮ»).
 * Тонкая служебная строка над вьюпортом превью-плеера: слева — параметры
 * запуска (какой движок, что с persist), справа — моноширинная сводка (seed,
 * число снапшотов). Строка всегда на тёмном хроме — `context` в исходнике не
 * варьируется, поэтому `onDark` здесь не нужен.
 */
const PreviewInfoBar = ({ items, right }: PreviewInfoBarProps) => {
  return (
    <div className={styles.root}>
      <ToneSurface tone="darkAccent" padding={0}>
        <div className={styles.row}>
          {items.map((item, index) => (
            <span key={index} className={styles.item}>
              <MutedText text={item.text} onDark />
            </span>
          ))}
          {right ? (
            <span className={styles.right}>
              <MonoText text={right} onDark muted size={10.5} />
            </span>
          ) : null}
        </div>
      </ToneSurface>
    </div>
  );
};

export default PreviewInfoBar;
