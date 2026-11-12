# Remote HR - Freetrip

Hệ thống quản lý nhân sự seeding làm việc theo ca: đăng ký ca, nộp link báo cáo, kiểm duyệt QC và nghiệm thu.

## Language

### Nộp báo cáo theo ca

**Vào ca**:
Thao tác điểm danh của nhân sự để bắt đầu một ca đã đăng ký; chỉ sau khi Vào ca mới được nộp link cho ca đó.
_Avoid_: Check-in, đăng nhập ca

**Vào muộn quá hạn**:
Trạng thái của ca mà nhân sự không Vào ca trong ngưỡng phút cho phép tính từ giờ bắt đầu ca; ca bị khóa nộp link.
_Avoid_: Đi muộn, trễ ca

**Cửa sổ sửa sau ca**:
Khoảng 1 giờ ngay sau khi một ca đã đạt Ngưỡng tham gia ca kết thúc, trong đó nhân sự được thêm hoặc thay link báo cáo của ca đó.
_Avoid_: Grace period, thời gian ân hạn

**Ngưỡng tham gia ca**:
Mức link tối thiểu (≥70% KPI của từng loại link) mà nhân sự phải nộp trong giờ ca, tính tại thời điểm ca kết thúc.
_Avoid_: Điều kiện nộp bù, KPI tối thiểu

**Nộp bù tuần**:
Giai đoạn từ sau Cửa sổ sửa sau ca đến hết Chủ nhật của tuần đó, trong đó nhân sự được nộp bù link cho các ca đã đạt Ngưỡng tham gia ca.
_Avoid_: Mở khóa tuần, reopen tuần

**Mở bù đặc cách**:
Quyền nộp bù do Quản lý hoặc QC mở thủ công cho một ca cụ thể, dành cho trường hợp ngoại lệ nằm ngoài các quy tắc tự động.
_Avoid_: Reopen ca, mở khóa ca
