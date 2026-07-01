import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from '../db';

const SESSION_SECRET = process.env.SESSION_SECRET;
const isBuildPhase = process.env.NEXT_PHASE?.includes('build') || process.env.PHASE?.includes('build');
if (!SESSION_SECRET && process.env.NODE_ENV === 'production' && !isBuildPhase) {
  throw new Error('SESSION_SECRET environment variable is required in production mode!');
}
const secretKey = SESSION_SECRET || 'd5a8b7c6e4f3a2b10987654321fedcba'; // fallback for dev
const COOKIE_NAME = 'app_session';

// AES-256-GCM standard key derivation
const derivedKey = crypto.scryptSync(secretKey.padEnd(32).substring(0, 32), 'session-salt-salt', 32);

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
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  // Fallback to SHA-256 for legacy seed accounts
  if (!storedHash.includes(':')) {
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return storedHash === legacyHash;
  }
  const [salt, hash] = storedHash.split(':');
  const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === computedHash;
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // 12 bytes IV is standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + encrypted;
}

function decrypt(text: string): string | null {
  try {
    const parts = text.split(':');
    if (parts.length < 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
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

export async function checkPermission(
  requiredModule: string,
  action: 'view' | 'create' | 'update' | 'delete' | 'approve' = 'view'
): Promise<boolean> {
  const session = await getSession();
  if (!session) {
    return false;
  }

  // Admin has full access
  if (session.username === 'admin' || session.isAdmin) {
    return true;
  }

  // Fetch fresh permissions from DB
  try {
    if (session.departmentId) {
      const deptRes = await query('SELECT is_admin FROM departments WHERE id = $1', [session.departmentId]);
      if (deptRes.rows.length > 0 && deptRes.rows[0].is_admin) {
        return true;
      }

      const allowedActions = ['view', 'create', 'update', 'delete', 'approve'];
      if (!allowedActions.includes(action)) {
        return false;
      }

      const permCol = `can_${action}`;
      const res = await query(`
        SELECT dp.${permCol} as allowed
        FROM department_permissions dp
        JOIN modules m ON dp.module_id = m.id
        WHERE dp.department_id = $1 AND m.code = $2
      `, [session.departmentId, requiredModule]);
      
      if (res.rows.length > 0 && res.rows[0].allowed === true) {
        return true;
      }
    }
  } catch (e) {
    console.error('Error checking permission in DB', e);
  }

  if (action === 'view') {
    return session.permissions.includes(requiredModule);
  }
  return false;
}
