import React, { useState, useEffect } from 'react';
import { api, uploadCV } from './api';
import { Auth, Profile, Management, roles } from './account';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Search, MapPin, Bookmark, BriefcaseBusiness, FileText, Send, Bell, ChevronDown, X, Check, UploadCloud, SlidersHorizontal, Building2, Clock, Menu, Sparkles, CheckCircle2 } from 'lucide-react';
import './styles.css';
import './account.css';
const statusNames = { submitted: 'Đã nộp', reviewing: 'Đang xem xét', interviewed: 'Đã phỏng vấn', accepted: 'Được nhận', rejected: 'Bị từ chối', withdrawn: 'Đã rút' };
function App() {
    const [page, setPage] = useState('jobs'), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [city, setCity] = useState(''), [categories, setCategories] = useState([]), [levels, setLevels] = useState([]), [salary, setSalary] = useState(''), [sort, setSort] = useState('new'), [saved, setSaved] = useState([]), [applications, setApplications] = useState([]), [cvs, setCvs] = useState([]), [modal, setModal] = useState(null), [notice, setNotice] = useState(''), [mobile, setMobile] = useState(false), [filterOpen, setFilterOpen] = useState(false), [status, setStatus] = useState(''), [limit, setLimit] = useState(6), [selectedCV, setSelectedCV] = useState(''), [cover, setCover] = useState('');
    const [user, setUser] = useState(null), [authOpen, setAuthOpen] = useState(false), [jobs, setJobs] = useState([]), [resultJobs, setResultJobs] = useState([]), [resultTotal, setResultTotal] = useState(0), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [working, setWorking] = useState(false), [jobVersion, setJobVersion] = useState(0);
    async function refreshCandidate() { const [s, a, c] = await Promise.all([api('/candidate/saved'), api('/candidate/applications'), api('/candidate/cvs')]); setSaved(s.saved); setApplications(a.applications); setCvs(c.cvs); }
    function authenticated(u) { setUser(u); setAuthOpen(false); setModal(null); setPage(u.role === 'Candidate' ? 'jobs' : 'management'); }
    useEffect(() => { api('/auth/me').then(({ user: u }) => { setUser(u); if (u && u.role !== 'Candidate')
        setPage('management'); }).catch(e => setLoadError(e.message)); }, []);
    useEffect(() => { setSaved([]); setApplications([]); setCvs([]); if (user?.role === 'Candidate')
        refreshCandidate().catch(e => toast(e.message)); }, [user?.id]);
    useEffect(() => { api('/jobs?limit=100').then(r => setJobs(r.jobs)).catch(e => setLoadError(e.message)); }, [jobVersion]);
    useEffect(() => { if (!['jobs', 'saved'].includes(page))
        return; const controller = new AbortController(); setLoading(true); setLoadError(''); const params = new URLSearchParams({ q: search, sort, limit: '6', page: String(Math.floor(limit / 6)) }); if (page === 'saved')
        params.set('saved', '1'); if (city)
        params.set('city', city); if (salary)
        params.set('min', salary); categories.forEach(c => params.append('category', c)); levels.forEach(l => params.append('level', l)); api('/jobs?' + params, { signal: controller.signal }).then(r => { setResultJobs(r.jobs); setResultTotal(r.total); setLoading(false); }).catch(e => { if (e.name !== 'AbortError') {
        setLoadError(e.message);
        setLoading(false);
    } }); return () => controller.abort(); }, [search, sort, limit, city, salary, categories, levels, page, jobVersion, saved.join(',')]);
    async function logout() { try {
        await api('/auth/logout', { method: 'POST' });
        setUser(null);
        setSaved([]);
        setApplications([]);
        setCvs([]);
        setPage('jobs');
        toast('Đã đăng xuất.');
    }
    catch (e) {
        toast(e.message);
    } }
    function candidate() { if (!user) {
        setAuthOpen(true);
        return false;
    } if (user.role !== 'Candidate') {
        toast('Chức năng này dành cho ứng viên.');
        return false;
    } return true; }
    const openJob = j => { setSelectedCV(cvs[0]?.id || ''); setCover(''); setModal({ type: 'detail', job: j }); };
    async function withdraw(a) { setWorking(true); try {
        await api('/candidate/applications/' + a.id + '/withdraw', { method: 'PATCH' });
        await refreshCandidate();
        setModal(null);
        toast('Đã rút đơn ứng tuyển.');
    }
    catch (e) {
        toast(e.message);
    }
    finally {
        setWorking(false);
    } }
    async function deleteCV(cv) { setWorking(true); try {
        await api('/candidate/cvs/' + cv.id, { method: 'DELETE' });
        await refreshCandidate();
        setModal(null);
        toast('Đã xóa CV.');
    }
    catch (e) {
        toast(e.message);
    }
    finally {
        setWorking(false);
    } }
    function toast(msg) { setNotice(msg); setTimeout(() => setNotice(''), 4000); }
    function navigate(p) { if (['cv', 'saved', 'applications'].includes(p) && !candidate())
        return; setPage(p); setMobile(false); setLimit(6); }
    async function save(id) { if (!candidate() || working)
        return; setWorking(true); try {
        await api('/candidate/saved/' + id, { method: saved.includes(id) ? 'DELETE' : 'PUT' });
        await refreshCandidate();
    }
    catch (e) {
        toast(e.message);
    }
    finally {
        setWorking(false);
    } }
    function toggle(v, list, set) { set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]); setLimit(6); }
    async function upload(file) { if (!file || !candidate())
        return; if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))
        return toast('Vui lòng chọn file PDF.'); if (file.size > 5 * 1024 * 1024)
        return toast('CV không được lớn hơn 5MB.'); if (!file.size)
        return toast('File PDF đang trống.'); setWorking(true); try {
        await uploadCV(file);
        await refreshCandidate();
        toast('Đã tải lên CV thành công.');
    }
    catch (e) {
        toast(e.message);
    }
    finally {
        setWorking(false);
    } }
    async function apply(e) { e.preventDefault(); if (!candidate() || working)
        return; if (!selectedCV)
        return toast('Hãy chọn CV để ứng tuyển.'); setWorking(true); try {
        await api('/candidate/applications', { method: 'POST', body: { jobId: modal.job.id, cvId: selectedCV, cover } });
        await refreshCandidate();
        setModal(null);
        toast('Đã gửi đơn ứng tuyển thành công!');
    }
    catch (e) {
        toast(e.message);
    }
    finally {
        setWorking(false);
    } }
    const filtered = resultJobs.filter(j => page !== 'saved' || saved.includes(j.id));
    const reset = () => { setCategories([]); setLevels([]); setSalary(''); setCity(''); setQuery(''); setSearch(''); setLimit(6); };
    return <>{authOpen && <Auth onSuccess={authenticated} onClose={() => setAuthOpen(false)}/>}<header><div className="header-inner"><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('jobs'); }}><span className="brand-icon"><BriefcaseBusiness size={22}/></span>Job<span>Connect</span><i /></a><nav className={mobile ? 'open' : ''}>{(user && user.role !== 'Candidate' ? [['jobs', 'Tìm việc làm'], ['management', 'Quản lý tuyển dụng']] : [['jobs', 'Tìm việc làm'], ['saved', 'Việc đã lưu'], ['applications', 'Đơn ứng tuyển'], ['cv', 'Hồ sơ & CV']]).map(([p, label]) => <button key={p} className={page === p ? 'active' : ''} onClick={() => navigate(p)}>{label}{p === 'saved' && saved.length > 0 && <small>{saved.length}</small>}</button>)}</nav><div className="user-nav"><button className="bell" aria-label="Thông báo" onClick={() => toast('Bạn chưa có thông báo mới.')}><Bell size={20}/><i /></button>{user ? <><div className="user-avatar">{user.name.split(' ').slice(-2).map(n => n[0]).join('')}</div><div className="user-name"><b>{user.name}</b><span>{roles[user.role]}</span></div><button className="logout-button" onClick={logout}>Đăng xuất</button></> : <button className="primary" onClick={() => setAuthOpen(true)}>Đăng nhập</button>}<button className="mobile-toggle" aria-label="Mở menu" onClick={() => setMobile(!mobile)}><Menu /></button></div></div></header>
 <main><section className="hero"><div className="hero-copy"><div className="eyebrow"><span /> HÀNH TRÌNH MỚI BẮT ĐẦU TỪ ĐÂY</div><h1>Kết nối cơ hội.<br />Mở lối <em>tương lai.</em></h1><p>Khám phá công việc phù hợp và tiến gần hơn<br className="desktop"/> đến sự nghiệp bạn mong muốn.</p><div className="hero-proof"><div className="avatar-stack"><span>HN</span><span>TL</span><span>MA</span><span>QT</span></div><div><b>Cơ hội mới</b> · Sẵn sàng cho bước tiến tiếp theo <span>✦</span></div></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-spark s1">✦</span><span className="art-spark s2">✦</span><div className="floating-label"><CheckCircle2 size={18}/> Cơ hội dành riêng cho bạn</div><div className="illustration-card"><div className="illustration-top"><div className="illustration-logo"><BriefcaseBusiness size={32}/></div><span>↗</span></div><div className="fake-title"/><div className="fake-line"/><div className="fake-tags"><i /><i /></div><div className="fake-bottom"><div><span /><span /></div><b>Ứng tuyển ngay <ArrowUpRight size={14}/></b></div></div><div className="match-badge"><span><Sparkles size={23}/></span><div><b>Đúng người, đúng việc</b><small>Sẵn sàng cho bước tiến mới</small></div></div><div className="little-bag"><BriefcaseBusiness size={29}/></div></div></section>
 <form className="search-bar" onSubmit={e => { e.preventDefault(); setSearch(query); setLimit(6); navigate('jobs'); }}><label className="search-key"><Search size={21}/><input aria-label="Từ khóa công việc" placeholder="Vị trí tuyển dụng, kỹ năng hoặc công ty..." value={query} onChange={e => setQuery(e.target.value)}/></label><label className="search-city"><MapPin size={20}/><select aria-label="Địa điểm" value={city} onChange={e => { setCity(e.target.value); setLimit(6); }}><option value="">Tất cả địa điểm</option>{['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'].map(c => <option key={c}>{c}</option>)}</select></label><button className="primary" type="submit"><Search size={18}/> Tìm việc ngay</button></form>
 <div className="popular"><b>Tìm kiếm phổ biến:</b>{['UI/UX Designer', 'ReactJS', 'Marketing', 'Business Analyst'].map(s => <button key={s} onClick={() => { setQuery(s); setSearch(s); navigate('jobs'); }}>{s}</button>)}</div>
 {page === 'management' && user && user.role !== 'Candidate' ? <Management user={user} toast={toast} onJobsChanged={() => setJobVersion(v => v + 1)} statusNames={statusNames}/> : <div className="content-layout"><aside className={filterOpen ? 'filters show' : 'filters'}><div className="filter-heading"><h3><SlidersHorizontal size={18}/> Bộ lọc tìm kiếm</h3><button onClick={reset}>Đặt lại</button></div><Filter jobs={jobs} title="Ngành nghề" values={['Công nghệ thông tin', 'Thiết kế', 'Marketing', 'Kinh doanh', 'Quản lý sản phẩm']} selected={categories} toggle={v => toggle(v, categories, setCategories)}/><Filter jobs={jobs} title="Cấp bậc" values={['Intern', 'Junior', 'Middle', 'Senior']} labels={['Thực tập sinh', 'Nhân viên / Junior', 'Chuyên viên / Middle', 'Cấp cao / Senior']} selected={levels} toggle={v => toggle(v, levels, setLevels)}/><div className="filter-section"><h4>Mức lương</h4><select aria-label="Mức lương" value={salary} onChange={e => setSalary(e.target.value)}><option value="">Tất cả mức lương</option><option value="15">Từ 15 triệu</option><option value="20">Từ 20 triệu</option><option value="30">Từ 30 triệu</option></select></div><div className="career-tip"><span>✦</span><h4>Cơ hội tốt hơn bắt đầu<br />với một CV ấn tượng.</h4><p>Cập nhật hồ sơ để nhà tuyển dụng tìm thấy bạn dễ dàng hơn.</p><button onClick={() => navigate('cv')}>Hoàn thiện hồ sơ <ArrowRight size={16}/></button></div></aside>
 <section className="results"><div className="result-heading"><div><div className="section-eyebrow">BƯỚC TIẾN TIẾP THEO CỦA BẠN</div><h2>{page === 'jobs' ? 'Việc làm dành cho bạn' : page === 'saved' ? 'Việc làm đã lưu' : page === 'cv' ? 'Hồ sơ & CV của bạn' : 'Theo dõi đơn ứng tuyển'}<span className="title-dot"/></h2><p>{page === 'jobs' || page === 'saved' ? <>Tìm thấy <b>{resultTotal} việc làm</b> phù hợp với bạn</> : page === 'cv' ? 'Một hồ sơ tốt, ngàn cơ hội mới.' : 'Quản lý hành trình tìm kiếm công việc mơ ước.'}</p></div><div className="sort-control"><button className="filter-toggle" onClick={() => setFilterOpen(!filterOpen)}><SlidersHorizontal size={17}/> Bộ lọc</button>{['jobs', 'saved'].includes(page) && <><span>Sắp xếp:</span><select aria-label="Sắp xếp" value={sort} onChange={e => setSort(e.target.value)}><option value="new">Mới nhất</option><option value="salary">Lương cao nhất</option></select></>}</div></div>
 {['jobs', 'saved'].includes(page) ? <><div className="category-tabs">{['Tất cả', 'Công nghệ thông tin', 'Thiết kế', 'Marketing', 'Kinh doanh'].map(c => <button key={c} className={(c === 'Tất cả' ? !categories.length : categories.length === 1 && categories[0] === c) ? 'selected' : ''} onClick={() => { setCategories(c === 'Tất cả' ? [] : [c]); setLimit(6); }}>{c}</button>)}</div>{loadError && <div className="form-error" role="alert">{loadError}<button className="inline-link" onClick={() => setJobVersion(v => v + 1)}>Thử lại</button></div>}{loading && <p role="status">Đang tải việc làm...</p>}<div className="job-grid">{filtered.map(job => <article className="job-card" key={job.id}><div className="card-top"><div className="company-logo" style={{ background: job.color, color: job.ink }}>{job.logo}</div><div className="card-labels">{(job.status === 'closed' || job.deadline < Date.now()) && <span className="status withdrawn">Đã kết thúc</span>}{job.hot && <span className="hot">↗ Nổi bật</span>}<button className={'save-button ' + (saved.includes(job.id) ? 'is-saved' : '')} aria-label={saved.includes(job.id) ? 'Bỏ lưu việc' : 'Lưu việc'} onClick={() => save(job.id)}><Bookmark size={19} fill={saved.includes(job.id) ? 'currentColor' : 'none'}/></button></div></div><button className="job-title" onClick={() => openJob(job)}>{job.title}</button><div className="company-name">{job.company}<CheckCircle2 size={13}/></div><div className="job-meta"><span><MapPin size={14}/>{job.city}</span><span><Clock size={14}/>{job.type}</span></div><div className="tags">{job.tags.map(t => <span key={t}>{t}</span>)}</div><div className="card-bottom"><b>{job.salary}<small> / tháng</small></b><span>{new Date(job.created_at).toLocaleDateString('vi-VN')}</span></div></article>)}</div>{!loading && !loadError && !filtered.length && <div className="empty"><Search size={36}/><h3>{page === 'saved' && !saved.length ? 'Chưa có việc làm đã lưu' : 'Không tìm thấy công việc phù hợp'}</h3><p>Thử thay đổi từ khóa hoặc bộ lọc tìm kiếm.</p><button className="secondary" onClick={reset}>Xóa bộ lọc</button></div>}{!loading && !loadError && resultTotal > 6 && <div className="pagination"><button className="secondary" disabled={limit <= 6} onClick={() => setLimit(v => Math.max(6, v - 6))}>Trang trước</button><span>Trang {Math.floor(limit / 6)} / {Math.ceil(resultTotal / 6)}</span><button className="secondary" disabled={limit >= resultTotal} onClick={() => setLimit(v => v + 6)}>Trang sau</button></div>}</> : page === 'cv' ? <>{user && <Profile user={user} onUpdate={setUser} toast={toast}/>}<div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}><div className="upload-icon"><UploadCloud size={32}/></div><h3>Thêm CV để sẵn sàng đón cơ hội</h3><p>Kéo thả file vào đây hoặc chọn từ thiết bị của bạn</p><label className="primary upload-label">{working ? 'Đang tải lên...' : 'Chọn file CV'}<input disabled={working} type="file" accept="application/pdf,.pdf" onChange={e => { upload(e.target.files[0]); e.target.value = ''; }}/></label><small>Chỉ chấp nhận PDF · Dung lượng tối đa 5MB</small></div><h3 className="cv-heading">CV của bạn <span>({cvs.length})</span></h3>{cvs.map(cv => <div className="cv-row" key={cv.id}><div className="pdf-icon"><FileText /></div><div><b>{cv.name}</b><p>{(cv.size / 1024).toFixed(0)} KB · Thêm ngày {cv.date}</p></div><a className="inline-link" href={'/api/candidate/cvs/' + cv.id} target="_blank" rel="noreferrer">Xem CV</a><button className="text-danger" onClick={() => setModal({ type: 'delete-cv', cv })}>Xóa</button></div>)}</> : <><div className="status-tabs"><button className={!status ? 'selected' : ''} onClick={() => setStatus('')}>Tất cả ({applications.length})</button>{Object.entries(statusNames).map(([k, v]) => <button key={k} className={status === k ? 'selected' : ''} onClick={() => setStatus(k)}>{v} ({applications.filter(a => a.status === k).length})</button>)}</div>{applications.filter(a => !status || a.status === status).map(a => { const j = jobs.find(j => j.id === a.jobId) || a; return <article className="application-row" key={a.id}><div className="company-logo" style={{ background: j.color, color: j.ink }}>{j.logo}</div><div className="application-info"><h3>{j.title}</h3><p>{j.company} · {a.date}</p><small>CV: {a.cv}</small><div className="application-progress" aria-label="Tiến trình xử lý">{['submitted', 'reviewing', 'interviewed', 'accepted'].map((step, i) => <span key={step} className={(['submitted', 'reviewing', 'interviewed', 'accepted'].indexOf(a.status) >= i) ? 'done' : ''}>{statusNames[step]}</span>)}</div>{a.cover && <p className="cover-text">{a.cover}</p>}</div><span className={'status ' + a.status} title={a.status}>{statusNames[a.status]}</span>{['submitted', 'reviewing', 'interviewed'].includes(a.status) && a.job_status === 'open' && a.deadline > Date.now() && <button className="secondary" onClick={() => setModal({ type: 'withdraw', application: a })}>Rút đơn</button>}</article>; })}{!applications.filter(a => !status || a.status === status).length && <div className="empty"><Send size={36}/><h3>Chưa có đơn ứng tuyển{status ? ' ở trạng thái này' : ''}</h3><p>Công việc tiếp theo đang chờ bạn khám phá.</p><button className="primary" onClick={() => navigate('jobs')}>Khám phá việc làm <ArrowRight size={16}/></button></div>}</>}
 </section></div>}<section className="bottom-banner"><div><span>ĐỪNG BỎ LỠ CƠ HỘI PHÙ HỢP</span><h2>Công việc mơ ước, gần hơn bạn nghĩ.</h2><p>Hoàn thiện hồ sơ và sẵn sàng cho bước tiến tiếp theo.</p></div><button onClick={() => navigate('cv')}>Cập nhật hồ sơ <ArrowUpRight size={19}/></button><div className="banner-circle"/></section></main><footer><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('jobs'); }}><span className="brand-icon"><BriefcaseBusiness size={18}/></span>Job<span>Connect</span></a><span>Kết nối tài năng. Kiến tạo tương lai.</span><small>© 2026 JobConnect</small></footer>
 {notice && <div className="toast" role="status"><CheckCircle2 size={19}/>{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16}/></button></div>}
 {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-label="Chi tiết" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={() => setModal(null)}><X /></button>{modal.type === 'detail' ? <><div className="company-logo" style={{ background: modal.job.color, color: modal.job.ink }}>{modal.job.logo}</div><h2>{modal.job.title}</h2><p>{modal.job.company} · {modal.job.city}</p><div className="detail-salary">{modal.job.salary} / tháng</div><h3>Mô tả công việc</h3><p>{modal.job.description}</p><h3>Yêu cầu & quyền lợi</h3><p>{modal.job.requirements}</p><small className="demo-note">Hạn nộp: {new Date(modal.job.deadline).toLocaleString('vi-VN')} · {modal.job.status === 'closed' || modal.job.deadline <= Date.now() ? 'Đã kết thúc' : 'Đang tuyển'}</small>{modal.job.status === 'closed' || modal.job.deadline <= Date.now() ? <button className="primary full" disabled>Tin tuyển dụng đã kết thúc</button> : applications.some(a => a.jobId === modal.job.id) ? <button className="primary full" disabled>Đã ứng tuyển công việc này</button> : <button className="primary full" onClick={() => { if (candidate())
        setModal({ ...modal, type: 'apply' }); }}>Ứng tuyển ngay <ArrowUpRight size={18}/></button>}</> : modal.type === 'apply' ? <form onSubmit={apply}><span className="section-eyebrow">CƠ HỘI MỚI CỦA BẠN</span><h2>Ứng tuyển {modal.job.title}</h2><p>{modal.job.company}</p><label className="form-label">Chọn CV của bạn<select required value={selectedCV} onChange={e => setSelectedCV(e.target.value)}><option value="">Chọn một CV</option>{cvs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{!cvs.length && <button type="button" className="inline-link" onClick={() => { setModal(null); navigate('cv'); }}>Thêm CV trước khi ứng tuyển →</button>}<label className="form-label">Thư giới thiệu <span>(không bắt buộc)</span><textarea rows={4} maxLength={3000} placeholder="Chia sẻ vì sao bạn phù hợp với vị trí này..." value={cover} onChange={e => setCover(e.target.value)}/></label><p className="demo-note">CV được gửi cho nhà tuyển dụng cùng đơn ứng tuyển của bạn.</p><button className="primary full" disabled={!cvs.length || working}>{working ? 'Đang gửi...' : 'Gửi đơn ứng tuyển'} <Send size={17}/></button></form> : modal.type === 'withdraw' ? <><h2>Rút đơn ứng tuyển?</h2><p>Đơn sẽ chuyển sang trạng thái “Đã rút”. Bạn không thể nộp lại cho cùng vị trí này.</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Giữ lại đơn</button><button className="primary" disabled={working} onClick={() => withdraw(modal.application)}>Xác nhận rút đơn</button></div></> : <><h2>Xóa CV này?</h2><p>{modal.cv.name}</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Hủy</button><button className="primary" disabled={working} onClick={() => deleteCV(modal.cv)}>Xóa CV</button></div></>}</section></div>}
 </>;
}
function Filter({ jobs, title, values, labels, selected, toggle }) { return <div className="filter-section"><h4>{title}<ChevronDown size={15}/></h4>{values.map((v, i) => <label className="checkbox-row" key={v}><input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)}/><span>{labels?.[i] || v}</span>{title === 'Ngành nghề' && <small>{jobs.filter(j => j.category === v).length}</small>}</label>)}</div>; }
createRoot(document.getElementById('root')).render(<App />);
