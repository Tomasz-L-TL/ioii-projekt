import { compare, hash } from 'bcryptjs';

export const PASSWORD_COST = 12;

// bcrypt przetwarza maksymalnie 72 bajty; odrzucamy ciche obcięcie hasła.
export function validPasswordLength(password: string): boolean {
  return password.length > 0 && Buffer.byteLength(password, 'utf8') <= 72;
}

export async function hashDemoPassword(password: string): Promise<string> {
  if (password.length < 12 || !validPasswordLength(password)) {
    throw new Error(
      'SEED_DEMO_PASSWORD wymaga minimum 12 znaków i maksymalnie 72 bajtów UTF-8.',
    );
  }
  return hash(password, PASSWORD_COST);
}

export const verifyPassword = compare;
