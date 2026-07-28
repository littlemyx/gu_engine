import React from 'react';

import styles from './ShellToolbar.module.css';

export type ShellMode = 'idle' | 'running' | 'blocked' | 'empty';

export interface ShellToolbarProps {
  mode?: ShellMode;
  /** 1280–1439: прячет ветку и seed. */
  compact?: boolean;
  /** Экран уже 1024: всё, что тратит деньги и меняет историю, заперто. */
  readonly?: boolean;

  /** idle */
  canContinueDraft?: boolean;
  branchLabel?: string;
  /** Готовый селектор веток из шелла. Без него рисуется кнопка-заглушка. */
  branchControl?: React.ReactNode;
  /** Готовый селектор seed-а из шелла. Без него seed-ряд не рисуется. */
  seedControl?: React.ReactNode;

  /** running: 0..1 */
  progress?: number;
  /** «фаза 8/10 · диалоги 14/24 · $0.21 из ≈ $0.52» */
  meter?: string;

  /** blocked */
  qaSummary?: string;

  /**
   * Бриф проходит валидацию. Гейтит ВСЁ, что запускает пайплайн, а не только
   * первый экран: перегенерация поверх готовой истории тратит те же деньги и
   * так же упирается в сломанный бриф.
   */
  briefReady?: boolean;
  /** Первая ошибка брифа — причина, по которой генерация заперта. */
  briefReason?: string;

  onGenerate?: () => void;
  onContinueDraft?: () => void;
  onCheckStory?: () => void;
  onPickBranch?: () => void;
  onExport?: () => void;
  onStop?: () => void;
  onRegenerateWithQa?: () => void;
  onImportBrief?: () => void;
  onOpenPrefabs?: () => void;
}

/**
 * Панель действий шелла. Режим определяет и состав кнопок, и то, что вообще
 * можно сделать: экспорт погашен во время прогона и при ошибках QA.
 */
const ShellToolbar = ({
  mode = 'idle',
  compact = false,
  readonly = false,
  canContinueDraft = false,
  branchLabel = 'все ▾',
  branchControl,
  seedControl,
  progress = 0,
  meter = '',
  qaSummary = '',
  briefReady = false,
  briefReason,
  onGenerate,
  onContinueDraft,
  onCheckStory,
  onPickBranch,
  onExport,
  onStop,
  onRegenerateWithQa,
  onImportBrief,
  onOpenPrefabs,
}: ShellToolbarProps) => {
  const exportBtn = (disabled: boolean) => (
    <button type="button" className={`${styles.btn} ${styles.spacer}`} disabled={disabled} onClick={onExport}>
      {disabled ? 'Скачать бандл' : 'Скачать бандл (v2)'}
    </button>
  );

  /** Правило дизайн-системы: запертая кнопка всегда объясняет причину. */
  const briefHint = !briefReady && (
    <span className={styles.hint}>{briefReason ?? 'нужен бриф или каст из префабов'}</span>
  );

  if (readonly) {
    // Единственная кнопка, которая уцелела: скачать уже собранное. Остальное
    // объясняется строкой — правило дизайна «disabled всегда с причиной».
    return (
      <div className={styles.root}>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled>
          ▶ Сгенерировать
        </button>
        <span className={styles.hint}>только просмотр — экран уже 1024</span>
        <span className={styles.divider} />
        <span className={styles.muted}>правки и генерация выключены</span>
        {exportBtn(mode === 'blocked' || mode === 'empty')}
      </div>
    );
  }

  if (mode === 'running') {
    return (
      <div className={styles.root}>
        <button type="button" className={`${styles.btn} ${styles.stop}`} onClick={onStop}>
          ■ Стоп
        </button>
        <span className={styles.track}>
          <span className={styles.fill} style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }} />
        </span>
        <span className={styles.meter}>{meter}</span>
        {exportBtn(true)}
      </div>
    );
  }

  if (mode === 'blocked') {
    return (
      <div className={styles.root}>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!briefReady} onClick={onGenerate}>
          ▶ Сгенерировать
        </button>
        <button type="button" className={styles.btn} disabled={!briefReady} onClick={onRegenerateWithQa}>
          Перегенерировать с фидбеком QA
        </button>
        {briefHint}
        <span className={styles.divider} />
        <span className={styles.warning}>{qaSummary}</span>
        {exportBtn(true)}
      </div>
    );
  }

  if (mode === 'empty') {
    return (
      <div className={styles.root}>
        <button
          type="button"
          className={`${styles.btn} ${styles.primary}`}
          disabled={!briefReady || readonly}
          onClick={onGenerate}
        >
          ▶ Сгенерировать
        </button>
        {briefHint}
        <span className={styles.divider} />
        <button type="button" className={styles.btn} onClick={onImportBrief}>
          Импорт брифа…
        </button>
        <button type="button" className={styles.btn} onClick={onOpenPrefabs}>
          Библиотека префабов
        </button>
        {exportBtn(true)}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!briefReady} onClick={onGenerate}>
        ▶ Сгенерировать
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={!canContinueDraft || !briefReady}
        onClick={onContinueDraft}
      >
        Продолжить черновик
      </button>
      {/* Проверка QA не трогает бриф и не тратит стадии — она читает готовую
          историю, поэтому остаётся доступной и на сломанном брифе. */}
      <button type="button" className={styles.btn} onClick={onCheckStory}>
        Проверить историю
      </button>
      {briefHint}
      {!compact && (
        <>
          <span className={styles.divider} />
          <span className={styles.muted}>ветка:</span>
          {branchControl ?? (
            <button type="button" className={`${styles.btn} ${styles.small}`} onClick={onPickBranch}>
              {branchLabel}
            </button>
          )}
          {/* Seed-поповер переехал в статус-бар (макет 7h); без контрола ряд не рисуем. */}
          {seedControl && (
            <>
              <span className={styles.muted}>seed:</span>
              {seedControl}
            </>
          )}
        </>
      )}
      {exportBtn(false)}
    </div>
  );
};

export default ShellToolbar;
