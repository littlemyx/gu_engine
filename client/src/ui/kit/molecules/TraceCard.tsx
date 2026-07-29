import React from 'react';

import AccentText from '../atoms/AccentText';
import MonoText from '../atoms/MonoText';

import styles from './TraceCard.module.css';

export type TraceCardKind = 'выбран' | 'отклонён';

export interface TraceCardProps {
  /** Trace-id сцены/энкаунтера, напр. `enc_kira_pier`. */
  id: string;
  /** Строка объяснения: салиенс и ярус для выбранных, guard для отклонённых. */
  meta: string;
  kind?: TraceCardKind;
  onClick?: () => void;
}

const KIND_GLYPH: Record<TraceCardKind, string> = {
  выбран: '✓',
  отклонён: '✗',
};

const KIND_CLASS: Record<TraceCardKind, string> = {
  выбран: styles.chosen,
  отклонён: styles.rejected,
};

/**
 * Порт `design_ref/components/TraceCard.dc.html` (molecules.json#k067,
 * «КАРТОЧКА ТРАССИРОВКИ · ВЫБРАН / ОТКЛОНЁН»).
 * Строка трассировки режиссёра: id сценария моно-строкой и объяснение выбора
 * (салиенс/ярус/жребий у выбранных, проваленный guard у отклонённых) —
 * состав панели «Замысел», где видно, почему один storylet выиграл у другого.
 */
const TraceCard = ({ id, meta, kind = 'выбран', onClick }: TraceCardProps) => {
  const glyph = KIND_GLYPH[kind];
  const className = [styles.root, KIND_CLASS[kind], onClick ? styles.clickable : ''].filter(Boolean).join(' ');

  const content = (
    <>
      <div className={styles.idRow}>
        <MonoText text={`${glyph} ${id}`} onDark muted={kind === 'отклонён'} size={10.5} />
      </div>
      <div className={styles.metaRow}>
        <AccentText text={meta} tone={kind === 'выбран' ? 'accent' : 'error'} onDark size={9.5} />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

export default TraceCard;
