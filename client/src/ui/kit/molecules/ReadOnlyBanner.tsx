import React from 'react';

import Glyph from '../atoms/Glyph';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './ReadOnlyBanner.module.css';

export interface ReadOnlyBannerProps {
  /** Текст предупреждения. */
  text?: string;
  /** Глиф перед текстом: ◳ и т.п. */
  glyph?: string;
}

/**
 * Порт `design_ref/components/ReadOnlyBanner.dc.html` (molecules.json#p042,
 * «БАННЕР READ-ONLY»).
 * Полоса-предупреждение поверх узкого вьюпорта: пока экран уже, чем порог
 * редактирования, студия открывается в режиме только-просмотр, а фоновый
 * прогон при этом продолжается. Собрана из `ToneSurface` (тон warn), `Glyph`
 * и `TextLabel`; своя разметка нужна только для строки-флекса и отступов,
 * которых нет в пропсах атома-подложки.
 */
const ReadOnlyBanner = ({
  text = 'Только просмотр — редактирование от 1024px. Прогоны продолжаются.',
  glyph = '◳',
}: ReadOnlyBannerProps) => {
  return (
    <ToneSurface tone="warn" padding={0}>
      <div className={styles.row}>
        <Glyph glyph={glyph} tone="warn" size={12} />
        <TextLabel text={text} bold size={10.5} />
      </div>
    </ToneSurface>
  );
};

export default ReadOnlyBanner;
