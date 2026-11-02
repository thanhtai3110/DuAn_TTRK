import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export async function hashPassword(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${Buffer.from(await derive(password, salt, 64)).toString('hex')}`; }
export async function verifyPassword(password, stored) { const [salt, hash] = stored.split(':'); const result = await derive(password, salt, 64); return timingSafeEqual(Buffer.from(hash, 'hex'), result); }
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function sessionUser(req, db) { const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('jc_session='))?.slice(11); if (!token)
    return null; return db.prepare('SELECT u.id,u.name,u.email,u.role,u.phone,u.headline FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(tokenHash(token), Date.now()) ?? null; }
export function requireRole(req, db, ...roles) { const user = sessionUser(req, db); if (!user)
    throw Object.assign(new Error('Vui lòng đăng nhập.'), { status: 401 }); if (roles.length && !roles.includes(user.role))
    throw Object.assign(new Error('Bạn không có quyền thực hiện thao tác này.'), { status: 403 }); return user; }
