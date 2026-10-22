export const demoMessage =
  'To podgląd interfejsu. Zapis danych nie jest jeszcze dostępny.';
export const demoClock = '19.10.2026, 08:00';

export const screens = [
  { id: 'UI-01', title: 'Logowanie', short: 'Ekran logowania' },
  { id: 'UI-02', title: 'Kalendarz studenta', short: 'Kalendarz' },
  { id: 'UI-03', title: 'Moje rezerwacje', short: 'Moje rezerwacje' },
  { id: 'UI-04', title: 'Zarządzanie salami', short: 'Sale' },
  { id: 'UI-05', title: 'Wszystkie rezerwacje', short: 'Rezerwacje studentów' },
  { id: 'UI-06', title: 'Blokady sal', short: 'Blokady sal' },
  {
    id: 'UI-07',
    title: 'Rezerwacja w imieniu studenta',
    short: 'Rezerwacja dla studenta',
  },
] as const;
export type ScreenId = (typeof screens)[number]['id'];

export const rooms = [
  { number: 'A-101', name: 'Sala projektowa', capacity: 6, active: true },
  { number: 'A-102', name: 'Sala seminaryjna', capacity: 8, active: true },
  { number: 'B-201', name: 'Sala do konsultacji', capacity: 4, active: true },
  { number: 'B-202', name: 'Sala zespołowa', capacity: 10, active: true },
  { number: 'C-301', name: 'Sala warsztatowa', capacity: 12, active: true },
  { number: 'C-302', name: '', capacity: 5, active: false },
  { number: 'D-401', name: 'Sala konferencyjna', capacity: 16, active: true },
  { number: 'D-402', name: '', capacity: 6, active: true },
];
export const students = ['Student 01', 'Student 02', 'Student 03'];
export const hours = Array.from({ length: 16 }, (_, i) => i + 7);
export const weekdays = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
];
export const time = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export function dateAt(offset: number) {
  const date = new Date(Date.UTC(2026, 9, 19 + offset, 12));
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function lessonRange(hour: number, minutes: number) {
  return `${time(hour)}–${minutes === 45 ? `${String(hour).padStart(2, '0')}:45` : `${String(hour + 1).padStart(2, '0')}:30`}`;
}

export type Booking = {
  id: string;
  owner: string;
  room: string;
  date: string;
  hour: number;
  minutes: 45 | 90;
  state: 'Nadchodząca' | 'Zakończona' | 'Anulowana';
  initiator: string;
  cancellation?: { date: string; initiator: string; reason: string };
};

// Stały scenariusz UI, bez kont, bazy i zależności od zegara komputera.
export const bookings: Booking[] = [
  {
    id: 'DEMO-01',
    owner: 'Student 01',
    room: 'A-101',
    date: '2026-10-20',
    hour: 9,
    minutes: 90,
    state: 'Nadchodząca',
    initiator: 'Student 01',
  },
  {
    id: 'DEMO-02',
    owner: 'Student 02',
    room: 'B-201',
    date: '2026-10-22',
    hour: 14,
    minutes: 45,
    state: 'Nadchodząca',
    initiator: 'Administrator demo',
  },
  {
    id: 'DEMO-03',
    owner: 'Student 01',
    room: 'B-201',
    date: '2026-10-16',
    hour: 10,
    minutes: 45,
    state: 'Zakończona',
    initiator: 'Administrator demo',
  },
  {
    id: 'DEMO-04',
    owner: 'Student 01',
    room: 'C-302',
    date: '2026-10-21',
    hour: 12,
    minutes: 45,
    state: 'Anulowana',
    initiator: 'Student 01',
    cancellation: {
      date: '18.10.2026, 12:00',
      initiator: 'Administrator demo',
      reason: 'Dezaktywacja sali',
    },
  },
];
