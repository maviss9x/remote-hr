import { NextResponse } from "next/server";
import { scanAndAutoApproveAllPendingWeeks } from "@/lib/shiftAutoApproval";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await scanAndAutoApproveAllPendingWeeks();
    return NextResponse.json({
      success: true,
      message: `Đã hoàn tất quét tự động duyệt ca: ${result.totalApprovedShifts} ca được duyệt tại ${result.processedWeeks} tuần.`,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Lỗi API GET /api/shifts/auto-approve:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi quét tự động duyệt ca", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
