import React, { useState } from 'react';

import DecisionRow from '@/ui/kit/molecules/DecisionRow';
import EstimateRow from '@/ui/kit/molecules/EstimateRow';
import EstimateTotal from '@/ui/kit/molecules/EstimateTotal';
import ModalFrame from '@/ui/kit/molecules/ModalFrame';
import SignActions from '@/ui/kit/molecules/SignActions';

import { zoneOfStage } from './zoneModel';

import styles from './shell.module.css';

import type { CallSheet, CallSheetPosition } from '@/processes/callSheet';
import type { ArtifactKey } from '@/artifacts/types';
import type { StatusGlyphStatus } from '@/ui/kit/atoms/StatusGlyph';

export interface CallSheetPanelProps {
  callSheet: CallSheet;
  /** Кикер модала, напр. «ПРОГОН #13». */
  runLabel?: string;
  /** Прогон уже стартовал по нажатию — кнопка подписи крутит спиннер. */
  signing?: boolean;
  onSign: () => void;
  onCancel: () => void;
}

const FRESHNESS_STATUS: Record<CallSheetPosition['freshness'], StatusGlyphStatus> = {
  fresh: 'fresh',
  stale: 'stale',
  missing: 'none',
};

type Pick = 'моё' | 'дубль';

/**
 * Колл-щит: полный список позиций, которые прогон сделает (и не сделает — с
 * ценой каждой), плюс конфликты, которые прогон не имеет права молча
 * разрешить сам.
 *
 * Компонент тупой: принимает готовый `CallSheet` и рисует его. Единственное
 * собственное состояние — какой выбор автор сделал по каждому конфликту
 * («оставить моё» / «дубль»); оно локальное и не персистится — сам конфликт
 * решается за пределами колл-щита (инспектор артефакта), здесь только
 * блокируется подпись, пока выбор не сделан по каждой строке.
 */
const CallSheetPanel = ({ callSheet, runLabel = 'ПРОГОН', signing = false, onSign, onCancel }: CallSheetPanelProps) => {
  const [decided, setDecided] = useState<Partial<Record<ArtifactKey, Pick>>>({});

  const { positions, decisions, generate, total } = callSheet;
  const shown = positions.filter(p => p.action !== 'needs-decision');
  const skipped = positions.length - generate.length - decisions.length;

  const allDecided = decisions.every(d => decided[d.key]);
  const canSign = decisions.length === 0 || allDecided;

  return (
    <ModalFrame kicker={runLabel} title="Колл-щит" subtitle={subtitle(callSheet)} width={360}>
      <div className={styles.section}>
        <div className={styles.kicker}>Позиции · {shown.length}</div>
        {shown.length === 0 ? (
          <p className={styles.empty}>Ведомость пуста — прогону нечего делать.</p>
        ) : (
          shown.map(position => (
            <EstimateRow
              key={position.key}
              text={positionLabel(position)}
              price={priceText(position.estCost)}
              kind={position.action === 'locked-skip' ? 'locked' : 'position'}
              status={FRESHNESS_STATUS[position.freshness]}
              frame="bottom"
            />
          ))
        )}
      </div>

      {decisions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.kicker}>Требуют решения · {decisions.length}</div>
          {decisions.map(d => (
            <DecisionRow
              key={d.key}
              text={`${positionLabel(d)} — входы изменились, а строка ваша`}
              redoLabel="дубль"
              chosen={decided[d.key] ?? 'нет'}
              onPick={choice => setDecided(prev => ({ ...prev, [d.key]: choice }))}
            />
          ))}
          {!canSign && <p className={styles.empty}>Решите каждый конфликт, чтобы подписать смету.</p>}
        </div>
      )}

      <div className={styles.section}>
        <EstimateTotal label="Итого" price={priceText(total)} size="large" accent={total > 0} />
        <p className={styles.empty}>
          к запуску: {generate.length} · пропущено (свежее/заперто): {Math.max(skipped, 0)}
        </p>
      </div>

      <SignActions
        confirmLabel="Подписать и запустить"
        price={total > 0 ? priceText(total) : undefined}
        disabled={!canSign}
        loading={signing}
        onCancel={onCancel}
        onConfirm={onSign}
      />
    </ModalFrame>
  );
};

function priceText(cost: number): string {
  return cost > 0 ? `≈$${cost.toFixed(2)}` : '$0';
}

/** «Замысел · cast/heroine» — зона отвечает за стадию, дальше её собственный адрес. */
function positionLabel(position: CallSheetPosition): string {
  const zone = zoneOfStage(position.stage);
  return zone ? `${zone.ru} · ${position.key}` : position.key;
}

function subtitle(sheet: CallSheet): string {
  if (sheet.positions.length === 0) return 'пусто';
  return sheet.decisions.length > 0 ? `конфликтов: ${sheet.decisions.length}` : `позиций: ${sheet.positions.length}`;
}

export default CallSheetPanel;
