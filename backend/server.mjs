import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { openStore, normalize, jobView } from './store.mjs';
import { hashPassword, verifyPassword, tokenHash, sessionUser, requireRole } from './security.mjs';
const MAX = 5 * 1024 * 1024;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function text(value, label, max = 200) { if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    fail(400, `${label} không hợp lệ (tối đa ${max} ký tự).`); return value.trim(); }
async function body(req, max = 16384) { let size = 0; const chunks = []; for await (const chunk of req) {
    size += chunk.length;
    if (size > max)
        fail(413, 'Dữ liệu vượt quá dung lượng cho phép.');
    chunks.push(chunk);
} return Buffer.concat(chunks); }
async function json(req) { if (!req.headers['content-type']?.startsWith('application/json'))
    fail(415, 'Yêu cầu dữ liệu JSON.'); try {
    const data = JSON.parse((await body(req)).toString());
    if (!data || typeof data !== 'object' || Array.isArray(data))
        fail(400, 'Yêu cầu một đối tượng JSON.');
    return data;
}
catch (e) {
    if (e.status)
        throw e;
    fail(400, 'JSON không hợp lệ.');
} }
function output(res, data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
function pdf(res, content, name) { res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="cv.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`, 'Content-Security-Policy': "sandbox; default-src 'none'" }); res.end(Buffer.from(content)); }
const appView = a => ({ ...a, jobId: a.job_id, cv: a.cv_name, date: new Date(a.created_at).toLocaleDateString('vi-VN'), cv_content: undefined });
export function createApp({ database = process.env.DB_PATH || fileURLToPath(new URL('./data/jobconnect.sqlite', import.meta.url)), secure = process.env.NODE_ENV === 'production', frontend = fileURLToPath(new URL('../frontend/dist', import.meta.url)) } = {}) {
    const db = openStore(database), attempts = new Map();
    const session = (res, user) => { const token = randomBytes(32).toString('hex'); db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token), user.id, Date.now() + 7 * 86400000); res.setHeader('Set-Cookie', `jc_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure ? '; Secure' : ''}`); };
    const server = http.createServer(async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Cache-Control', 'no-store');
        try {
            const url = new URL(req.url, 'http://localhost'), p = url.pathname, m = req.method;
            if (p.startsWith('/api/') && !['GET', 'HEAD'].includes(m)) {
                const origin = req.headers.origin;
                if (origin && new URL(origin).host !== req.headers.host)
                    fail(403, 'Nguồn yêu cầu không được phép.');
                if (req.headers['sec-fetch-site'] === 'cross-site')
                    fail(403, 'Nguồn yêu cầu không được phép.');
            }
            if (p === '/api/health' && m === 'GET')
                return output(res, { service: 'jobconnect', status: 'ok' });
            if (p === '/api/auth/me' && m === 'GET')
                return output(res, { user: sessionUser(req, db) });
            if (['/api/auth/register', '/api/auth/login'].includes(p) && m === 'POST') {
                const key = req.socket.remoteAddress, now = Date.now();
                let entry = attempts.get(key);
                if (!entry || entry.until < now) {
                    entry = { count: 0, until: now + 60000 };
                    attempts.set(key, entry);
                }
                if (++entry.count > 20)
                    fail(429, 'Quá nhiều lần thử. Vui lòng thử lại sau một phút.');
                const b = await json(req), email = text(b.email, 'Email', 254).toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                    fail(400, 'Email không hợp lệ.');
                if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 128)
                    fail(400, 'Mật khẩu cần từ 8 đến 128 ký tự.');
                let user;
                if (p.endsWith('register')) {
                    const role = b.role ?? 'Candidate';
                    if (!['Candidate', 'Recruiter'].includes(role))
                        fail(403, 'Không được tự đăng ký vai trò Admin.');
                    const name = text(b.name, 'Họ tên', 100);
                    if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
                        fail(409, 'Email này đã được đăng ký.');
                    const password = await hashPassword(b.password);
                    try {
                        db.prepare('INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)').run(randomUUID(), name, email, password, role);
                    }
                    catch (e) {
                        if (String(e).includes('UNIQUE'))
                            fail(409, 'Email này đã được đăng ký.');
                        throw e;
                    }
                    user = db.prepare('SELECT id,name,email,role,phone,headline FROM users WHERE email=?').get(email);
                }
                else {
                    const record = db.prepare('SELECT * FROM users WHERE email=?').get(email);
                    if (!record || !await verifyPassword(b.password, record.password))
                        fail(401, 'Email hoặc mật khẩu không chính xác.');
                    const { password, ...safe } = record;
                    user = safe;
                }
                session(res, user);
                return output(res, { user }, p.endsWith('register') ? 201 : 200);
            }
            if (p === '/api/auth/logout' && m === 'POST') {
                const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('jc_session='))?.slice(11);
                if (token)
                    db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(token));
                res.setHeader('Set-Cookie', 'jc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
                return output(res, { ok: true });
            }
            if (p === '/api/profile' && m === 'PATCH') {
                const u = requireRole(req, db), b = await json(req), name = text(b.name, 'Họ tên', 100);
                const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
                const headline = typeof b.headline === 'string' ? b.headline.trim() : '';
                if (phone.length > 30 || headline.length > 200)
                    fail(400, 'Thông tin hồ sơ quá dài.');
                db.prepare('UPDATE users SET name=?,phone=?,headline=? WHERE id=?').run(name, phone, headline, u.id);
                return output(res, { user: { ...u, name, phone, headline } });
            }
            if (p === '/api/jobs' && m === 'GET') {
                const start = performance.now(), params = [], clauses = [];
                const q = url.searchParams.get('q');
                if (q) {
                    clauses.push('search LIKE ?');
                    params.push('%' + normalize(q.slice(0, 200)) + '%');
                }
                if (url.searchParams.get('saved') === '1') {
                    const u = requireRole(req, db, 'Candidate');
                    clauses.push('id IN (SELECT job_id FROM saved WHERE user_id=?)');
                    params.push(u.id);
                }
                for (const key of ['city', 'category', 'level', 'type', 'status']) {
                    const values = url.searchParams.getAll(key);
                    if (values.length) {
                        clauses.push(`${key} IN (${values.map(() => '?').join(',')})`);
                        params.push(...values);
                    }
                }
                const min = Number(url.searchParams.get('min') || 0);
                if (min) {
                    clauses.push('min>=?');
                    params.push(min);
                }
                const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '', sort = url.searchParams.get('sort') === 'salary' ? 'min DESC,created_at DESC' : 'created_at DESC';
                const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1)), limit = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('limit')) || 20)));
                const total = db.prepare('SELECT COUNT(*) AS count FROM jobs' + where).get(...params).count;
                const jobs = db.prepare('SELECT * FROM jobs' + where + ' ORDER BY ' + sort + ' LIMIT ? OFFSET ?').all(...params, limit, (page - 1) * limit).map(jobView);
                const elapsedMs = performance.now() - start;
                res.setHeader('Server-Timing', `search;dur=${elapsedMs.toFixed(2)}`);
                return output(res, { jobs, total, page, elapsedMs });
            }
            if (p === '/api/candidate/saved') {
                const u = requireRole(req, db, 'Candidate');
                if (m === 'GET')
                    return output(res, { saved: db.prepare('SELECT job_id FROM saved WHERE user_id=?').all(u.id).map(j => j.job_id) });
            }
            let match = p.match(/^\/api\/candidate\/saved\/(\d+)$/);
            if (match) {
                const u = requireRole(req, db, 'Candidate'), id = Number(match[1]);
                if (!db.prepare('SELECT id FROM jobs WHERE id=?').get(id))
                    fail(404, 'Không tìm thấy việc làm.');
                if (m === 'PUT') {
                    db.prepare('INSERT OR IGNORE INTO saved VALUES(?,?)').run(u.id, id);
                    return output(res, { ok: true });
                }
                if (m === 'DELETE') {
                    db.prepare('DELETE FROM saved WHERE user_id=? AND job_id=?').run(u.id, id);
                    return output(res, { ok: true });
                }
            }
            if (p === '/api/candidate/cvs') {
                const u = requireRole(req, db, 'Candidate');
                if (m === 'GET')
                    return output(res, { cvs: db.prepare('SELECT id,name,size,created_at FROM cvs WHERE user_id=? ORDER BY created_at DESC').all(u.id).map(c => ({ ...c, date: new Date(c.created_at).toLocaleDateString('vi-VN') })) });
                if (m === 'POST') {
                    const name = text(url.searchParams.get('name'), 'Tên CV', 180);
                    if (!name.toLowerCase().endsWith('.pdf') || req.headers['content-type']?.split(';')[0] !== 'application/pdf')
                        fail(415, 'Chỉ chấp nhận file PDF.');
                    if (Number(req.headers['content-length']) > MAX)
                        fail(413, 'CV không được lớn hơn 5MB.');
                    const content = await body(req, MAX);
                    if (content.length < 8 || content.subarray(0, 5).toString() !== '%PDF-' || !content.subarray(Math.max(0, content.length - 1024)).includes(Buffer.from('%%EOF')))
                        fail(400, 'Nội dung PDF không hợp lệ.');
                    const id = randomUUID(), created = Date.now();
                    db.prepare('INSERT INTO cvs VALUES(?,?,?,?,?,?)').run(id, u.id, name, content.length, content, created);
                    return output(res, { cv: { id, name, size: content.length, date: new Date(created).toLocaleDateString('vi-VN') } }, 201);
                }
            }
            match = p.match(/^\/api\/candidate\/cvs\/([\w-]+)$/);
            if (match) {
                const u = requireRole(req, db, 'Candidate'), cv = db.prepare('SELECT * FROM cvs WHERE id=? AND user_id=?').get(match[1], u.id);
                if (!cv)
                    fail(404, 'Không tìm thấy CV.');
                if (m === 'GET')
                    return pdf(res, cv.content, cv.name);
                if (m === 'DELETE') {
                    db.prepare('DELETE FROM cvs WHERE id=? AND user_id=?').run(cv.id, u.id);
                    return output(res, { ok: true });
                }
            }
            if (p === '/api/candidate/applications') {
                const u = requireRole(req, db, 'Candidate');
                if (m === 'GET')
                    return output(res, { applications: db.prepare('SELECT a.id,a.job_id,a.cv_name,a.cover,a.status,a.created_at,a.updated_at,j.title,j.company,j.logo,j.color,j.ink,j.deadline,j.status AS job_status FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? ORDER BY a.created_at DESC').all(u.id).map(appView) });
                if (m === 'POST') {
                    const b = await json(req), j = db.prepare('SELECT * FROM jobs WHERE id=?').get(Number(b.jobId));
                    if (!j)
                        fail(404, 'Không tìm thấy việc làm.');
                    if (j.status !== 'open' || j.deadline <= Date.now())
                        fail(409, 'Tin tuyển dụng đã kết thúc.');
                    const cv = db.prepare('SELECT * FROM cvs WHERE id=? AND user_id=?').get(String(b.cvId), u.id);
                    if (!cv)
                        fail(400, 'Vui lòng chọn CV thuộc tài khoản của bạn.');
                    const cover = typeof b.cover === 'string' ? b.cover.trim() : '';
                    if (cover.length > 3000)
                        fail(400, 'Thư giới thiệu tối đa 3000 ký tự.');
                    try {
                        db.prepare('INSERT INTO applications(id,user_id,job_id,cv_name,cv_content,cover,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), u.id, j.id, cv.name, cv.content, cover, Date.now(), Date.now());
                    }
                    catch (e) {
                        if (String(e).includes('UNIQUE'))
                            fail(409, 'Mỗi ứng viên chỉ được ứng tuyển một lần cho mỗi tin.');
                        throw e;
                    }
                    return output(res, { ok: true }, 201);
                }
            }
            match = p.match(/^\/api\/candidate\/applications\/([\w-]+)\/withdraw$/);
            if (match && m === 'PATCH') {
                const u = requireRole(req, db, 'Candidate');
                const result = db.prepare("UPDATE applications SET status='withdrawn',updated_at=? WHERE id=? AND user_id=? AND status IN ('submitted','reviewing','interviewed') AND job_id IN (SELECT id FROM jobs WHERE status='open' AND deadline>?)").run(Date.now(), match[1], u.id, Date.now());
                if (!result.changes) {
                    if (!db.prepare('SELECT id FROM applications WHERE id=? AND user_id=?').get(match[1], u.id))
                        fail(404, 'Không tìm thấy đơn.');
                    fail(409, 'Chỉ được rút đơn đang xử lý khi tin tuyển dụng chưa kết thúc.');
                }
                return output(res, { ok: true });
            }
            if (p === '/api/recruiter/jobs' && m === 'GET') {
                const u = requireRole(req, db, 'Recruiter', 'Admin');
                return output(res, { jobs: db.prepare('SELECT * FROM jobs' + (u.role === 'Admin' ? '' : ' WHERE owner_id=?') + ' ORDER BY created_at DESC').all(...(u.role === 'Admin' ? [] : [u.id])).map(jobView) });
            }
            if (p === '/api/recruiter/jobs' && m === 'POST') {
                const u = requireRole(req, db, 'Recruiter', 'Admin'), b = await json(req);
                const title = text(b.title, 'Vị trí', 150), company = text(b.company, 'Công ty', 150), city = text(b.city, 'Địa điểm', 100), category = text(b.category, 'Ngành nghề', 100), level = text(b.level, 'Cấp bậc', 50), type = text(b.type, 'Hình thức', 60), salary = text(b.salary, 'Lương', 100), description = text(b.description, 'Mô tả', 5000), requirements = text(b.requirements, 'Yêu cầu', 5000), min = Number(b.min), deadline = Date.parse(b.deadline);
                if (!Number.isFinite(min) || min < 0 || !Number.isFinite(deadline) || deadline <= Date.now())
                    fail(400, 'Mức lương hoặc hạn nộp không hợp lệ.');
                const tags = Array.isArray(b.tags) ? b.tags.slice(0, 8).map(t => text(t, 'Kỹ năng', 40)) : [];
                const result = db.prepare('INSERT INTO jobs(owner_id,title,company,city,category,level,type,salary,min,tags,logo,color,ink,deadline,created_at,description,requirements,search) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(u.id, title, company, city, category, level, type, salary, min, JSON.stringify(tags), company.slice(0, 2).toUpperCase(), '#e8f3ec', '#247654', deadline, Date.now(), description, requirements, normalize([title, company, ...tags].join(' ')));
                return output(res, { id: Number(result.lastInsertRowid) }, 201);
            }
            match = p.match(/^\/api\/recruiter\/jobs\/(\d+)$/);
            if (match && m === 'PATCH') {
                const u = requireRole(req, db, 'Recruiter', 'Admin'), b = await json(req);
                if (!['open', 'closed'].includes(b.status))
                    fail(400, 'Trạng thái không hợp lệ.');
                const j = db.prepare('SELECT * FROM jobs WHERE id=?').get(Number(match[1]));
                if (!j)
                    fail(404, 'Không tìm thấy tin.');
                if (u.role !== 'Admin' && j.owner_id !== u.id)
                    fail(403, 'Bạn không sở hữu tin này.');
                db.prepare('UPDATE jobs SET status=? WHERE id=?').run(b.status, j.id);
                return output(res, { ok: true });
            }
            if (p === '/api/recruiter/applications' && m === 'GET') {
                const u = requireRole(req, db, 'Recruiter', 'Admin');
                return output(res, { applications: db.prepare('SELECT a.id,a.job_id,a.cv_name,a.cover,a.status,a.created_at,a.updated_at,u.name,u.email,j.title,j.company FROM applications a JOIN jobs j ON a.job_id=j.id JOIN users u ON a.user_id=u.id' + (u.role === 'Admin' ? '' : ' WHERE j.owner_id=?') + ' ORDER BY a.created_at DESC').all(...(u.role === 'Admin' ? [] : [u.id])).map(appView) });
            }
            match = p.match(/^\/api\/recruiter\/applications\/([\w-]+)(\/cv)?$/);
            if (match) {
                const u = requireRole(req, db, 'Recruiter', 'Admin'), a = db.prepare('SELECT a.*,j.owner_id,j.status AS job_status,j.deadline FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=?').get(match[1]);
                if (!a)
                    fail(404, 'Không tìm thấy đơn.');
                if (u.role !== 'Admin' && a.owner_id !== u.id)
                    fail(403, 'Bạn không sở hữu tin tuyển dụng này.');
                if (match[2] && m === 'GET')
                    return pdf(res, a.cv_content, a.cv_name);
                if (!match[2] && m === 'PATCH') {
                    const b = await json(req);
                    const transitions = { submitted: ['reviewing', 'rejected'], reviewing: ['interviewed', 'accepted', 'rejected'], interviewed: ['accepted', 'rejected'] };
                    if (!transitions[a.status]?.includes(b.status))
                        fail(409, 'Không được chuyển trạng thái đơn như vậy.');
                    const result = db.prepare('UPDATE applications SET status=?,updated_at=? WHERE id=? AND status=?').run(b.status, Date.now(), a.id, a.status);
                    if (!result.changes)
                        fail(409, 'Trạng thái đơn đã thay đổi. Vui lòng tải lại.');
                    return output(res, { ok: true });
                }
            }
            if (p === '/api/admin/users' && m === 'GET') {
                requireRole(req, db, 'Admin');
                return output(res, { users: db.prepare('SELECT id,name,email,role FROM users ORDER BY name').all() });
            }
            if (p.startsWith('/api/'))
                fail(404, 'API không tồn tại.');
            if (!['GET', 'HEAD'].includes(m))
                fail(405, 'Phương thức không được hỗ trợ.');
            const path = resolve(frontend, '.' + decodeURIComponent(p));
            if (path !== frontend && !path.startsWith(frontend + '/') && !path.startsWith(frontend + '\\'))
                fail(403, 'Đường dẫn không hợp lệ.');
            let content;
            try {
                content = await readFile(path);
            }
            catch {
                if (extname(path))
                    fail(404, 'Không tìm thấy tập tin.');
                content = await readFile(resolve(frontend, 'index.html'));
            }
            const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' };
            res.writeHead(200, { 'Content-Type': (mime[extname(path)] || 'text/html') + '; charset=utf-8' });
            res.end(m === 'HEAD' ? undefined : content);
        }
        catch (e) {
            if (res.headersSent) {
                res.end();
                return;
            }
            if (!e.status)
                console.error(e);
            output(res, { error: e.status ? e.message : 'Máy chủ gặp lỗi. Vui lòng thử lại.' }, e.status || 500);
        }
    });
    server.on('close', () => db.close());
    return { server, db };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { server } = createApp();
    server.listen(Number(process.env.PORT) || 3001, '0.0.0.0', () => {
    console.log('Server listening on port ' + (process.env.PORT || 3001));
});;
}
