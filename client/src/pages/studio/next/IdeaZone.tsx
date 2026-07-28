import React, { useMemo, useState } from 'react';

import { usePrefabStore } from '@/prefabs/prefabStore';
import HintNote from '@/ui/kit/molecules/HintNote';
import PrefabCard from '@/ui/kit/molecules/PrefabCard';
import RoleCard from '@/ui/kit/molecules/RoleCard';
import SearchField from '@/ui/kit/molecules/SearchField';

import { useStudioProjectStore } from '../studioProjectStore';
import { acceptsKind, deriveCasting } from './castingModel';

import styles from './shell.module.css';
import casting from './casting.module.css';

import type { Brief } from '@/narrative/types';
import type { CastingRole } from './castingModel';
import type { PrefabKind } from '@/prefabs/prefabTypes';

const GLYPH: Record<PrefabKind, string> = { character: '◐', world: '▣', audio_set: '♪' };
const KIND_RU: Record<PrefabKind, string> = { character: 'персонаж', world: 'мир', audio_set: 'аудио-набор' };

export interface IdeaZoneProps {
  brief: Brief;
}

/**
 * Зона 0 «Замысел»: кастинг-стол и библиотека.
 *
 * Роль закрывается кликом — выбрали слот, выбрали префаб. Перетаскивание
 * добавится позже: клик работает и с клавиатуры, и на узком экране, поэтому
 * он остаётся основным способом, а не запасным.
 */
const IdeaZone = ({ brief }: IdeaZoneProps) => {
  const castSlots = useStudioProjectStore(s => s.castSlots);
  const castRole = useStudioProjectStore(s => s.castRole);
  const prefabs = usePrefabStore(s => s.prefabs);

  const [picking, setPicking] = useState<CastingRole | null>(null);
  const [query, setQuery] = useState('');

  const model = useMemo(() => deriveCasting({ brief, castSlots }), [brief, castSlots]);

  const offered = useMemo(() => {
    if (!picking) return [];
    const wanted = acceptsKind(picking.kind);
    const needle = query.trim().toLowerCase();
    return prefabs.filter(p => p.kind === wanted && (!needle || p.name.toLowerCase().includes(needle)));
  }, [picking, prefabs, query]);

  return (
    <div className={styles.zoneBody}>
      <h1 className={styles.zoneHeading}>Кастинг-стол</h1>
      <p className={styles.zoneHint}>
        роли из брифа · закрыто {model.assigned} из {model.roles.length}
      </p>

      <div className={casting.grid}>
        {model.roles.map(role => (
          <div key={role.id} className={casting.cell}>
            <RoleCard
              slot={role.slot}
              roleName={role.name || '— не назначена'}
              cast={role.cast}
              castLabel={role.castLabel}
              selected={picking?.id === role.id}
            />
            <div className={casting.actions}>
              <button type="button" className={casting.link} onClick={() => setPicking(role)}>
                {role.ref ? 'заменить' : 'закастовать'}
              </button>
              {role.ref && (
                <button type="button" className={casting.link} onClick={() => castRole(role.id, null)}>
                  снять
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {picking && (
        <div className={casting.library}>
          <div className={styles.kicker}>Библиотека · чем закрыть «{picking.slot}»</div>
          <SearchField value={query} placeholder="поиск: персонаж, мир, аудио…" onChange={setQuery} />

          {offered.length === 0 ? (
            <HintNote text={`В библиотеке нет подходящих префабов (нужен ${KIND_RU[acceptsKind(picking.kind)]}).`} />
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
