import React from 'react';

import CheckerBg from '../atoms/CheckerBg';
import DashedFrame from '../atoms/DashedFrame';
import FillBadge from '../atoms/FillBadge';
import Frame from '../atoms/Frame';
import Glyph from '../atoms/Glyph';
import MutedText from '../atoms/MutedText';
import StatusGlyph from '../atoms/StatusGlyph';
import TextLabel from '../atoms/TextLabel';

import styles from './PoseTile.module.css';

export type PoseTileState = 'normal' | 'selected' | 'generating' | 'missing';

export interface PoseTileProps {
  /** Имя позы спрайта, например «happy». */
  name: string;
  state?: PoseTileState;
  /** Подпись бейджа выбора в левом верхнем углу. Осмысленна только у `state="selected"`. */
  badge?: string;
  /** Пояснение под ✗, почему кадра нет. Осмысленно только у `state="missing"`. */
  missingNote?: string;
  /** Подпись кнопки догенерации. Осмысленна только у `state="missing"`. */
  generateLabel?: string;
  /** Подпись под индикатором в процессе генерации. Осмысленна только у `state="generating"`. */
  generatingLabel?: string;
  /** Ширина плитки, px (80–220 в макете); высота следует соотношению 2:3. */
  width?: number;
  onClick?: () => void;
  /** Догенерировать пропущенный кадр. Осмыслен только у `state="missing"`. */
  onGenerate?: () => void;
}

/**
 * Порт `design_ref/components/PoseTile.dc.html` (molecules.json#p001,
 * «ПЛИТКА ПОЗЫ СПРАЙТА»). Плитка одной позы на кастинг-столе: превью на
 * шахматной подложке `CheckerBg` под `Frame`, «выбрана» добавляет `FillBadge`
 * в углу, «генерация» меняет превью на крутящийся `StatusGlyph` + `MutedText`,
 * «нет» подменяет всю плитку на `DashedFrame` с пояснением и кнопкой
 * догенерации. Футер с именем и статус-глифом рисуется всегда, независимо от
 * состояния тела плитки — как в макете. У «нет» кликабельная область — не
 * `<button>`, а `div[role=button]`: внутри неё лежит настоящая кнопка
 * «Догенерировать» с `stopPropagation`, а вложенный `<button>` внутри
 * `<button>` невалиден.
 */
const PoseTile = ({
  name,
  state = 'normal',
  badge,
  missingNote,
  generateLabel,
  generatingLabel,
  width = 110,
  onClick,
  onGenerate,
}: PoseTileProps) => {
  const selected = state === 'selected';
  const generating = state === 'generating';
  const missing = state === 'missing';
  const height = Math.round(width * 1.5);

  const footer = (
    <div className={[styles.footer, missing ? styles.footerMissing : ''].filter(Boolean).join(' ')}>
      <TextLabel text={name} bold tone={missing ? 'error' : 'normal'} size={10} />
      {missing ? (
        <Glyph glyph="—" tone="error" size={11} />
      ) : (
        <StatusGlyph status={generating ? 'run' : 'ok'} spin={false} size={11} />
      )}
    </div>
  );

  if (missing) {
    const handleGenerate = (event: React.MouseEvent) => {
      event.stopPropagation();
      onGenerate?.();
    };

    const body = (
      <>
        <DashedFrame kind="missing" interactive={false} padding={0}>
          <div className={styles.missingBody} style={{ width: `${width}px`, height: `${height}px` }}>
            <Glyph glyph="✗" tone="error" size={14} />
            {missingNote && <TextLabel text={missingNote} tone="error" size={9.5} />}
            {generateLabel && (
              <button type="button" className={styles.generateBtn} onClick={handleGenerate}>
                {generateLabel}
              </button>
            )}
          </div>
        </DashedFrame>
        {footer}
      </>
    );

    if (!onClick) {
      return <div className={styles.missingWrap}>{body}</div>;
    }

    return (
      <div
        role="button"
        tabIndex={0}
        className={[styles.missingWrap, styles.missingWrapInteractive].join(' ')}
        onClick={onClick}
      >
        {body}
      </div>
    );
  }

  return (
    <Frame
      tone={selected ? 'accent' : 'light'}
      selected={selected}
      fill="paper"
      interactive={Boolean(onClick)}
      padding={0}
      onClick={onClick}
    >
      {selected && badge && (
        <span className={styles.badgeSlot}>
          <FillBadge label={badge} />
        </span>
      )}
      {generating ? (
        <CheckerBg width={width} height={height}>
          <span className={styles.generatingBody}>
            <StatusGlyph status="run" size={15} />
            {generatingLabel && <MutedText text={generatingLabel} size={9.5} />}
          </span>
        </CheckerBg>
      ) : (
        <CheckerBg width={width} height={height}>
          <span className={styles.glyphAnchor}>
            <Glyph glyph="◐" tone={selected ? 'accent' : 'muted'} size={34} />
          </span>
        </CheckerBg>
      )}
      {footer}
    </Frame>
  );
};

export default PoseTile;
