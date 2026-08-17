import React from 'react';

import ConsequenceRow from '@/ui/kit/molecules/ConsequenceRow';
import ModalFrame from '@/ui/kit/molecules/ModalFrame';
import SignActions from '@/ui/kit/molecules/SignActions';

import { zoneOfStage } from './zoneModel';

import styles from './shell.module.css';

import type { PrefabConsequences } from './prefabConsequences';
import type { ArtifactStage } from '@/artifacts/types';

export interface ConsequencesModalProps {
  /** Что вставляем — заголовок модалки, напр. «Алина v2 → каст». */
  title: string;
  consequences: PrefabConsequences;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Превью последствий перед вставкой префаба: что протухнет и во что обойдётся
 * пересборка. Правка входа — не запуск: деньги здесь не тратятся, поэтому
 * кнопка подтверждения применяет вставку, а пересборку автор закажет позже,
 * через обычный колл-щит (там же решатся и конфликты с авторским).
 */
const ConsequencesModal = ({ title, consequences, onConfirm, onCancel }: ConsequencesModalProps) => {
  const { extra, decisions, cost } = consequences;
  const byStage = groupByStage(extra);

  return (
    <ModalFrame kicker="ВСТАВКА" title={title} subtitle={subtitle(consequences)} width={360}>
      {byStage.length === 0 ? (
        <p className={styles.empty}>Вставка ничего не обесценит: пересобирать нечего.</p>
      ) : (
        <div className={styles.section}>
          <div className={styles.kicker}>Протухнет · {extra.length}</div>
          {byStage.map(row => (
            <ConsequenceRow
              key={row.stage}
              glyph="◐"
              text={rowText(row)}
              action={row.cost > 0 ? `довести ≈$${row.cost.toFixed(2)}` : 'бесплатно'}
            />
          ))}
        </div>
      )}

      {decisions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.kicker}>Конфликты · {decisions.length}</div>
          <p className={styles.empty}>
            Протухнет авторское или запертое — прогон спросит решение («моё»/«дубль») в колл-щите.
          </p>
        </div>
      )}

      <SignActions
        cancelLabel="Не вставлять"
        confirmLabel="Вставить"
        price={cost > 0 ? `потом ≈$${cost.toFixed(2)}` : undefined}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </ModalFrame>
  );
};

interface StageRow {
  stage: ArtifactStage;
  count: number;
  cost: number;
}

/** Свёртка позиций по стадиям: автору важна цена шага, а не каждый юнит. */
function groupByStage(extra: PrefabConsequences['extra']): StageRow[] {
  const map = new Map<ArtifactStage, StageRow>();
  for (const p of extra) {
    const row = map.get(p.stage) ?? { stage: p.stage, count: 0, cost: 0 };
    row.count += 1;
    row.cost += p.estCost;
    map.set(p.stage, row);
  }
  return [...map.values()];
}

function rowText(row: StageRow): string {
  const zone = zoneOfStage(row.stage);
  const name = zone ? `${zone.ru} · ${row.stage}` : row.stage;
  return row.count > 1 ? `${name} — позиций: ${row.count}` : name;
}

function subtitle(c: PrefabConsequences): string {
  if (c.extra.length === 0 && c.decisions.length === 0) return 'без последствий';
  return c.cost > 0 ? `пересборка ≈$${c.cost.toFixed(2)}` : `позиций: ${c.extra.length}`;
}

export default ConsequencesModal;
