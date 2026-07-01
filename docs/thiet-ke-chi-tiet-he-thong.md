# Thiết Kế Chi Tiết Hệ Thống

Tài liệu này mô tả thiết kế chi tiết cho website nội bộ có đăng nhập chung, màn chọn module, module Auth và module Chấm công/Tính lương. Tài liệu đi cùng:

- `database/schema.sql`
- `docs/huong-dan-tinh-luong.md`
- `docs/cau-truc-thu-muc-code.md`
- `docs/chacong.csv`
- `docs/bangluong.csv`
- `docs/phieuluong.csv`

## 1. Mục Tiêu Hệ Thống

Hệ thống cần giải quyết 3 nhóm việc chính:

1. Đăng nhập chung cho toàn bộ website.
2. Phân quyền động theo phòng ban để người dùng chỉ thấy và vào được module được cấp quyền.
3. Quản lý chấm công, cấu hình lương, tính lương theo chu kỳ và lưu kết quả tính lương để xuất bảng lương/phiếu lương.

Phiên bản thiết kế ban đầu có 2 module:

- `auth`: quản lý người dùng web, phòng ban và quyền truy cập module.
- `payroll`: quản lý nhân viên, cấu hình lương, quy tắc tính lương, import chấm công, chu kỳ lương và kết quả tính lương.

## 2. Vai Trò Người Dùng

### 2.1 Admin

Admin có toàn quyền:

- Truy cập mọi module.
- Tạo/sửa/xóa phòng ban.
- Tạo/sửa/khóa user.
- Cấp quyền module cho phòng ban.
- Quản lý toàn bộ dữ liệu nhân viên, chấm công và lương.
- Tính lại, khóa, hủy hoặc đánh dấu đã chi trả chu kỳ lương.

Admin được xác định bằng một trong hai cách:

- `app_users.is_admin = true`
- Hoặc phòng ban của user có `departments.is_admin = true`

### 2.2 User Theo Phòng Ban

User thường được gán vào một phòng ban. Quyền truy cập module lấy từ `department_module_permissions`.

Các quyền cơ bản:

- `can_view`: được xem module/dữ liệu.
- `can_create`: được tạo dữ liệu.
- `can_update`: được cập nhật dữ liệu.
- `can_delete`: được xóa hoặc hủy dữ liệu.
- `can_approve`: được chốt, khóa, duyệt hoặc xác nhận nghiệp vụ quan trọng.

## 3. Kiến Trúc Tổng Quan

```txt
Browser
  |
  | HTTP + httpOnly session cookie
  v
Next.js App Router
  |
  | app/page.tsx, app/login, app/modules, app/auth, app/payroll
  |
  | app/api/**/route.ts
  v
Feature Services
  |
  | auth, admin, employees, timekeeping, payroll
  v
PostgreSQL
```

Nguyên tắc:

- UI không chứa business logic quan trọng.
- API route không viết truy vấn dài hoặc tính lương trực tiếp.
- Service chịu trách nhiệm validate nghiệp vụ, gọi database, tính toán và kiểm tra workflow.
- Database giữ ràng buộc dữ liệu, trạng thái và snapshot kết quả.

## 4. Luồng Đăng Nhập Và Chọn Module

### 4.1 Đăng Nhập

1. Người dùng mở `/login`.
2. Nhập username/password.
3. API `POST /api/auth/login` kiểm tra:
   - username tồn tại.
   - user chưa bị khóa/xóa.
   - password đúng với `password_hash`.
4. Server tạo session token ngẫu nhiên.
5. Server lưu hash của token vào `user_sessions`.
6. Browser nhận cookie httpOnly.
7. Redirect tới `/modules`.

Không lưu token plain trong database. Database chỉ lưu `token_hash`.

### 4.2 Kiểm Tra Session

Mỗi request cần bảo vệ sẽ:

1. Đọc session cookie.
2. Hash token từ cookie.
3. Tìm `user_sessions.token_hash`.
4. Kiểm tra:
   - session chưa hết hạn.
   - session chưa bị revoke.
   - user còn active.
