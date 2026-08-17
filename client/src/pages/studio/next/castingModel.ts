import type { Brief } from '@/narrative/types';
import type { CastIntent, CastRef } from '../studioProjectStore';
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
  castIntent?: Record<string, CastIntent>;
}

export function deriveCasting({ brief, castSlots, castIntent = {} }: CastingInput): CastingModel {
  const slots = { castSlots, castIntent };
  const roles: CastingRole[] = [
    // У протагониста нет имени — есть плейсхолдер, куда игрок впишет своё.
    role('protagonist', 'Протагонист', 'protagonist', brief.protagonist?.namePlaceholder ?? '', slots),
    ...(brief.loveInterests ?? []).map((li, i) =>
      role(`li:${li.id}`, `LI-${i + 1}`, 'loveInterest', li.name ?? '', slots),
    ),
    role('world', 'Мир', 'world', worldName(brief), slots),
    role('audio', 'Аудио · пакет оформления', 'audio', '', slots),
  ];

  // Роль закрыта, когда её есть чем играть: префабом или именем. Пометка
  // «отдать генератору» — обещание, а не закрытие, и в счётчик не идёт.
  const unassigned = roles.filter(r => !r.ref && !r.name);
  return { roles, assigned: roles.length - unassigned.length, unassigned };
}

/**
 * Префикс путей брифа, которые описывают эту роль: по нему точечная генерация
 * отбирает свои пробелы из общего списка. `null` — роль в брифе не описана,
 * генерировать под неё нечего (аудио живёт в библиотеке, а не в брифе).
 */
export function roleGapPrefix(role: CastingRole): string | null {
  if (role.kind === 'loveInterest') return `loveInterests[${role.id.slice('li:'.length)}].`;
  if (role.kind === 'protagonist') return 'protagonist.';
  if (role.kind === 'world') return 'world.';
  return null;
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
  { castSlots, castIntent }: { castSlots: Record<string, CastRef>; castIntent: Record<string, CastIntent> },
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

  // Роль, отданную генератору, видно и до генерации, и после: пометка держится
  // за роль, а не за факт заполнения, — иначе сгенерированное имя было бы не
  // отличить от написанного автором.
  const planned = castIntent[id] === 'generate';

  if (briefName) {
    return {
      id,
      slot,
      kind,
      name: briefName,
      cast: planned ? 'generated' : 'manual',
      castLabel: planned ? 'сгенерировано' : 'задано в брифе',
    };
  }

  if (planned) return { id, slot, kind, name: '', cast: 'generated', castLabel: 'ждёт генерации' };

  return { id, slot, kind, name: '', cast: 'unassigned' };
}

/** Префабы, которыми можно закрыть роль: персонаж — персонажем, мир — миром. */
export function acceptsKind(role: RoleKind): 'character' | 'world' | 'audio_set' {
  if (role === 'world') return 'world';
  if (role === 'audio') return 'audio_set';
  return 'character';
}
