import React from 'react';

import Badge, { type BadgeTone } from '../atoms/Badge';
import CornerMarks from '../atoms/CornerMarks';
import DashedFrame from '../atoms/DashedFrame';
import FillBadge from '../atoms/FillBadge';
import Frame from '../atoms/Frame';
import Heading from '../atoms/Heading';
import Kicker from '../atoms/Kicker';
import MutedText from '../atoms/MutedText';

import styles from './RoleCard.module.css';

export type RoleCardCast = 'linked' | 'manual' | 'generated' | 'unassigned';

export interface RoleCardProps {
  /** Слот кастинга: «LI-1», «LI-2», … */
  slot: string;
  /** Имя роли на карточке. В исходнике — проп `role`/`name` (`name` в дизайне
   * зарезервирован тулингом), здесь осмысленный `roleName`. */
  roleName: string;
  /** Как роль назначена: из префаба (linked) · руками · сгенерирована · не назначена. */
  cast?: RoleCardCast;
  /** Подпись префаба для `cast="linked"`, например «префаб «Кира» v2». */
  castLabel?: string;
  /** Пояснение под карточкой: оверрайды, причина и т.п. Пусто — строка не рисуется. */
  note?: string;
  /** Есть новая версия префаба, доступная к сравнению. */
  hasUpdate?: boolean;
  /** Подпись бейджа обновления, например «есть v3 · diff ▾». */
  updateLabel?: string;
  selected?: boolean;
  /** Открыть diff новой версии префаба. Без колбэка бейдж обновления не кликабелен. */
  onDiff?: () => void;
}

interface CastBadgeConfig {
  glyph: string;
  tone: BadgeTone;
  label: string;
}

/**
 * Порт `design_ref/components/RoleCard.dc.html` (molecules.json#k024,
 * «КАРТОЧКА РОЛИ · ПРЕФАБ LINKED»).
 * Карточка роли в кастинге: слот, имя, происхождение (linked/руками/
 * сгенерирована/не назначена) и, если у линкованного префаба вышла новая
 * версия, — кликабельный бейдж со ссылкой на diff. Незаназначенная роль
 * получает пунктирную рамку вместо сплошной — как и `DashedFrame` в остальном
 * ките для мест, ждущих действия.
 */
const RoleCard = ({
  slot,
  roleName,
  cast = 'linked',
  castLabel = 'префаб «Кира» v2',
  note = '2 оверрайда: speechPattern, палитра',
  hasUpdate = true,
  updateLabel = 'есть v3 · diff ▾',
  selected = false,
  onDiff,
}: RoleCardProps) => {
  const castBadge: CastBadgeConfig | null =
    cast === 'linked'
      ? { glyph: '⇄', tone: 'accent', label: `${castLabel} · linked` }
      : cast === 'manual'
      ? { glyph: '✎', tone: 'neutral', label: 'руками' }
      : cast === 'generated'
      ? { glyph: '⚙', tone: 'neutral', label: 'сгенерировать' }
      : null;

  const updateArea =
    hasUpdate &&
    (onDiff ? (
      <button type="button" className={`${styles.updateArea} ${styles.updateButton}`} onClick={onDiff}>
        <FillBadge label={updateLabel} uppercase={false} />
      </button>
    ) : (
      <span className={styles.updateArea}>
        <FillBadge label={updateLabel} uppercase={false} />
      </span>
    ));

  const body = (
    <>
      <div className={styles.topRow}>
        <Kicker text={slot} tone="neutral" size={8.5} />
        {updateArea}
      </div>
      <div className={styles.nameRow}>
        <Heading text={roleName} level="card" uppercase={false} size={14} />
      </div>
      {castBadge && (
        <div className={styles.castRow}>
          <Badge label={castBadge.label} glyph={castBadge.glyph} tone={castBadge.tone} />
        </div>
      )}
      {note && (
        <div className={styles.noteRow}>
          <MutedText text={note} size={10} />
        </div>
      )}
    </>
  );

  const rootClassName = [styles.root, cast === 'linked' ? styles.filled : '', selected ? styles.selected : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      <CornerMarks tone={cast === 'linked' ? 'accent' : 'plain'}>
        {cast === 'unassigned' ? (
          <DashedFrame kind="note" interactive={false}>
            {body}
          </DashedFrame>
        ) : (
          <Frame tone={cast === 'linked' ? 'accent' : 'light'} interactive={false}>
            {body}
          </Frame>
        )}
      </CornerMarks>
    </div>
  );
};

export default RoleCard;
