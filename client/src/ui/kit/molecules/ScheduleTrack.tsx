import React from 'react';

import styles from './ScheduleTrack.module.css';

export interface ScheduleTrackRange {
  from: number;
  to: number;
}

export interface ScheduleTrackProps {
  /** Подпись строки — обычно имя персонажа. */
  label: string;
  /** Число слотов в дорожке. */
  slots?: number;
  /** Диапазоны присутствия (1-индексные, включительно с обеих сторон). */
  presence?: ScheduleTrackRange[];
  /** Слоты встреч — диалоговых юнитов. */
  meetings?: number[];
  /** Слоты якорных битов. */
  anchors?: number[];
  /** Ширина колонки подписи, px. */
  labelWidth?: number;
  /** Общая ширина дорожки, px. */
  width?: number;
  presenceTip?: string;
  meetingTip?: string;
  anchorTip?: string;
}

type SpanTone = 'presence' | 'meeting' | 'anchor';

interface TrackSpan {
  key: string;
  gridColumn: string;
  tone: SpanTone;
  tip: string;
}

const DEFAULT_PRESENCE: ScheduleTrackRange[] = [
  { from: 1, to: 3 },
  { from: 5, to: 8 },
  { from: 10, to: 14 },
  { from: 17, to: 21 },
];
const DEFAULT_MEETINGS = [2, 7, 12];
const DEFAULT_ANCHORS = [20];

const TONE_CLASS: Record<SpanTone, string> = {
  presence: styles.presence,
  meeting: styles.meeting,
  anchor: styles.anchor,
};

/**
 * Порт `design_ref/components/ScheduleTrack.dc.html` (molecules.json#p026, «ПОЛОСА ПРИСУТСТВИЯ 21 СЛОТ»).
 * Строка расписания персонажа: подпись слева и грид-дорожка справа, где
 * диапазоны присутствия, отдельные встречи и якорные биты — три разных тона
 * заливки по тем же слотам. Позже объявленные спаны (встречи, затем якоря)
 * рисуются поверх presence при пересечении — как в исходном порядке DOM.
 */
const ScheduleTrack = ({
  label,
  slots = 21,
  presence = DEFAULT_PRESENCE,
  meetings = DEFAULT_MEETINGS,
  anchors = DEFAULT_ANCHORS,
  labelWidth = 70,
  width = 560,
  presenceTip = 'в локации по расписанию',
  meetingTip = 'встреча — диалоговый юнит',
  anchorTip = 'якорный бит',
}: ScheduleTrackProps) => {
  const spans: TrackSpan[] = [
    ...presence.map((r, i) => ({
      key: `presence-${i}`,
      gridColumn: `${r.from} / ${r.to + 1}`,
      tone: 'presence' as const,
      tip: presenceTip,
    })),
    ...meetings.map((n, i) => ({
      key: `meeting-${i}`,
      gridColumn: `${n} / ${n + 1}`,
      tone: 'meeting' as const,
      tip: meetingTip,
    })),
    ...anchors.map((n, i) => ({
      key: `anchor-${i}`,
      gridColumn: `${n} / ${n + 1}`,
      tone: 'anchor' as const,
      tip: anchorTip,
    })),
  ];

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <span className={styles.label} style={{ width: `${labelWidth}px` }}>
        {label}
      </span>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}>
        {spans.map(s => (
          <span key={s.key} title={s.tip} className={TONE_CLASS[s.tone]} style={{ gridColumn: s.gridColumn }} />
        ))}
      </div>
    </div>
  );
};

export default ScheduleTrack;
