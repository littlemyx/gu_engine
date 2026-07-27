import React, { useMemo } from 'react';

import { useNarrativeStore } from '@/narrative/narrativeStore';
import ActionButton from '@/ui/ActionButton';

import { useStudioStore } from '../studioStore';

import styles from './panels.module.css';

import type { SegmentIssue } from '@/narrative/types';
import type { Selection } from '../studioStore';

export interface QaPanelProps {
  onRun: () => void;
  running: boolean;
  disabledReason?: string;
}

/**
 * Куда ведёт проблема. Scope-и QA — пути вида `spine/beats/<id>/window`,
 * `dialogue/<unitId>/nodes`, `qa/prose/<unitId>`: по ним восстанавливается
 * сущность, которую надо открыть в инспекторе.
 */
function targetOf(issue: SegmentIssue): Selection {
  const parts = issue.scope.split('/');
  const beatAt = parts.indexOf('beats');
  if (beatAt >= 0 && parts[beatAt + 1]) return { kind: 'beat', id: parts[beatAt + 1] };
  if (parts[0] === 'dialogue' && parts[1]) return { kind: 'unit', unitId: parts[1] };
  if (parts[0] === 'qa' && parts[1] === 'prose' && parts[2]) return { kind: 'unit', unitId: parts[2] };
  return null;
}

/** Док «QA»: плоский список проблем, ошибки первыми. */
const QaPanel = ({ onRun, running, disabledReason }: QaPanelProps) => {
  const storyQA = useNarrativeStore(s => s.storyQA);
  const select = useStudioStore(s => s.select);

  const issues = useMemo(() => {
    const list = storyQA?.issues ?? [];
    return [...list].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  }, [storyQA]);

  const policies = storyQA?.policyReports ?? [];

  return (
    <div className={styles.dockBody}>
      <div className={styles.dockActions}>
        <ActionButton
          label={storyQA?.state === 'done' ? 'Проверить заново' : 'Проверить историю'}
          cost="бесплатно"
          kind="outline"
          disabled={running || Boolean(disabledReason)}
          reason={disabledReason ?? (running ? 'проверка уже идёт' : undefined)}
          onClick={onRun}
        />
      </div>

      {storyQA == null || storyQA.state === 'idle' ? (
        <div className={styles.placeholder}>Проверка ещё не запускалась. Она детерминирована и ничего не стоит.</div>
      ) : storyQA.state === 'running' ? (
        <div className={styles.placeholder}>Проверка идёт…</div>
      ) : issues.length === 0 ? (
        <div className={styles.qaOk}>✓ проблем не найдено</div>
      ) : (
        <div className={styles.qaList}>
          {issues.map((issue, index) => {
            const target = targetOf(issue);
            return (
              <div key={`${issue.scope}-${index}`} className={styles.qaRow}>
                <span className={issue.severity === 'error' ? styles.qaBad : styles.qaWarn}>
                  {issue.severity === 'error' ? '✗' : '⚠'}
                </span>
                <span className={styles.qaScope}>{issue.scope}</span>
                <span className={styles.qaMessage} title={issue.message}>
                  {issue.message}
                </span>
                {target && (
                  <button type="button" className={styles.qaAction} onClick={() => select(target)}>
                    Открыть
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {policies.length > 0 && (
        <div className={styles.qaPolicies}>
          {policies.map(report => (
            <span key={`${report.policy}-${report.seed}`}>
              {report.policy}: {report.reachedFinale ? 'финал ✓' : 'финал ✗'} ·{' '}
              {report.endingSatisfied ?? 'без концовки'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default QaPanel;
