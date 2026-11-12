import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import { getWeekRange } from "@/lib/dateUtils";
import { parseJsonArray, parseJsonObject } from "@/lib/json-fields";
import type { ShiftType, WorkMode } from "@/generated/prisma";

interface ShiftInput {
  shiftDate: string; // "YYYY-MM-DD"
  shiftType: ShiftType; // "MORNING" | "AFTERNOON" | "EVENING"
  workMode: WorkMode; // "ONLINE" | "OFFLINE"
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { weekNumber, year, shifts, targetUserId } = body;

    // Nếu Quản lý đăng ký thay nhân sự thì dùng targetUserId, ngược lại dùng userId của session
    const isManagerRole = hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC", "HR"]);
    const effectiveUserId = isManagerRole && targetUserId ? parseInt(targetUserId) : session.userId;

    if (!weekNumber || !year || !Array.isArray(shifts)) {
      return NextResponse.json({ error: "Dữ liệu đăng ký không hợp lệ" }, { status: 400 });
    }

    // 1. Kiểm tra cấu hình khóa tuần và tự động duyệt ca nếu đã kết thúc giờ đăng ký
    const { checkAndAutoApproveWeekShifts } = await import("@/lib/shiftAutoApproval");
    const autoApprovalResult = await checkAndAutoApproveWeekShifts(parseInt(weekNumber), parseInt(year));

    const config = await prisma.shiftScheduleConfig.findUnique({
      where: {
        weekNumber_year: { weekNumber: parseInt(weekNumber), year: parseInt(year) },
      },
    });

    const now = new Date();
    // Tuần bị khóa nếu: đã tự động duyệt, có cờ approvedAt, cờ isLocked bật, hoặc đã qua hạn đóng đăng ký
    const isWeekLocked = Boolean(
      autoApprovalResult.isLocked ||
      config?.approvedAt ||
      config?.isLocked ||
      (config?.registrationCloseAt && now > config.registrationCloseAt)
    );

    // Kiểm tra xem nhân sự có được cấp quyền nộp bù / sửa ca không:
    // - Có nằm trong mảng reopenedUserIds của cấu hình tuần
    // - Hoặc có bản ghi ca mang cờ reopenedBy
    const reopenedList = parseJsonArray<number>(config?.reopenedUserIds);
    const hasReopenPermission = Boolean(
      reopenedList.includes(effectiveUserId) ||
      (await prisma.shiftRegistration.findFirst({
        where: {
          userId: effectiveUserId,
          weekNumber: parseInt(weekNumber),
          year: parseInt(year),
          reopenedBy: { not: null },
        },
      }))
    );

    if (isWeekLocked && !hasReopenPermission && !isManagerRole) {
      const closeNotice = autoApprovalResult.formattedCloseVN
        ? ` (đã khóa lúc ${autoApprovalResult.formattedCloseVN})`
        : "";
      return NextResponse.json(
        {
          error:
            `Thời gian đăng ký ca cho tuần này đã kết thúc${closeNotice}. Toàn bộ ca đã được chốt và tự động duyệt. Vui lòng liên hệ Quản lý nếu cần mở quyền nộp bổ sung.`,
        },
        { status: 403 }
      );
    }

    // 2. Ràng buộc: Kiểm tra trùng lặp ca và Giới hạn số ca / ngày
    const shiftRulesSetting = await prisma.systemSetting.findUnique({
      where: { key: "shift_rules" },
    });
    const shiftRules = parseJsonObject<{ maxShiftsPerDay?: number; maxUsersPerShift?: number }>(shiftRulesSetting?.value, {});
    const maxShiftsPerDaySetting = shiftRules.maxShiftsPerDay ?? 1;

    // 2.1. Không được đăng ký trùng cùng 1 ca làm việc trong ngày
    const shiftKeySet = new Set<string>();
    for (const shift of shifts as ShiftInput[]) {
      const key = `${shift.shiftDate.slice(0, 10)}_${shift.shiftType}`;
      if (shiftKeySet.has(key)) {
        return NextResponse.json(
          { error: `Ca ${shift.shiftType} ngày ${shift.shiftDate.slice(0, 10)} bị đăng ký trùng lặp!` },
          { status: 400 }
        );
      }
      shiftKeySet.add(key);
    }

