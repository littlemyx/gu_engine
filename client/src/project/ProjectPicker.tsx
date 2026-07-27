import React, { useCallback, useState } from 'react';

import { pickProjectFile } from '@/pages/studio/projectFile/fileHandle';
import { applyProject, parseProjectFile } from '@/pages/studio/projectFile/parseProject';
import ActionButton from '@/ui/ActionButton';

import { deleteProject, listProjects, UNNAMED_PROJECT, upsertProject } from './projectRegistry';
import { newProjectId, studioUrl } from './projectScope';

import styles from './ProjectPicker.module.css';

import type { ProjectMeta } from './projectRegistry';

/**
 * Выбор проекта — экран вкладки, не привязанной к истории. Появился вместе с
 * многопроектностью: раз проект живёт в адресе вкладки, открыть редактор «ни с
 * чем» нельзя, и выбор должен быть явным.
 *
 * Любое действие заканчивается переходом на /studio?project=<id> — сторы
 * привязываются к неймспейсу при загрузке страницы, так что новый проект
 * начинается с чистого JS-контекста.
 */

const formatUpdated = (at: number): string =>
  new Date(at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const ProjectRow = ({ project, onDeleted }: { project: ProjectMeta; onDeleted: () => void }) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={styles.row}>
      <button type="button" className={styles.rowMain} onClick={() => window.location.assign(studioUrl(project.id))}>
        <span className={project.name === UNNAMED_PROJECT ? styles.nameUnnamed : styles.name}>{project.name}</span>
        <span className={styles.meta}>изменён {formatUpdated(project.updatedAt)}</span>
      </button>
      {confirming ? (
        <span className={styles.confirm}>
          <b>{project.name}</b> — удалить без возврата?
          <button
            type="button"
            className={styles.confirmAction}
            onClick={() => {
              deleteProject(project.id);
              onDeleted();
            }}
          >
            удалить
          </button>
          <button type="button" className={styles.confirmAction} onClick={() => setConfirming(false)}>
            отмена
          </button>
        </span>
      ) : (
        <button type="button" className={styles.remove} onClick={() => setConfirming(true)}>
          удалить
        </button>
      )}
    </div>
  );
};

const ProjectPicker = () => {
  const [projects, setProjects] = useState<ProjectMeta[]>(() => listProjects());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = useCallback(() => {
    const id = newProjectId();
    upsertProject(id);
    window.location.assign(studioUrl(id));
  }, []);

  const openFile = useCallback(async () => {
    setError(null);
    // Пикер — первым делом: любой await до него закрывает окно пользовательской
    // активации, и Chrome отказывает в доступе к файлам.
    let picked;
    try {
      picked = await pickProjectFile();
    } catch (e) {
      setError(`не удалось открыть файл: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (picked === 'cancelled') return;

    setBusy(true);
    try {
      const parsed = await parseProjectFile(picked.file);
      if ('error' in parsed) {
        setError(`файл не открыт: ${parsed.error}`);
        return;
      }
      // Вкладка не привязана к проекту, поэтому applyProject сам выберет ветку
      // «записать снимок и уйти» — на id из файла или на свежий.
      const result = await applyProject(parsed);
      if (!result.ok) setError(`не удалось открыть проект: ${result.error}`);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Выберите проект</h1>
        <p className={styles.subtitle}>
          Каждая вкладка ведёт свой проект. Две истории можно держать открытыми рядом — генерации в них идут независимо.
        </p>

        {projects.length > 0 ? (
          <div className={styles.list}>
            {projects.map(project => (
              <ProjectRow key={project.id} project={project} onDeleted={() => setProjects(listProjects())} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            Проектов пока нет. Создайте новый или откройте файл <b>.guproj</b>.
          </div>
        )}

        <div className={styles.actions}>
          <ActionButton onLight label="Новый проект" disabled={busy} onClick={createProject} />
          <ActionButton
            onLight
            label={busy ? 'Открытие…' : 'Открыть файл .guproj'}
            kind="outline"
            disabled={busy}
            onClick={() => void openFile()}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <p className={styles.note}>
          Удаление стирает историю проекта из хранилища браузера — сохранённый файл <b>.guproj</b> не трогается.
          Библиотека префабов общая и остаётся при любом выборе.
        </p>
      </div>
    </div>
  );
};

export default ProjectPicker;
