import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import { PASSWORD_COST, verifyPassword } from './password.js';
import { verifySessionToken } from './session.js';

export type Role = 'STUDENT' | 'ADMIN';
export type UserDto = {
  id: number;
  email: string;
  displayName: string;
  role: Role;
};
export const userSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
} as const;

function safeUser(
  user: { id: number; email: string; displayName: string; role: string } | null,
): UserDto | null {
  return user && (user.role === 'ADMIN' || user.role === 'STUDENT')
    ? {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      }
    : null;
}

export class AuthService {
  private constructor(
    private readonly db: PrismaClient,
    private readonly secret: Buffer,
    private readonly dummyHash: string,
  ) {}

  static async create(db: PrismaClient, secret: Buffer): Promise<AuthService> {
    if (secret.length < 32)
      throw new Error('Sekret sesji musi zawierać przynajmniej 32 bajty.');
    return new AuthService(
      db,
      secret,
      await hash(randomBytes(32).toString('hex'), PASSWORD_COST),
    );
  }

  async login(email: string, password: string): Promise<UserDto | null> {
    const user = await this.db.user.findUnique({
      where: { email },
      select: { ...userSelect, passwordHash: true },
    });
    const matches = await verifyPassword(
      password,
      user?.passwordHash ?? this.dummyHash,
    );
    return matches ? safeUser(user) : null;
  }

  async authenticate(token: string): Promise<UserDto | null> {
    const id = verifySessionToken(token, this.secret);
    if (id === null) return null;
    return safeUser(
      await this.db.user.findUnique({ where: { id }, select: userSelect }),
    );
  }
}