5. Trả về user context gồm `user_id`, `department_id`, `is_admin`, danh sách quyền module.

### 4.3 Màn Chọn Module

Sau đăng nhập, `/modules` hiển thị các module user được vào:

- Admin thấy tất cả module đang active.
- User thường chỉ thấy module có `can_view = true`.

Khi click module:

- `auth` đi tới `/auth`.
- `payroll` đi tới `/payroll`.

Nếu user truy cập thẳng URL không có quyền, server trả `403` hoặc redirect về `/modules`.

## 5. Module Auth

### 5.1 Chức Năng

Module Auth quản lý:

- Phòng ban.
- User dùng web.
- Quyền module theo phòng ban.

Phòng ban trong hệ thống này đóng vai trò tương tự role. Một user thuộc một phòng ban, và phòng ban quyết định user được vào module nào.

### 5.2 Bảng Dữ Liệu Liên Quan

- `modules`
- `departments`
- `department_module_permissions`
- `app_users`
- `user_sessions`

### 5.3 Màn Hình Phòng Ban

Danh sách phòng ban cần có:

- Search theo mã/tên phòng ban.
- Filter trạng thái active/inactive.
- Sort theo mã, tên, ngày tạo.
- Pagination.
- Create/Edit.
- Soft delete bằng `deleted_at`.
- Cấu hình quyền module cho phòng ban.

Form phòng ban:

- `code`: bắt buộc, duy nhất, dùng lowercase/kebab hoặc snake tùy quy ước.
- `name`: bắt buộc.
- `description`: tùy chọn.
- `is_admin`: chỉ admin được chỉnh.
- `is_active`: bật/tắt phòng ban.

### 5.4 Màn Hình User

Danh sách user cần có:

- Search theo username, display name, email.
- Filter theo phòng ban, trạng thái.
- Sort theo username, display name, last login, ngày tạo.
- Pagination.
- Create/Edit/Lock/Unlock/Reset password.
- Không hiển thị password hash.

Form user:

- `username`: bắt buộc, duy nhất.
- `display_name`: bắt buộc.
- `email`: tùy chọn, duy nhất nếu có.
- `department_id`: bắt buộc với user thường.
- `password`: bắt buộc khi tạo, tùy chọn khi sửa.
- `status`: `active`, `inactive`, `locked`.
- `is_admin`: chỉ admin được chỉnh.

### 5.5 API Đề Xuất

```txt
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/session

GET    /api/modules

GET    /api/admin/departments
POST   /api/admin/departments
GET    /api/admin/departments/[id]
PATCH  /api/admin/departments/[id]
DELETE /api/admin/departments/[id]

GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/[id]
PATCH  /api/admin/users/[id]
DELETE /api/admin/users/[id]
```

## 6. Module Chấm Công / Tính Lương

### 6.1 Chức Năng

Module payroll gồm các nhóm nghiệp vụ:

1. Quản lý nhân viên.
2. Cấu hình lương riêng cho từng nhân viên.
3. Cấu hình quy tắc tính lương chung.
4. Tạo và quản lý chu kỳ lương.
5. Import chấm công từ Excel/CSV.
6. Làm sạch bảng chấm công.
7. Tính lương theo chu kỳ.
8. Xem bảng lương và phiếu lương.

### 6.2 Bảng Dữ Liệu Liên Quan

- `employees`
- `employee_salary_configs`
- `payroll_rules`
- `payroll_cycles`
- `attendance_imports`
- `attendance_raw_rows`
- `attendance_records`
- `payroll_items`
- `payroll_item_lines`
- `payroll_audit_logs`

## 7. Quản Lý Nhân Viên

### 7.1 Dữ Liệu Nhân Viên

Các trường chính:

- `employee_code`
- `full_name`
- `gender`
- `department_name`
- `position_title`
- `joined_date`
- `status`
- `dependent_count`
- `has_child_under_6`

`employee_code` phải khớp với mã nhân viên trong file chấm công và bảng lương mẫu.

### 7.2 Cấu Hình Lương Nhân Viên

Mỗi nhân viên có nhiều cấu hình lương theo thời gian hiệu lực:

