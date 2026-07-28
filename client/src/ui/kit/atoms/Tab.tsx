import React from 'react';

import styles from './Tab.module.css';

export type TabVariant = 'underline' | 'document' | 'dock';

export interface TabProps {
  label: string;
  variant?: TabVariant;
  selected?: boolean;
  /** Точка непросмотренного. */
  notify?: boolean;
  /** Крестик закрытия — рисуется только у документной вкладки (`document`). */
  closable?: boolean;
  onClick?: () => void;
  onClose?: () => void;
}

const VARIANT_CLASS: Record<TabVariant, string> = {
  underline: styles.underline,
  document: styles.document,
  dock: styles.dock,
};

/**
 * Порт `design_ref/components/Tab.dc.html` (atoms.json#Tab).
 * Вкладка панели/документа: тёмный underline-акцент тулбара, светлая
 * документная с крестиком закрытия, приглушённая док-таба.
 */
const Tab = ({
  label,
  variant = 'underline',
  selected = false,
  notify = false,
  closable = true,
  onClick,
  onClose,
}: TabProps) => {
  const showClose = variant === 'document' && closable;
  const className = [styles.root, VARIANT_CLASS[variant], selected ? styles.selected : ''].filter(Boolean).join(' ');

  const handleClose = (event: React.MouseEvent) => {
    event.stopPropagation();
    onClose?.();
  };

  const content = (
    <>
      <span>{label}</span>
      {notify && <span className={styles.notify} aria-label="есть непросмотренное" />}
      {showClose && (
        <span role="button" tabIndex={0} className={styles.close} aria-label="закрыть" onClick={handleClose}>
          ✕
        </span>
      )}
    </>
  );

  if (!onClick) {
    return (
      <span role="tab" aria-selected={selected} className={className}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" role="tab" aria-selected={selected} className={className} onClick={onClick}>
      {content}
    </button>
  );
};

export default Tab;
