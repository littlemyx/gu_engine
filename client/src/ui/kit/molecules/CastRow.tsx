import React from 'react';

import Glyph from '../atoms/Glyph';
import MutedText from '../atoms/MutedText';
import TextLabel from '../atoms/TextLabel';

import styles from './CastRow.module.css';

export interface CastRowProps {
  /** Имя персонажа, напр. «Кира». Проп `name` в макете переименован — там это
   * зарезервированный атрибут инструмента дизайна. */
  name: string;
  /** Короткая мета-строка справа от имени, напр. «староста потока ·
   * enemies_to_lovers · очки в тонкой оправе». Обрезается многоточием. */
  description: string;
  /** Ширина строки, px (240–560 в макете). */
  width?: number;
  /** Клик по строке целиком — назначение/выбор кандидата. Без колбэка строка
   * не интерактивна. */
  onClick?: () => void;
  /** Клик по значку «✎»; не всплывает до выбора строки. Без колбэка значок
   * рисуется, но не кликабелен. */
  onEdit?: () => void;
}

/**
 * Порт `design_ref/components/CastRow.dc.html` (molecules.json#p014,
 * «СТРОКА КАСТА МИНИ · CastRow»).
 * Компактная строка кандидата в кастинг-листе: аватар-заглушка, имя, мета и
 * значок правки. У исходника нет пропа `context` — фон строки в макете
 * захардкожен белым (`#fff`), поэтому `onDark` здесь не заводим, как и сам
 * макет.
 *
 * `Frame` не подошёл: его пяти тонам нет ровно `--color-neutral-300` рамки
 * макета (ближайший, `light`, даёт заметно более тёмный `--color-neutral-400`),
 * а сам атом `inline-block` — рамке строки нужен flex-ряд с `gap`. Рамка и
 * раскладка собраны локально теми же токенами, которыми пользуется `Frame`
 * (см. `missingAtoms` отчёта задачи). `Thumbnail` тоже не подошёл: квадратной
 * заглушки 22×22 под декоративный глиф у него нет — базовые размеры
 * (32×46 спрайт, 56×34 локация) не квадратные, а `stub` ожидает подпись-
 * счётчик текстом, а не одиночный символ. Аватар — обычный `Glyph` в локальном
 * квадрате. Значок «✎» тоже не идёт через `Glyph`: тот принципиально не
 * кликабелен (`aria-hidden`, без hover/focus), а строке нужна отдельная
 * интерактивная зона с наведением — `IconButton` в реестре атомов молекулы
 * не значится, поэтому кнопка правки собрана локально, фиксированный глиф
 * оставлен как символ из макета.
 */
const CastRow = ({ name, description, width = 380, onClick, onEdit }: CastRowProps) => {
  const clickable = Boolean(onClick);
  const editable = Boolean(onEdit);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  const handleEditClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onEdit?.();
  };

  const rowClassName = [styles.root, clickable ? styles.clickable : ''].filter(Boolean).join(' ');
  const editClassName = [styles.edit, editable ? styles.editClickable : ''].filter(Boolean).join(' ');

  const content = (
    <>
      <span className={styles.avatar} aria-hidden="true">
        <Glyph glyph="◐" tone="muted" size={11} />
      </span>
      <span className={styles.name}>
        <TextLabel text={name} bold size={11.5} />
      </span>
      <span className={styles.desc}>
        <MutedText text={description} size={11.5} />
      </span>
      {editable ? (
        <button type="button" className={editClassName} onClick={handleEditClick} aria-label="редактировать">
          ✎
        </button>
      ) : (
        <span className={editClassName} aria-hidden="true">
          ✎
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = { width: `${width}px` };

  if (clickable) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={rowClassName}
        style={style}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={rowClassName} style={style}>
      {content}
    </div>
  );
};

export default CastRow;
