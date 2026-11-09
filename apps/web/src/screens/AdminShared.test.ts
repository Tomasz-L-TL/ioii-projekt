import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { canSelect, ImpactSummary, TermSummary, WeekGrid } from './AdminShared';
import type { AvailabilityDto, SlotDto } from '../api/types';

const slots: SlotDto[] = Array.from({ length: 16 }, (_, i) => ({
  startHour: i + 7,
  status: 'AVAILABLE',
  past: false,
  available45: true,
  fits90: i < 15,
  available90: i < 15,
}));
const term = {
  roomId: 1,
  date: '2026-11-10',
  startHour: 21,
  durationSlots: 2 as const,
};
it('podsumowanie 90 minut rozróżnia zajęcia i 120 minut zajętości do 23', () => {
  const html = renderToStaticMarkup(createElement(TermSummary, { term }));
  expect(html).toContain('21:00–22:30');
  expect(html).toContain('21:00–23:00');
  expect(html).toContain('120');
  expect(html).toContain('Europe/Warsaw');
});
it('podgląd zerowy wymaga potwierdzenia i nie ujawnia tokena', () => {
  const html = renderToStaticMarkup(
    createElement(ImpactSummary, {
      impact: {
        roomId: 1,
        cancellationCount: 0,
        expectedCancellationIds: [],
        confirmationToken: 'secret-token',
      },
      children: 'Sala A',
    }),
  );
  expect(html).toContain('do anulowania: 0');
  expect(html).toContain('brak anulowań wymaga potwierdzenia');
  expect(html).not.toContain('secret-token');
});
it('blokada dopuszcza zarezerwowany i nieaktywny slot, ale nie blokadę, przeszłość i start 22 dla dwóch slotów', () => {
  for (const status of ['RESERVED', 'INACTIVE'] as const) {
    const rows = slots.map((row) => ({ ...row, status }));
    expect(canSelect(rows, 0, 2, true)).toBe(true);
    expect(canSelect(rows, 0, 1, false)).toBe(false);
  }
  expect(canSelect(slots, 15, 2, true)).toBe(false);
  expect(
    canSelect(
      slots.map((row) => ({ ...row, past: true })),
      0,
      1,
      true,
    ),
  ).toBe(false);
  expect(
    canSelect(
      slots.map((row) => ({ ...row, status: 'BLOCKED' })),
      0,
      1,
      true,
    ),
  ).toBe(false);
});
it('siatka pokazuje pięć dni, 80 komórek i dwa wybrane sloty z etykietami', () => {
  const snapshot: AvailabilityDto = {
    roomId: 1,
    weekStart: '2026-11-09',
    timeZone: 'Europe/Warsaw',
    days: Array.from({ length: 5 }, (_, i) => ({
      date: `2026-11-${String(9 + i).padStart(2, '0')}`,
      slots,
    })),
  };
  const html = renderToStaticMarkup(
    createElement(WeekGrid, {
      snapshot,
      duration: 2,
      selection: term,
      pending: false,
      onSelect: () => {},
    }),
  );
  expect(html.match(/data-hour=/g)).toHaveLength(80);
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  expect(html).toContain('slot 1/2');
  expect(html).toContain('slot 2/2');
  expect(html).toContain('ostatni start 21:00');
});
