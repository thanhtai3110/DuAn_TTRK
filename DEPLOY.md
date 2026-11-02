# Đưa JobConnect lên mạng lâu dài bằng Render

## Cấu hình đã chuẩn bị

Một Node Web Service phục vụ cả frontend và backend trên cùng URL HTTPS. SQLite và CV lưu trong disk `/var/data`, giữ dữ liệu khi restart/deploy. Local vẫn chạy `npm run dev` như trước.

`render.yaml` khai báo gói **trả phí** và disk 1GB. Kiểm tra tổng chi phí trong Render trước khi xác nhận tạo dịch vụ. Render Free không hỗ trợ persistent disk nên không phù hợp giữ SQLite/CV lâu dài.

## Triển khai qua GitHub

1. Đưa các thay đổi đã kiểm tra lên repository `https://github.com/thanhtai3110/DuAn_TTRK`. Không đưa database/CV hay biến môi trường chứa mật khẩu lên GitHub.
2. Vào https://dashboard.render.com, đăng nhập và kết nối GitHub.
3. Chọn **New → Blueprint**, chọn repository và nhánh chứa `render.yaml`. Để Root Directory trống vì cấu hình chạy từ gốc repo.
4. Kiểm tra dịch vụ `jobconnect`, vùng Singapore, gói compute và disk 1GB. Chỉ xác nhận nếu đồng ý chi phí Render hiển thị.
5. Đợi build và health check thành công. Mở URL `https://...onrender.com` Render cấp và chia sẻ URL đó.

Nếu tạo Web Service thủ công, dùng:

| Trường | Giá trị |
| --- | --- |
| Runtime | Node |
| Root Directory | để trống |
| Build Command | `npm --prefix frontend ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| NODE_VERSION | `24.22.1` |
| NODE_ENV | `production` |
| HOST | `0.0.0.0` |
| DB_PATH | `/var/data/jobconnect.sqlite` |
| Persistent Disk | mount `/var/data`, 1GB |

## Tài khoản và dữ liệu sau triển khai

- Lần đầu online sử dụng database mới với 8 tin mẫu; tài khoản và CV trên máy bạn không tự chuyển lên cloud.
- Tạo tài khoản Ứng viên/Nhà tuyển dụng ngay trên URL online.
- Để tạo Admin, mở **Shell của chính Web Service** rồi nhập (mật khẩu không hiển thị):

```bash
export ADMIN_EMAIL='email-cua-ban@example.com'
read -s -p 'Mat khau Admin (it nhat 12 ky tu): ' ADMIN_PASSWORD
echo
export ADMIN_PASSWORD
npm run admin
unset ADMIN_PASSWORD
```

- Không chạy tạo Admin trong Build/Pre-deploy vì persistent disk chỉ có tại runtime. Không đặt mật khẩu Admin trong Git hoặc render.yaml.
- Nếu cần chuyển dữ liệu từ máy cá nhân, sao lưu khi backend đã dừng và chuyển qua kênh riêng vào disk; không upload qua repository public. Giữ file sao lưu riêng.
- Blueprint tắt auto-deploy. Khi cập nhật code, chọn Manual Deploy trên Render sau khi kiểm thử. Không tạo thêm service mới cho mỗi lần cập nhật.

## Xác minh

1. `https://<ten-service>.onrender.com/api/health` trả `{"service":"jobconnect","status":"ok"}`.
2. Thử đăng ký/đăng nhập, upload PDF, lưu việc và ứng tuyển.
3. Restart service, đăng nhập lại để kiểm tra dữ liệu vẫn còn.
4. Mở URL từ điện thoại qua mạng di động để xác nhận truy cập công khai.

Tài liệu: https://render.com/docs/web-services · https://render.com/docs/disks · https://render.com/docs/blueprint-spec

Việc có file cấu hình không có nghĩa website đã được xuất bản. Chỉ chia sẻ URL khi Render báo Live và health check thành công.