- `effective_from`
- `effective_to`
- `total_salary`
- `insurance_salary`
- `base_salary`
- các khoản phụ cấp/thưởng

Khi tính lương, service chọn cấu hình có hiệu lực trong chu kỳ. Nếu một chu kỳ bị giao cắt bởi nhiều cấu hình lương, thiết kế triển khai có 2 lựa chọn:

1. Chặn tính và yêu cầu tách chu kỳ.
2. Tính prorate theo từng giai đoạn hiệu lực.

Khuyến nghị giai đoạn đầu: chặn tính và yêu cầu một chu kỳ chỉ dùng một cấu hình lương hiệu lực cho mỗi nhân viên.

## 8. Quản Lý Quy Tắc Tính Lương

`payroll_rules` lưu quy tắc dạng key-value để có thể chỉnh trong hệ thống.

Các rule seed ban đầu:

- `standard_hours_per_day`
- `overtime_normal_rate`
- `overtime_sunday_rate`
- `overtime_holiday_rate`
- `employee_insurance_rate`
- `company_social_insurance_rate`
- `company_health_insurance_rate`
- `company_unemployment_insurance_rate`
- `company_union_rate`
- `employee_union_rate`

Khi tính lương, service phải lấy toàn bộ active rules và lưu vào `payroll_items.rule_snapshot`.

## 9. Chu Kỳ Lương

### 9.1 Trạng Thái

```txt
draft -> imported -> cleaned -> calculated -> locked -> paid
```

Nhánh phụ:

```txt
draft/imported/cleaned/calculated -> cancelled
locked -> calculated
```

Mở khóa từ `locked` về `calculated` chỉ admin hoặc user có `can_approve` được làm.

### 9.2 Quy Định Theo Trạng Thái

`draft`:

- Được sửa thông tin chu kỳ.
- Được import chấm công.
- Chưa được tính lương nếu chưa có dữ liệu chấm công.

`imported`:

- Đã có file nguồn.
- Được validate/làm sạch.

`cleaned`:

- Đã có `attendance_records`.
- Được tính lương.

`calculated`:

- Đã có `payroll_items`.
- Được xem bảng lương.
- Được tính lại nếu chưa locked.

`locked`:

- Không cho sửa chấm công, cấu hình trong chu kỳ hoặc tính lại.
- Được xuất bảng lương/phiếu lương.
- Được đánh dấu paid.

`paid`:

- Chu kỳ đã chi trả.
- Chỉ xem và xuất dữ liệu.

`cancelled`:

- Chu kỳ hủy.
- Không cho import/tính/chốt.

Mọi chuyển trạng thái quan trọng ghi vào `payroll_audit_logs`.

## 10. Import Và Làm Sạch Chấm Công

### 10.1 Input

Nguồn ban đầu là file Excel xuất ra CSV tương tự `docs/chacong.csv`.

Các dòng đầu có thể là tiêu đề báo cáo:

- Tên báo cáo.
- Khoảng ngày.
- Header thật bắt đầu từ dòng có `Mã N.Viên`.

Parser cần tự tìm dòng header bằng cột `Mã N.Viên`.

### 10.2 Pipeline Import

```txt
Upload file
  -> tạo attendance_imports
  -> parse CSV/Excel
  -> lưu từng dòng vào attendance_raw_rows
  -> validate từng dòng
  -> normalize dữ liệu
  -> upsert attendance_records
  -> cập nhật summary import
  -> chuyển payroll_cycles sang imported/cleaned
```

### 10.3 Validate Dòng Chấm Công

Mỗi dòng hợp lệ cần có:

- Mã nhân viên.
- Tên nhân viên.
- Ngày hợp lệ.
- Dữ liệu số có thể parse.
- Giờ vào/ra đúng format nếu có.

Lỗi nên trả về theo dòng:

```json
{
  "rowNumber": 12,
  "employeeCode": "16NAT",
  "errors": [
    "Ngày không hợp lệ",
    "Không tìm thấy nhân viên"
  ]
}
```

### 10.4 Làm Sạch Dữ Liệu

