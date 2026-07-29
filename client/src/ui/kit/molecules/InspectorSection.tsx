import React from 'react';

import DisclosureArrow from '../atoms/DisclosureArrow';
import Kicker from '../atoms/Kicker';
import TextLabel from '../atoms/TextLabel';

import styles from './InspectorSection.module.css';

export interface InspectorSectionProps {
  /** Надзаголовок секции, напр. «Готовность · 6/6». */
  title: string;
  /** Текст содержимого. Игнорируется, если передан `children`. */
  body?: string;
  /** Произвольное содержимое секции — перекрывает `body`. */
  children?: React.ReactNode;
  /** Развёрнута ли секция. */
  open?: boolean;
  /** Без колбэка заголовок немой — рендерится как div, а не кнопка. */
  onToggle?: (open: boolean) => void;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/InspectorSection.dc.html` (molecules.json#p018,
 * «СЕКЦИЯ ИНСПЕКТОРА (▾ заголовок + контент)»).
 * Сворачиваемая секция инспектора: капслок-заголовок со стрелкой раскрытия
 * и содержимое под ним. Как и `ActRow`, состояние раскрытия держит
 * вызывающая сторона — секция только рисует и сообщает о клике.
 */
const InspectorSection = ({
  title,
  body = '',
  children,
  open = true,
  onToggle,
  onDark = false,
}: InspectorSectionProps) => {
  const interactive = Boolean(onToggle);
  const rootClassName = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const headerClassName = [styles.header, interactive ? styles.clickable : '', open ? styles.expanded : '']
    .filter(Boolean)
    .join(' ');

  const header = (
    <>
      <DisclosureArrow expanded={open} onDark={onDark} size={10} />
      <span className={styles.title}>
        <Kicker text={title} tone="neutral" onDark={onDark} size={10} />
      </span>
    </>
  );

  return (
    <div className={rootClassName}>
      {interactive ? (
        <button type="button" className={headerClassName} aria-expanded={open} onClick={() => onToggle?.(!open)}>
          {header}
        </button>
      ) : (
        <div className={headerClassName}>{header}</div>
      )}
      {open && (
        <div className={styles.body}>
          {children ?? (
            <span className={styles.bodyText}>
              <TextLabel text={body} onDark={onDark} size={11.5} />
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectorSection;
