import React, { useEffect, useState } from 'react';
import { api } from './api';
export const roles = { Candidate: 'Ứng viên', Recruiter: 'Nhà tuyển dụng', Admin: 'Quản trị viên' };
export function Auth({ onSuccess, onClose }) {
    const [register, setRegister] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    async function submit(e) { e.preventDefault(); setBusy(true); setError(''); const b = Object.fromEntries(new FormData(e.currentTarget)); if (register && b.password !== b.confirm) {
        setError('Mật khẩu xác nhận không khớp.');
        setBusy(false);
        return;
    } try {
        const { user } = await api('/auth/' + (register ? 'register' : 'login'), { method: 'POST', body: b });
        onSuccess(user);
    }
    catch (e) {
        setError(e.message);
    }
    finally {
        setBusy(false);
    } }
    return <div className="modal-backdrop" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={register ? 'Đăng ký' : 'Đăng nhập'} onClick={e => e.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Đóng">✕</button><span className="section-eyebrow">CHÀO MỪNG ĐẾN VỚI JOBCONNECT</span><h2>{register ? 'Bắt đầu hành trình mới' : 'Chào mừng bạn trở lại'}</h2><p>{register ? 'Tạo tài khoản để kết nối cơ hội nghề nghiệp.' : 'Đăng nhập để quản lý hồ sơ và cơ hội của bạn.'}</p><form onSubmit={submit}>{register && <><label className="form-label">Họ và tên<input name="name" autoComplete="name" required maxLength={100}/></label><label className="form-label">Bạn là<select name="role"><option value="Candidate">Ứng viên tìm việc</option><option value="Recruiter">Nhà tuyển dụng</option></select></label></>}<label className="form-label">Email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label><label className="form-label">Mật khẩu<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'}/></label>{register && <label className="form-label">Xác nhận mật khẩu<input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Đang xử lý...' : register ? 'Tạo tài khoản' : 'Đăng nhập'}</button></form><button className="inline-link auth-switch" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}</button></section></div>;
}
export function Profile({ user, onUpdate, toast }) { const [busy, setBusy] = useState(false); return <form className="profile-panel" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    const result = await api('/profile', { method: 'PATCH', body: Object.fromEntries(new FormData(e.currentTarget)) });
    onUpdate(result.user);
    toast('Đã cập nhật hồ sơ.');
}
catch (e) {
    toast(e.message);
}
finally {
    setBusy(false);
} }}><h3>Thông tin cá nhân</h3><div className="profile-grid"><label className="form-label">Họ và tên<input name="name" required maxLength={100} defaultValue={user.name}/></label><label className="form-label">Email<input value={user.email} disabled readOnly/></label><label className="form-label">Số điện thoại<input name="phone" type="tel" maxLength={30} defaultValue={user.phone}/></label><label className="form-label">Vị trí / chuyên môn<input name="headline" maxLength={200} defaultValue={user.headline}/></label></div><button className="primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thông tin'}</button></form>; }
export function Management({ user, toast, onJobsChanged, statusNames }) {
    const [jobs, setJobs] = useState([]), [applications, setApplications] = useState([]), [users, setUsers] = useState([]), [showForm, setShowForm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function refresh() { try {
        const [j, a] = await Promise.all([api('/recruiter/jobs'), api('/recruiter/applications')]);
        setJobs(j.jobs);
        setApplications(a.applications);
        if (user.role === 'Admin')
            setUsers((await api('/admin/users')).users);
        setError('');
    }
    catch (e) {
        setError(e.message);
    } }
    useEffect(() => { refresh(); }, [user.id]);
    async function mutate(path, options) { setBusy(true); try {
        await api(path, options);
        await refresh();
        onJobsChanged();
        toast('Đã cập nhật thành công.');
        return true;
    }
    catch (e) {
        toast(e.message);
        return false;
    }
    finally {
        setBusy(false);
    } }
    const next = { submitted: ['reviewing', 'rejected'], reviewing: ['interviewed', 'accepted', 'rejected'], interviewed: ['accepted', 'rejected'] };
    return <section className="management"><div className="result-heading"><div><div className="section-eyebrow">{roles[user.role].toUpperCase()}</div><h2>Quản lý tuyển dụng</h2><p>{jobs.length} tin tuyển dụng · {applications.length} đơn ứng tuyển</p></div><div className="action-group"><button className="secondary" onClick={refresh}>Tải lại</button><button className="primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Đóng biểu mẫu' : '+ Đăng tin tuyển dụng'}</button></div></div>{error && <p className="form-error" role="alert">{error}</p>}{showForm && <form className="profile-panel" onSubmit={async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.currentTarget)); b.tags = b.tags.split(',').map(t => t.trim()).filter(Boolean); if (await mutate('/recruiter/jobs', { method: 'POST', body: b }))
        setShowForm(false); }}><h3>Thông tin tin tuyển dụng</h3><div className="profile-grid">{[['title', 'Vị trí tuyển dụng'], ['company', 'Tên công ty']].map(([name, label]) => <label className="form-label" key={name}>{label}<input name={name} required maxLength={150}/></label>)}<label className="form-label">Địa điểm<select name="city">{['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'].map(c => <option key={c}>{c}</option>)}</select></label><label className="form-label">Ngành nghề<select name="category">{['Công nghệ thông tin', 'Thiết kế', 'Marketing', 'Kinh doanh', 'Quản lý sản phẩm'].map(c => <option key={c}>{c}</option>)}</select></label><label className="form-label">Cấp bậc<select name="level">{['Intern', 'Junior', 'Middle', 'Senior'].map(c => <option key={c}>{c}</option>)}</select></label><label className="form-label">Hình thức<select name="type"><option>Toàn thời gian</option><option>Bán thời gian</option><option>Hợp đồng</option></select></label><label className="form-label">Mức lương hiển thị<input name="salary" placeholder="20 – 30 triệu" required maxLength={100}/></label><label className="form-label">Lương từ (triệu / tháng)<input name="min" type="number" required min="0" step="0.1"/></label><label className="form-label">Hạn nộp hồ sơ<input name="deadline" type="datetime-local" required/></label><label className="form-label">Kỹ năng (ngăn cách bằng dấu phẩy)<input name="tags" maxLength={300}/></label></div><label className="form-label">Mô tả công việc<textarea name="description" required maxLength={5000} rows={4}/></label><label className="form-label">Yêu cầu & quyền lợi<textarea name="requirements" required maxLength={5000} rows={4}/></label><button className="primary full" disabled={busy}>Đăng tin</button></form>}<h3>Tin tuyển dụng</h3>{!jobs.length && <div className="empty"><p>Bạn chưa có tin tuyển dụng. Hãy đăng tin đầu tiên.</p></div>}{jobs.map(j => <article className="application-row" key={j.id}><div className="application-info"><h3>{j.title}</h3><p>{j.company} · {j.city}</p><small>Hạn nộp: {new Date(j.deadline).toLocaleString('vi-VN')}</small></div><span className={'status ' + (j.status === 'closed' ? 'withdrawn' : 'accepted')}>{j.status === 'closed' ? 'Đã đóng' : j.deadline < Date.now() ? 'Hết hạn' : 'Đang mở'}</span><button className="secondary" disabled={busy} onClick={() => mutate('/recruiter/jobs/' + j.id, { method: 'PATCH', body: { status: j.status === 'open' ? 'closed' : 'open' } })}>{j.status === 'open' ? 'Đóng tin' : 'Mở lại'}</button></article>)}<h3>Đơn ứng tuyển</h3>{!applications.length && <div className="empty"><p>Chưa có ứng viên nộp đơn.</p></div>}{applications.map(a => <article className="application-row" key={a.id}><div className="application-info"><h3>{a.name} · {a.title}</h3><p>{a.email} · {a.date}</p>{a.cover && <p className="cover-text">{a.cover}</p>}<a className="inline-link" target="_blank" rel="noreferrer" href={'/api/recruiter/applications/' + a.id + '/cv'}>Xem CV: {a.cv}</a></div><span className={'status ' + a.status}>{statusNames[a.status]}</span>{next[a.status] && <select className="management-select" aria-label={'Cập nhật đơn của ' + a.name} disabled={busy} value="" onChange={e => e.target.value && mutate('/recruiter/applications/' + a.id, { method: 'PATCH', body: { status: e.target.value } })}><option value="">Chuyển trạng thái</option>{next[a.status].map(s => <option value={s} key={s}>{statusNames[s]}</option>)}</select>}</article>)}{user.role === 'Admin' && <><h3>Tài khoản hệ thống</h3><div className="table-scroll"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{roles[u.role]}</td></tr>)}</tbody></table></div></>}</section>;
}
