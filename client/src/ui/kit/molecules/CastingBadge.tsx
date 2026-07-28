import React from 'react';

import Badge, { type BadgeTone } from '../atoms/Badge';

import styles from './CastingBadge.module.css';

export type CastingBadgeKind = 'руками' | 'префаб' | 'сгенерировать';

export interface CastingBadgeProps {
  kind?: CastingBadgeKind;
  /** Подпись поверх дефолтной для kind (например, конкретное имя префаба). */
  label?: string;
  onDark?: boolean;
  onClick?: () => void;
}

interface KindConfig {
  glyph: string;
  defaultLabel: string;
  tone: BadgeTone;
}

const KIND_CONFIG: Record<CastingBadgeKind, KindConfig> = {
  руками: { glyph: '✎', defaultLabel: 'руками', tone: 'neutral' },
  префаб: { glyph: '⇄', defaultLabel: 'префаб v2 · linked', tone: 'accent' },
  сгенерировать: { glyph: '⚙', defaultLabel: 'сгенерировать', tone: 'neutral' },
};

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  error: '',
};

/**
 * Порт `design_ref/components/CastingBadge.dc.html` (molecules.json#k025).
 * Бейдж происхождения роли в кастинге: как персонаж попал в историю —
 * руками, из префаба (со ссылкой на источник) или сгенерирован. Кликабелен,
 * когда есть колбэк (например, открыть карточку префаба).
 */
const CastingBadge = ({ kind = 'префаб', label, onDark = false, onClick }: CastingBadgeProps) => {
  const config = KIND_CONFIG[kind];
  const text = label || config.defaultLabel;

  const badge = <Badge label={text} glyph={config.glyph} tone={config.tone} onDark={onDark} />;

  if (!onClick) {
    return badge;
  }

  const className = [styles.button, TONE_CLASS[config.tone], onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <button type="button" className={className} onClick={onClick}>
      {badge}
    </button>
  );
};

export default CastingBadge;
