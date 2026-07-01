import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from '../db';

const SESSION_SECRET = process.env.SESSION_SECRET || 'd5a8b7c6e4f3a2b10987654321fedcba'; // Must be 32 chars
const IV_LENGTH = 16;
const COOKIE_NAME = 'app_session';

export interface SessionPayload {
  userId: string; // uuid
  username: string;
  displayName: string;
  departmentId: string | null; // uuid
  departmentName: string | null;
  isAdmin: boolean;
  permissions: string[];
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SESSION_SECRET.padEnd(32).substring(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string | null {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift() || '', 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SESSION_SECRET.padEnd(32).substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return null;
  }
}

export async function createSession(user: { id: string; username: string; display_name: string; department_id: string | null; department_name: string | null; is_admin: boolean; permissions: string[] }) {
  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    departmentId: user.department_id,
    departmentName: user.department_name,
    isAdmin: user.is_admin,
    permissions: user.permissions
  };

  const encrypted = encrypt(JSON.stringify(payload));
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/'
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const decrypted = decrypt(sessionCookie.value);
  if (!decrypted) {
    return null;
  }

  try {
    return JSON.parse(decrypted) as SessionPayload;
  } catch (e) {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function checkPermission(requiredModule: string): Promise<boolean> {
  const session = await getSession();
  if (!session) {
    return false;
  }

  // Admin has full access
  if (session.username === 'admin' || session.isAdmin) {
    return true;
  }

  // Fetch fresh permissions from DB just to be sure
  try {
    if (session.departmentId) {
      const deptRes = await query('SELECT is_admin FROM departments WHERE id = $1', [session.departmentId]);
      if (deptRes.rows.length > 0 && deptRes.rows[0].is_admin) {
        return true;
      }

      const res = await query(`
        SELECT dp.can_view
        FROM department_permissions dp
        JOIN modules m ON dp.module_id = m.id
        WHERE dp.department_id = $1 AND m.code = $2
      `, [session.departmentId, requiredModule]);
      
      if (res.rows.length > 0 && res.rows[0].can_view) {
        return true;
      }
    }
  } catch (e) {
    console.error('Error checking permission in DB', e);
  }

  return session.permissions.includes(requiredModule);
}
