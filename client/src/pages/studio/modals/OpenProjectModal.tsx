import React from 'react';

import ActionButton from '@/ui/ActionButton';
import { pluralize } from '@/ui/plural';

import Modal from './Modal';

import styles from './modals.module.css';

import type { ProjectSummary } from '../projectFile/parseProject';

export interface OpenProjectModalProps {
  summary: ProjectSummary;
  /** Замечания разбора: старая схема, неполный манифест ассетов. */
  problems: string[];
  /** В редакторе есть история, которую открытие затрёт. */
  hasStory: boolean;
  /** Файл чужого проекта: откроется отдельным проектом, вкладка уйдёт на него. */
  foreign: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function formatSavedAt(iso: string): string {
  if (!iso) return 'дата неизвестна';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'дата неизвестна' : date.toLocaleString('ru-RU');
}

/**
 * Подтверждение открытия. Архив к этому моменту уже разобран — диалог
 * показывает, что именно лежит в файле, чтобы решение о затирании текущей
 * работы принималось по содержимому, а не по имени файла.
 */
const OpenProjectModal = ({ summary, problems, hasStory, foreign, onConfirm, onClose }: OpenProjectModalProps) => (
  <Modal
    title="Открыть проект?"
    subtitle={`«${summary.name}» · сохранён ${formatSavedAt(summary.savedAt)}`}
    onClose={onClose}
    footer={
      <>
        <ActionButton onLight label="Отмена" kind="ghost" onClick={onClose} />
        <ActionButton onLight label={foreign ? 'Открыть проектом' : 'Открыть'} onClick={onConfirm} />
      </>
    }
  >
    <div>
      В файле: {summary.hasSpine ? 'готовая история' : 'история ещё не сгенерирована'} ·{' '}
      {pluralize(summary.loveInterests, 'персонаж', 'персонажа', 'персонажей')} · {summary.images}{' '}
      {pluralize(summary.images, 'картинка', 'картинки', 'картинок')} · {summary.audio}{' '}
      {pluralize(summary.audio, 'трек', 'трека', 'треков')}.
    </div>

    {summary.prefabs > 0 && (
      <div className={styles.note}>
        Использовано префабов: {summary.prefabs}. Сами они уже вшиты в проект — библиотека для открытия не нужна.
      </div>
    )}

    {problems.length > 0 && (
      <div className={styles.field}>
        <span className={styles.label}>Проблемы файла · открыть можно</span>
        <div className={styles.list}>
          {problems.map(problem => (
            <div key={problem} className={styles.quote}>
              ▨ {problem}
            </div>
          ))}
        </div>
      </div>
    )}

    <div className={styles.note}>
      Картинки и звук из архива будут загружены на локальные серверы ассетов. Совпавшие по хэшу переиспользуются без
      загрузки.
    </div>

    {foreign ? (
      <div className={styles.note}>
        Файл принадлежит <b>другому проекту</b> — он откроется отдельным проектом, и вкладка перейдёт на него. Свой же
        файл (или файл без id) заменил бы содержимое текущего.
      </div>
    ) : (
      hasStory && (
        <div className={styles.warning}>
          Текущие бриф, история и медиа будут заменены. Несохранённую работу вернуть будет нельзя.
        </div>
      )
    )}
  </Modal>
);

export default OpenProjectModal;
