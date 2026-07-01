# Hướng Dẫn Tính Lương

Tài liệu này mô tả logic nghiệp vụ tính lương dựa trên 3 file mẫu đang có trong `docs/`:

- `docs/chacong.csv`: dữ liệu chấm công thô theo từng nhân viên và từng ngày.
- `docs/bangluong.csv`: bảng lương tổng hợp theo nhân viên.
- `docs/phieuluong.csv`: phiếu lương chi tiết của một nhân viên.

## 1. Luồng Xử Lý Chuẩn

1. Tạo chu kỳ lương, ví dụ `2026-05`, với ngày bắt đầu, ngày kết thúc, số ngày công chuẩn và số giờ chuẩn mỗi ngày.
2. Import file chấm công thô từ Excel/CSV.
3. Lưu nguyên dòng gốc vào bảng raw để truy vết.
4. Làm sạch dữ liệu chấm công thành bảng chuẩn:
   - Chuẩn hóa mã nhân viên, tên nhân viên, ngày, giờ vào/ra.
   - Đổi số thập phân kiểu Việt Nam, ví dụ `23,5`, thành numeric `23.5`.
   - Tách các cột công thường, giờ công, công cộng thêm, giờ cộng thêm, đi trễ, về sớm, tăng ca.
   - Map nhân viên theo `employee_code`; nếu chưa có thì báo lỗi hoặc tạo nháp tùy quy trình triển khai.
5. Kiểm tra cấu hình lương hiệu lực của từng nhân viên trong chu kỳ.
6. Tính lương và lưu snapshot kết quả vào `payroll_items`.
7. Khóa chu kỳ sau khi chốt để không tự động thay đổi kết quả cũ khi cấu hình lương hoặc quy tắc thay đổi.
8. Xuất bảng lương tổng hợp và phiếu lương từ dữ liệu snapshot.

## 2. Dữ Liệu Chấm Công Thô

Các cột chính trong `chacong.csv`:

- `Mã N.Viên`, `Tên nhân viên`, `Phòng ban`, `Chức vụ`
- `Ngày`, `Thứ`
- `Vào 1`, `Ra 1`, `Vào 2`, `Ra 2`, `Vào 3`, `Ra 3`
- `Công`, `Giờ`, `Công+`, `Giờ+`
- `Vào Trễ`, `Ra sớm`
- `TC1`, `TC2`, `TC3`
- `Tên ca`, `Kí hiệu`, `Kí hiệu+`, `Tổng giờ`

Quy ước xử lý:

- `Công` là số công chính trong ngày.
- `Giờ` là số giờ công chính.
- `Công+` và `Giờ+` là phần công/giờ cộng thêm.
- `TC1` là tăng ca ngày thường.
- `TC2` là tăng ca Chủ Nhật.
- `TC3` là tăng ca ngày lễ.
- `Kí hiệu` và `Kí hiệu+` dùng để nhận diện phép, lễ, nghỉ, hoặc trạng thái đặc biệt nếu file nguồn có khai báo.
- Dữ liệu gốc phải được giữ nguyên để có thể đối chiếu lại khi có tranh chấp.

## 3. Cấu Hình Lương Nhân Viên

Mỗi nhân viên cần có cấu hình lương theo thời gian hiệu lực:

- Tổng lương
- Lương đóng bảo hiểm
- Lương cơ bản
- Phụ cấp chức danh
- Phụ cấp trách nhiệm
- Phụ cấp thâm niên
- Phụ cấp an toàn/VSSV
- Phụ cấp điện thoại
- Phụ cấp công tác/xăng xe
- Phụ cấp nhà ở
- Chuyên cần
- Thưởng/hỗ trợ khác
- Phụ cấp cơm, con nhỏ dưới 6 tuổi, hành kinh nếu áp dụng

Khi tính lương cho một chu kỳ, hệ thống lấy bản cấu hình có `effective_from <= period_end` và `effective_to IS NULL OR effective_to >= period_start`.

## 4. Quy Tắc Tính Chính

Các công thức dưới đây là baseline theo file mẫu. Khi triển khai thực tế có thể bổ sung quy định nội bộ chi tiết hơn.

### 4.1 Lương Ngày Và Lương Giờ

```txt
luong_ngay = tong_luong / so_ngay_cong_chuan
luong_gio = luong_ngay / so_gio_chuan_moi_ngay
```

`so_ngay_cong_chuan` lấy từ chu kỳ lương. `so_gio_chuan_moi_ngay` mặc định là 8 giờ.

### 4.2 Lương Ngày Công

```txt
ngay_duoc_tinh_luong = cong_thuc_te + ngay_phep_co_luong + ngay_le
luong_ngay_cong = luong_ngay * ngay_duoc_tinh_luong
```

Trong phiếu mẫu có dòng `Công thực ngày`, `Lễ, PN`, và `Lương ngày công (Gồm C/Cần)`. Vì vậy phần lương ngày công cần lưu riêng số lượng ngày và số tiền.

### 4.3 Tăng Ca

Theo `bangluong.csv` và `phieuluong.csv`, các hệ số chính:

```txt
tien_tang_ca_thuong = so_gio_ot_thuong * luong_gio * 150%
tien_tang_ca_chu_nhat = so_gio_ot_chu_nhat * luong_gio * 200%
tien_tang_ca_le = so_gio_ot_le * luong_gio * 300%
```