Quy tắc normalize:

- Trim mọi text.
- Đổi `,` thành `.` cho số thập phân.
- Chuẩn hóa ngày `dd/MM/yyyy` sang date.
- Chuẩn hóa giờ `HH:mm`.
- Blank, `-`, `-----` xem là null hoặc 0 tùy field.
- `TC1`, `TC2`, `TC3` map sang OT thường, Chủ Nhật, lễ.
- `Công`, `Giờ`, `Công+`, `Giờ+` map sang công/giờ chuẩn hóa.

Không sửa mất dữ liệu nguồn; raw vẫn nằm trong `attendance_raw_rows`.

## 11. Tính Lương

### 11.1 Điều Kiện Trước Khi Tính

Chu kỳ được tính khi:

- Trạng thái là `cleaned` hoặc `calculated`.
- Có `attendance_records`.
- Mỗi nhân viên trong chấm công có hồ sơ `employees`.
- Mỗi nhân viên có cấu hình lương hiệu lực.
- Các payroll rules bắt buộc đang active.

Nếu thiếu dữ liệu, API trả lỗi validation theo từng nhân viên để kế toán sửa trước khi tính.

### 11.2 Dữ Liệu Đầu Vào

Với mỗi nhân viên trong chu kỳ:

- Hồ sơ nhân viên.
- Cấu hình lương hiệu lực.
- Dòng chấm công đã clean.
- Quy tắc tính lương active.
- Thông tin chu kỳ: ngày bắt đầu, ngày kết thúc, ngày công chuẩn, giờ/ngày.

### 11.3 Tổng Hợp Chấm Công

Từ `attendance_records`, tính:

- Tổng công thực tế.
- Tổng giờ công.
- Tổng công cộng thêm.
- Tổng giờ cộng thêm.
- Tổng giờ OT thường.
- Tổng giờ OT Chủ Nhật.
- Tổng giờ OT lễ.
- Tổng phút đi trễ.
- Tổng phút về sớm.
- Số ngày phép/lễ/nghỉ nếu nhận diện được từ ký hiệu.

### 11.4 Công Thức Baseline

```txt
salary_per_day = total_salary / standard_workdays
salary_per_hour = salary_per_day / standard_hours_per_day

monthly_salary_amount = salary_per_day * paid_workdays

overtime_normal_amount = overtime_normal_hours * salary_per_hour * overtime_normal_rate
overtime_sunday_amount = overtime_sunday_hours * salary_per_hour * overtime_sunday_rate
overtime_holiday_amount = overtime_holiday_hours * salary_per_hour * overtime_holiday_rate

allowance_amount =
  position_allowance
  + responsibility_allowance
  + seniority_allowance
  + safety_allowance
  + phone_allowance
  + travel_allowance
  + housing_allowance
  + attendance_bonus
  + other_bonus
  + meal_allowance

gross_income =
  monthly_salary_amount
  + paid_leave_amount
  + overtime_normal_amount
  + overtime_sunday_amount
  + overtime_holiday_amount
  + allowance_amount

company_insurance_amount =
  insurance_salary
  * (company_social_insurance_rate
    + company_health_insurance_rate
    + company_unemployment_insurance_rate
    + company_union_rate)

employee_insurance_amount = insurance_salary * employee_insurance_rate
union_fee_amount = insurance_salary * employee_union_rate

total_deduction =
  employee_insurance_amount
  + union_fee_amount
  + personal_income_tax_amount
  + advance_payment_1
  + advance_payment_2

net_salary = gross_income - total_deduction
```

### 11.5 Snapshot Kết Quả

Khi tính xong:

- Xóa hoặc replace kết quả cũ của cùng chu kỳ nếu chu kỳ chưa locked.
- Insert/update `payroll_items`.
- Insert lại `payroll_item_lines`.
- Lưu `salary_config_snapshot`.
- Lưu `rule_snapshot`.
- Set chu kỳ sang `calculated`.
- Ghi `payroll_audit_logs`.

Snapshot là bắt buộc để bảng lương cũ không bị thay đổi khi sửa cấu hình lương hoặc rule ở kỳ sau.

