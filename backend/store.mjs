import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import seedJobs from './seed-jobs.mjs';
import { remoteStore } from './remote-store.mjs';
export const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
export async function openStore(path, { url = process.env.TURSO_DATABASE_URL, authToken = process.env.TURSO_AUTH_TOKEN } = {}) {
    if (url && !url.startsWith('file:') && !authToken)
        throw new Error('Thiếu TURSO_AUTH_TOKEN cho database cloud.');
    if (!url && process.env.REQUIRE_REMOTE_DB === 'true')
        throw new Error('Cần TURSO_DATABASE_URL và TURSO_AUTH_TOKEN để giữ dữ liệu trên gói hosting miễn phí.');
    if (!url && path !== ':memory:')
        mkdirSync(dirname(path), { recursive: true });
    const db = url ? remoteStore(url, authToken) : new DatabaseSync(path);
    await db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Candidate','Recruiter','Admin')), phone TEXT NOT NULL DEFAULT '', headline TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, owner_id TEXT REFERENCES users(id), title TEXT NOT NULL, company TEXT NOT NULL, city TEXT NOT NULL, category TEXT NOT NULL, level TEXT NOT NULL, type TEXT NOT NULL, salary TEXT NOT NULL, min INTEGER NOT NULL, tags TEXT NOT NULL, logo TEXT NOT NULL, color TEXT NOT NULL, ink TEXT NOT NULL, hot INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), deadline INTEGER NOT NULL, created_at INTEGER NOT NULL, description TEXT NOT NULL, requirements TEXT NOT NULL, search TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_filters ON jobs(status,city,category,level,min,created_at);
    CREATE TABLE IF NOT EXISTS saved(user_id TEXT NOT NULL REFERENCES users(id), job_id INTEGER NOT NULL REFERENCES jobs(id), PRIMARY KEY(user_id,job_id));
    CREATE TABLE IF NOT EXISTS cvs(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0 AND size<=5242880), content BLOB NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS cvs_owner ON cvs(user_id);
    CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), job_id INTEGER NOT NULL REFERENCES jobs(id), cv_name TEXT NOT NULL, cv_content BLOB NOT NULL, cover TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','interviewed','accepted','rejected','withdrawn')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(user_id,job_id));
    CREATE INDEX IF NOT EXISTS applications_owner ON applications(user_id,created_at);
  `);
    if (!await db.prepare('SELECT id FROM jobs LIMIT 1').get()) {
        const insert = db.prepare('INSERT OR IGNORE INTO jobs(id,title,company,city,category,level,type,salary,min,tags,logo,color,ink,hot,deadline,created_at,description,requirements,search) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        for (const j of seedJobs)
            await insert.run(j.id, j.title, j.company, j.city, j.category, j.level, j.type, j.salary, j.min, JSON.stringify(j.tags), j.logo, j.color, j.ink, j.hot ? 1 : 0, Date.now() + 90 * 86400000, Date.now() - j.id * 3600000, `Tham gia đội ngũ ${j.company}, phối hợp xây dựng sản phẩm và giải pháp mang lại giá trị cho người dùng. Chủ động đóng góp ý tưởng, đảm bảo tiến độ và chất lượng công việc.`, `Kỹ năng: ${j.tags.join(', ')}. Cấp bậc ${j.level}. Môi trường cởi mở, phúc lợi cạnh tranh và lộ trình phát triển rõ ràng.`, normalize([j.title, j.company, ...j.tags].join(' ')));
    }
    return db;
}
export function jobView(j) { return { ...j, tags: JSON.parse(j.tags), hot: !!j.hot, owner_id: undefined, search: undefined }; }
