import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Chỉ Super Admin mới có quyền truy cập." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "nhan-su";

  // ==============================================================
  // MẪU TỆP JSON ALL-IN-ONE
  // ==============================================================
  if (type === "json-all-in-one") {
    const sampleJson = [
      {
        info: {
          name: "Nguyễn Văn A",
          phone: "0981000001",
          email: "nguyenvana@gmail.com",
          dob: "2002-05-15",
          cccd: "001204000001",
          bankAccount: "190356789012",
          bankName: "Techcombank",
          role: "NHAN_SU_HYBRID",
          status: "ACTIVE",
          startDate: "2026-10-01",
          password: "",
        },
        contracts: [
          {
            contractType: "khoan_viec",
            startDate: "2026-10-01",
            endDate: "2026-12-31",
            status: "ACTIVE",
            note: "Hợp đồng khoán việc nhân sự",
          },
        ],
        shifts: [
          {
            shiftDate: "2026-10-20",
            shiftType: "MORNING",
            workMode: "ONLINE",
            status: "COMPLETED",
            note: "Ca thực tế sáng",
          },
          {
            shiftDate: "2026-10-21",
            shiftType: "AFTERNOON",
            workMode: "OFFLINE",
            status: "COMPLETED",
            note: "Làm trực tiếp tại văn phòng",
          },
        ],
        reports: [
          {
            reportDate: "2026-10-20",
            shiftType: "MORNING",
            fbLinks: [
              "https://www.facebook.com/groups/freetrip/posts/100001",
              "https://www.facebook.com/groups/freetrip/posts/100002",
            ],
            threadLinks: ["https://www.threads.net/@user/post/100001"],
            commentDriveLink: "https://drive.google.com/drive/folders/sample-proof",
            femaleContentLinks: [],
            viralPostLinks: ["https://www.facebook.com/groups/freetrip/posts/viral101"],
            qcReview: {
              fbApproved: 10,
              threadApproved: 4,
              commentApproved: 50,
              result: "PASS",
              feedback: "Đạt chỉ tiêu ca sáng",
            },
          },
        ],
        viralPosts: [
          {
            postUrl: "https://www.facebook.com/groups/freetrip/posts/viral101",
            platform: "FACEBOOK",
            contentType: "POST",
            likes: 1250,
            bonusAmount: 50000,
            submittedAt: "2026-10-20",
            shiftType: "MORNING",
          },
        ],
        monthlyAcceptances: [
          {
            month: 10,
            year: 2026,
            totalShifts: 24,
            totalShiftsPassed: 24,
            totalPackages: 1,
            status: "DRAFT",
            bonusNote: "Hoàn thành chỉ tiêu tháng 10",
          },
        ],
      },
      {
        info: {
          name: "Trần Thị B",
          phone: "0981000002",
          email: "tranthib@gmail.com",
          dob: "2003-08-20",
          cccd: "001204000002",
          bankAccount: "10287654321",
          bankName: "Vietcombank",
          role: "NHAN_SU_HYBRID",
          status: "ACTIVE",
          startDate: "2026-10-01",
          password: "CustomPassword@123",
        },
        contracts: [
          {
            contractType: "khoan_viec",
            startDate: "2026-10-01",
            endDate: "2026-12-31",
            status: "ACTIVE",
            note: "Hợp đồng thử việc / khoán việc",
          },
        ],
        shifts: [
          {
            shiftDate: "2026-10-20",
            shiftType: "EVENING",
            workMode: "ONLINE",
            status: "COMPLETED",
            note: "Ca tối online",
          },
        ],
        reports: [],
        viralPosts: [],
        monthlyAcceptances: [],
      },
    ];

    const jsonString = JSON.stringify(sampleJson, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mau_import_all_in_one.json"',
      },
    });
  }

  // ==============================================================
  // MẪU TỆP EXCEL
  // ==============================================================
  const workbook = XLSX.utils.book_new();

  if (type === "nhan-su") {
    const data = [
      {
        "Họ và tên *": "Nguyễn Văn A",
        "Số điện thoại *": "0981000001",
        "Email": "nguyenvana@gmail.com",
        "CCCD": "001204000001",
        "Ngày sinh": "2002-05-15",
        "Ngày bắt đầu": "2026-10-01",
        "Số tài khoản": "190356789012",
        "Tên ngân hàng": "Techcombank",
        "Vai trò": "NHAN_SU_HYBRID",
        "Trạng thái": "ACTIVE",
        "Loại hợp đồng": "khoan_viec",
        "Mật khẩu (để trống: 123456)": "",
      },
      {
        "Họ và tên *": "Trần Thị B",
        "Số điện thoại *": "0981000002",
        "Email": "tranthib@gmail.com",
        "CCCD": "001204000002",
        "Ngày sinh": "2003-08-20",
        "Ngày bắt đầu": "2026-10-01",
        "Số tài khoản": "10287654321",
        "Tên ngân hàng": "Vietcombank",
        "Vai trò": "NHAN_SU_HYBRID",
        "Trạng thái": "ACTIVE",
        "Loại hợp đồng": "khoan_viec",
        "Mật khẩu (để trống: 123456)": "Abc@123456",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 14 },
      { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
      { wch: 16 }, { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(workbook, ws, "DanhSachNhanSu");
  } else if (type === "ca-lam-viec") {
    const data = [
      {
        "Số điện thoại / Email / Tên *": "0981000001",
        "Ngày làm việc (YYYY-MM-DD) *": "2026-10-20",
        "Ca làm việc (Sáng / Chiều / Tối) *": "Sáng",
        "Hình thức (Online / Offline) *": "Online",
        "Trạng thái (COMPLETED / REGISTERED / ABSENT)": "COMPLETED",
        "Ghi chú": "Ca thực tế tháng 10",
      },
      {
        "Số điện thoại / Email / Tên *": "0981000002",
        "Ngày làm việc (YYYY-MM-DD) *": "2026-10-20",
        "Ca làm việc (Sáng / Chiều / Tối) *": "Chiều",
        "Hình thức (Online / Offline) *": "Offline",
        "Trạng thái (COMPLETED / REGISTERED / ABSENT)": "COMPLETED",
        "Ghi chú": "Làm tại văn phòng",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, ws, "DangKyCa");
  } else if (type === "bao-cao-seeding") {
    const data = [
      {
        "Số điện thoại / Email / Tên *": "0981000001",
        "Ngày báo cáo (YYYY-MM-DD) *": "2026-10-20",
        "Ca làm việc (Sáng / Chiều / Tối) *": "Sáng",
        "Link Facebook (mỗi link 1 dòng)": "https://facebook.com/post/1\nhttps://facebook.com/post/2",
        "Link Threads (mỗi link 1 dòng)": "https://threads.net/@user/post/1",
        "Link Drive CMT": "https://drive.google.com/drive/folders/abc",
        "Link bài nữ": "",
        "Link bài viral": "https://facebook.com/post/viral1",
        "Duyệt FB": 10,
        "Duyệt Threads": 4,
        "Duyệt CMT": 50,
        "Kết quả QC (PASS / PARTIAL / FAIL)": "PASS",
        "Nhận xét QC": "Đạt chỉ tiêu ca sáng",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 40 },
      { wch: 35 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 20 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, ws, "BaoCaoSeeding");
  } else if (type === "thuong-viral") {
    const data = [
      {
        "Số điện thoại / Email / Tên *": "0981000001",
        "Link bài viết *": "https://facebook.com/post/viral_123",
        "Nền tảng (FACEBOOK / THREADS) *": "FACEBOOK",
        "Loại nội dung (POST / COMMENT)": "POST",
        "Lượt tương tác (Like) *": 1200,
        "Tiền thưởng (để trống sẽ tự tính theo bậc)": 50000,
        "Ngày đăng (YYYY-MM-DD)": "2026-10-20",
        "Ca làm việc (Sáng / Chiều / Tối)": "Sáng",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, ws, "ThuongViral");
  }

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const fileName = `Mau_Import_${type.toUpperCase()}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
