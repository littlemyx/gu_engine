import React from 'react';

import Frame from '../atoms/Frame';
import Kicker from '../atoms/Kicker';

import styles from './FieldGroup.module.css';

export type FieldGroupState = 'ok' | 'error';

export interface FieldGroupProps {
  /** Заголовок секции: «Жанр и формат» и т. п. */
  title: string;
  /** Мета-строка справа от заголовка в обычном состоянии: `genre · format · endingsProfile`. */
  meta: string;
  /** Мета-строка справа от заголовка, когда `state="error"`: `✗ 0 персонажей`. */
  errorMeta?: string;
  state?: FieldGroupState;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/FieldGroup.dc.html` (molecules.json#p011,
 * «секция формы»).
 * Рамка-контейнер поля брифа/формы: заголовок слева, мета-строка справа —
 * состояние `error` красит рамку и мету в акцент и делает мету жирной вместо
 * приглушённой.
 */
const FieldGroup = ({ title, meta, errorMeta = '', state = 'ok', children }: FieldGroupProps) => {
  const isError = state === 'error';
  const metaText = isError ? errorMeta || meta : meta;
  const metaClass = [styles.meta, isError ? styles.metaError : styles.metaOk].join(' ');

  return (
    <Frame tone={isError ? 'accent' : 'light'} paddingX={14} paddingY={12} interactive={false} block>
      <div className={styles.header}>
        <Kicker text={title} tone="accent" size={12} />
        <span className={metaClass}>{metaText}</span>
      </div>
      {children != null && <div className={styles.body}>{children}</div>}
    </Frame>
  );
};

export default FieldGroup;
