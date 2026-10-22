export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();
export const normalizeRoomNumber = (roomNumber: string): string =>
  roomNumber.trim().replace(/\s+/gu, ' ').toUpperCase();
