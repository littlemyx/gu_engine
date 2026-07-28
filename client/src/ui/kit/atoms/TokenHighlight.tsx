import React from 'react';

import styles from './TokenHighlight.module.css';

export interface TokenHighlightProps {
  /** Имя токена без фигурных скобок, например `biome`. */
  token: string;
  /** Показывать ли `before`/`after` вокруг токена — иначе токен стоит один. */
  inSentence?: boolean;
  before?: string;
  after?: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/TokenHighlight.dc.html` (atoms.json#TokenHighlight).
 * Подсвеченный `{token}` внутри моноширинного фрагмента шаблона промпта — вставка
 * даёт понять автору брифа, где движок подставит значение.
 */
const TokenHighlight = ({
  token,
  inSentence = true,
  before = 'Опиши локацию',
  after = 'в тоне сеттинга.',
  onDark = false,
}: TokenHighlightProps) => {
  const rootClass = [styles.root, onDark ? styles.onDark : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <span className={styles.text}>
        {inSentence && before ? `${before} ` : null}
        <span className={styles.token}>{`{${token}}`}</span>
        {inSentence && after ? ` ${after}` : null}
      </span>
    </div>
  );
};

export default TokenHighlight;
