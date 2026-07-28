import React from 'react';

import Badge, { type BadgeTone } from '../atoms/Badge';

import styles from './OwnershipBadges.module.css';

export type OwnershipTone = 'manual' | 'proposed' | 'accepted' | 'locked';

export interface OwnershipBadgesProps {
  /** Подпись бейджа владения, глиф уже часть строки («✎ ручная правка»). Пусто — бейдж не рисуется. */
  ownership?: string;
  ownerTone?: OwnershipTone;
  /** Подпись бейджа устаревания, глиф уже часть строки («◐ устарело — изменился Б4»). Пусто — бейдж не рисуется. */
  stale?: string;
  onDark?: boolean;
}

/**
 * Badge умеет только три тона (neutral/accent/error), а у владения их четыре.
 * `proposed`/`accepted` в макете буквально совпадают с токенами accent-тона
 * Badge на тёмном хроме (`--gu-signal-run`), поэтому это честное переиспользование.
 * У `locked` в макете свой сплошной ink-акцент без сигнального смысла — ближайший
 * тон Badge без ложной семантики «ошибки» это neutral, поэтому `manual` и `locked`
 * делят один и тот же тон ценой утраты различимости между ними.
 */
const OWNER_TONE_TO_BADGE: Record<OwnershipTone, BadgeTone> = {
  manual: 'neutral',
  proposed: 'accent',
  accepted: 'accent',
  locked: 'neutral',
};

/**
 * Порт `design_ref/components/OwnershipBadges.dc.html` (molecules.json#k015,
 * «бейджи владения и свежести»).
 * Пара контурных бейджей рядом: кто владеет правкой (ручная/предложено/
 * принято/залочено) и не устарела ли она относительно связанного артефакта.
 * Оба бейджа независимо необязательны — рисуется то, для чего пришёл текст.
 */
const OwnershipBadges = ({ ownership, ownerTone = 'manual', stale, onDark = true }: OwnershipBadgesProps) => {
  return (
    <div className={styles.root}>
      {ownership && <Badge label={ownership} tone={OWNER_TONE_TO_BADGE[ownerTone]} onDark={onDark} />}
      {stale && <Badge label={stale} tone="error" onDark={onDark} />}
    </div>
  );
};

export default OwnershipBadges;
