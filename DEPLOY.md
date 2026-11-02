# Triển khai JobConnect với gói miễn phí

## Phương án

- **Render Free:** chạy Node.js, frontend và API trên cùng URL HTTPS `onrender.com`.
- **Turso Free:** giữ tài khoản, việc làm, đơn ứng tuyển và file CV dạng BLOB. Database không nằm trên ổ đĩa tạm của Render.
- `render.yaml` dùng `plan: free`, không gắn disk, không tạo dịch vụ trả phí. Không chọn nâng cấp hoặc bật tính phí vượt hạn mức.

Miễn phí trong hạn mức nhà cung cấp; không phải cam kết không giới hạn hay uptime 24/7. Render Free ngủ sau 15 phút không truy cập và có độ trễ khởi động lại. Hạn mức Turso xem tại https://turso.tech/pricing. Tốc độ kiểm thử cục bộ không đại diện cho thời gian khởi động lạnh hoặc API cloud.

## 1. Tạo database miễn phí

1. Mở https://app.turso.tech và đăng nhập bằng GitHub.
2. Chọn gói **Free**, tạo database `jobconnect`; chọn khu vực gần người dùng nếu có.
3. Trong dashboard database, sao chép **Database URL** và tạo **database auth token** có quyền đọc/ghi. Đây là token database, không phải token quản lý tài khoản.
4. Giữ token riêng để điền trực tiếp vào Render. Không gửi token vào chat, GitHub, mã frontend hoặc ảnh chụp màn hình.

## 2. Tạo web miễn phí

1. Vào https://dashboard.render.com, đăng nhập bằng GitHub.
2. Chọn **New → Blueprint**, repository `thanhtai3110/DuAn_TTRK`, nhánh `master`; Root Directory để trống.
3. Render đọc `render.yaml`. Điền `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` khi được yêu cầu.
4. Kiểm tra **plan Free**, không có persistent disk và không có tài nguyên trả phí. Nếu màn hình hiện yêu cầu thanh toán/nâng cấp, dừng lại để kiểm tra cấu hình.
5. Đợi dịch vụ báo **Live**, mở URL Render cấp và chia sẻ URL đó. URL dùng HTTPS; không cần mua tên miền.

Nếu tạo Web Service thủ công:

| Trường | Giá trị |
| --- | --- |
| Runtime | Node |
| Plan | Free |
| Root Directory | để trống |
| Build Command | `npm --prefix backend ci --omit=dev && npm --prefix frontend ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check | `/api/health` |
| NODE_VERSION | `24.22.1` |
| NODE_ENV | `production` |
| HOST | `0.0.0.0` |
| REQUIRE_REMOTE_DB | `true` |
| TURSO_DATABASE_URL | Database URL từ Turso |
| TURSO_AUTH_TOKEN | Token database từ Turso (secret) |

Không đặt `DB_PATH` trên cloud. `REQUIRE_REMOTE_DB=true` khiến ứng dụng từ chối khởi động nếu thiếu Turso, tránh vô tình lưu SQLite lên ổ tạm rồi mất dữ liệu.

## Dữ liệu và Admin

- Database online mới có 8 tin mẫu. Dữ liệu SQLite cục bộ không tự chuyển lên cloud.
- Đăng ký Candidate/Recruiter trên web. Dữ liệu tồn tại sau restart/redeploy Render.
- Render Free không có Shell. Để tạo Admin trong Turso, dùng terminal **PowerShell 7 trên máy của bạn**, không dùng shell hosting trả phí:

```powershell
cd D:\tv2
$env:TURSO_DATABASE_URL = Read-Host 'Database URL'
$env:TURSO_AUTH_TOKEN = Read-Host 'Database token' -MaskInput
$env:ADMIN_EMAIL = Read-Host 'Email Admin'
$env:ADMIN_PASSWORD = Read-Host 'Mat khau Admin (it nhat 12 ky tu)' -MaskInput
npm run admin
Remove-Item Env:TURSO_AUTH_TOKEN, Env:TURSO_DATABASE_URL, Env:ADMIN_PASSWORD, Env:ADMIN_EMAIL
```

Local vẫn dùng SQLite nếu không đặt biến Turso. Sau khi xóa các biến trên, chạy `npm run dev` để trở lại database local. Các file `.env.example` chỉ là hướng dẫn; app không tự đọc `.env`.

## Kiểm tra sau xuất bản

1. Mở `/api/health`, phải trả `{"service":"jobconnect","status":"ok"}`.
2. Đăng ký, tải CV PDF tối đa 5MB, lưu việc và ứng tuyển.
3. Restart trên Render rồi kiểm tra dữ liệu còn nguyên.
4. Mở URL bằng mạng di động. Lần mở sau khi dịch vụ ngủ có thể chậm.

Chưa có URL online cho tới khi Render báo Live. Kiểm thử adapter libSQL ở máy cục bộ không thay thế việc kiểm thử kết nối Turso thật. Đừng tạo tài nguyên trả phí để vượt quota khi chưa được cho phép.

Tài liệu: https://render.com/docs/free · https://turso.tech/pricing · https://docs.turso.tech/sdk/ts/reference
