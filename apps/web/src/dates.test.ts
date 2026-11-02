import { describe, expect, it } from 'vitest';
import { addDays, formatDate, monday, warsawToday } from './dates';
describe('daty kalendarza studenta', () => {
  it('ustala warszawski dzień na granicy UTC i roku', () => {
    expect(warsawToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(warsawToday(new Date('2026-06-01T22:30:00Z'))).toBe('2026-06-02');
  });
  it('poniedziałek jest początkiem również w niedzielę i na granicy roku', () => {
    expect(monday('2027-01-03')).toBe('2026-12-28');
    expect(monday('2027-01-04')).toBe('2027-01-04');
  });
  it('przesuwa tydzień przez obie zmiany DST bez zmiany daty modelu', () => {
    expect(addDays('2026-03-23', 7)).toBe('2026-03-30');
    expect(addDays('2026-10-19', 7)).toBe('2026-10-26');
    expect(addDays('2026-10-26', -7)).toBe('2026-10-19');
  });
  it('poprawnie przechodzi przez koniec miesiąca i rok przestępny', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(formatDate('2026-03-30')).toBe('30.03.2026');
  });
});
