import React, { useMemo, useState } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import ChecklistRow from '@/ui/kit/molecules/ChecklistRow';
import HintNote from '@/ui/kit/molecules/HintNote';
import IssueQuote from '@/ui/kit/molecules/IssueQuote';
import IssueRoute from '@/ui/kit/molecules/IssueRoute';
import IssueRow from '@/ui/kit/molecules/IssueRow';
import KpiBlock from '@/ui/kit/molecules/KpiBlock';
import QARow from '@/ui/kit/molecules/QARow';
import ReachabilityChart from '@/ui/kit/molecules/ReachabilityChart';

import { deriveQa } from './qaModel';

import styles from './shell.module.css';
import qa from './QaZone.module.css';

/**
 * Зона 5 «Проверка»: сводка KPI, проблемы Story QA с маршрутом «куда идти
 * чинить», отчёт симуляции политик и чек-лист достижимости концовок.
 *
 * Строка проблемы кликается сама — цитата и маршрут появляются под списком,
 * а не в попапе (инвариант шелла: выделение открывает деталь на месте).
 * Данных своих нет: всё выводит `deriveQa` из `storyQA`/`spine` narrativeStore
 * и брифа.
 */
const QaZone = () => {
  const brief = useBriefStore(s => s.brief);
  const spine = useNarrativeStore(s => s.spine);
  const storyQA = useNarrativeStore(s => s.storyQA);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const model = useMemo(() => deriveQa({ brief, spine, storyQA }), [brief, spine, storyQA]);
  const selected = model.issues.find(i => i.id === selectedId) ?? null;

  return (
    <div className={styles.zoneBody}>
      <h1 className={styles.zoneHeading}>Проверка</h1>
      <p className={styles.zoneHint}>достижимость, тупики, континуити</p>

      <div className={styles.section}>
        <div className={styles.kicker}>Итог</div>
        <KpiBlock items={model.kpi} />
      </div>

      {!model.hasRun && (
        <div className={styles.section}>
          <HintNote text="Story QA ещё не запускался — проблемы и симуляция появятся после прогона в колл-щите; ниже — то, что уже известно по хребту." />
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.kicker}>Проблемы{model.hasRun ? ` · ${model.issues.length}` : ''}</div>
        {model.issues.length === 0 ? (
          <p className={styles.empty}>{model.hasRun ? 'Проблем не найдено — гейт открыт.' : 'Прогонов ещё не было.'}</p>
        ) : (
          <div className={qa.list}>
            {model.issues.map(issue => (
              <IssueRow
                key={issue.id}
                text={issue.text}
                kind={issue.kind}
                action={issue.actionLabel}
                selected={selectedId === issue.id}
                onClick={() => setSelectedId(prev => (prev === issue.id ? null : issue.id))}
              />
            ))}
          </div>
        )}

        {selected && (
          <div className={qa.detail}>
            <IssueQuote quote={selected.quote} note={selected.quoteNote} />
            <IssueRoute lines={[{ text: selected.routeLine }]} onDark />
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.kicker}>Симуляция политик{model.hasRun ? ` · ${model.policies.length}` : ''}</div>
        {model.policies.length === 0 ? (
          <p className={styles.empty}>Политики ещё не прогонялись.</p>
        ) : (
          <div className={qa.list}>
            {model.policies.map(p => (
              <QARow key={p.id} kind={p.kind} title={p.title} meta={p.meta} />
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.kicker}>Чек-лист достижимости</div>
        {model.endings.length === 0 ? (
          <p className={styles.empty}>В хребте пока нет ни одной концовки.</p>
        ) : (
          <div className={qa.list}>
            {model.endings.map(row => (
              <ChecklistRow key={row.id} title={row.title} meta={row.meta} state={row.state} onDark={false} />
            ))}
          </div>
        )}
      </div>

      {model.reachabilityRows.length > 0 && (
        <div className={styles.section}>
          <ReachabilityChart title={model.reachabilityTitle} rows={model.reachabilityRows} />
        </div>
      )}
    </div>
  );
};

export default QaZone;
