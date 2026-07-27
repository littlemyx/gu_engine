import React from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { formatCost, useRunCost } from '@/narrative/costModel';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { captureAudioPrefab, captureCharacterPrefab, captureWorldPrefab } from '@/prefabs/applyPrefab';
import { usePrefabStore } from '@/prefabs/prefabStore';
import { pluralize } from '@/ui/plural';

import { useStudioStore } from '../studioStore';

import BriefEditorModal from './BriefEditorModal';
import ExportBlockedModal from './ExportBlockedModal';
import ImportBriefModal from './ImportBriefModal';
import LocationMoodsModal from './LocationMoodsModal';
import PosesModal from './PosesModal';
import SelectorModal from './SelectorModal';
import NewProjectModal from './NewProjectModal';
import OpenProjectModal from './OpenProjectModal';
import ResetDraftModal from './ResetDraftModal';
import SavePrefabModal from './SavePrefabModal';

import { appendRunLog, clearRunLog } from '@/narrative/runLog';
import { projectId } from '@/project/projectScope';
import { setCurrentHandle } from '../projectFile/fileHandle';
import { startNewProject } from '../projectFile/newProject';
import { applyProject } from '../projectFile/parseProject';

import type { ExportGate } from '../useStudioActions';
import type { PrefabKind } from '@/prefabs/prefabTypes';
import type { PoseItemStatus, PoseRegenEntry, PoseRegenStatus } from '@/narrative/useRegeneratePoses';

export interface ModalHostProps {
  exportGate: ExportGate;
  onExportAnyway: () => void;
  onDiscardDraft: () => void;
  onArchiveDraft: () => void;
  onOpenQaReport: () => void;
  onNotify: (message: string) => void;
  /** Запуск аудио-конвейера из «Настроений локаций». */
  audioGen: { onGenerate: () => void; disabledReason?: string };
  /** Догенерация поз для модалки 7d. */
  poseGen: {
    status: PoseRegenStatus;
    poseStatuses: Record<string, PoseItemStatus>;
    onStart: (entries: PoseRegenEntry[]) => void;
    disabledReason?: string;
  };
}

/**
 * Один хост на все диалоги: какой открыт, решает studioStore. Данные для
 * диалога собираются здесь, чтобы модалки оставались чистыми формами.
 */
