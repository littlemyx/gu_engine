import type { Brief } from '@/narrative/types';
import type { CastRef } from '../studioProjectStore';
import type { RoleCardCast } from '@/ui/kit/molecules/RoleCard';

/**
 * Кастинг-стол: роли, которые история обязана закрыть, и чем они закрыты.
 *
 * Роли берутся из брифа, а не из библиотеки: история решает, сколько ей нужно
 * любовных интересов, а библиотека лишь предлагает, кем их закрыть. Поэтому
 * незакрытая роль — это не «нет данных», а «зона не готова», и её видно ещё
 * до первого прогона.
 */

export type RoleKind = 'protagonist' | 'loveInterest' | 'world' | 'audio';

export interface CastingRole {
  id: string;
  /** Подпись слота: «ПРОТАГОНИСТ», «LI-1», «МИР». */
  slot: string;
  kind: RoleKind;
  /** Имя, которым роль закрыта, либо пустая строка. */
  name: string;
  cast: RoleCardCast;
  /** Подпись под именем: «префаб «Кира» v2». */
  castLabel?: string;
  ref?: CastRef;
}

export interface CastingModel {
  roles: CastingRole[];
  assigned: number;
  /** Роли, которые ещё некем закрыть. */
  unassigned: CastingRole[];
}

export interface CastingInput {
  brief: Brief;
  castSlots: Record<string, CastRef>;
}

export function deriveCasting({ brief, castSlots }: CastingInput): CastingModel {
  const roles: CastingRole[] = [
    // У протагониста нет имени — есть плейсхолдер, куда игрок впишет своё.
    role('protagonist', 'Протагонист', 'protagonist', brief.protagonist?.namePlaceholder ?? '', castSlots),
    ...(brief.loveInterests ?? []).map((li, i) =>
      role(`li:${li.id}`, `LI-${i + 1}`, 'loveInterest', li.name ?? '', castSlots),
    ),
    role('world', 'Мир', 'world', worldName(brief), castSlots),
    role('audio', 'Аудио · пакет оформления', 'audio', '', castSlots),
  ];

  const unassigned = roles.filter(r => r.cast === 'unassigned');
  return { roles, assigned: roles.length - unassigned.length, unassigned };
}

/** Мир назван местом действия: сеттинг — объект, а не строка. */
function worldName(brief: Brief): string {
  const setting = brief.world?.setting as { place?: string; era?: string } | undefined;
  return setting?.place ?? setting?.era ?? '';
}

function role(
  id: string,
  slot: string,
  kind: RoleKind,
  briefName: string,
  castSlots: Record<string, CastRef>,
): CastingRole {
  const ref = castSlots[id];

  if (ref) {
    return {
      id,
      slot,
      kind,
      name: ref.name,
      cast: 'linked',
      // Форк отвязан от библиотеки — это надо видеть, не открывая инспектор.
      castLabel:
        ref.mode === 'forked'
          ? `префаб «${ref.name}» v${ref.version} · правлен`
          : `префаб «${ref.name}» v${ref.version}`,
      ref,
    };
  }

  // Имя из брифа без префаба — роль написана автором вручную.
  if (briefName) return { id, slot, kind, name: briefName, cast: 'manual', castLabel: 'задано в брифе' };

  return { id, slot, kind, name: '', cast: 'unassigned' };
}

/** Префабы, которыми можно закрыть роль: персонаж — персонажем, мир — миром. */
export function acceptsKind(role: RoleKind): 'character' | 'world' | 'audio_set' {
  if (role === 'world') return 'world';
  if (role === 'audio') return 'audio_set';
  return 'character';
}
