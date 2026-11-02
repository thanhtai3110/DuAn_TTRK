export async function api(path, options = {}) {
    const { body, ...rest } = options;
    const response = await fetch('/api' + path, { credentials: 'same-origin', ...rest, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...rest.headers } }) });
    const data = await response.json().catch(() => ({ error: 'Không thể kết nối API. Hãy kiểm tra backend đang chạy.' }));
    if (!response.ok)
        throw new Error(data.error || 'Yêu cầu thất bại.');
    return data;
}
export async function uploadCV(file) { const response = await fetch('/api/candidate/cvs?name=' + encodeURIComponent(file.name), { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file }); const data = await response.json(); if (!response.ok)
    throw new Error(data.error); return data; }