    // 2.2. Kiểm tra giới hạn số ca / ngày theo mốc thời gian
    const shiftsCountByDate = new Map<string, number>();
    for (const shift of shifts as ShiftInput[]) {
      const dateStr = shift.shiftDate.slice(0, 10);
      const isBeforeSept2026 = dateStr < "2026-09-01";
      // Tháng 8/2026 hoặc trước đó: Cho phép tối đa cả 3 ca/ngày (không giới hạn)
      // Từ Tháng 9/2026 trở đi: Áp dụng theo maxShiftsPerDay từ cài đặt Admin (0 = không giới hạn)
      const maxAllowed = isBeforeSept2026 ? 3 : (maxShiftsPerDaySetting === 0 ? 3 : maxShiftsPerDaySetting);

      const count = (shiftsCountByDate.get(dateStr) || 0) + 1;
      if (count > maxAllowed) {
        return NextResponse.json(
          {
            error: isBeforeSept2026
              ? `Ngày ${dateStr} đã vượt quá 3 ca (tối đa gồm Sáng, Chiều, Tối).`
              : `Chính sách mới (áp dụng từ Tháng 09/2026): Mỗi nhân sự chỉ được làm tối đa ${maxAllowed} ca/ngày! Ngày ${dateStr} đã chọn ${count} ca.`,
          },
          { status: 400 }
        );
      }
      shiftsCountByDate.set(dateStr, count);
    }

    // 3. Ràng buộc: Tối thiểu 5 ca / tuần & 4. Ít nhất 1 ca Offline:
    // Đã chuyển thành tiêu chí theo dõi/khuyến nghị trên giao diện, không chặn lưu ca ở backend
    // để hỗ trợ nhân sự đăng ký linh hoạt theo ngày.

    // 5. Ràng buộc: Tổng số người tối đa đăng ký mỗi ca làm việc (maxUsersPerShift)
    const maxUsersPerShift = Number(shiftRules.maxUsersPerShift) || 10;

    const fullShifts: string[] = [];
    const SHIFT_LABELS: Record<string, string> = {
      MORNING: "Ca Sáng",
      AFTERNOON: "Ca Chiều",
      EVENING: "Ca Tối",
    };

    for (const shift of shifts as ShiftInput[]) {
      const shiftDateObj = new Date(shift.shiftDate);
      shiftDateObj.setUTCHours(0, 0, 0, 0);

      // Đếm số người đã đăng ký ca này (loại trừ chính nhân sự đang được thao tác)
      const registeredCount = await prisma.shiftRegistration.count({
        where: {
          shiftDate: shiftDateObj,
          shiftType: shift.shiftType,
          status: { in: ["REGISTERED", "APPROVED", "COMPLETED"] },
          userId: { not: effectiveUserId },
        },
      });

      if (registeredCount >= maxUsersPerShift) {
        const d = new Date(shift.shiftDate);
        const displayDate = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        const shiftName = SHIFT_LABELS[shift.shiftType] || shift.shiftType;
        fullShifts.push(`${shiftName} ngày ${displayDate} (Đã đủ ${registeredCount}/${maxUsersPerShift} người)`);
      }
    }

    if (fullShifts.length > 0) {
      return NextResponse.json(
        {
          error: `Rất tiếc! Ca làm việc sau đã đủ số lượng nhân sự tối đa:\n• ${fullShifts.join("\n• ")}\nVui lòng chọn ca hoặc ngày khác và đăng ký lại!`,
          fullShifts,
          maxUsersPerShift,
        },
        { status: 400 }
      );
    }

