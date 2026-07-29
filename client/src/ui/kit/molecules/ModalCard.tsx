import React from 'react';

import Divider from '../atoms/Divider';
import Frame from '../atoms/Frame';
import Heading from '../atoms/Heading';
import IconButton from '../atoms/IconButton';
import ToneSurface from '../atoms/ToneSurface';

import styles from './ModalCard.module.css';

export interface ModalCardProps {
  /** Заголовок в тёмной шапке, напр. «Режиссура · веса селектора». */
  title: string;
  /** Крестик закрытия в шапке. */
  closable?: boolean;
  /** Тень наружу; без неё карточка держится только волосяной рамкой. */
  elevation?: boolean;
  /** Ширина карточки в px. */
  width?: number;
  onClose?: () => void;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/ModalCard.dc.html` (molecules.json#p009,
 * «МОДАЛ-КАРТОЧКА С ТЁМНЫМ ХЕДЕРОМ»). Плавающая карточка поверх рабочей
 * области: тёмная шапка с заголовком и крестиком, волосяная рамка держит
 * силуэт даже когда тень (`elevation`) выключена, тело — произвольный
 * контент. Шапка всегда тёмная независимо от того, где карточка стоит —
 * это не переключаемый `context`, а фиксированная деталь макета.
 */
const ModalCard = ({ title, closable = true, elevation = true, width = 430, onClose, children }: ModalCardProps) => {
  const rootClassName = [styles.root, elevation ? styles.elevated : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} style={{ width: `${width}px` }}>
      <Frame tone="light" padding={0} interactive={false} block>
        <ToneSurface tone="darkAccent" padding={0}>
          <div className={styles.header}>
            <Heading text={title} level="card" size={12} onDark />
            {closable && <IconButton glyph="✕" hint="Закрыть" onDark onClick={onClose} />}
          </div>
        </ToneSurface>
        <Divider orientation="horizontal" onDark={false} length={width} />
        <div className={styles.body}>{children}</div>
      </Frame>
    </div>
  );
};

export default ModalCard;
