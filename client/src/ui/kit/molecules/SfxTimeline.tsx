import React from 'react';

import Frame from '../atoms/Frame';
import Playhead from '../atoms/Playhead';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './SfxTimeline.module.css';

export interface SfxTimelineClip {
  /** Название клипа, например «скрип досок». */
  label: string;
  /** Позиция левого края клипа, % от ширины дорожки. */
  left: number;
  /** Ширина клипа, px. */
  width: number;
  /** Клип привязан к конкретному моменту сцены, а не лежит фоном. */
  bound?: boolean;
}

export interface SfxTimelineProps {
  /** Клипы SFX на дорожке, слева направо. */
  clips: SfxTimelineClip[];
  /** Индекс выбранного клипа в `clips`; `null` — ничего не выбрано. */
  selected?: number | null;
  /** Позиция плейхеда, % от ширины дорожки. `< 0` — плейхед скрыт. */
  playhead?: number;
  onClipClick?: (index: number) => void;
}

const DEFAULT_CLIPS: SfxTimelineClip[] = [
  { label: 'скрип досок', left: 12, width: 90, bound: true },
  { label: 'шаги', left: 55, width: 70, bound: false },
];

/**
 * Порт `design_ref/components/SfxTimeline.dc.html` (molecules.json#k081,
 * «КЛИПЫ SFX НА ТАЙМЛАЙНЕ · ПРИВЯЗАН / ОБЫЧНЫЙ»).
 * Дорожка клипов звукового оформления сцены: сквозная линия времени, клипы —
 * кликабельные `Frame` (привязанные к моменту тонированы `ToneSurface`,
 * обычные — просто белая рамка) и опциональный `Playhead` поверх. У исходника
 * нет пропа `context` — дорожка всегда живёт на светлом чертёжном фоне, как
 * и `AudioTrackRow`, поэтому `onDark` здесь не нужен. Проп `width` мокапа —
 * секция «Превью» редактора дизайна, не часть компонента: дорожка сама
 * заполняет ширину контейнера.
 */
const SfxTimeline = ({ clips = DEFAULT_CLIPS, selected = null, playhead = 34, onClipClick }: SfxTimelineProps) => {
  const showPlayhead = playhead >= 0;

  return (
    <div className={styles.root}>
      <span className={styles.spine} aria-hidden="true" />
      {clips.map((clip, index) => {
        const bound = clip.bound ?? false;
        const isSelected = selected === index;

        return (
          <span
            key={`${clip.label}-${index}`}
            className={styles.clipSlot}
            style={{ left: `${clip.left}%`, width: `${clip.width}px` }}
          >
            {bound && (
              <span className={styles.fillLayer} aria-hidden="true">
                <ToneSurface tone="accent" padding={0} />
              </span>
            )}
            <span className={styles.frameLayer}>
              <Frame
                tone={bound ? 'accent' : 'light'}
                selected={isSelected}
                padding={0}
                block
                fill={bound ? 'none' : 'paper'}
                onClick={onClipClick ? () => onClipClick(index) : undefined}
              >
                <span className={styles.clipLabel}>
                  <TextLabel text={clip.label} tone={bound ? 'accent' : 'muted'} size={8} />
                </span>
              </Frame>
            </span>
          </span>
        );
      })}
      {showPlayhead && <Playhead position={playhead} height={48} tone="contrast" withHandle={false} />}
    </div>
  );
};

export default SfxTimeline;
