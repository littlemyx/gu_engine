import React from 'react';

import Swatch from '../atoms/Swatch';

import styles from './ArtPalette.module.css';

export interface ArtPaletteProps {
  /** Цвета палитры арт-стиля, слева направо. Hex — с решёткой или без, нормализуется сам. */
  colors: string[];
  /** Подпись hex-кода под каждым квадратом. */
  showHex?: boolean;
  /** Пунктирная кнопка добавления цвета в конце ряда. */
  withAdd?: boolean;
  /** Зовётся с индексом свотча и его нормализованным hex. */
  onPick?: (index: number, hex: string) => void;
  onAdd?: () => void;
}

const normalizeHex = (raw: string) => `#${raw.trim().replace(/^#/, '')}`;

/**
 * Порт `design_ref/components/ArtPalette.dc.html` (molecules.json#p048,
 * «ПАЛИТРА АРТ-СТИЛЯ (свотчи + hex + add)»).
 * Ряд свотчей арт-стиля истории с необязательной hex-подписью и пунктирной
 * кнопкой добавления цвета в конце — целиком собран из атома `Swatch`
 * (варианты `palette` и `add`), своей вёрстки у молекулы нет.
 */
const ArtPalette = ({ colors, showHex = true, withAdd = true, onPick, onAdd }: ArtPaletteProps) => {
  return (
    <div className={styles.root}>
      {colors.map((raw, index) => {
        const hex = normalizeHex(raw);
        return (
          <Swatch
            key={`${hex}-${index}`}
            color={hex}
            showHex={showHex}
            onClick={onPick ? () => onPick(index, hex) : undefined}
          />
        );
      })}
      {withAdd && <Swatch variant="add" onClick={onAdd} />}
    </div>
  );
};

export default ArtPalette;
