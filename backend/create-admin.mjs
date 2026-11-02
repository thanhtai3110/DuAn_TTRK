import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { hashPassword } from './security.mjs';
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Quản trị viên' } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    console.error('Cần ADMIN_EMAIL và ADMIN_PASSWORD (ít nhất 12 ký tự), tùy chọn ADMIN_NAME.');
    process.exit(1);
}
const db = await openStore(process.env.DB_PATH || fileURLToPath(new URL('./data/jobconnect.sqlite', import.meta.url)));
try {
    await db.prepare('INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)').run(randomUUID(), ADMIN_NAME, ADMIN_EMAIL.trim().toLowerCase(), await hashPassword(ADMIN_PASSWORD), 'Admin');
    console.log('Đã tạo tài khoản Admin.');
}
finally {
    await db.close();
}
