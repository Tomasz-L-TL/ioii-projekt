import type { PrismaClient } from '../generated/prisma/client.js';
import { ApiError } from '../http/errors.js';
import type { Tx } from './repository.js';

// Adapter 7.10.1 mapuje SQLITE_BUSY na SocketTimeout (Prisma P1008).
// Nie zamieniamy błędów SQL ani ogólnego P2028 na konflikt.
export function isWriteContention(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (
    'code' in error &&
    error.code === 'P2028' &&
    'meta' in error &&
    error.meta &&
    typeof error.meta === 'object' &&
    'error' in error.meta
  ) {
    const detail = String(error.meta.error);
    return (
      detail === 'Unable to start a transaction in the given time.' ||
      /^A \w+ cannot be executed on an expired transaction\. The timeout for this transaction was \d+ ms, however \d+ ms passed since the start of the transaction\./u.test(
        detail,
      )
    );
  }
  if (
    'code' in error &&
    [
      'P1008',
      'P2034',
      'SQLITE_BUSY',
      'SQLITE_BUSY_SNAPSHOT',
      'SQLITE_BUSY_TIMEOUT',
    ].includes(String(error.code))
  )
    return true;
  if ('kind' in error && error.kind === 'SocketTimeout') return true;
  if ('cause' in error && isWriteContention(error.cause)) return true;
  if ('meta' in error && isWriteContention(error.meta)) return true;
  if (
    'driverAdapterError' in error &&
    isWriteContention(error.driverAdapterError)
  )
    return true;
  return false;
}

export async function writeTransaction<T>(
  db: PrismaClient,
  operation: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    return await db.$transaction(
      async (tx) => {
        // Pierwszy dostęp do DB to instrukcja zapisu. SQLite uzyskuje RESERVED
        // także dla UPDATE bez wierszy; żaden rekord ani trigger nie jest zmieniany.
        // Wszystkie kolejne odczyty/zapisy używają dokładnie tego tx.
        await tx.$executeRaw`UPDATE rooms SET id = id WHERE 0`;
        return operation(tx);
      },
      { maxWait: 1000, timeout: 5000 },
    );
  } catch (error) {
    if (isWriteContention(error))
      throw new ApiError(
        409,
        'WRITE_CONFLICT',
        'Trwa inny zapis. Odśwież dane i spróbuj ponownie.',
      );
    throw error;
  }
}
