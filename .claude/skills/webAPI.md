# Skill: Fullstack Development & System Cleanup 

## 1. Quy định về Thư mục & Phạm vi
- **Làm việc chính:** `source/insight/`
- **Vùng cấm:** `capture_tool_kit/`
- **Thư mục Nhật ký:** `D:\AITC\API-Testing\docs\insight`

## 2. Quy trình thực hiện (Workflow) - BẮT BUỘC

### Bước 1: Khởi tạo & Lập Kế hoạch (Planning)
- Phân tích yêu cầu, liệt kê các file sẽ thay đổi trong `source/insight/`.
- **Hỏi ý kiến người dùng về Plan này.**

### Bước 2: Ghi Nhật ký Thay đổi (Log Change - SAU KHI DUYỆT PLAN)
Ngay sau khi người dùng đồng ý với Plan, Claude PHẢI tạo một file `.md` tóm tắt tại: `D:\AITC\API-Testing\docs\insight`.
- **Định dạng tên file:** `Update_[Ten_Tinh_Nang]_[YYYYMMDD_HHmmss].md`
- **Múi giờ:** Asia/Ho_Chi_Minh (GMT+7).
- **Nội dung file:**
    - # Nhật ký Update: [Tên tính năng]
    - **Thời gian:** [Giờ Việt Nam]
    - **Mục tiêu:** [Tóm tắt ngắn gọn tính năng]
    - **Các file sẽ tác động:** [Danh sách file]
    - **Trạng thái:** Chờ thực thi (Pending).

### Bước 3: Thực thi Code (Implementation)
- Chỉ code trong `source/insight/`. Tuân thủ FastAPI, React, shadcn/ui.
- Sau khi code xong, cập nhật trạng thái trong file log ở Bước 2 thành "Hoàn thành (Completed)".

### Bước 4: Vệ sinh & Dọn rác (Cleanup)
- Sau khi chạy/test Python, BẮT BUỘC chạy lệnh:
  `find . -name "__pycache__" -type d -exec rm -rf {} +`
- Xóa các file rác phát sinh như `.pytest_cache`, `npm-debug.log`.

## 3. Tiêu chuẩn Code
- Comment tiếng Việt, Type Hints đầy đủ, không sửa cấu trúc folder gốc.