const ModalHost = ({
  exportGate,
  onExportAnyway,
  onDiscardDraft,
  onArchiveDraft,
  onOpenQaReport,
  onNotify,
  audioGen,
  poseGen,
}: ModalHostProps) => {
  const modal = useStudioStore(s => s.modal);
  const closeModal = useStudioStore(s => s.closeModal);

  const brief = useBriefStore(s => s.brief);
  const setBrief = useBriefStore(s => s.setBrief);
  const calendarRun = useNarrativeStore(s => s.calendarRun);
  const spine = useNarrativeStore(s => s.spine);
  const storyQA = useNarrativeStore(s => s.storyQA);
  const characters = useNarrativeStore(s => s.characters);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const images = useNarrativeStore(s => s.images);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const spent = useRunCost(s => s.spent);
  const savePrefab = usePrefabStore(s => s.savePrefab);

  if (modal == null) return null;

  if (modal.kind === 'resetDraft') {
    return (
      <ResetDraftModal
        phase={calendarRun?.phase ?? '—'}
        completed={calendarRun?.progress.completed ?? 0}
        total={calendarRun?.progress.total ?? 0}
        spent={`≈ ${formatCost(spent)}`}
        onClose={closeModal}
        onConfirm={archive => {
          if (archive) onArchiveDraft();
          onDiscardDraft();
          closeModal();
          onNotify('черновик сброшен');
        }}
      />
    );
  }

  if (modal.kind === 'exportBlocked') {
    const warnings = (storyQA?.issues ?? []).filter(i => i.severity === 'warning').length;
    return (
      <ExportBlockedModal
        errors={'errors' in exportGate ? exportGate.errors : []}
        warnings={warnings}
        qaRan={storyQA?.state === 'done'}
        stackReason={'stackReason' in exportGate ? exportGate.stackReason : undefined}
        onClose={closeModal}
        onOpenReport={() => {
          closeModal();
          onOpenQaReport();
        }}
        onExportAnyway={() => {
          closeModal();
          onExportAnyway();
        }}
      />
    );
  }

  if (modal.kind === 'brief') {
    return <BriefEditorModal hasStory={spine != null} onClose={closeModal} />;
  }

  if (modal.kind === 'selector') {
    return <SelectorModal onClose={closeModal} />;
  }

  if (modal.kind === 'locationMoods') {
    return (
      <LocationMoodsModal
        onClose={closeModal}
        onGenerateAudio={audioGen.onGenerate}
        generateDisabledReason={audioGen.disabledReason}
      />
    );
  }

  if (modal.kind === 'poses') {
    return (
      <PosesModal
        brief={brief}
        status={poseGen.status}
        poseStatuses={poseGen.poseStatuses}
        disabledReason={poseGen.disabledReason}
        onStart={poseGen.onStart}
        onClose={closeModal}
      />
    );
  }

  if (modal.kind === 'importBrief') {
    return (
      <ImportBriefModal
        hasStory={spine != null}
        onClose={closeModal}
        onImport={imported => {
          setBrief(imported);
          closeModal();
          onNotify(
            `бриф импортирован · ${pluralize(imported.loveInterests.length, 'персонаж', 'персонажа', 'персонажей')}`,
          );
        }}
      />
    );
  }

  if (modal.kind === 'newProject') {
    return (
      <NewProjectModal
        hasStory={spine != null}
        spent={`≈ ${formatCost(spent)}`}
        onClose={closeModal}
        onConfirm={(name, template) => {
          closeModal();
          onNotify('новый проект…');
          startNewProject({ name, sample: template === 'sample' });
        }}
      />
    );
  }

  if (modal.kind === 'openProject') {
    const { parsed, handle } = modal;
    return (
      <OpenProjectModal
        summary={parsed.summary}
        problems={parsed.problems}
        hasStory={spine != null}
        // Чужой файл открывается отдельным проектом (см. decideApplyTarget).
        foreign={Boolean(parsed.project.projectId && projectId && parsed.project.projectId !== projectId)}
        onClose={closeModal}
        onConfirm={() => {
          closeModal();
          onNotify('открытие проекта…');
          void applyProject(parsed, {
            onProgress: p => {
              if (p.stage === 'upload' && p.total > 0) onNotify(`открытие · ассеты ${p.done}/${p.total}`);
            },
          }).then(result => {
            if (!result.ok) {
              appendRunLog('error', `проект не открыт · ${result.error}`);
              onNotify(`не удалось открыть проект: ${result.error}`);
              return;
            }
            // Файл чужого проекта уже записан в его неймспейс, и вкладка уходит
            // туда. Отчитываться некому: страница перезагружается.
            if (result.navigated) return;
            // Открытый файл становится целью «Сохранить»: правки поедут туда же,
            // откуда пришли, а не в новый файл в Загрузках.
            setCurrentHandle(handle);
            // Консоль относится к сессии работы над проектом: со сменой
            // проекта старые строки только путают.
            clearRunLog();
            const failed = result.failedUploads.length;
            appendRunLog(
              failed > 0 ? 'error' : 'ok',
              `проект открыт · «${parsed.summary.name}» · залито ${result.uploaded} · переиспользовано ${result.reusedExisting}` +
                (failed > 0 ? ` · не залито ${failed}` : ''),
            );
            onNotify(
              failed > 0
                ? `проект открыт · ${failed} ассетов не загрузилось — проверьте серверы ассетов`
                : `проект открыт · «${parsed.summary.name}»`,
            );
          });
        }}
      />
    );
  }

  // ── Сохранение префаба ────────────────────────────────────────────────────
  const from = modal.from;
  const kind: PrefabKind = from?.kind === 'character' ? 'character' : from?.kind === 'location' ? 'world' : 'audio_set';
  const origin = spine?.title || 'без названия';

  const li = from?.kind === 'character' ? brief.loveInterests.find(l => l.id === from.id) : null;
  const defaultName =
    kind === 'character'
      ? li?.name || li?.id || 'персонаж'
      : kind === 'world'
      ? `Мир «${origin}»`
      : `Аудио «${origin}»`;

  const backgrounds = Object.entries(images).filter(
    ([key, image]) => key.startsWith('loc:') && image.status === 'done',
  ).length;

  const parts =
    kind === 'character'
      ? [
          { label: 'карточка персонажа: архетип, речь, внешность', included: true },
          {
            label: 'спрайт и позы',
            included: li ? characters[li.id]?.status === 'done' : false,
            reason: 'спрайт ещё не нарисован',
          },
          { label: 'голосовые вариации темы', included: li ? Boolean(li.id) : false },
          { label: 'диалоги — привязаны к миру, недоступно', included: false },
        ]
      : kind === 'world'
      ? [
          { label: `локации и связность (${worldModel?.locations.length ?? 0})`, included: true },
          { label: `фоны (${backgrounds})`, included: backgrounds > 0, reason: 'фонов ещё нет' },
          { label: 'события — привязаны к касту, недоступно', included: false },
        ]
      : [
          { label: 'подложка проекта', included: audioBase?.status === 'done', reason: 'не сгенерирована' },
          { label: 'эмбиенты настроений и особых локаций', included: true },
          { label: 'SFX-набор', included: true },
        ];

  return (
    <SavePrefabModal
      kind={kind}
      defaultName={defaultName}
      parts={parts}
      onClose={closeModal}
      onSave={name => {
        const prefab =
          kind === 'character' && li
            ? captureCharacterPrefab(li.id, origin)
            : kind === 'world'
            ? captureWorldPrefab(name, origin)
            : captureAudioPrefab(name, origin);

        if (!prefab) {
          closeModal();
          onNotify('нечего сохранять: артефакта нет в проекте');
          return;
        }
        savePrefab({ ...prefab, name });
        closeModal();
        onNotify(`префаб «${name}» сохранён в библиотеку`);
      }}
    />
  );
};

export default ModalHost;
