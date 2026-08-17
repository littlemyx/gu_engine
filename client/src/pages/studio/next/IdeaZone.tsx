import React, { useMemo, useState } from 'react';

import { useNarrativeStore } from '@/narrative/narrativeStore';
import { blankPrefab } from '@/prefabs/blankPrefab';
import { usePrefabStore } from '@/prefabs/prefabStore';
import HintNote from '@/ui/kit/molecules/HintNote';
import Input from '@/ui/kit/atoms/Input';
import MutedText from '@/ui/kit/atoms/MutedText';
import OutlineButton from '@/ui/kit/atoms/OutlineButton';
import PrefabCard from '@/ui/kit/molecules/PrefabCard';
import RoleCard from '@/ui/kit/molecules/RoleCard';
import SearchField from '@/ui/kit/molecules/SearchField';

import { useStudioProjectStore } from '../studioProjectStore';
import { acceptsKind, deriveCasting, roleGapPrefix } from './castingModel';
import { useRoleGeneration } from './useRoleGeneration';

import styles from './shell.module.css';
import casting from './casting.module.css';

import type { Brief } from '@/narrative/types';
import type { CastingRole } from './castingModel';
import type { PrefabKind } from '@/prefabs/prefabTypes';

const GLYPH: Record<PrefabKind, string> = { character: '◐', world: '▣', audio_set: '♪' };
const KIND_RU: Record<PrefabKind, string> = { character: 'персонаж', world: 'мир', audio_set: 'аудио-набор' };

/** Пустая карточка не молчит: имя-заглушка говорит, чего роль ждёт. */
function placeholderName(role: CastingRole): string {
  return role.cast === 'generated' ? '— придумает генератор' : '— не назначена';
}

export interface IdeaZoneProps {
  brief: Brief;
}

/**
 * Зона 0 «Замысел»: кастинг-стол и библиотека.
 *
 * Роль закрывается кликом — выбрали слот, выбрали префаб. Перетаскивание
 * добавится позже: клик работает и с клавиатуры, и на узком экране, поэтому
 * он остаётся основным способом, а не запасным.
 *
 * Библиотекой дело не ограничивается: пустая роль — это тупик, если закрыть её
 * нечем, поэтому рядом с «закастовать» стоят три других выхода — завести
 * префаб руками, сгенерировать роль сейчас и отдать её генератору на потом.
 */
