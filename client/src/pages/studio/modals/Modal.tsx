import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import Blueprint from '@/ui/Blueprint';

import styles from './modals.module.css';

export interface ModalProps {
  title: string;
  /** Подпись под заголовком: чем это действие обернётся. */
  subtitle?: string;
  wide?: boolean;
  /** Таблица на всю строку (настроения локаций): 620px по макету 7c. */
  broad?: boolean;
  /** Широкий редактор (бриф, режиссура): почти во весь экран, форма скроллится. */
  editor?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Диалог шелла: портал в body, Esc и клик по подложке закрывают, фокус
 * уводится внутрь и не выпускается наружу — модалка всегда про решение,
 * которое нельзя пролистать мимо.
 */
const Modal = ({
  title,
  subtitle,
  wide = false,
  broad = false,
  editor = false,
  onClose,
  children,
  footer,
}: ModalProps) => {
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    windowRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = windowRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), textarea, select, [href]',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    // Ref держит подложка: кроме диалога, внутри неё ничего нет, поэтому
    // ловушка фокуса ищет по ней (Blueprint ref-ы не пробрасывает).
    <div className={styles.overlay} onMouseDown={onClose} ref={windowRef}>
      <Blueprint
        className={`${styles.window} ${wide ? styles.wide : ''} ${broad ? styles.broad : ''} ${
          editor ? styles.editor : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
      >
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>{footer}</div>
      </Blueprint>
    </div>,
    document.body,
  );
};

export default Modal;
