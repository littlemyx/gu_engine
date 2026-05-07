import React, { useCallback, useRef, useState } from 'react';
import styles from './SpritePreview.module.css';

type Props = {
  src: string;
  label?: string;
  children: React.ReactNode;
};

export const SpritePreview: React.FC<Props> = ({ src, label, children }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const handleEnter = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popupW = 292;
    const popupH = 460;

    let left = rect.left - popupW - 12;
    if (left < 8) left = rect.right + 12;
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;

    let top = rect.top;
    if (top + popupH > window.innerHeight - 8) top = window.innerHeight - popupH - 8;
    if (top < 8) top = 8;

    setPos({ top, left });
  }, []);

  const handleLeave = useCallback(() => setPos(null), []);

  return (
    <div ref={wrapRef} className={styles.wrap} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {pos && (
        <div className={styles.popup} style={{ top: pos.top, left: pos.left, display: 'block' }}>
          <img className={styles.popupImg} src={src} alt={label ?? ''} />
          {label && <span className={styles.popupLabel}>{label}</span>}
        </div>
      )}
    </div>
  );
};
