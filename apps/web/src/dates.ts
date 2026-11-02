// Arytmetyka dat w UTC, bieżący dzień zawsze jawnie z Europe/Warsaw.
export function warsawToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) =>
    parts.find((item) => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addDays(date: string, count: number) {
  const model = new Date(`${date}T12:00:00Z`);
  model.setUTCDate(model.getUTCDate() + count);
  return model.toISOString().slice(0, 10);
}
export function monday(date = warsawToday()) {
  return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
}
export function formatDate(date: string, weekday = false) {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(weekday ? { weekday: 'long' as const } : {}),
  }).format(new Date(`${date}T12:00:00Z`));
}
export const time = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
export const lessonRange = (hour: number, minutes: number) =>
  `${time(hour)}–${String(minutes === 45 ? hour : hour + 1).padStart(2, '0')}:${minutes === 45 ? '45' : '30'}`;
export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
