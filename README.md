# JobConnect — Kết nối việc làm

Frontend React + Tailwind CSS và backend Node.js + SQLite cho Task 8–15. Cần **Node.js 24.13 trở lên**.

## Chạy ứng dụng

```powershell
cd D:\tv2
npm run setup
npm run dev
```

Mở địa chỉ Vite in ra, thường là **http://127.0.0.1:5173**. Backend ở cổng 3001. Frontend chuyển tiếp `/api` tới backend. Backend cài @libsql/client để hỗ trợ Turso; chạy npm run setup trước lần đầu. Có thể chạy riêng `npm run dev` trong từng thư mục `backend` và `frontend`.

Lệnh `npm run dev` ở thư mục gốc chạy frontend và backend trong cùng tiến trình. Nhấn Ctrl+C để dừng cả hai; sau khi sửa mã backend, chạy lại lệnh. Nếu ứng dụng đã chạy, lệnh sẽ báo địa chỉ hiện tại thay vì tạo thêm phiên. Không cần mở thêm terminal chạy backend riêng.

Nếu gặp `EADDRINUSE` hoặc `Failed running 'backend/server.mjs'`, cổng có thể đang bị phiên cũ chiếm. Dừng terminal cũ bằng Ctrl+C rồi chạy lệnh gốc. Launcher kiểm tra cổng trước khi khởi động và báo rõ khi ứng dụng khác đang chiếm cổng, không tự dừng các tiến trình không xác định. Đổi cổng API bằng `$env:PORT = '3002'` trước khi chạy lệnh gốc nếu cần.

## Build và kiểm thử

```powershell
cd D:\tv2
npm test
npm run build
npm start
```

Mở **http://127.0.0.1:3001** để dùng frontend đã build cùng API trên một địa chỉ. Dừng tiến trình dev trước nếu đang chiếm cổng 3001.

## Tài khoản và dữ liệu

- Tạo tài khoản Ứng viên hoặc Nhà tuyển dụng trên giao diện. Không có mật khẩu mặc định.
- Admin chỉ được tạo bằng lệnh quản trị cục bộ, không thể tự đăng ký hoặc sửa role qua API. Ví dụ trong PowerShell 7:

```powershell
$env:ADMIN_EMAIL = 'admin@example.com'
$env:ADMIN_PASSWORD = Read-Host 'Mật khẩu Admin (ít nhất 12 ký tự)' -MaskInput
npm run admin
Remove-Item Env:ADMIN_PASSWORD
```

- SQLite tự khởi tạo ở `backend/data/jobconnect.sqlite`. Tài khoản và CV tồn tại sau khi khởi động lại. Sao lưu thư mục `backend/data` khi server đã dừng. `DB_PATH` cho phép đổi vị trí dữ liệu.
- 8 tin ban đầu là dữ liệu mẫu, được Admin quản lý. Nhà tuyển dụng quản lý tin và đơn thuộc tin do mình tạo.
- CV được lưu dạng BLOB trong SQLite. Đơn ứng tuyển giữ bản sao CV đã nộp, kể cả khi ứng viên xóa CV khỏi danh sách cá nhân.
- Không nhập lại dữ liệu localStorage của giao diện mô phỏng cũ; đăng ký tài khoản để dùng hệ thống thật.

## Đối chiếu Task 8–15

| Task | Triển khai |
| --- | --- |
| 8 | React, Vite, Tailwind CSS; layout Desktop/Tablet/Mobile, chữ dễ đọc |
| 9 | Session HttpOnly, mật khẩu scrypt; middleware Candidate/Recruiter/Admin; chặn tự đăng ký Admin, kiểm tra chủ sở hữu và nguồn yêu cầu |
| 10 | Việc mới nhất; tìm không dấu, địa điểm, ngành, cấp bậc, lương; sắp xếp và phân trang API; phép đo tốc độ với 10.000 bản ghi |
| 11 | Lưu/bỏ lưu theo tài khoản; khóa chính kép ngăn lưu trùng trong SQLite |
| 12 | Chọn/kéo thả CV; kiểm tra đuôi, MIME, dấu hiệu PDF và tối đa 5MB; xem/xóa CV chính chủ |
| 13 | Xác nhận rút đơn chỉ khi còn xử lý và tin chưa đóng/hết hạn; cập nhật withdrawn |
| 14 | Đủ submitted, reviewing, interviewed, accepted, rejected, withdrawn; nhà tuyển dụng cập nhật theo luồng chuyển hợp lệ |
| 15 | Chọn CV, thư giới thiệu; kiểm tra tin mở và CV chính chủ; UNIQUE(user_id,job_id) kể cả đã rút |

## Thử luồng đầy đủ

1. Đăng ký Nhà tuyển dụng, đăng tin có hạn nộp trong tương lai.
2. Đăng xuất, đăng ký Ứng viên, cập nhật hồ sơ, tải PDF tối đa 5MB.
3. Tìm tin vừa tạo, lưu việc, mở chi tiết và ứng tuyển. Thử nộp lại để kiểm tra chống trùng.
4. Đăng nhập Nhà tuyển dụng, xem CV, chuyển Đã nộp → Đang xem xét → Đã phỏng vấn → Được nhận hoặc Bị từ chối.
5. Với một đơn khác chưa kết thúc, đăng nhập Ứng viên để rút. Đơn kết thúc và tin đã đóng/hết hạn không được rút.
6. Đăng nhập Admin để xem tài khoản và quản lý tất cả tin/đơn, bao gồm tin mẫu.

Test dùng database và tài khoản tạm riêng. Phép đo dưới 500ms là p95 HTTP cục bộ trên 10.000 bản ghi, không phải cam kết độ trễ Internet. Chưa kiểm thử trình duyệt tự động trong môi trường này.

## Triển khai

Phương án hiện tại không dùng hosting trả phí: **Render Free + Turso Free**. Xem [DEPLOY.md](DEPLOY.md). Không gắn persistent disk vào Render Free. Khi thiếu cấu hình Turso, bản cloud dừng với thông báo rõ ràng để tránh mất dữ liệu trên ổ đĩa tạm. Local vẫn dùng SQLite như trước.


Khi triển khai ở hosting riêng có SQLite local, dùng ổ đĩa bền vững. Cấu hình cloud hiện tại lưu database ở Turso, dùng HTTPS và `NODE_ENV=production` để cookie có cờ Secure; reverse proxy cùng origin tới backend. Server lắng nghe `127.0.0.1`, cổng tùy chọn qua `PORT`. Không đặt database vào public. Xác thực email và đặt lại mật khẩu không nằm trong Task 8–15.

Tài liệu thư viện: [Node.js SQLite](https://nodejs.org/api/sqlite.html), [Node.js Crypto](https://nodejs.org/api/crypto.html).
