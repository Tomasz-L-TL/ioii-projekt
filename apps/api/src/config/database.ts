import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(
  new URL('../../../../', import.meta.url),
);

// CLI, seed, tsx i zbudowane API rozwiązują ścieżkę względem tego samego katalogu.
export function resolveDatabaseUrl(value: string): string {
  if (
    !value.startsWith('file:') ||
    !value.slice(5).trim() ||
    value.includes('?')
  ) {
    throw new Error(
      'DATABASE_URL musi wskazywać lokalny plik SQLite (file:...).',
    );
  }
  return `file:${resolve(repositoryRoot, value.slice(5))}`;
}
