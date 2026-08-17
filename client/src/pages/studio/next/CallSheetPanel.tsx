import React, { useState } from 'react';

import DecisionRow from '@/ui/kit/molecules/DecisionRow';
import EstimateRow from '@/ui/kit/molecules/EstimateRow';
import EstimateTotal from '@/ui/kit/molecules/EstimateTotal';
import ModalFrame from '@/ui/kit/molecules/ModalFrame';
import SignActions from '@/ui/kit/molecules/SignActions';

import { zoneOfStage } from './zoneModel';

import styles from './shell.module.css';

import type { CallSheet, CallSheetPosition, DecisionPick, StageCost } from '@/processes/callSheet';
import type { ArtifactKey } from '@/artifacts/types';
import type { StatusGlyphStatus } from '@/ui/kit/atoms/StatusGlyph';

export interface CallSheetPanelProps {
  callSheet: CallSheet;
  /** Кикер модала, напр. «ПРОГОН #13». */
  runLabel?: string;
  /** Прогон уже стартовал по нажатию — кнопка подписи крутит спиннер. */
  signing?: boolean;
  /**
   * Смета стадии. Нужна, чтобы дубль по конфликту попал в итог: пока автор не
   * решил, ведомость такую позицию не считает — а решив «дубль», он заказывает
   * работу, и цена подписи обязана вырасти у него на глазах.
   */
  stageCost?: StageCost;
  /** Подпись отдаёт решения по конфликтам: без них прогон их не исполнит. */
  onSign: (decided: Partial<Record<ArtifactKey, DecisionPick>>) => void;
  onCancel: () => void;
}

const FRESHNESS_STATUS: Record<CallSheetPosition['freshness'], StatusGlyphStatus> = {
  fresh: 'fresh',
  stale: 'stale',
  missing: 'none',
};

/**
 * Колл-щит: полный список позиций, которые прогон сделает (и не сделает — с
 * ценой каждой), плюс конфликты, которые прогон не имеет права молча
 * разрешить сам.
 *
 * Компонент тупой: принимает готовый `CallSheet` и рисует его. Единственное
 * собственное состояние — какой выбор автор сделал по каждому конфликту
 * («оставить моё» / «дубль»). Персистить его незачем: выбор живёт ровно до
 * подписи, а подпись отдаёт его целиком наружу — там он и превращается в план
 * прогона (что обойти, что пересчитать).
 */
const CallSheetPanel = ({
  callSheet,
  runLabel = 'ПРОГОН',
  signing = false,
  stageCost,
  onSign,
  onCancel,
}: CallSheetPanelProps) => {
  const [decided, setDecided] = useState<Partial<Record<ArtifactKey, DecisionPick>>>({});

  const { positions, decisions, generate, total } = callSheet;
  const shown = positions.filter(p => p.action !== 'needs-decision');
  const skipped = positions.length - generate.length - decisions.length;

  const allDecided = decisions.every(d => decided[d.key]);
  const canSign = decisions.length === 0 || allDecided;

  const redo = decisions.filter(d => decided[d.key] === 'дубль');
  const signedTotal = total + redo.reduce((sum, d) => sum + (stageCost?.[d.stage] ?? 0), 0);

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
        <EstimateTotal label="Итого" price={priceText(signedTotal)} size="large" accent={signedTotal > 0} />
        <p className={styles.empty}>
          к запуску: {generate.length + redo.length} · пропущено (свежее/заперто): {Math.max(skipped, 0)}
        </p>
      </div>

      <SignActions
        confirmLabel="Подписать и запустить"
        price={signedTotal > 0 ? priceText(signedTotal) : undefined}
        disabled={!canSign}
        loading={signing}
        onCancel={onCancel}
        onConfirm={() => onSign(decided)}
      />
    </ModalFrame>
  );
};

function priceText(cost: number): string {
  return cost > 0 ? `≈$${cost.toFixed(2)}` : '$0';
}

/** «Замысел · cast/heroine» — зона отвечает за стадию, дальше её собственный адрес. */
function positionLabel(position: CallSheetPosition): string {
  // Нетронутая стадия адресуется целиком: «spine/» без элемента — это «вся
  // стадия впереди», хвостовой слэш тут не адрес, а шум.
  const address = position.key.endsWith('/') ? position.stage : position.key;
  const zone = zoneOfStage(position.stage);
  return zone ? `${zone.ru} · ${address}` : address;
}

function subtitle(sheet: CallSheet): string {
  if (sheet.positions.length === 0) return 'пусто';
  return sheet.decisions.length > 0 ? `конфликтов: ${sheet.decisions.length}` : `позиций: ${sheet.positions.length}`;
}

export default CallSheetPanel;
