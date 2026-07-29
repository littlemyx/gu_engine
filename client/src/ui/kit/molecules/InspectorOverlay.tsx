import React from 'react';

import Divider from '../atoms/Divider';
import Heading from '../atoms/Heading';
import IconButton from '../atoms/IconButton';
import Shadow from '../atoms/Shadow';
import ToneSurface from '../atoms/ToneSurface';

import styles from './InspectorOverlay.module.css';

export interface InspectorOverlayProps {
  /** Заголовок в шапке оверлея, напр. «Инспектор · Бит 04». */
  title: string;
  /** Ширина панели в px; в макете диапазон 240–420, по умолчанию 300. */
  width?: number;
  /** Высота панели в px; в макете диапазон 200–600, по умолчанию 320. */
  height?: number;
  onClose?: () => void;
  children?: React.ReactNode;
}

/**
 * Порт `design_ref/components/InspectorOverlay.dc.html` (molecules.json#p040, «ИНСПЕКТОР-ОВЕРЛЕЙ»).
 * Панель инспектора поверх вьюпорта: тёмная accent-подложка, шапка с заголовком
 * и кнопкой закрытия, произвольное содержимое ниже. Затемнение фона и отступ от
 * края в макете — обвязка превью редактора дизайна и в порт не входят: здесь
 * только сама панель, позиционирование остаётся на совести того, кто её монтирует.
 */
const InspectorOverlay = ({ title, width = 300, height = 320, onClose, children }: InspectorOverlayProps) => (
  <Shadow size="lg">
    <ToneSurface tone="darkAccent" padding={0}>
      <div className={styles.panel} style={{ width: `${width}px`, height: `${height}px` }}>
        <div className={styles.header}>
          <Heading text={title} level="card" onDark size={11} />
          <IconButton glyph="✕" hint="Закрыть (Esc)" size="inline" tone="neutral" onDark onClick={onClose} />
        </div>
        <Divider orientation="horizontal" onDark length={width} />
        <div className={styles.body}>{children}</div>
      </div>
    </ToneSurface>
  </Shadow>
);

export default InspectorOverlay;
