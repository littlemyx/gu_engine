/**
 * Русское склонение по числу: «1 префаб · 2 префаба · 5 префабов».
 * Интерфейс на русском, и «1 персонажей» в нём читается как недоделка.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «3 персонажа» — число вместе со словом. */
export function pluralize(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