const IdeaZone = ({ brief }: IdeaZoneProps) => {
  const castSlots = useStudioProjectStore(s => s.castSlots);
  const castIntent = useStudioProjectStore(s => s.castIntent);
  const castRole = useStudioProjectStore(s => s.castRole);
  const planRoleGeneration = useStudioProjectStore(s => s.planRoleGeneration);
  const prefabs = usePrefabStore(s => s.prefabs);
  const savePrefab = usePrefabStore(s => s.savePrefab);
  const storyTitle = useNarrativeStore(s => s.spine?.title);

  const [picking, setPicking] = useState<CastingRole | null>(null);
  const [creating, setCreating] = useState<CastingRole | null>(null);
  const [draftName, setDraftName] = useState('');
  const [query, setQuery] = useState('');

  const generation = useRoleGeneration();

  const model = useMemo(() => deriveCasting({ brief, castSlots, castIntent }), [brief, castSlots, castIntent]);

  const offered = useMemo(() => {
    if (!picking) return [];
    const wanted = acceptsKind(picking.kind);
    const needle = query.trim().toLowerCase();
    return prefabs.filter(p => p.kind === wanted && (!needle || p.name.toLowerCase().includes(needle)));
  }, [picking, prefabs, query]);

  /** Завести префаб от одного имени и сразу закрыть им роль. */
  const createAndCast = (role: CastingRole, name: string) => {
    const kind = acceptsKind(role.kind);
    const prefab = blankPrefab(kind, name, storyTitle || 'без названия', Date.now());
    savePrefab(prefab);

    // Стор мог перезаписать одноимённый префаб — тогда у роли должен быть его
    // id и его версия, а не те, что мы принесли.
    const saved = usePrefabStore.getState().prefabs.find(p => p.kind === kind && p.name === name);
    if (!saved) return;

    castRole(role.id, {
      prefabId: saved.id,
      version: saved.version,
      mode: 'linked',
      name: saved.name,
      snapshot: saved,
    });
    setCreating(null);
    setDraftName('');
  };

  const roleStatus = (role: CastingRole): string | null => {
    if (generation.busy === role.id) return 'генерирую…';
    if (generation.lastRole !== role.id) return null;
    if (generation.error) return generation.error;
    if (generation.filled > 0) return `сгенерировано полей: ${generation.filled}`;
    return null;
  };

  return (
    <div className={styles.zoneBody}>
      <h1 className={styles.zoneHeading}>Кастинг-стол</h1>
      <p className={styles.zoneHint}>
        роли из брифа · закрыто {model.assigned} из {model.roles.length}
      </p>

      <div className={casting.grid}>
        {model.roles.map(role => {
          const planned = castIntent[role.id] === 'generate';
          const status = roleStatus(role);

          return (
            <div key={role.id} className={casting.cell}>
              <RoleCard
                slot={role.slot}
                roleName={role.name || placeholderName(role)}
                cast={role.cast}
                castLabel={role.castLabel}
                selected={picking?.id === role.id || creating?.id === role.id}
              />
              <div className={casting.actions}>
                <button
                  type="button"
                  className={casting.link}
                  onClick={() => {
                    setCreating(null);
                    setPicking(role);
                  }}
                >
                  {role.ref ? 'заменить' : 'закастовать'}
                </button>

                {role.ref ? (
                  <button type="button" className={casting.link} onClick={() => castRole(role.id, null)}>
                    снять
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={casting.link}
                      onClick={() => {
                        setPicking(null);
                        setDraftName(role.name && role.name !== '' ? role.name : '');
                        setCreating(role);
                      }}
                    >
                      создать
                    </button>

                    {/* Аудио-набор в брифе не описан — генерировать под него нечего. */}
                    {roleGapPrefix(role) && (
                      <button
                        type="button"
                        className={casting.link}
                        disabled={generation.busy !== null}
                        onClick={() => {
                          planRoleGeneration(role.id, true);
                          void generation.generate(role);
                        }}
                      >
                        сгенерировать
                      </button>
                    )}

                    <button
                      type="button"
                      className={casting.link}
                      onClick={() => planRoleGeneration(role.id, !planned)}
                    >
                      {planned ? 'вернуть себе' : 'отдать генератору'}
                    </button>
                  </>
                )}
              </div>

              {status && (
                <div className={casting.status}>
                  <MutedText text={status} size={10} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating && (
        <div className={`${casting.library} ${styles.plate}`}>
          <div className={styles.kicker}>
            Новый префаб · {KIND_RU[acceptsKind(creating.kind)]} для «{creating.slot}»
          </div>
          <Input value={draftName} placeholder="имя — остальное дозаполнится позже" onDark onChange={setDraftName} />
          <HintNote
            onDark
            text="Префаб заводится пустым: спрайт, фоны и звук допишутся, когда дойдут руки. Роль он закрывает сразу."
          />
          <div className={casting.actions}>
            <OutlineButton
              label="создать и закастовать"
              tone="accent"
              size="compact"
              onDark
              disabled={draftName.trim() === ''}
              onClick={() => createAndCast(creating, draftName.trim())}
            />
            <OutlineButton
              label="отмена"
              size="compact"
              onDark
              onClick={() => {
                setCreating(null);
                setDraftName('');
              }}
            />
          </div>
        </div>
      )}

      {picking && (
        <div className={`${casting.library} ${styles.plate}`}>
          <div className={styles.kicker}>Библиотека · чем закрыть «{picking.slot}»</div>
          <SearchField value={query} placeholder="поиск: персонаж, мир, аудио…" onChange={setQuery} />

          {offered.length === 0 ? (
            <HintNote
              onDark
              text={`В библиотеке нет подходящих префабов (нужен ${
                KIND_RU[acceptsKind(picking.kind)]
              }). Заведите свой кнопкой «создать» — или отдайте роль генератору.`}
            />
          ) : (
            <div className={casting.shelf}>
              {offered.map(prefab => (
                <PrefabCard
                  key={prefab.id}
                  glyph={GLYPH[prefab.kind]}
                  title={`${prefab.name} v${prefab.version}`}
                  kind={KIND_RU[prefab.kind]}
                  src={`использован в ${prefab.usedIn ?? 0}`}
                  status="свободен"
                  onClick={() => {
                    castRole(picking.id, {
                      prefabId: prefab.id,
                      version: prefab.version,
                      mode: 'linked',
                      name: prefab.name,
                      // Снимок, а не ссылка: библиотека машинная и в .guproj не
                      // едет, иначе чужой проект открылся бы с пустыми ролями.
                      snapshot: prefab,
                    });
                    setPicking(null);
                    setQuery('');
                  }}
                />
              ))}
            </div>
          )}

          <button type="button" className={casting.link} onClick={() => setPicking(null)}>
            отмена
          </button>
        </div>
      )}
    </div>
  );
};

export default IdeaZone;
