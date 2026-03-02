Project Goal: Chuyển đổi hệ thống sang kiến trúc Stateless hoàn toàn, dữ liệu Live 100%.

1. Quy tắc thư mục (Feature-based):

Mỗi thư mục con trong app/features/ tương ứng với một Tab (ví dụ: overview, config, auth).

Mỗi folder tính năng phải có routes.py và service.py riêng biệt để cô lập logic.

2. Ràng buộc Database insight:

Chỉ kết nối vào DB insight tại localhost:27017.

TUYỆT ĐỐI KHÔNG lưu trữ bất kỳ token, password hay session nào xuống database.

Bảng users chỉ lưu định danh và quyền hạn nội bộ (App Role).

3. Luồng dữ liệu Live-Only:

Danh sách site và cấu hình phải được lấy TRỰC TIẾP từ Aruba API qua Token của trình duyệt gửi lên.

Role của site (userRoleOnSite) phải được map theo thời gian thực (Live Mapping) để tránh lỗi Admin ảo.

4. Cơ chế Refresh:

Sử dụng Fernet để mã hóa credentials trong refresh_token gửi về trình duyệt.

Endpoint /refresh phải giải mã trực tiếp từ client gửi lên mà không truy vấn database