## 12. Bảng Lương Và Phiếu Lương

### 12.1 Bảng Lương Tổng Hợp

Bảng lương tổng hợp lấy từ `payroll_items` và join chu kỳ/nhân viên khi cần.

Cột chính:

- Mã nhân viên.
- Họ tên.
- Tổng lương.
- Lương đóng BH.
- Công thực tế.
- Phép/lễ.
- OT thường/CN/lễ.
- Tổng phụ cấp.
- Tổng thu nhập.
- BHXH nhân viên.
- Đoàn phí.
- Thuế TNCN.
- Tạm ứng.
- Tổng khấu trừ.
- Lương thực nhận.
- Lương còn lại/chi lần 2.

### 12.2 Phiếu Lương

Phiếu lương là detail view của một `payroll_item`.

Nên hiển thị theo nhóm giống `docs/phieuluong.csv`:

- Thông tin công ty/kỳ lương.
- Mã số, họ tên.
- Tổng lương, lương đóng BH.
- Công thực ngày, nghỉ, phép/lễ.
- Tăng ca thường, Chủ Nhật, lễ.
- Phụ cấp.
- Tổng thu nhập.
- Phần khấu trừ.
- Lương chi lần 1/lần 2.
- Lương còn lại.
- Ghi chú.

## 13. API Payroll Đề Xuất

```txt
GET    /api/employees
POST   /api/employees
GET    /api/employees/[id]
PATCH  /api/employees/[id]
DELETE /api/employees/[id]

GET    /api/payroll/rules
POST   /api/payroll/rules
PATCH  /api/payroll/rules/[id]

GET    /api/payroll/cycles
POST   /api/payroll/cycles
GET    /api/payroll/cycles/[id]
PATCH  /api/payroll/cycles/[id]
DELETE /api/payroll/cycles/[id]
POST   /api/payroll/cycles/[id]/calculate

POST   /api/timekeeping/imports
GET    /api/timekeeping/imports
GET    /api/timekeeping/records

GET    /api/payroll/items
GET    /api/payroll/items?cycleId=...
```

List API phải hỗ trợ:

- `page`
- `limit`
- `search`
- `sort`
- filter theo trạng thái/kỳ/phòng ban nếu phù hợp

Sort field phải whitelist, không nhận trực tiếp từ client để ghép SQL tùy ý.

## 14. Thiết Kế Màn Hình

### 14.1 `/login`

Thành phần:

- Form username/password.
- Trạng thái loading.
- Thông báo lỗi đăng nhập.

Sau login thành công redirect `/modules`.

### 14.2 `/modules`

Thành phần:

- Header có tên user và nút logout.
- Grid/list module được cấp quyền.
- Empty state nếu user chưa được cấp module.

### 14.3 `/auth`

Tabs đề xuất:

- Phòng ban.
- User.
- Phân quyền.

Mỗi tab có table, search, filter, pagination và dialog create/edit.

### 14.4 `/payroll`

Tabs đề xuất:

- Nhân viên.
- Cấu hình lương.
- Quy tắc lương.
- Chu kỳ lương.
- Chấm công.
- Bảng lương.

Các action quan trọng:

- Import chấm công.
- Làm sạch chấm công.
- Tính lương.
- Tính lại lương.
- Khóa chu kỳ.
- Đánh dấu đã trả.
- Xem phiếu lương.

Các action phá dữ liệu hoặc đổi trạng thái quan trọng phải có confirm.

## 15. Validation Và Bảo Mật

### 15.1 Validation

Validate server-side cho:

- Login body.
- Query pagination/filter/sort.
- Form phòng ban/user/nhân viên.
- Config lương.
- Rule lương.
- Chu kỳ lương.
- File import.
- Dòng chấm công.
- Action tính/chốt/hủy chu kỳ.

### 15.2 Bảo Mật

Yêu cầu:

- Không expose `DATABASEURL`.
- Không trả `password_hash`.
- Cookie session dùng `httpOnly`, `sameSite=lax`.
- Production dùng `secure=true`.
- Không lưu token session dạng plain.
- Không trả lỗi SQL/raw stack cho client.
- Mọi API, trừ login/session public tối thiểu, phải check quyền server-side.

