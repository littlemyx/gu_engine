import React from 'react';

import { useBriefStore } from '@/narrative';
import ActionButton from '@/ui/ActionButton';

import Modal from './Modal';

import styles from './modals.module.css';

import type { SelectorWeights } from 'gu-engine-story-core';

type WeightMeta = { key: keyof SelectorWeights; hint: string };

/** Порядок и пояснения — из макета 7b: имя слагаемого + что оно значит. */
const WEIGHTS: WeightMeta[] = [
  { key: 'base', hint: 'авторский вес юнита' },
  { key: 'specificity', hint: 'узость guard-а (правило QBN)' },
  { key: 'arcProgress', hint: 'следующая ступень арки' },
  { key: 'urgency', hint: 'окно закрывается' },
  { key: 'variety', hint: 'штраф недавнему персонажу' },
  { key: 'pacing', hint: 'окно прицельно в фазу' },
  { key: 'source', hint: 'хребет › агенда › филлер' },
];

const WEIGHT_MAX = 5;

/** Перебросить: пятизначный seed читается глазами и влезает в статус-бар. */
const rollSeed = () => Math.floor(10000 + Math.random() * 90000);

export interface SelectorModalProps {
  onClose: () => void;
}

/**
 * «Режиссура · веса селектора»: единственная ручка, меняющая поведение игры
 * без перегенерации — едет в бандл как данные. Правки применяются в briefStore
 * сразу; «Применить» лишь закрывает диалог.
 */
const SelectorModal = ({ onClose }: SelectorModalProps) => {
  const selector = useBriefStore(s => s.selector);
  const patchSelector = useBriefStore(s => s.patchSelector);
  const patchWeight = useBriefStore(s => s.patchSelectorWeight);
  const reset = useBriefStore(s => s.resetSelector);

  return (
    <Modal
      title="Режиссура · веса селектора"
      subtitle="score = Σ term × вес · слагаемые видны в трейсе ?gudebug"
      wide
      onClose={onClose}
      footer={
        <>
          <ActionButton onLight kind="outline" label="Сбросить к дефолтам" onClick={reset} />
          <ActionButton onLight label="Применить" onClick={onClose} />
        </>
      }
    >
      <div className={styles.weightList}>
        {WEIGHTS.map(w => (
          <label key={w.key} className={styles.weightRow}>
            <span className={styles.weightHead}>
              <span className={styles.weightName}>{w.key}</span>
              <span className={styles.weightHint}>— {w.hint}</span>
              <span className={styles.weightValue}>{selector.weights[w.key].toFixed(1)}</span>
            </span>
            <input
              className={styles.weightRange}
              type="range"
              min={0}
              max={WEIGHT_MAX}
              step={0.1}
              value={selector.weights[w.key]}
              onChange={e => patchWeight(w.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <div className={styles.stepGrid}>
        <label className={styles.field}>
          <span className={styles.label}>Ширина жребия · topN</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={6}
            value={selector.topN}
            onChange={e => patchSelector({ topN: Math.max(1, Number(e.target.value) || 1) })}
          />
          <span className={styles.note}>1 = чистый argmax, без жребия</span>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Память разнообразия · varietyWindow</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={6}
            value={selector.varietyWindow}
            onChange={e => patchSelector({ varietyWindow: Math.max(1, Number(e.target.value) || 1) })}
          />
          <span className={styles.note}>штраф за LI из последних K сцен</span>
        </label>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Политика seed</span>
        <div className={styles.seedRow}>
          <div className={styles.seedTabs} role="tablist" aria-label="Политика seed">
            {(['random', 'fixed'] as const).map(policy => (
              <button
                key={policy}
                type="button"
                role="tab"
                aria-selected={selector.seedPolicy === policy}
                className={`${styles.seedTab} ${selector.seedPolicy === policy ? styles.seedTabActive : ''}`}
                onClick={() =>
                  patchSelector(
                    policy === 'fixed'
                      ? { seedPolicy: policy, fixedSeed: selector.fixedSeed ?? rollSeed() }
                      : { seedPolicy: policy },
                  )
                }
              >
                {policy}
              </button>
            ))}
          </div>
          {selector.seedPolicy === 'fixed' && (
            <>
              <input
                className={`${styles.input} ${styles.mono} ${styles.seedInput}`}
                type="number"
                value={selector.fixedSeed ?? 1}
                onChange={e => patchSelector({ fixedSeed: Number(e.target.value) || 1 })}
              />
              <ActionButton
                onLight
                kind="ghost"
                label="Перебросить"
                onClick={() => patchSelector({ fixedSeed: rollSeed() })}
              />
            </>
          )}
        </div>
        {selector.seedPolicy === 'random' && (
          <span className={styles.note}>каждое прохождение тянет жребий по-своему</span>
        )}
      </div>

      <div className={styles.quote}>
        Жребий тянется только внутри старшего непустого <strong>яруса</strong>: ступень арки → хребет → филлер. Веса
        выбирают среди равноценных — уронить сюжет болтовнёй они не могут.
      </div>
    </Modal>
  );
};

export default SelectorModal;
