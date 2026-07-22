import React from 'react';
import { useBriefStore } from '@/narrative';
import type { SelectorWeights } from 'gu-engine-story-core';
import styles from './SelectorPanel.module.css';

/**
 * Панель режиссуры: веса салиенс-селектора.
 *
 * Это единственная ручка, которая меняет ПОВЕДЕНИЕ игры, не трогая контент.
 * В графовой модели такой ручки быть не могло: поведение было запечено в
 * порядок рёбер, и «сделать истории разнообразнее» означало перегенерацию.
 * Здесь правки едут в бандл как данные и применяются перезагрузкой файла.
 */

type WeightMeta = { key: keyof SelectorWeights; label: string; hint: string };

const WEIGHTS: WeightMeta[] = [
  { key: 'source', label: 'Сюжет важнее болтовни', hint: 'сцены хребта вытесняют повестку, повестка — филлеры' },
  { key: 'arcProgress', label: 'Следующая ступень', hint: 'очередная ступень лестницы отношений' },
  { key: 'urgency', label: 'Закрывающееся окно', hint: 'сцена, чьё время на исходе, всплывает наверх' },
  { key: 'variety', label: 'Разнообразие', hint: 'штраф за того же собеседника подряд' },
  { key: 'specificity', label: 'Узость условий', hint: 'сцена под три условия важнее сцены под одно' },
  { key: 'pacing', label: 'Попадание в фазу', hint: 'сцена, написанная под текущую половину дня' },
  { key: 'base', label: 'Собственный вес', hint: 'базовый вес самой сцены' },
];

export const SelectorPanel: React.FC = () => {
  const selector = useBriefStore(s => s.selector);
  const patchSelector = useBriefStore(s => s.patchSelector);
  const patchWeight = useBriefStore(s => s.patchSelectorWeight);
  const reset = useBriefStore(s => s.resetSelector);

  return (
    <div className={styles.selectorPanel}>
      <div className={styles.selectorHeader}>
        <div>
          <h3 className={styles.selectorTitle}>Режиссура</h3>
          <p className={styles.selectorSub}>
            Как движок выбирает сцену из подходящих. Едет в бандл — перегенерация не нужна.
          </p>
        </div>
        <button type="button" className={styles.selectorReset} onClick={reset}>
          Сбросить
        </button>
      </div>

      <div className={styles.selectorWeights}>
        {WEIGHTS.map(w => (
          <label key={w.key} className={styles.selectorRow} title={w.hint}>
            <span className={styles.selectorLabel}>
              {w.label}
              <span className={styles.selectorHint}>{w.hint}</span>
            </span>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={selector.weights[w.key]}
              onChange={e => patchWeight(w.key, Number(e.target.value))}
            />
            <span className={styles.selectorValue}>{selector.weights[w.key]}</span>
          </label>
        ))}
      </div>

      <div className={styles.selectorFooter}>
        <label className={styles.selectorRow} title="Из скольких лучших вариантов тянуть жребий. 1 — всегда лучший.">
          <span className={styles.selectorLabel}>
            Ширина жребия
            <span className={styles.selectorHint}>1 = строго лучший вариант, без случайности</span>
          </span>
          <input
            type="number"
            min={1}
            max={6}
            value={selector.topN}
            onChange={e => patchSelector({ topN: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>

        <label className={styles.selectorRow} title="Сколько последних собеседников помнит штраф разнообразия.">
          <span className={styles.selectorLabel}>
            Память разнообразия
            <span className={styles.selectorHint}>сколько последних собеседников помнить</span>
          </span>
          <input
            type="number"
            min={1}
            max={6}
            value={selector.varietyWindow}
            onChange={e => patchSelector({ varietyWindow: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>

        <label className={styles.selectorRow} title="Фиксированный seed делает каждое прохождение одинаковым.">
          <span className={styles.selectorLabel}>
            Случайность
            <span className={styles.selectorHint}>фиксированный seed — одинаковые прохождения</span>
          </span>
          <select
            value={selector.seedPolicy}
            onChange={e => patchSelector({ seedPolicy: e.target.value as 'fixed' | 'random' })}
          >
            <option value="random">разная каждый раз</option>
            <option value="fixed">фиксированная</option>
          </select>
        </label>

        {selector.seedPolicy === 'fixed' && (
          <label className={styles.selectorRow}>
            <span className={styles.selectorLabel}>Seed</span>
            <input
              type="number"
              value={selector.fixedSeed ?? 1}
              onChange={e => patchSelector({ fixedSeed: Number(e.target.value) || 1 })}
            />
          </label>
        )}
      </div>

      <p className={styles.selectorNote}>
        Ступень арки и бит хребта всегда вытесняют болтовню — это правило движка, весами не отключается. Жребий тянется
        только среди равноценных.
      </p>
    </div>
  );
};