Trong schema, các hệ số này nằm trong `payroll_rules` để có thể chỉnh sau:

- `overtime_normal_rate = 1.5`
- `overtime_sunday_rate = 2`
- `overtime_holiday_rate = 3`

### 4.4 Phụ Cấp Và Thưởng

Tổng phụ cấp/thưởng lấy từ cấu hình nhân viên và dữ liệu phát sinh trong chu kỳ:

```txt
tong_phu_cap =
  phu_cap_chuc_danh
  + phu_cap_trach_nhiem
  + phu_cap_tham_nien
  + phu_cap_an_toan
  + phu_cap_dien_thoai
  + phu_cap_di_lai
  + phu_cap_nha_o
  + chuyen_can
  + thuong_ho_tro_khac
  + phu_cap_khac
```

Các khoản có điều kiện như con nhỏ dưới 6 tuổi, hành kinh, cơm ca nên được lưu thành dòng chi tiết trong `payroll_item_lines`.

### 4.5 Tổng Thu Nhập

```txt
tong_thu_nhap =
  luong_ngay_cong
  + tien_phep_le
  + tien_tang_ca_thuong
  + tien_tang_ca_chu_nhat
  + tien_tang_ca_le
  + tong_phu_cap
```

`phieuluong.csv` có dòng `TỔNG THU NHẬP`, nên kết quả này phải được lưu snapshot.

### 4.6 Bảo Hiểm Và Công Đoàn

Theo mẫu:

- Công ty trích đóng:
  - BHXH 17.5%
  - BHYT 3%
  - BHTN 1%
  - Công đoàn 2%
- Người lao động khấu trừ:
  - BHXH/BHYT/BHTN 10.5%
  - Đoàn phí 1%

Baseline:

```txt
bao_hiem_cong_ty =
  luong_dong_bh * (17.5% + 3% + 1% + 2%)

bao_hiem_nhan_vien =
  luong_dong_bh * 10.5%

doan_phi_nhan_vien =
  luong_dong_bh * 1%
```

Nếu doanh nghiệp có mức trần, mức sàn, hoặc quy định làm tròn riêng thì bổ sung vào `payroll_rules`.

### 4.7 Khấu Trừ Và Lương Còn Lại

Các khoản khấu trừ thường gặp trong mẫu:

- BHXH/BHYT/BHTN người lao động
- Đoàn phí
- Thuế TNCN
- Lương ứng đợt 1
- Lương ứng đợt 2
- Nghỉ không phép hoặc khoản phạt nếu có quy định

```txt
tong_khau_tru =
  bao_hiem_nhan_vien
  + doan_phi_nhan_vien
  + thue_tncn
  + luong_ung_dot_1
  + luong_ung_dot_2
  + khau_tru_khac

luong_thuc_nhan = tong_thu_nhap - tong_khau_tru
```

`phieuluong.csv` có các dòng `Lương chi lần 1`, `Lương chi lần 2`, `TỔNG PHẦN KHẤU TRỪ`, `LƯƠNG CÒN LẠI`; các giá trị này cần có trong snapshot để xuất lại đúng kỳ.

## 5. Trạng Thái Chu Kỳ Lương

Chu kỳ lương nên đi qua các trạng thái:

- `draft`: mới tạo, chưa import.
- `imported`: đã import file chấm công.
- `cleaned`: đã làm sạch và chuẩn hóa dữ liệu.
- `calculated`: đã tính lương.
- `locked`: đã chốt, không cho sửa dữ liệu nguồn nếu chưa mở khóa.
- `paid`: đã chi trả.
- `cancelled`: hủy chu kỳ.

Các thao tác tính lại, khóa, mở khóa, hoặc hủy cần ghi vào `payroll_audit_logs`.

## 6. Nguyên Tắc Lưu Snapshot

Kết quả tính lương không nên phụ thuộc động vào cấu hình hiện tại sau khi đã chốt. Khi tính lương cần lưu:

- Snapshot cấu hình lương nhân viên.
- Snapshot quy tắc tính lương.
- Tổng công, phép, lễ, nghỉ không lương.
- Số giờ OT theo loại.
- Từng dòng lương/phụ cấp/khấu trừ.
- Tổng thu nhập, tổng khấu trừ, lương còn lại.

Nhờ vậy khi đổi lương hoặc đổi quy tắc ở tháng sau, bảng lương tháng cũ vẫn không bị lệch.

## 7. Những Điểm Cần Xác Nhận Thêm

Các file mẫu đã thể hiện cấu trúc chính, nhưng khi triển khai tính tiền chính xác cần xác nhận thêm:

- Số ngày công chuẩn mỗi tháng lấy cố định hay theo lịch làm việc thực tế.
- Cách tính chuyên cần khi đi trễ/về sớm/nghỉ.
- Quy định làm tròn từng khoản và làm tròn tổng cuối.
- Cách tính thuế TNCN và giảm trừ gia cảnh.
- Khoản nào tính vào lương đóng bảo hiểm, khoản nào không.
- Cách xử lý nhân viên vào/ra công ty giữa kỳ.
- Cách nhận diện ngày lễ, Chủ Nhật, phép năm từ ký hiệu trong file chấm công.
