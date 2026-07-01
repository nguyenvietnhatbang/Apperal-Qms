# Cấu Trúc Thư Mục Code

Tài liệu này mô tả cấu trúc đề xuất cho dự án Next.js App Router. Mục tiêu là giữ route mỏng, tách nghiệp vụ khỏi UI, và dễ mở rộng thêm module sau này.

## 1. Nguyên Tắc Chung

- Dùng App Router với thư mục root-level `app/`.
- Không dùng legacy `pages/`.
- API viết trong `app/api/**/route.ts`.
- Route handler chỉ nhận request, kiểm tra session/quyền, validate input, gọi service và trả response.
- Business logic nằm trong `features/*/services`.
- UI theo route đặt trong `app/<route>/_components` nếu chỉ dùng cho route đó.
- Logic dùng chung đặt trong `lib/`.
- Tài liệu nghiệp vụ đặt trong `docs/`.
- Schema SQL đặt trong `database/`.

## 2. Cây Thư Mục Đề Xuất

```txt
app/
  layout.tsx
  page.tsx
  login/
    page.tsx
    _components/
      login-form.tsx
  modules/
    page.tsx
    _components/
      module-grid.tsx
  auth/
    page.tsx
    _components/
      departments-table.tsx
      department-form-dialog.tsx
      users-table.tsx
      user-form-dialog.tsx
  payroll/
    page.tsx
    _components/
      employees-table.tsx
      employee-form-dialog.tsx
      salary-config-dialog.tsx
      payroll-rules-table.tsx
      payroll-cycles-table.tsx
      attendance-import-panel.tsx
      payroll-result-table.tsx
  api/
    auth/
      login/route.ts
      logout/route.ts
      session/route.ts
    modules/route.ts
    admin/
      departments/route.ts
      departments/[id]/route.ts
      users/route.ts
      users/[id]/route.ts
    employees/
      route.ts
      [id]/route.ts
    timekeeping/
      imports/route.ts
      records/route.ts
    payroll/
      rules/route.ts
      rules/[id]/route.ts
      cycles/route.ts
      cycles/[id]/route.ts
      cycles/[id]/calculate/route.ts
      items/route.ts

features/
  auth/
    services/
      auth-service.ts
      permission-service.ts
    types/
      auth-types.ts
  admin/
    services/
      department-service.ts
      user-service.ts
    types/
      admin-types.ts
  employees/
    services/
      employee-service.ts
      salary-config-service.ts
    types/
      employee-types.ts
  timekeeping/
    services/
      attendance-import-service.ts
      attendance-cleaning-service.ts
    types/
      timekeeping-types.ts
  payroll/
    services/
      payroll-rule-service.ts
      payroll-cycle-service.ts
      payroll-calculation-service.ts
      payroll-slip-service.ts
    types/
      payroll-types.ts

lib/
  db.ts
  api-response.ts
  auth-session.ts
  validation.ts
  pagination.ts
  format.ts

database/
  schema.sql

docs/
  huong-dan-tinh-luong.md
  cau-truc-thu-muc-code.md
  bangluong.csv
  chacong.csv
  phieuluong.csv
```

## 3. Vai Trò Từng Khu Vực

### `app/`

Chứa routing và giao diện theo URL.

- `app/page.tsx`: kiểm tra session và điều hướng về `/login` hoặc `/modules`.
- `app/login/page.tsx`: màn đăng nhập chung.
- `app/modules/page.tsx`: màn chọn module sau đăng nhập.
- `app/auth/page.tsx`: quản lý phòng ban, user web và phân quyền module.
- `app/payroll/page.tsx`: màn nghiệp vụ chấm công/tính lương.

`page.tsx` chỉ nên làm composition, không chứa toàn bộ table, form và business logic.

### `app/api/`

Chứa API nội bộ của Next.js.

Quy tắc:

- Mỗi resource có `route.ts`.
- Resource có thao tác theo id dùng `[id]/route.ts`.
- Không viết SQL dài trực tiếp trong route.
- Không tin dữ liệu từ client.
- Mọi API cần kiểm tra đăng nhập và quyền, trừ `login`.

Ví dụ:

```txt
app/api/admin/departments/route.ts
app/api/admin/departments/[id]/route.ts
```

### `features/`

Chứa nghiệp vụ theo module.

- `auth`: đăng nhập, session, phân quyền.
- `admin`: phòng ban và user web.
- `employees`: hồ sơ nhân viên và cấu hình lương riêng.
- `timekeeping`: import và làm sạch chấm công.
- `payroll`: quy tắc lương, chu kỳ lương, tính lương, phiếu lương.

Service trong `features` chịu trách nhiệm:

- Validate nghiệp vụ.
- Gọi database.
- Tính toán.
- Kiểm tra workflow.
- Trả dữ liệu đã chuẩn hóa cho API/UI.

### `lib/`

Chứa tiện ích dùng chung:

- `db.ts`: PostgreSQL connection pool đọc từ `DATABASEURL`.
- `api-response.ts`: response shape thống nhất.
- `auth-session.ts`: đọc/ghi session cookie, hash token.
- `validation.ts`: helper validate query/body.
- `pagination.ts`: chuẩn hóa page, limit, offset, sort.
- `format.ts`: format tiền, ngày, số thập phân.

Không đặt nghiệp vụ tính lương chi tiết vào `lib/`; phần đó thuộc `features/payroll`.

### `database/`

Chứa schema và migration SQL.

Hiện tại:

```txt
database/schema.sql
```

Sau này nếu cần version migration:

```txt
database/migrations/
  001_initial_schema.sql
  002_add_payroll_indexes.sql
```

### `docs/`

Chứa tài liệu nghiệp vụ, tài liệu kỹ thuật và file mẫu.

```txt
docs/huong-dan-tinh-luong.md
docs/cau-truc-thu-muc-code.md
docs/bangluong.csv
docs/chacong.csv
docs/phieuluong.csv
```

## 4. Quy Ước API

Response thành công:

```json
{
  "success": true,
  "data": {}
}
```

Response lỗi:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": []
  }
}
```

List API cần có pagination:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

## 5. Quy Ước Phân Quyền

Luồng phân quyền:

1. User đăng nhập bằng username/password.
2. Server tạo session token, lưu hash token vào `user_sessions`.
3. Browser chỉ giữ httpOnly cookie.
4. Khi vào module hoặc gọi API, server đọc session.
5. Nếu `app_users.is_admin = true` hoặc `departments.is_admin = true` thì full quyền.
6. Nếu không phải admin, kiểm tra `department_module_permissions` theo module.

Module mặc định:

- `auth`: quản lý người dùng, phòng ban, quyền.
- `payroll`: chấm công và tính lương.

## 6. Quy Ước Màn Hình Quản Trị

Các màn quản trị dữ liệu nên có:

- Search.
- Filter.
- Sort.
- Pagination.
- Loading state.
- Empty state.
- Error state.
- View/Create/Edit/Delete nếu phù hợp.
- Confirm cho thao tác xóa, khóa, tính lại lương, chốt lương.

Màn chấm công/tính lương nên chia thành các vùng:

- Nhân viên và cấu hình lương.
- Quy tắc tính lương.
- Chu kỳ lương.
- Import/làm sạch chấm công.
- Kết quả bảng lương.
- Phiếu lương chi tiết.

## 7. Quy Ước Tên File

- Component: kebab-case, ví dụ `employees-table.tsx`.
- Service: kebab-case, ví dụ `payroll-calculation-service.ts`.
- Type: kebab-case, ví dụ `payroll-types.ts`.
- Database: snake_case cho table và column.
- API folder: danh từ số nhiều, ví dụ `employees`, `departments`, `cycles`.

## 8. Thứ Tự Triển Khai Khuyến Nghị

1. Tạo schema database.
2. Tạo `lib/db.ts`, response helper, session helper.
3. Làm auth cơ bản: login/logout/session.
4. Làm module picker sau đăng nhập.
5. Làm quản lý phòng ban/user/quyền.
6. Làm quản lý nhân viên và cấu hình lương.
7. Làm import và clean chấm công.
8. Làm chu kỳ lương và tính lương snapshot.
9. Làm bảng lương và phiếu lương.
