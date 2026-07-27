import React from 'react';

import ActionButton from '@/ui/ActionButton';
import Blueprint from '@/ui/Blueprint';

import styles from './modals.module.css';

export interface EmptyProjectProps {
  /** Бриф уже заполнен — первая дорожка становится «Сгенерировать». */
  briefReady: boolean;
  briefReason?: string;
  /** Режим чтения: обе дорожки заперты, кнопки объясняют почему. */
  disabledReason?: string;
  onFillBrief: () => void;
  onGenerate: () => void;
  onOpenPrefabs: () => void;
  /** Подстановка образцового брифа. Не задан — брифу есть что терять. */
  onUseSample?: () => void;
}

/**
 * Экран пустого проекта: два способа начать, и их можно совмещать. Дорожка
 * «из префабов» дешевле — оплаченные персонажи и мир переезжают как есть.
 */
const EmptyProject = ({
  briefReady,
  briefReason,
  disabledReason,
  onFillBrief,
  onGenerate,
  onOpenPrefabs,
  onUseSample,
}: EmptyProjectProps) => (
  <div className={styles.empty}>
    <Blueprint className={styles.invite}>
      <h2 className={styles.inviteTitle}>Пустая история</h2>
      <p className={styles.inviteSub}>Два способа начать — их можно совмещать.</p>

      <div className={styles.tracks}>
        <section className={styles.track}>
          <h3 className={styles.trackTitle}>1 · С нуля</h3>
          <p className={styles.trackText}>
            Заполните бриф — жанр, тон, длительность, каст. Конвейер соберёт мир, календарь и хребет, а потом напишет
            прозу.
          </p>
          <div className={styles.trackActions}>
            {briefReady ? (
              <ActionButton
                onLight
                label="Сгенерировать историю"
                cost="≈ $0.50"
                block
                disabled={Boolean(disabledReason)}
                reason={disabledReason}
                onClick={onGenerate}
              />
            ) : (
              <ActionButton
                onLight
                label="Заполнить бриф"
                cost="≈ $0.50"
                block
                onClick={onFillBrief}
                title={briefReason}
              />
            )}
            {!briefReady && onUseSample && (
              <ActionButton
                onLight
                label="Подставить образец"
                kind="ghost"
                block
                disabled={Boolean(disabledReason)}
                reason={disabledReason}
                onClick={onUseSample}
                title="Университетская новелла, три персонажа — готовый бриф, который можно править дальше"
              />
            )}
          </div>
        </section>

        <section className={styles.track}>
          <h3 className={styles.trackTitle}>2 · Из префабов</h3>
          <p className={styles.trackText}>
            Перетащите персонажей, мир или аудио-набор из дока внизу — генерация допишет остальное дешевле: спрайты и
            фоны уже оплачены.
          </p>
          <div className={styles.trackActions}>
            <ActionButton onLight label="Открыть библиотеку" kind="outline" block onClick={onOpenPrefabs} />
          </div>
        </section>
      </div>
    </Blueprint>
  </div>
);

export default EmptyProject;
