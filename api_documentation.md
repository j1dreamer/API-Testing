# Aruba Instant On - Native API Master Spec

Tài liệu này trích xuất các **API gốc (Native APIs)** của Aruba Instant On từ source code, loại bỏ các lớp bọc proxy nội bộ để cung cấp "bản đồ gốc" cho việc tái sử dụng trên các nền tảng khác.

| ID | Nhóm Chức năng (Module) | Tên Hành động (Action) | Method | Endpoint URL (Original) | Headers Bắt buộc (Gốc) | Request Payload (Gốc) | Response Mẫu (Gốc) | Phụ thuộc (Dependency) | Ghi chú Kỹ thuật (Notes) |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **AUTH_01** | Authentication | Discovery Config | GET | `https://portal.instant-on.hpe.com/settings.json` | Không | (Trống) | `{"ssoClientIdAuthN": "...", "restApiUrl": "..."}` | Không | Dùng để lấy `client_id` và URL API động. |
| **AUTH_02** | Authentication | MFA/Login Validate | POST | `https://sso.arubainstanton.com/aio/api/v1/mfa/validate/full` | Content-Type: application/x-www-form-urlencoded | `identification={{user}}&password={{pass}}&client_id={{id}}` | `{"access_token": "...", "success": true}` | **AUTH_01** | Trả về `sessionToken` để dùng cho bước Authorize. |
| **AUTH_03** | Authentication | OAuth2 Authorize | GET | `https://sso.arubainstanton.com/as/authorization.oauth2` | Không | Query: `client_id, response_type=code, code_challenge, sessionToken` | Redirect tới Location có `code=...` | **AUTH_02** | Thực hiện bước lấy Authorize Code trong luồng PKCE. |
| **AUTH_04** | Authentication | Token Exchange | POST | `https://sso.arubainstanton.com/as/token.oauth2` | Content-Type: application/x-www-form-urlencoded | `grant_type=authorization_code&code={{code}}&code_verifier={{v}}` | `{"access_token": "ey...", "expires_in": 1800}` | **AUTH_03** | Trả về Final Bearer Token để gọi các Management API. |
| **SITE_01** | Site Management | Get Customer Context | GET | `https://portal.instant-on.hpe.com/api/v1/customers/me` | Authorization: Bearer {{token}} | (Trống) | `{"customerId": "uuid", "email": "..."}` | **AUTH_04** | Xác định context định danh của người dùng. |
| **SITE_02** | Site Management | List All Sites | GET | `https://portal.instant-on.hpe.com/api/sites` | Authorization: Bearer {{token}}, X-ION-API-VERSION: 22 | (Trống) | `[{"id": "site_uuid", "name": "HCM_Office"}]` | **AUTH_04** | Trả về danh sách siteID để dùng cho các bước sau. |
| **NET_01** | Network Config | Get Networks Summary | GET | `https://portal.instant-on.hpe.com/api/sites/{{site_id}}/networksSummary` | Authorization: Bearer {{token}} | (Trống) | `[{"networkId": "...", "networkName": "SSID_1", ...}]` | **SITE_02** | Lấy toàn diện cấu hình Wired/Wireless của một Site. |
| **NET_02** | Network Config | Create Network (Step 1) | POST | `https://portal.instant-on.hpe.com/api/sites/{{site_id}}/networksSummary` | Authorization: Bearer {{token}}, Content-Type: application/json | `{"networkName": "New_SSID", "isWireless": true, "security": "WPA2_PSK"}` | `{"networkId": "new_uuid", ...}` | **NET_01** | Bước 1 trong quy trình Clone: Tạo khung network cơ bản. |
| **NET_03** | Network Config | Update Network (Step 2) | PUT | `https://portal.instant-on.hpe.com/api/sites/{{site_id}}/networksSummary/{{net_id}}` | Authorization: Bearer {{token}} | `{"networkName": "...", "schedule": {...}, "bandwidth": {...}}` | (200 OK / 204 No Content) | **NET_02** | Bước 2: Cập nhật các settings nâng cao vào Network vừa tạo. |
| **GUEST_01**| Guest Management | Update Portal Settings | PUT | `https://portal.instant-on.hpe.com/api/sites/{{site_id}}/guestPortalSettings` | Authorization: Bearer {{token}} | `{"kind": "GuestSessionSettings", "isPortalEnabled": true, ...}` | (200 OK) | **NET_03** | Cấu hình trang chào (Captive Portal) cho Guest Network. |
| **INV_01** | Inventory | Get Site Dashboard | GET | `https://portal.instant-on.hpe.com/api/v1/sites/{{site_id}}/dashboard` | Authorization: Bearer {{token}} | (Trống) | `{"devices": [...], "alerts": [...]}` | **SITE_02** | Lấy trạng thái thiết bị và cảnh báo của site. |

## Quy trình Xác thực (Native Auth Flow)

Aruba sử dụng luồng **OAuth2 Authorization Code + PKCE**. Để bóc tách code thành tool riêng, bạn cần thực hiện theo thứ tự:
1. Gọi **AUTH_01** để xác định `client_id` hiện tại.
2. Gọi **AUTH_02** với credentials để lấy `sessionToken`.
3. Gọi **AUTH_03** (với `sessionToken`) để lấy `code`.
4. Gọi **AUTH_04** (với `code`) để lấy `access_token` cuối cùng.

## Ghi chú Kỹ thuật (Notes)

- **Common Headers**: Hầu hết các API của Aruba yêu cầu bộ Header sau:
    - `X-ION-API-VERSION`: Thường là `22`.
    - `X-ION-CLIENT-TYPE`: `InstantOn`.
    - `X-ION-CLIENT-PLATFORM`: `web`.
- **Two-Pass Configuration**: Khi tạo Network mới, Aruba yêu cầu thực hiện `POST` trước để lấy `networkId`, sau đó mới dùng `PUT` để đẩy các cấu hình chi tiết (Schedules, Bandwidth).
- **VLAN Handling**: `vlanId` phải là số nguyên (Integer). Nếu để String sẽ bị lỗi 400 Bad Request.
