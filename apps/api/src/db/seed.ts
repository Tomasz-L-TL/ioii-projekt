import type { PrismaClient } from '../generated/prisma/client.js';
import { hashDemoPassword } from '../auth/password.js';
import { normalizeEmail, normalizeRoomNumber } from '../auth/normalization.js';

const users = [
  ['admin@roombook.test', 'Administrator Demo', 'ADMIN'],
  ['anna.nowak@roombook.test', 'Anna Nowak', 'STUDENT'],
  ['jan.kowalski@roombook.test', 'Jan Kowalski', 'STUDENT'],
  ['julia.wisniewska@roombook.test', 'Julia Wiśniewska', 'STUDENT'],
  ['piotr.zielinski@roombook.test', 'Piotr Zieliński', 'STUDENT'],
  ['maja.lewandowska@roombook.test', 'Maja Lewandowska', 'STUDENT'],
] as const;

const rooms = [
  ['A-101', 'Sala projektowa', 6],
  ['A-102', 'Sala seminaryjna', 8],
  ['B-201', 'Sala do konsultacji', 4],
  ['B-202', 'Sala zespołowa', 10],
  ['C-301', 'Sala warsztatowa', 12],
  ['C-302', null, 5],
  ['D-401', 'Sala konferencyjna', 16],
  ['D-402', null, 6],
] as const;

export async function seedDemo(
  db: PrismaClient,
  password: string,
): Promise<void> {
  const passwordHash = await hashDemoPassword(password);
  // Jedna atomowa transakcja. Puste update zachowuje wszystkie istniejące dane.
  await db.$transaction(async (tx) => {
    for (const [email, displayName, role] of users) {
      const canonicalEmail = normalizeEmail(email);
      await tx.user.upsert({
        where: { email: canonicalEmail },
        update: {},
        create: { email: canonicalEmail, displayName, role, passwordHash },
      });
    }
    for (const [roomNumber, name, capacity] of rooms) {
      const canonicalNumber = normalizeRoomNumber(roomNumber);
      await tx.room.upsert({
        where: { roomNumber: canonicalNumber },
        update: {},
        create: { roomNumber: canonicalNumber, name, capacity },
      });
    }
  });
}
