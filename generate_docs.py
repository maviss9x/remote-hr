import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import os

def create_document():
    doc = docx.Document()

    # Cấu hình Margins trang (2cm mỗi cạnh)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        section.page_width = Inches(8.27)  # A4
        section.page_height = Inches(11.69)
        
        # Header / Footer
        footer = section.footer
        f_p = footer.paragraphs[0]
        f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        f_run = f_p.add_run("Hệ Thống WebHybrid - Hướng Dẫn Sử Dụng & Quy Chế Nhân Sự | Trang ")
        f_run.font.name = "Calibri"
        f_run.font.size = Pt(9)
        f_run.font.color.rgb = RGBColor(140, 140, 140)
        
        # Thêm page number XML vào footer
        fldSimple = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
        f_p._p.append(fldSimple)

    # Bảng màu chuẩn thương hiệu
    COLOR_PRIMARY = RGBColor(30, 58, 138)      # Deep Blue (#1E3A8A)
    COLOR_SECONDARY = RGBColor(234, 88, 12)    # Accent Orange (#EA580C)
    COLOR_TEXT = RGBColor(30, 41, 59)          # Dark Slate (#1E293B)
    COLOR_MUTED = RGBColor(100, 116, 139)      # Gray (#64748B)
    COLOR_SUCCESS = RGBColor(22, 101, 52)      # Green (#166534)
    COLOR_WARNING = RGBColor(180, 83, 9)       # Amber (#B45309)
    COLOR_DANGER = RGBColor(185, 28, 28)       # Red (#B91C1C)

    HEX_PRIMARY = "1E3A8A"
    HEX_SECONDARY = "EA580C"
    HEX_LIGHT_BG = "F8FAFC"
    HEX_BORDER = "CBD5E1"
    HEX_CALLOUT_BLUE = "EFF6FF"
    HEX_CALLOUT_BORDER_BLUE = "3B82F6"
    HEX_CALLOUT_AMBER = "FFFBEB"
    HEX_CALLOUT_BORDER_AMBER = "F59E0B"
    HEX_CALLOUT_GREEN = "F0FDF4"
    HEX_CALLOUT_BORDER_GREEN = "22C55E"

    # Style Tiêu đề tài liệu
    def add_title(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(24)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_subtitle(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(18)
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.italic = True
        run.font.color.rgb = COLOR_MUTED
        return p

    def add_meta_info():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(20)
        
        r1 = p.add_run("Phiên bản: ")
        r1.font.bold = True
        r1.font.size = Pt(10)
        r2 = p.add_run("2.5 (Áp dụng chính sách 2026)  |  ")
        r2.font.size = Pt(10)
        
        r3 = p.add_run("Phạm vi: ")
        r3.font.bold = True
        r3.font.size = Pt(10)
        r4 = p.add_run("Nhân sự Seeding, Quản lý Ca (Manager), QC & HR Admin")
        r4.font.size = Pt(10)

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(16)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = COLOR_SECONDARY
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11.5)
        run.font.bold = True
        run.font.color.rgb = COLOR_TEXT
        return p

    def add_body(text, bold_prefix=None, space_after=6):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.name = "Calibri"
            r_bold.font.size = Pt(11)
            r_bold.font.bold = True
            r_bold.font.color.rgb = COLOR_TEXT
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.color.rgb = COLOR_TEXT
        return p

    def add_bullet(text, bold_prefix=None, level=0):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.left_indent = Inches(0.25 * (level + 1))
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.name = "Calibri"
            r_bold.font.size = Pt(11)
            r_bold.font.bold = True
            r_bold.font.color.rgb = COLOR_TEXT
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.color.rgb = COLOR_TEXT
        return p

    def add_callout(title, text, type_style="blue"):
        table = doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = table.cell(0, 0)
        cell.width = Inches(6.5)

        bg_color = HEX_CALLOUT_BLUE
        border_color = HEX_CALLOUT_BORDER_BLUE
        icon = "ℹ️ "
        title_color = COLOR_PRIMARY

        if type_style == "amber":
            bg_color = HEX_CALLOUT_AMBER
            border_color = HEX_CALLOUT_BORDER_AMBER
            icon = "⚠️ "
            title_color = COLOR_WARNING
        elif type_style == "green":
            bg_color = HEX_CALLOUT_GREEN
            border_color = HEX_CALLOUT_BORDER_GREEN
            icon = "✅ "
            title_color = COLOR_SUCCESS

        # Shading
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg_color}"/>')
        cell._tc.get_or_add_tcPr().append(shading)

        # Left border only (Callout effect)
        borders = parse_xml(f'''
            <w:tcBorders {nsdecls("w")}>
                <w:top w:val="none"/>
                <w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>
                <w:bottom w:val="none"/>
                <w:right w:val="none"/>
            </w:tcBorders>
        ''')
        cell._tc.get_or_add_tcPr().append(borders)

        # Content
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.left_indent = Inches(0.15)
        p.paragraph_format.right_indent = Inches(0.15)
        
        r_title = p.add_run(f"{icon}{title}\n")
        r_title.font.name = "Calibri"
        r_title.font.size = Pt(11)
        r_title.font.bold = True
        r_title.font.color.rgb = title_color

        r_text = p.add_run(text)
        r_text.font.name = "Calibri"
        r_text.font.size = Pt(10.5)
        r_text.font.color.rgb = COLOR_TEXT

        p_end = cell.add_paragraph()
        p_end.paragraph_format.space_before = Pt(0)
        p_end.paragraph_format.space_after = Pt(4)

        # Spacer after table
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(4)

    def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'''
            <w:tcMar {nsdecls("w")}>
                <w:top w:w="{top}" w:type="dxa"/>
                <w:bottom w:w="{bottom}" w:type="dxa"/>
                <w:left w:w="{left}" w:type="dxa"/>
                <w:right w:w="{right}" w:type="dxa"/>
            </w:tcMar>
        ''')
        tcPr.append(tcMar)

    def style_table(table, col_widths, headers, data):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        # Set Table Borders
        tblPr = table._tbl.tblPr
        tblBorders = parse_xml(f'''
            <w:tblBorders {nsdecls("w")}>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>
                <w:left w:val="none"/>
                <w:bottom w:val="single" w:sz="8" w:space="0" w:color="{HEX_PRIMARY}"/>
                <w:right w:val="none"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>
                <w:insideV w:val="none"/>
            </w:tblBorders>
        ''')
        tblPr.append(tblBorders)

        # Header Row
        hdr_cells = table.rows[0].cells
        for i, h_text in enumerate(headers):
            hdr_cells[i].width = Inches(col_widths[i])
            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{HEX_PRIMARY}"/>')
            hdr_cells[i]._tc.get_or_add_tcPr().append(shd)
            set_cell_margins(hdr_cells[i], top=120, bottom=120, left=140, right=140)
            
            p = hdr_cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.space_before = Pt(0)
            run = p.add_run(h_text)
            run.font.name = "Calibri"
            run.font.bold = True
            run.font.size = Pt(10.5)
            run.font.color.rgb = RGBColor(255, 255, 255)

        # Data Rows
        for r_idx, row_data in enumerate(data):
            row_cells = table.add_row().cells
            bg_fill = HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF"
            for c_idx, cell_value in enumerate(row_data):
                row_cells[c_idx].width = Inches(col_widths[c_idx])
                if bg_fill != "FFFFFF":
                    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg_fill}"/>')
                    row_cells[c_idx]._tc.get_or_add_tcPr().append(shd)
                set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=140, right=140)
                
                p = row_cells[c_idx].paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.line_spacing = 1.15
                run = p.add_run(cell_value)
                run.font.name = "Calibri"
                run.font.size = Pt(10)
                run.font.color.rgb = COLOR_TEXT

        # Thêm khoảng cách sau bảng
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(6)

    # ==========================================
    # NỘI DUNG TÀI LIỆU
    # ==========================================

    add_title("HƯỚNG DẪN SỬ DỤNG & QUY CHẾ NHÂN SỰ")
    add_subtitle("Hệ Thống Quản Trị Vận Hành Remote & Seeding Tự Động WebHybrid")
    add_meta_info()

    # MỤC LỤC TỔNG QUAN
    add_callout(
        "MỤC ĐÍCH TÀI LIỆU & ĐỐI TƯỢNG ÁP DỤNG",
        "Tài liệu này chuẩn hóa toàn bộ quy trình làm việc và các quy tắc (Rule) ràng buộc hệ thống cho 2 phân hệ cốt lõi: "
        "PHẦN I - QUẢN LÝ & ĐĂNG KÝ CA LÀM VIỆC và PHẦN II - BÁO CÁO SEEDING, PHÂN LOẠI & THƯỞNG VIRAL.\n"
        "Áp dụng bắt buộc đối với: Toàn thể Nhân sự Seeding Remote, Quản lý ca (Manager), Bộ phận Kiểm duyệt (QC) và Quản trị viên Nhân sự (HR Admin).",
        "blue"
    )

    # =========================================================================
    # PHẦN I: CA LÀM VIỆC (SHIFT MANAGEMENT)
    # =========================================================================
    add_h1("PHẦN I: QUY CHẾ VÀ HƯỚNG DẪN CA LÀM VIỆC")
    add_body(
        "Phân hệ Ca làm việc giúp quản lý việc phân bổ nhân sự làm việc từ xa (Remote) theo từng tuần, "
        "đảm bảo tính công bằng, minh bạch về khối lượng công việc và phục vụ tính công tự động vào bảng nghiệm thu lương."
    )

    # 1. Khung giờ ca chuẩn & Tiền lương
    add_h2("1. Khung Giờ Ca Chuẩn & Định Mức Thù Lao")
    add_body("Hệ thống thiết lập 3 ca làm việc chuẩn cố định mỗi ngày (áp dụng từ Thứ 2 đến Chủ Nhật):")

    shift_table_headers = ["Ca Làm Việc", "Khung Giờ Mặc Định", "Thời Lượng", "Đơn Giá / Giờ", "Thu Nhập / Ca"]
    shift_table_widths = [1.2, 1.6, 1.0, 1.3, 1.4]
    shift_table_data = [
        ["Ca Sáng (MORNING)", "08:30 – 12:00", "3.5 giờ", "25.000 đ/h", "87.500 đ / ca"],
        ["Ca Chiều (AFTERNOON)", "13:30 – 18:00", "4.5 giờ", "25.000 đ/h", "112.500 đ / ca"],
        ["Ca Tối (EVENING)", "19:30 – 23:00", "3.5 giờ", "33.000 đ/h", "115.500 đ / ca"],
    ]
    t1 = doc.add_table(rows=1, cols=len(shift_table_headers))
    style_table(t1, shift_table_widths, shift_table_headers, shift_table_data)

    add_callout(
        "LƯU Ý VỀ KHUNG GIỜ VÀ MỨC LƯƠNG CA",
        "• Ca Tối được hỗ trợ phụ cấp làm ngoài giờ đặc thù nên mức thù lao theo giờ là 33.000 đ/h (cao hơn 32% so với ca ngày).\n"
        "• Quản trị viên cấp cao (SUPER_ADMIN) có toàn quyền điều chỉnh khung giờ bắt đầu/kết thúc và đơn giá của từng ca trong mục 'Admin > Cài đặt Ca'. Khi cập nhật, đơn giá mới sẽ áp dụng cho các ca tạo mới sau đó.",
        "amber"
    )

    # 2. Quy chế Đăng ký ca tuần & Tự động duyệt
    add_h2("2. Quy Chế Mở & Chốt Đăng Ký Ca Tuần")
    add_body(
        "Để đảm bảo kế hoạch hoạt động xuyên suốt, toàn bộ nhân sự đăng ký lịch làm việc theo chu kỳ tuần thông qua quy chế sau:"
    )

    add_bullet("Thời gian mở form đăng ký tuần mới: ", bold_prefix="• Mở cổng đăng ký: ")
    add_body("Mặc định lúc 00:00 Thứ Sáu hàng tuần (nhân viên bắt đầu được chọn ca cho tuần kế tiếp).", space_after=2)
    
    add_bullet("Thời gian chốt đăng ký tuần: ", bold_prefix="• Khóa form đăng ký: ")
    add_body("Mặc định lúc 23:59 Chủ Nhật hàng tuần. Sau thời điểm này, form sẽ tự động khóa và nhân viên không thể tự đăng ký thêm hoặc tự ý hủy ca.", space_after=2)

    add_bullet("Cơ chế Tự động duyệt ca (Auto-Approval Engine): ", bold_prefix="• Tự động duyệt ca: ")
    add_body(
        "Trong suốt thời gian mở cổng (Thứ 6 - Chủ Nhật), các ca đăng ký ở trạng thái 'Chờ duyệt' (PENDING). "
        "Ngay khi chạm mốc giờ khóa form (23:59 Chủ Nhật), hệ thống tự động quét và duyệt đồng loạt toàn bộ các ca sang trạng thái 'Đã duyệt' (APPROVED) "
        "mà không cần Cấp quản lý phải thao tác thủ công từng nhân viên.", space_after=4
    )

    add_callout(
        "CƠ CHẾ ĐỒNG BỘ KHI ADMIN THAY ĐỔI RULE GIỜ KHÓA",
        "Nếu Quản trị viên thay đổi ngày/giờ khóa form trong Admin (ví dụ đổi hạn chốt sang 18:00 Chủ Nhật), "
        "hệ thống sẽ tự động kích hoạt tiến trình quét và duyệt ngay lập tức cho các ca của tuần hiện hành đã qua mốc giờ mới.",
        "green"
    )

    # 3. Các quy định khống chế ca (Limit Rules)
    add_h2("3. Các Quy Định Giới Hạn & Ràng Buộc Ca (Rule Nhân Sự)")
    add_body("Hệ thống tích hợp các thuật toán kiểm tra tính hợp lệ tự động (Validation Guardrails):")

    add_h3("a) Giới hạn số người tối đa trên một ca (maxUsersPerShift)")
    add_bullet("Định mức mặc định: Tối đa 10 người / ca làm việc.")
    add_bullet("Cơ chế khóa tự động: Khi một ca đã đủ 10 nhân sự đăng ký, hệ thống lập tức hiển thị nhãn 'Ca đã đủ người' và vô hiệu hóa nút bấm đăng ký đối với các nhân sự khác.")
    add_bullet("Mục đích: Đảm bảo số lượng nhân sự chia đều giữa các ca, tránh tình trạng dồn quá đông người vào một khung giờ gây quá tải kiểm duyệt.")

    add_h3("b) Giới hạn số ca đăng ký trong một ngày (maxShiftsPerDay)")
    add_bullet("Chính sách chuẩn từ Tháng 09/2026: Tối đa 1 ca / ngày. Mỗi nhân viên chỉ được đăng ký làm việc 1 trong 3 ca (Sáng, Chiều, hoặc Tối) trong một ngày.")
    add_bullet("Chặn trùng lặp: Nếu nhân viên đã có 1 ca trong ngày, hệ thống sẽ ẩn/chặn lựa chọn các ca còn lại của ngày hôm đó.")
    add_bullet("Dữ liệu lịch sử: Đối với dữ liệu Tháng 08/2026 trở về trước, hệ thống tự động cho phép đa ca/ngày theo đúng số liệu thực tế lịch sử đã lưu.")

    add_h3("c) Quy định báo nghỉ và hủy ca làm việc (allowCancelHoursBefore)")
    add_bullet("Thời hạn tối thiểu báo hủy ca: Tối thiểu 4 giờ trước thời điểm bắt đầu ca làm việc.")
    add_bullet("Quy tắc xử lý: Ví dụ ca Sáng bắt đầu lúc 08:30, nhân viên bắt buộc phải thực hiện thao tác 'Hủy ca' trên hệ thống trước 04:30 sáng cùng ngày.")
    add_bullet("Chặn hủy sát giờ: Nếu còn dưới 4 tiếng, nút 'Hủy ca' sẽ bị khóa. Nhân viên bắt buộc phải liên hệ trực tiếp Quản lý ca để xin vắng ca có lý do chính đáng.")
    add_bullet("Giới hạn số ca vắng tối đa: Mỗi nhân sự không được vắng quá 3 ca trong một tháng (maxAbsentsPerMonth = 3). Vượt quá mốc này hệ thống sẽ cảnh báo vi phạm kỷ luật KPI.")

    # 4. Hướng dẫn thao tác Ca làm việc
    add_h2("4. Hướng Dẫn Thao Tác Chi Tiết Cho Nhân Viên & Quản Lý")

    add_h3("Dành cho Nhân sự Seeding:")
    add_bullet("Bước 1: Truy cập mục 'Ca Làm Việc' trên thanh điều hướng bên trái.")
    add_bullet("Bước 2: Sử dụng bộ điều hướng tuần để chọn tuần làm việc cần đăng ký (chỉ mở đăng ký tuần tiếp theo từ Thứ 6 đến Chủ Nhật).")
    add_bullet("Bước 3: Nhấp vào nút '+' hoặc 'Đăng ký ca' tại các ô ca Sáng, Chiều, hoặc Tối mong muốn (lưu ý: mỗi ngày chỉ được chọn tối đa 1 ca).")
    add_bullet("Bước 4: Kiểm tra trạng thái ca: 'Chờ duyệt' (trong tuần mở đăng ký) hoặc 'Đã duyệt' (sau khi đóng cổng).")
    add_bullet("Bước 5: Trường hợp bận việc đột xuất: Nhấp vào ca đã đăng ký > Chọn 'Hủy ca' (phải thao tác trước giờ ca chạy tối thiểu 4 tiếng).")

    add_h3("Dành cho Quản lý (Manager / HR Admin):")
    add_bullet("Xem phân bổ tổng thể: Xem lưới lịch tuần của toàn bộ nhân viên, xem tổng số người của từng ca để điều phối cân bằng.")
    add_bullet("Duyệt / Từ chối ca khẩn cấp: Quản lý có quyền duyệt ca thủ công hoặc xóa ca vi phạm của nhân viên.")
    add_bullet("Mở quyền nộp bù (Reopen Shift): Khi nhân viên gặp sự cố mạng hoặc quên nộp báo cáo đúng giờ:")
    add_body(
        "Quản lý nhấp vào ca làm việc của nhân viên đó > Chọn 'Mở nộp bù' (Reopen) > Thiết lập thời hạn hết hạn (reopenedUntil - ví dụ: gia hạn thêm 2 tiếng hoặc 24 tiếng). "
        "Nhân viên sẽ được mở lại quyền submit bài trong khoảng thời gian gia hạn này.",
        space_after=8
    )

    # =========================================================================
    # PHẦN II: BÁO CÁO SEEDING (SEEDING REPORTS & QC)
    # =========================================================================
    add_h1("PHẦN II: QUY CHẾ VÀ HƯỚNG DẪN BÁO CÁO SEEDING")
    add_body(
        "Báo cáo Seeding là căn cứ pháp lý và dữ liệu trực tiếp để nghiệm thu chất lượng công việc, "
        "kiểm tra sản lượng KPI và chi trả lương/thưởng cho nhân viên. Mọi báo cáo đều gắn liền chặt chẽ với một Ca làm việc cụ thể."
    )

    # Chèn ảnh hướng dẫn trực quan nếu tồn tại
    img_guide_path = r"d:\Quang\Cong Viec Dev\WebHybrid\HUONG_DAN_BAO_CAO_SEEDING_RULE.png"
    if os.path.exists(img_guide_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run_img = p_img.add_run()
        run_img.add_picture(img_guide_path, width=Inches(6.4))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(12)
        r_cap = p_cap.add_run("Hình 1: Sơ đồ trực quan giao diện Báo cáo Seeding và 4 nhóm Rule nhân sự cốt lõi")
        r_cap.font.name = "Calibri"
        r_cap.font.size = Pt(9.5)
        r_cap.font.italic = True
        r_cap.font.color.rgb = COLOR_MUTED

    # 1. Thời gian nộp báo cáo theo ca
    add_h2("1. Quy Định Thời Gian Nộp Báo Cáo Theo Ca")
    add_body("Hệ thống kiểm soát nghiêm ngặt thời điểm nhân viên được nộp link theo logic ca:")

    add_bullet("Nghiêm cấm nộp trước giờ ca bắt đầu: ", bold_prefix="• Trước giờ ca (now < shiftStart): ")
    add_body("Hệ thống chặn tuyệt đối việc nộp link trước khi ca làm việc bắt đầu. Ví dụ: Ca Chiều bắt đầu lúc 13:30, nhân viên không thể nộp link lúc 13:25 (kể cả có được mở nộp bù tuần).", space_after=2)

    add_bullet("Nộp báo cáo trong khung giờ ca: ", bold_prefix="• Trong giờ ca (shiftStart <= now <= shiftEnd): ")
    add_body("Nhân viên tiến hành seeding và nộp link trực tiếp trên hệ thống. Có thể nộp nhiều lần và chỉnh sửa link trong suốt thời gian diễn ra ca.", space_after=2)

    add_bullet("Tự động khóa form khi ca kết thúc: ", bold_prefix="• Sau giờ ca (now > shiftEnd): ")
    add_body("Ngay khi ca làm việc kết thúc (ví dụ Ca Sáng kết thúc lúc 12:00:01), form nộp bài sẽ tự động khóa. Nhân viên KHÔNG THỂ nộp thêm link mới nếu không được Cấp quản lý cấp quyền mở nộp bù.", space_after=2)

    add_bullet("Cơ chế nộp bù có thời hạn: ", bold_prefix="• Ca được mở nộp bù (Reopened): ")
    add_body("Chỉ khi ca được Cấp quản lý kích hoạt 'Mở nộp bù', nhân viên mới được bổ sung dữ liệu. Nếu Quản lý đặt thời hạn hết hạn (reopenedUntil), sau thời điểm hết hạn hệ thống sẽ tiếp tục khóa vĩnh viễn.", space_after=4)

    # 2. Cấu trúc các loại link báo cáo
    add_h2("2. Cấu Trúc Các Loại Link Báo Cáo Seeding")
    add_body("Mỗi ca làm việc, nhân viên nộp báo cáo bao gồm các mục dữ liệu sau:")

    report_table_headers = ["Hạng Mục Báo Cáo", "Định Dạng / Nguồn Link", "Quy Chuẩn Kiểm Duyệt", "Tác Động KPI"]
    report_table_widths = [1.5, 1.6, 1.8, 1.6]
    report_table_data = [
        ["Link Bài Viết Facebook", "URL bài đăng trên Facebook (Fanpage/Group/Profile)", "Bài viết công khai, đúng chủ đề, đúng hashtag/tag quy định", "Tính vào sản lượng bài viết chính"],
        ["Link Bài Viết Bổ Sung", "URL bài đăng hỗ trợ trên Facebook", "Được phân công thêm hoặc bù bài", "Cộng dồn vào tổng link bài hợp lệ"],
        ["Link Bài Viết Threads", "URL bài đăng trên mạng xã hội Threads", "Tài khoản chính chủ, nội dung tự nhiên, không spam", "Tính vào chỉ tiêu nền tảng Threads"],
        ["Link Bằng Chứng Comment", "Link thư mục Google Drive chứa ảnh chụp", "Quyền xem công khai (Public View), ảnh rõ nét từng comment", "Bắt buộc có để nghiệm thu comment"],
        ["Link Nội Dung Nữ", "URL bài viết nhóm Nữ (nếu có)", "Dành riêng cho nhân sự được phân công mảng nội dung nữ", "Đánh giá theo chỉ tiêu chuyên đề riêng"],
    ]
    t2 = doc.add_table(rows=1, cols=len(report_table_headers))
    style_table(t2, report_table_widths, report_table_headers, report_table_data)

    # 3. Quy chế Gắn Loại bài viết & Đề xuất Viral
    add_h2("3. Quy Chế Gắn Loại Bài Viết & Đề Xuất Bài Viết Viral Sau Ca")
    add_body(
        "Nhằm tạo điều kiện tốt nhất cho nhân sự theo dõi tương tác nội dung mà không gây khó khăn về thủ tục hành chính, "
        "hệ thống áp dụng 2 cơ chế gia hạn đặc biệt (Grace Period):"
    )

    add_h3("a) Thời hạn Gắn / Sửa Loại Bài Viết (tagPostGraceDays = 7 ngày)")
    add_bullet("Khái niệm: Mỗi link bài viết sau khi nộp cần được gắn nhãn chủ đề (Ví dụ: Review du lịch, Tip chia sẻ, Minigame, Thảo luận, Hỏi đáp...).")
    add_bullet("Thời hạn cho phép: Trong vòng 7 ngày kể từ thời điểm submit link bài viết, nhân viên được quyền vào lại báo cáo để chọn hoặc thay đổi Loại bài viết.")
    add_bullet("Sau 7 ngày: Hệ thống tự động khóa cố định nhãn bài viết để chốt dữ liệu phân tích Content Marketing, nhân viên không thể thay đổi thêm.")

    add_h3("b) Thời hạn Đề xuất & Gắn cờ Bài Viết Viral (viralPostGraceDays = 30 ngày)")
    add_bullet("Khái niệm: Các bài viết seeding đạt hiệu ứng tương tác cao (like, share, comment) vượt ngưỡng sẽ được nhận Thưởng nóng (Viral Bonus).")
    add_bullet("Thời hạn chủ động: Trong vòng 30 ngày kể từ ngày nộp link, nhân viên được chủ động vào báo cáo cũ để gắn cờ 'Đề xuất Viral' kèm số liệu tương tác.")
    add_bullet("Đặc quyền không cần mở ca: Nhân viên ĐƯỢC PHÉP gắn cờ viral mà KHÔNG CẦN xin Quản lý mở lại ca đã kết thúc, giúp tiết kiệm thời gian tối đa.")

    add_callout(
        "RULE AN TOÀN CHẶN GẮN VIRAL CHO LINK BỊ TỪ CHỐI",
        "• Link đã bị Bộ phận QC đánh dấu 'Không hợp lệ' (Invalid / REJECTED) thì hệ thống TUYỆT ĐỐI KHÔNG CHO PHÉP gắn cờ Viral.\n"
        "• Link đề xuất Viral bắt buộc phải nằm trong danh sách các link đã được nộp trong ca đó, không thể chèn link lạ từ bên ngoài vào.",
        "amber"
    )

    # 4. Quy trình QC Kiểm duyệt và Bảng mức thưởng Viral
    add_h2("4. Quy Trình Kiểm Duyệt (QC Review) & Bảng Thưởng Viral")

    add_h3("Quy trình làm việc của Bộ phận QC:")
    add_bullet("Bước 1: QC truy cập phân hệ 'Kiểm Duyệt' (QC Review), chọn ca làm việc hoặc danh sách báo cáo cần thẩm định.")
    add_bullet("Bước 2: QC kiểm tra tính truy cập của từng đường link:")
    add_bullet("Nếu link tốt, bài viết chuẩn: QC tích chọn 'Hợp lệ' (Valid).", level=1)
    add_bullet("Nếu link lỗi, sai nội dung, trùng lặp hoặc vi phạm chính sách: QC chọn 'Không hợp lệ' (Invalid) và bắt buộc chọn/nhập Lý do từ chối cụ thể.", level=1)
    add_bullet("Bước 3: Hoàn tất phiên duyệt: Báo cáo chuyển sang trạng thái ĐÃ DUYỆT (APPROVED). Các link hợp lệ sẽ ngay lập tức được ghi nhận vào chỉ tiêu của nhân viên.")

    add_h3("Bảng Mức Tiền Thưởng Bài Viết & Bình Luận Viral:")
    add_body("Tiền thưởng Viral được hệ thống tự động cộng dồn vào Bảng Nghiệm Thu Lương tháng tương ứng theo các mốc định mức:")

    viral_headers = ["Hạng Mức", "Mức Tương Tác Tối Thiểu", "Đối Tượng Áp Dụng", "Mức Tiền Thưởng"]
    viral_widths = [1.2, 2.3, 1.5, 1.5]
    viral_data = [
        ["Mốc 1 (Viral Đồng)", "Từ 500 – 999 Lượt tương tác (Like/Reactions)", "Bài viết Facebook / Threads", "50.000 VNĐ / bài"],
        ["Mốc 2 (Viral Bạc)", "Từ 1.000 – 2.999 Lượt tương tác", "Bài viết Facebook / Threads", "100.000 VNĐ / bài"],
        ["Mốc 3 (Viral Vàng)", "Từ 3.000 – 9.999 Lượt tương tác", "Bài viết Facebook / Threads", "200.000 VNĐ / bài"],
        ["Mốc 4 (Viral Kim Cương)", "Từ 10.000 Lượt tương tác trở lên", "Bài viết Facebook / Threads", "500.000 VNĐ / bài"],
        ["Top Comment Viral", "Top 1 bình luận đạt trên 200 lượt thích", "Comment seeding trong group lớn", "30.000 VNĐ / cmt"],
    ]
    t3 = doc.add_table(rows=1, cols=len(viral_headers))
    style_table(t3, viral_widths, viral_headers, viral_data)

    # 5. Hướng dẫn thao tác nộp báo cáo
    add_h2("5. Hướng Dẫn Thao Tác Nộp Báo Cáo Cho Nhân Viên")
    add_bullet("Bước 1: Vào mục 'Báo Cáo' hoặc nhấp vào ca làm việc đang diễn ra trên lịch ca.")
    add_bullet("Bước 2: Dán danh sách link bài viết Facebook, bài bổ sung, Threads (mỗi link nằm trên một dòng riêng biệt).")
    add_bullet("Bước 3: Dán link thư mục Google Drive chứa ảnh chụp minh chứng bình luận (chú ý mở quyền truy cập 'Bất kỳ ai có đường liên kết').")
    add_bullet("Bước 4: Nhấp vào nút 'Gắn thẻ loại bài' để chọn chủ đề cho từng bài viết (nếu chưa gắn kịp, vẫn có 7 ngày để bổ sung sau ca).")
    add_bullet("Bước 5: Nhấp nút 'LƯU & NỘP BÁO CÁO' trước khi ca kết thúc. Hệ thống hiển thị thông báo nộp thành công và thời gian nộp.")
    add_bullet("Bước 6: Theo dõi kết quả kiểm duyệt tại cột 'Trạng thái QC' và 'Lý do từ chối' (nếu có bài bị từ chối, chủ động báo quản lý để sửa đổi).")
    add_bullet("Bước 7: Sau ca (trong vòng 30 ngày), nếu bài viết nổ tương tác: Mở lại báo cáo > Nhấp 'Đề xuất Viral' tại link tương ứng để nhận thưởng nóng.")

    # =========================================================================
    # PHẦN III: TỔNG KẾT & CÂU HỎI THƯỜNG GẶP (FAQ)
    # =========================================================================
    add_h1("PHẦN III: TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ)")

    faq_items = [
        ("Tôi có thể đăng ký 2 ca trong cùng 1 ngày để tăng thu nhập không?",
         "Từ Tháng 09/2026, quy chế hệ thống giới hạn tối đa 1 ca / ngày nhằm đảm bảo sức khỏe và chất lượng bài viết của nhân viên. Bạn chỉ có thể chọn 1 ca duy nhất mỗi ngày."),
        ("Đã hết giờ ca nhưng tôi bị mất mạng chưa kịp bấm Nộp báo cáo thì phải làm sao?",
         "Bạn cần nhắn tin ngay cho Quản lý ca (Manager) trên nhóm vận hành, cung cấp lý do và thời gian gặp sự cố. Quản lý sẽ kích hoạt tính năng 'Mở nộp bù' (Reopen) cho ca của bạn với hạn chót nhất định để bạn hoàn tất submit."),
        ("Bài viết của tôi đăng tuần trước nhưng hôm nay mới đạt 2.000 like, tôi có được nhận thưởng không?",
         "HOÀN TOÀN ĐƯỢC. Bạn có thời hạn lên tới 30 ngày kể từ ngày nộp link để vào báo cáo cũ và gắn cờ Đề xuất Viral. Tiền thưởng sẽ tự động cộng vào bảng nghiệm thu lương của tháng hiện tại sau khi QC xác nhận."),
        ("Tại sao tôi không thể tự hủy ca làm việc khi chỉ còn 2 tiếng nữa là ca bắt đầu?",
         "Theo quy chế, hệ thống chỉ cho phép tự hủy ca trước tối thiểu 4 tiếng để Quản lý kịp điều động nhân sự dự phòng. Khi còn dưới 4 tiếng, bạn phải báo cáo trực tiếp Quản lý ca để được hỗ trợ hủy ngoại lệ."),
        ("Link báo cáo của tôi bị QC từ chối có được tính lương không?",
         "Chỉ các link được QC duyệt 'Hợp lệ' mới được tính vào sản lượng KPI. Lương thời gian của ca vẫn được ghi nhận nếu ca không bị đánh giá là vắng mặt hoặc gian lận.")
    ]

    for q, a in faq_items:
        add_body(q, bold_prefix="Hỏi: ", space_after=2)
        add_body(a, bold_prefix="Trả lời: ", space_after=8)

    # Footer note
    add_callout(
        "KÊNH HỖ TRỢ KỸ THUẬT & GIẢI ĐÁP QUY CHẾ",
        "• Kỹ thuật hệ thống: Liên hệ Quản trị viên IT / Hệ thống WebHybrid.\n"
        "• Quy chế ca & Chấm công: Liên hệ Phòng Nhân sự (HR Department).\n"
        "• Tiêu chuẩn bài viết & Duyệt nội dung: Liên hệ Trưởng nhóm Kiểm duyệt (QC Lead).",
        "green"
    )

    output_path = r"d:\Quang\Cong Viec Dev\WebHybrid\HUONG_DAN_SU_DUNG_RULE_NHAN_SU_KEM_ANH.docx"
    doc.save(output_path)
    print(f"File saved successfully to: {output_path}")

if __name__ == "__main__":
    create_document()
