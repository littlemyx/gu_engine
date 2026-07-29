import React from 'react';

import Chip from '../atoms/Chip';
import Frame from '../atoms/Frame';
import Heading from '../atoms/Heading';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './CastCard.module.css';

export interface CastCardProps {
  /** Имя персонажа. */
  name: string;
  /** Мета-строка рядом с именем: возраст, маршрут — «20 · slow_burn». */
  meta?: string;
  /** Занятие/роль персонажа. */
  role?: string;
  /** Образец речи. Карточка сама берёт его в кавычки-«ёлочки», кавычки в проп не входят. */
  speech?: string;
  /** Черты характера; каждая рисуется отдельной фишкой. */
  traits?: string[];
  selected?: boolean;
  /** Ширина карточки, px (240–480 в макете). */
  width?: number;
  onClick?: () => void;
  /** Редактировать персонажа. Без колбэка иконка ✎ неинтерактивна. */
  onEdit?: () => void;
}

/**
 * Порт `design_ref/components/CastCard.dc.html` (molecules.json#p015,
 * «КАРТОЧКА ПЕРСОНАЖА КОМПАКТ»).
 * Компактная карточка кастинг-стола: имя, мета, роль, образец речи и черты
 * характера фишками. У карточки и у кнопки ✎ разные клики, поэтому кликабельная
 * область — не настоящий `<button>`, а `div[role="button"]`: вложенный
 * `<button>` внутри `<button>` невалиден (тот же приём, что у missing-состояния
 * `PoseTile`).
 */
const CastCard = ({
  name,
  meta,
  role,
  speech,
  traits,
  selected = false,
  width = 330,
  onClick,
  onEdit,
}: CastCardProps) => {
  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    onEdit?.();
  };

  const body = (
    <Frame
      tone={selected ? 'accent' : 'light'}
      selected={selected}
      fill="paper"
      interactive={false}
      paddingX={12}
      paddingY={10}
      block
    >
      <div className={styles.topRow}>
        <Heading text={name} level="card" uppercase={false} size={13} />
        {meta && <MutedText text={meta} size={10} />}
        {onEdit ? (
          <button type="button" className={styles.editButton} onClick={handleEdit}>
            ✎
          </button>
        ) : (
          <span className={styles.editGlyph} aria-hidden="true">
            ✎
          </span>
        )}
      </div>
      {role && (
        <div className={styles.roleRow}>
          <MutedText text={role} size={10.5} />
        </div>
      )}
      {speech && (
        <div className={styles.speechRow}>
          <TextLabel text={`«${speech}»`} size={10.5} />
        </div>
      )}
      {traits && traits.length > 0 && (
        <div className={styles.traitsRow}>
          {traits.map(trait => (
            <Chip key={trait} label={trait} kind="outline" />
          ))}
        </div>
      )}
    </Frame>
  );

  if (!onClick) {
    return (
      <div className={styles.wrap} style={{ width: `${width}px` }}>
        {body}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.wrap} ${styles.wrapInteractive}`}
      style={{ width: `${width}px` }}
      onClick={onClick}
    >
      {body}
    </div>
  );
};

export default CastCard;