## 16. Giao Dịch Database

Các thao tác cần transaction:

- Tạo user + dữ liệu phụ liên quan.
- Cập nhật quyền phòng ban theo module.
- Import chấm công: import summary + raw rows + clean records + trạng thái chu kỳ.
- Tính lương: xóa/recalculate item cũ + insert item mới + insert lines + update cycle + audit log.
- Lock/pay/cancel chu kỳ + audit log.

Nếu transaction lỗi, rollback toàn bộ để tránh bảng lương nửa vời.

## 17. Hiệu Năng Và Index

Các danh sách lớn cần query ở PostgreSQL:

- Search/filter/sort/pagination không xử lý trong memory.
- Không dùng `SELECT *` cho API list.
- Dùng index đã định nghĩa trong `schema.sql`.
- Các bảng lớn dự kiến: `attendance_raw_rows`, `attendance_records`, `payroll_items`.

Query thường gặp:

- Lấy chấm công theo `payroll_cycle_id`, `employee_code`, `work_date`.
- Lấy bảng lương theo `payroll_cycle_id`.
- Lấy nhân viên theo mã/tên/trạng thái.
- Lấy user theo phòng ban/trạng thái.

## 18. Logging Và Audit

Audit bắt buộc cho:

- Tính lương.
- Tính lại lương.
- Khóa chu kỳ.
- Mở khóa chu kỳ.
- Đánh dấu paid.
- Hủy chu kỳ.
- Import chấm công.

`payroll_audit_logs.payload` nên lưu:

- số bản ghi ảnh hưởng.
- người thao tác.
- thời điểm.
- lý do nếu có.
- summary lỗi nếu có.

## 19. Kế Hoạch Triển Khai

### Giai Đoạn 1: Nền Tảng

1. Apply `database/schema.sql`.
2. Tạo `lib/db.ts`.
3. Tạo response helper, pagination helper, validation helper.
4. Tạo auth service và session service.
5. Tạo login/logout/session API.

### Giai Đoạn 2: Auth Module

1. Tạo màn `/login`.
2. Tạo màn `/modules`.
3. Tạo API và UI quản lý phòng ban.
4. Tạo API và UI quản lý user.
5. Tạo UI cấp quyền module theo phòng ban.

### Giai Đoạn 3: Payroll Master Data

1. Tạo API và UI nhân viên.
2. Tạo API và UI cấu hình lương nhân viên.
3. Tạo API và UI payroll rules.
4. Tạo API và UI chu kỳ lương.

### Giai Đoạn 4: Chấm Công

1. Tạo import API.
2. Parse file mẫu.
3. Lưu raw rows.
4. Normalize sang `attendance_records`.
5. Hiển thị màn kiểm tra dữ liệu clean.
6. Báo lỗi theo dòng.

### Giai Đoạn 5: Tính Lương

1. Tạo payroll calculation service.
2. Tổng hợp chấm công.
3. Áp dụng config lương và rules.
4. Lưu `payroll_items` và `payroll_item_lines`.
5. Tạo bảng lương tổng hợp.
6. Tạo phiếu lương detail.
7. Tạo action lock/pay/cancel.

## 20. Tiêu Chí Hoàn Thành

Hệ thống đạt yêu cầu khi:

- User đăng nhập được bằng auth tự viết.
- User chỉ thấy module được cấp quyền.
- Admin full quyền.
- Quản lý được phòng ban, user và quyền module.
- Quản lý được nhân viên và cấu hình lương.
- Quản lý được quy tắc tính lương.
- Tạo được chu kỳ lương.
- Import được file chấm công mẫu.
- Làm sạch được dữ liệu chấm công để dễ đọc.
- Tính được bảng lương theo chu kỳ.
- Lưu snapshot kết quả tính.
- Xem được bảng lương tổng hợp và phiếu lương.
- Chu kỳ đã locked/paid không bị thay đổi ngoài quy trình mở khóa.