    // 6. Lưu CSDL trong Transaction: BẢO VỆ TUYỆT ĐỐI LINK BÁO CÁO ĐÃ NỘP
    // Không bao giờ xóa toàn bộ ca trong tuần bằng deleteMany!
    // Các ca cũ đã nộp link hoặc đã làm việc phải được bảo lưu nguyên vẹn.
    const result = await prisma.$transaction(async (tx) => {
      // 6.1. Lấy toàn bộ ca hiện có của nhân sự trong tuần này
      const existingShifts = await tx.shiftRegistration.findMany({
        where: {
          userId: effectiveUserId,
          weekNumber: parseInt(weekNumber),
          year: parseInt(year),
        },
        include: {
          dailyReport: {
            select: {
              id: true,
              submittedAt: true,
            },
          },
          loginSession: {
            select: {
              id: true,
            },
          },
        },
      });

      const getKey = (d: Date | string, type: string) => {
        const dateStr = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
        return `${dateStr}_${type}`;
      };

      const incomingMap = new Map<string, ShiftInput>();
      for (const s of shifts as ShiftInput[]) {
        const key = getKey(s.shiftDate, s.shiftType);
        incomingMap.set(key, s);
      }

      const existingMap = new Map<string, (typeof existingShifts)[0]>();
      for (const s of existingShifts) {
        const key = getKey(s.shiftDate, s.shiftType);
        existingMap.set(key, s);
      }

      const createdKeys: string[] = [];
      const updatedKeys: string[] = [];
      const removedKeys: string[] = [];
      const preservedReportKeys: string[] = [];

      // 6.2. Cập nhật các ca tiếp tục giữ lại (Kept)
      for (const [key, existing] of existingMap.entries()) {
        if (incomingMap.has(key)) {
          const input = incomingMap.get(key)!;
          const updateData: any = {};
          if (input.workMode && input.workMode !== existing.workMode) {
            updateData.workMode = input.workMode;
          }
          // Nếu ca từng bị REJECTED thì chuyển lại về REGISTERED
          if (existing.status === "REJECTED") {
            updateData.status = "REGISTERED";
          }
          if (Object.keys(updateData).length > 0) {
            await tx.shiftRegistration.update({
              where: { id: existing.id },
              data: updateData,
            });
            updatedKeys.push(key);
          }
        }
      }

      // 6.3. Tạo mới các ca chưa từng có (New)
      for (const [key, input] of incomingMap.entries()) {
        if (!existingMap.has(key)) {
          const dateStr = input.shiftDate.slice(0, 10);
          const shiftDateObj = new Date(`${dateStr}T00:00:00.000Z`);

          await tx.shiftRegistration.create({
            data: {
              userId: effectiveUserId,
              shiftDate: shiftDateObj,
              shiftType: input.shiftType,
              workMode: input.workMode,
              status: isManagerRole && isWeekLocked ? "APPROVED" : "REGISTERED",
              weekNumber: parseInt(weekNumber),
              year: parseInt(year),
            },
          });
          createdKeys.push(key);
        }
      }

      // 6.4. Xử lý các ca bị BỎ / HỦY khi đổi lịch (Removed)
      for (const [key, existing] of existingMap.entries()) {
        if (!incomingMap.has(key)) {
          // KIỂM TRA ĐẶC BIỆT: Bảo vệ dữ liệu chấm công và báo cáo
          // 1. Ca đã có DailyReport (đã nộp link)
          // 2. Ca đã có LoginSession (đã điểm danh/chấm công đăng nhập)
          // 3. Ca ở các trạng thái đã hoàn thành hoặc đang xử lý (COMPLETED, IN_PROGRESS)
          // 4. Nếu là nhân sự thường: Không được tự xóa ca đã bị đánh vắng (ABSENT)
          // CHÚ Ý: Ca ở trạng thái APPROVED hoặc REGISTERED (hoặc ABSENT do đổi ca nếu do Quản lý thao tác)
          // mà chưa từng có điểm danh (LoginSession) và chưa từng có link báo cáo (DailyReport)
          // THÌ KHI ĐỔI LỊCH PHẢI ĐƯỢC PHÉP XÓA để chuyển ca thành công, tránh bị trùng ca!
          const hasReport = Boolean(existing.dailyReport);
          const hasLoginSession = Boolean(existing.loginSession);
          const isCriticalStatus =
            ["COMPLETED", "IN_PROGRESS"].includes(existing.status) ||
            (!isManagerRole && existing.status === "ABSENT");

          if (hasReport || hasLoginSession || isCriticalStatus) {
            preservedReportKeys.push(key);
            // Giữ nguyên ca này trong CSDL, bảo toàn dữ liệu chấm công và báo cáo
          } else {
            // Ca chưa từng điểm danh và chưa từng nộp báo cáo -> Cho phép xóa / đổi ca an toàn
            await tx.shiftRegistration.delete({
              where: { id: existing.id },
            });
            removedKeys.push(key);
          }
        }
      }

      // Lưu log và thông báo nếu Quản lý thực hiện chỉnh sửa ca thay cho nhân sự
      if (effectiveUserId !== session.userId) {
        const managerUser = await tx.user.findUnique({
          where: { id: session.userId },
          select: { fullName: true },
        });

        await tx.notification.create({
          data: {
            userId: effectiveUserId,
            type: "GENERAL",
            title: "Lịch ca tuần đã được Quản lý cập nhật",
            message: `Quản lý ${managerUser?.fullName || "Quản trị viên"} đã cập nhật lịch ca tuần ${weekNumber}/${year} của bạn. Các dữ liệu link báo cáo đã nộp được bảo lưu an toàn.`,
            metadata: JSON.stringify({
              action: "MANAGER_UPDATE_SHIFTS",
              updatedByUserId: session.userId,
              updatedByName: managerUser?.fullName,
              weekNumber: parseInt(weekNumber),
              year: parseInt(year),
              createdCount: createdKeys.length,
              removedCount: removedKeys.length,
              preservedCount: preservedReportKeys.length,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      }

      return {
        createdKeys,
        updatedKeys,
        removedKeys,
        preservedReportKeys,
      };
    });

    const totalActiveShifts = await prisma.shiftRegistration.count({
      where: {
        userId: effectiveUserId,
        weekNumber: parseInt(weekNumber),
        year: parseInt(year),
      },
    });

    const isScheduleChanged = result.createdKeys.length > 0 || result.removedKeys.length > 0;
    const SHIFT_NAMES: Record<string, string> = {
      MORNING: "Ca Sáng",
      AFTERNOON: "Ca Chiều",
      EVENING: "Ca Tối",
    };

    const formatKeyToVN = (key: string) => {
      const [dStr, type] = key.split("_");
      const [y, m, d] = dStr.split("-");
      return `${SHIFT_NAMES[type] || type} ngày ${d}/${m}`;
    };

    let popupTitle = "Thông báo thay đổi lịch làm việc";
    let popupMessage = "";

    if (isScheduleChanged) {
      const details: string[] = [];
      if (result.createdKeys.length > 0) {
        const addedDesc = result.createdKeys.map(formatKeyToVN).join(", ");
        details.push(`• Thêm mới: ${addedDesc}`);
      }
      if (result.removedKeys.length > 0) {
        const removedDesc = result.removedKeys.map(formatKeyToVN).join(", ");
        details.push(`• Đã hủy/đổi: ${removedDesc}`);
      }
      if (result.preservedReportKeys.length > 0) {
        const preservedDesc = result.preservedReportKeys.map(formatKeyToVN).join(", ");
        details.push(`• Đã nộp link (bảo lưu dữ liệu): ${preservedDesc}`);
      }

      popupMessage = `Lịch làm việc tuần ${weekNumber}/${year} đã được thay đổi thành công!\n\n${details.join("\n")}\n\n✅ Toàn bộ dữ liệu và link báo cáo của các ca đã làm việc trước đó được giữ nguyên an toàn, không bị xóa.`;
    } else {
      popupTitle = "Đăng ký ca làm việc";
      popupMessage = effectiveUserId !== session.userId
        ? `Đã lưu và đồng bộ lịch ${totalActiveShifts} ca làm việc tuần ${weekNumber}/${year} cho nhân sự! Dữ liệu các ca đã nộp link báo cáo được giữ nguyên.`
        : `Đã lưu thành công lịch ${totalActiveShifts} ca làm việc cho tuần ${weekNumber}! Dữ liệu các ca đã nộp link báo cáo được bảo lưu nguyên vẹn.`;
    }

    return NextResponse.json({
      success: true,
      message: popupMessage,
      popupTitle,
      popupMessage,
      isChanged: isScheduleChanged,
      addedCount: result.createdKeys.length,
      removedCount: result.removedKeys.length,
      preservedCount: result.preservedReportKeys.length,
      count: totalActiveShifts,
    });
  } catch (error: any) {
    console.error("Lỗi khi đăng ký ca làm việc:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi lưu lịch đăng ký ca", details: error.message },
      { status: 500 }
    );
  }
}
