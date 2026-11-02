import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseJsonArray, stringifyJsonArray } from "@/lib/json-fields";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"];

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Không có quyền đánh dấu link lỗi" }, { status: 403 });
    }

    const body = await request.json();
    const { dailyReportId, invalidUrls = [], reason = "" } = body;

    if (!dailyReportId) {
      return NextResponse.json({ error: "Thiếu ID báo cáo cần đánh dấu link lỗi" }, { status: 400 });
    }

    const cleanUrls = Array.isArray(invalidUrls)
      ? invalidUrls.map((u: unknown) => String(u).trim()).filter(Boolean)
      : [];

    if (cleanUrls.length === 0) {
      return NextResponse.json({ error: "Danh sách link đánh dấu lỗi không được để trống" }, { status: 400 });
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: parseInt(dailyReportId) },
      include: {
        shiftRegistration: true,
        user: true,
        qcReview: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Không tìm thấy báo cáo" }, { status: 404 });
    }

    // Merge với danh sách invalidLinks đã có (nếu có)
    const existingInvalid = parseJsonArray<string>(report.qcReview?.invalidLinks);
    const mergedInvalidSet = new Set([...existingInvalid, ...cleanUrls]);
    const mergedInvalidArray = Array.from(mergedInvalidSet);

    // Cập nhật QcReview và tạo thông báo tự động trong transaction
    const result = await prisma.$transaction(async (tx) => {
      let qc;
      if (report.qcReview) {
        qc = await tx.qcReview.update({
          where: { id: report.qcReview.id },
          data: {
            invalidLinks: stringifyJsonArray(mergedInvalidArray),
          },
        });
      } else {
        qc = await tx.qcReview.create({
          data: {
            dailyReportId: report.id,
            reviewerId: session.userId,
            fbApproved: Math.max(0, parseJsonArray(report.fbLinks).length - mergedInvalidArray.length),
            threadApproved: Math.max(0, parseJsonArray(report.threadLinks).length),
            commentApproved: 0,
            result: "PENDING",
            feedback: reason || "Phát hiện liên kết không hợp lệ cần thay thế",
            invalidLinks: stringifyJsonArray(mergedInvalidArray),
            reviewedAt: new Date(),
          },
        });
      }

      // Tạo thông báo cho nhân sự
      const reportDateStr = new Date(report.reportDate).toLocaleDateString("vi-VN");
      const shiftType = report.shiftType || report.shiftRegistration?.shiftType || "Ca làm việc";
      const reasonText = reason ? `Lý do: ${reason}` : "Lý do: Không truy cập được hoặc sai quy định.";

      await tx.notification.create({
        data: {
          userId: report.userId,
          type: "LINK_INVALID",
          title: "Phát hiện link báo cáo không hợp lệ",
          message: `Ca làm việc ngày ${reportDateStr} (${shiftType}) có ${cleanUrls.length} liên kết bị đánh dấu không hợp lệ. ${reasonText} Vui lòng vào trang Báo cáo để thay thế link trước khi kết thúc tuần!`,
          metadata: JSON.stringify({
            dailyReportId: report.id,
            invalidUrls: cleanUrls,
            reason,
            markedBy: session.fullName || `User #${session.userId}`,
          }),
        },
      });

      return qc;
    });

    return NextResponse.json({
      success: true,
      message: `Đã đánh dấu ${cleanUrls.length} liên kết lỗi và gửi thông báo cho nhân sự`,
      invalidLinks: mergedInvalidArray,
      review: result,
    });
  } catch (error: any) {
    console.error("Lỗi khi đánh dấu link lỗi:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi đánh dấu link lỗi" }, { status: 500 });
  }
}
