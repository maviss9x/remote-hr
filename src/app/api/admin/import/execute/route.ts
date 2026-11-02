import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getISOWeekAndYear, getWeekDateRange } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Chỉ Super Admin mới có quyền thực hiện nạp dữ liệu." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, items, options = {} } = body;

    if (!type || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Không có dữ liệu hợp lệ để thực thi import." },
        { status: 400 }
      );
    }

    const mode = options.mode || "UPSERT"; // "UPSERT" or "SKIP"
    const defaultPassword = options.defaultPassword || "123456";
    const createContracts = options.createContracts ?? true;
    const autoCreateWeeks = options.autoCreateWeeks ?? true;

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errorLogs: Array<{ row: number; message: string }> = [];

    // ==============================================================
    // 0. IMPORT GÓI JSON TRỌN GÓI (ALL-IN-ONE)
    // ==============================================================
    if (type === "json-all-in-one") {
      const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);
      const reviewerId = currentUser.userId;

      // Lấy bậc thưởng viral để tự động tính tiền nếu cần
      const bonusTiers = await prisma.viralBonusTier.findMany({
        orderBy: [{ minLikes: "desc" }],
      });

      let totalShiftsCreated = 0;
      let totalReportsCreated = 0;
      let totalViralCreated = 0;
      let totalAcceptancesCreated = 0;

      for (const person of items) {
        try {
          const info = person.info;

          // 1. TÌM HOẶC TẠO USER
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { phone: info.phone },
                ...(info.email ? [{ email: info.email }] : []),
              ],
            },
          });

          if (user) {
            if (mode === "UPSERT") {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  fullName: info.fullName,
                  email: info.email || user.email,
                  cccd: info.cccd || user.cccd,
                  bankAccount: info.bankAccount || user.bankAccount,
                  bankName: info.bankName || user.bankName,
                  role: info.role || user.role,
                  status: info.status || user.status,
                  dateOfBirth: info.dateOfBirth ? new Date(info.dateOfBirth) : user.dateOfBirth,
                  startDate: info.startDate ? new Date(info.startDate) : user.startDate,
                },
              });
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            const passwordHash = info.customPassword
              ? await bcrypt.hash(info.customPassword, 10)
              : defaultPasswordHash;

            user = await prisma.user.create({
              data: {
                fullName: info.fullName,
                phone: info.phone,
                email: info.email || null,
                cccd: info.cccd || null,
                bankAccount: info.bankAccount || null,
                bankName: info.bankName || null,
                passwordHash,
                role: info.role || "NHAN_SU_HYBRID",
                status: info.status || "ACTIVE",
                startDate: new Date(info.startDate || new Date()),
                dateOfBirth: info.dateOfBirth ? new Date(info.dateOfBirth) : null,
              },
            });
            createdCount++;
          }

          // 2. TẠO HOẶC CẬP NHẬT HỢP ĐỒNG
          if (Array.isArray(person.contracts) && person.contracts.length > 0) {
            for (const c of person.contracts) {
              const startD = new Date(c.startDate || info.startDate || new Date());
              const endD = new Date(c.endDate || "2026-12-31");
              await prisma.contract.create({
                data: {
                  userId: user.id,
                  startDate: startD,
                  endDate: endD,
                  status: c.status || "ACTIVE",
                  contractType: c.contractType || info.contractType || "khoan_viec",
                  note: c.note || `Hợp đồng JSON All-In-One - ${info.fullName}`,
                },
              });
            }
          } else if (createContracts) {
            const startD = new Date(info.startDate || new Date());
            const endD = new Date(startD.getFullYear(), 11, 31);
            const existingContract = await prisma.contract.findFirst({
              where: { userId: user.id },
            });
            if (!existingContract) {
              await prisma.contract.create({
                data: {
                  userId: user.id,
                  startDate: startD,
                  endDate: endD,
                  status: "ACTIVE",
                  contractType: info.contractType || "khoan_viec",
                  note: `Hợp đồng tự động khởi tạo - ${info.fullName}`,
                },
              });
            }
          }

          // 3. TỰ ĐỘNG KÍCH HOẠT CẤU HÌNH TUẦN NẾU ĐƯỢC CHỌN
          if (autoCreateWeeks) {
            const weekKeys = new Set<string>();
            for (const s of person.shifts || []) {
              weekKeys.add(`${s.weekNumber}_${s.year}`);
            }
            for (const r of person.reports || []) {
              weekKeys.add(`${r.weekNumber}_${r.year}`);
            }

            for (const wk of weekKeys) {
              const [wStr, yStr] = wk.split("_");
              const w = parseInt(wStr, 10);
              const y = parseInt(yStr, 10);
              if (!isNaN(w) && !isNaN(y)) {
                const { startDate, endDate } = getWeekDateRange(w, y);
                const regOpen = new Date(startDate.getTime() - 14 * 86400000);
                const regClose = new Date(endDate.getTime() + 7 * 86400000);

                await prisma.shiftScheduleConfig.upsert({
                  where: { weekNumber_year: { weekNumber: w, year: y } },
                  update: { isLocked: false },
                  create: {
                    weekNumber: w,
                    year: y,
                    registrationOpenAt: regOpen,
                    registrationCloseAt: regClose,
                    isLocked: false,
                    reopenedUserIds: "[]",
                  },
                });
              }
            }
          }

          // 4. NẠP CÁC CA LÀM VIỆC (SHIFTS)
          for (const s of person.shifts || []) {
            const shiftDateObj = new Date(`${s.shiftDate}T00:00:00Z`);

            const existingShift = await prisma.shiftRegistration.findUnique({
              where: {
                userId_shiftDate_shiftType: {
                  userId: user.id,
                  shiftDate: shiftDateObj,
                  shiftType: s.shiftType,
                },
              },
            });

            if (existingShift) {
              if (mode === "UPSERT") {
                await prisma.shiftRegistration.update({
                  where: { id: existingShift.id },
                  data: {
                    workMode: s.workMode || existingShift.workMode,
                    status: s.status || existingShift.status,
                    note: s.note || existingShift.note,
                  },
                });
              }
            } else {
              await prisma.shiftRegistration.create({
                data: {
                  userId: user.id,
                  shiftDate: shiftDateObj,
                  shiftType: s.shiftType,
                  workMode: s.workMode || "ONLINE",
                  status: s.status || "COMPLETED",
                  weekNumber: s.weekNumber,
                  year: s.year,
                  note: s.note || "Nạp từ JSON All-In-One",
                },
              });
              totalShiftsCreated++;
            }
          }

          // 5. NẠP BÁO CÁO SEEDING & QC
          for (const r of person.reports || []) {
            const shiftDateObj = new Date(`${r.reportDate}T00:00:00Z`);

            // Đảm bảo có ca làm việc tương ứng
            let shift = await prisma.shiftRegistration.findUnique({
              where: {
                userId_shiftDate_shiftType: {
                  userId: user.id,
                  shiftDate: shiftDateObj,
                  shiftType: r.shiftType,
                },
              },
            });

            if (!shift) {
              shift = await prisma.shiftRegistration.create({
                data: {
                  userId: user.id,
                  shiftDate: shiftDateObj,
                  shiftType: r.shiftType,
                  workMode: "ONLINE",
                  status: "COMPLETED",
                  weekNumber: r.weekNumber,
                  year: r.year,
                  note: "Tự động tạo từ Báo cáo Seeding JSON",
                },
              });
              totalShiftsCreated++;
            }

            const reportData = {
              fbLinks: JSON.stringify(r.fbLinks || []),
              threadLinks: JSON.stringify(r.threadLinks || []),
              commentDriveLink: r.commentDriveLink || null,
              femaleContentLinks: JSON.stringify(r.femaleContentLinks || []),
              viralPostLinks: JSON.stringify(r.viralPostLinks || []),
              postTags: JSON.stringify(r.postTags || {}),
              submittedAt: new Date(`${r.reportDate}T23:59:59Z`),
            };

            const existingReport = await prisma.dailyReport.findUnique({
              where: { shiftRegistrationId: shift.id },
            });

            let reportId: number;

            if (existingReport) {
              if (mode === "UPSERT") {
                const updated = await prisma.dailyReport.update({
                  where: { id: existingReport.id },
                  data: reportData,
                });
                reportId = updated.id;
              } else {
                reportId = existingReport.id;
              }
            } else {
              const created = await prisma.dailyReport.create({
                data: {
                  userId: user.id,
                  shiftRegistrationId: shift.id,
                  reportDate: shiftDateObj,
                  shiftType: r.shiftType,
                  ...reportData,
                },
              });
              reportId = created.id;
              totalReportsCreated++;
            }

            // QC Review
            await prisma.qcReview.upsert({
              where: { dailyReportId: reportId },
              update: {
                reviewerId,
                fbApproved: r.fbApproved,
                threadApproved: r.threadApproved,
                commentApproved: r.commentApproved,
                result: r.qcResult || "PASS",
                feedback: r.qcFeedback || null,
                reviewedAt: new Date(),
              },
              create: {
                dailyReportId: reportId,
                reviewerId,
                fbApproved: r.fbApproved,
                threadApproved: r.threadApproved,
                commentApproved: r.commentApproved,
                result: r.qcResult || "PASS",
                feedback: r.qcFeedback || null,
                reviewedAt: new Date(),
              },
            });
          }

          // 6. NẠP THƯỞNG VIRAL
          for (const v of person.viralPosts || []) {
            const shiftDateObj = new Date(`${v.submittedAt}T00:00:00Z`);
            const weekInfo = getISOWeekAndYear(shiftDateObj);

            let shift = await prisma.shiftRegistration.findUnique({
              where: {
                userId_shiftDate_shiftType: {
                  userId: user.id,
                  shiftDate: shiftDateObj,
                  shiftType: v.shiftType,
                },
              },
            });

            if (!shift) {
              shift = await prisma.shiftRegistration.create({
                data: {
                  userId: user.id,
                  shiftDate: shiftDateObj,
                  shiftType: v.shiftType,
                  workMode: "ONLINE",
                  status: "COMPLETED",
                  weekNumber: weekInfo.weekNumber,
                  year: weekInfo.year,
                  note: "Tự động tạo từ Thưởng Viral JSON",
                },
              });
              totalShiftsCreated++;
            }

            let report = await prisma.dailyReport.findUnique({
              where: { shiftRegistrationId: shift.id },
            });

            if (!report) {
              report = await prisma.dailyReport.create({
                data: {
                  userId: user.id,
                  shiftRegistrationId: shift.id,
                  reportDate: shiftDateObj,
                  shiftType: v.shiftType,
                  viralPostLinks: JSON.stringify([v.postUrl]),
                  submittedAt: shiftDateObj,
                },
              });
              totalReportsCreated++;
            }

            let finalBonus = v.bonusAmount;
            if (!finalBonus || finalBonus === 0) {
              const matchedTier = bonusTiers.find(
                (t) =>
                  t.platform === v.platform &&
                  t.contentType === v.contentType &&
                  v.likes >= t.minLikes
              );
              if (matchedTier) finalBonus = matchedTier.bonusAmount;
            }

            await prisma.viralPost.create({
              data: {
                userId: user.id,
                dailyReportId: report.id,
                postUrl: v.postUrl,
                platform: v.platform,
                contentType: v.contentType,
                likes: v.likes,
                bonusAmount: finalBonus || 0,
                shiftType: v.shiftType,
                submittedAt: shiftDateObj,
              },
            });
            totalViralCreated++;
          }

          // 7. NẠP NGHIỆM THU THÁNG (MONTHLY ACCEPTANCES)
          for (const m of person.monthlyAcceptances || []) {
            const existingAcceptance = await prisma.monthlyAcceptance.findFirst({
              where: {
                userId: user.id,
                month: m.month,
                year: m.year,
              },
            });

            const acceptData = {
              totalShifts: m.totalShifts || 0,
              totalShiftsPassed: m.totalShiftsPassed || 0,
              totalPackages: m.totalPackages || Math.floor((m.totalShiftsPassed || 0) / 24),
              viralBonus: m.viralBonus || 0,
              bonusNote: m.bonusNote || null,
              status: m.status || "DRAFT",
            };

            if (existingAcceptance) {
              if (mode === "UPSERT") {
                await prisma.monthlyAcceptance.update({
                  where: { id: existingAcceptance.id },
                  data: acceptData,
                });
              }
            } else {
              await prisma.monthlyAcceptance.create({
                data: {
                  userId: user.id,
                  month: m.month,
                  year: m.year,
                  ...acceptData,
                },
              });
              totalAcceptancesCreated++;
            }
          }
        } catch (err: any) {
          errorCount++;
          errorLogs.push({
            row: person.row,
            message: `Lỗi nạp nhân sự "${person.info?.fullName || person.info?.name}": ${err.message || String(err)}`,
          });
        }
      }

      return NextResponse.json({
        success: true,
        type,
        totalProcessed: items.length,
        createdCount,
        updatedCount,
        skippedCount,
        errorCount,
        errors: errorLogs,
        details: {
          shiftsCreated: totalShiftsCreated,
          reportsCreated: totalReportsCreated,
          viralCreated: totalViralCreated,
          acceptancesCreated: totalAcceptancesCreated,
        },
      });
    }

    // ==============================================================
    // 1. IMPORT NHÂN SỰ & HỢP ĐỒNG (EXCEL)
    // ==============================================================
    if (type === "nhan-su") {
      const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

      for (const item of items) {
        try {
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { phone: item.phone },
                ...(item.email ? [{ email: item.email }] : []),
              ],
            },
          });

          if (existingUser) {
            if (mode === "SKIP") {
              skippedCount++;
              continue;
            }

            // Cập nhật thông tin
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                fullName: item.fullName,
                email: item.email || existingUser.email,
                cccd: item.cccd || existingUser.cccd,
                bankAccount: item.bankAccount || existingUser.bankAccount,
                bankName: item.bankName || existingUser.bankName,
                role: item.role || existingUser.role,
                status: item.status || existingUser.status,
                dateOfBirth: item.dateOfBirth ? new Date(item.dateOfBirth) : existingUser.dateOfBirth,
                startDate: item.startDate ? new Date(item.startDate) : existingUser.startDate,
              },
            });
            updatedCount++;
          } else {
            // Tạo mới user
            const passwordHash = item.customPassword
              ? await bcrypt.hash(item.customPassword, 10)
              : defaultPasswordHash;

            const newUser = await prisma.user.create({
              data: {
                fullName: item.fullName,
                phone: item.phone,
                email: item.email || null,
                cccd: item.cccd || null,
                bankAccount: item.bankAccount || null,
                bankName: item.bankName || null,
                passwordHash,
                role: item.role || "NHAN_SU_HYBRID",
                status: item.status || "ACTIVE",
                startDate: new Date(item.startDate || new Date()),
                dateOfBirth: item.dateOfBirth ? new Date(item.dateOfBirth) : null,
              },
            });

            // Tạo hợp đồng nếu được chọn
            if (createContracts) {
              const startD = new Date(item.startDate || new Date());
              const endD = new Date(startD.getFullYear(), 11, 31);
              await prisma.contract.create({
                data: {
                  userId: newUser.id,
                  startDate: startD,
                  endDate: endD,
                  status: "ACTIVE",
                  contractType: item.contractType || "khoan_viec",
                  note: `Hợp đồng tự động nạp từ Excel - ${item.fullName}`,
                },
              });
            }
            createdCount++;
          }
        } catch (err: any) {
          errorCount++;
          errorLogs.push({ row: item.row, message: err.message || "Lỗi tạo bản ghi nhân sự." });
        }
      }
    }

    // ==============================================================
    // 2. IMPORT CA LÀM VIỆC & CHẤM CÔNG (EXCEL)
    // ==============================================================
    else if (type === "ca-lam-viec") {
      if (autoCreateWeeks) {
        const uniqueWeeks = new Map<string, { weekNumber: number; year: number }>();
        for (const item of items) {
          const key = `${item.weekNumber}_${item.year}`;
          if (!uniqueWeeks.has(key)) {
            uniqueWeeks.set(key, { weekNumber: item.weekNumber, year: item.year });
          }
        }

        for (const { weekNumber, year } of uniqueWeeks.values()) {
          const { startDate, endDate } = getWeekDateRange(weekNumber, year);
          const regOpen = new Date(startDate.getTime() - 14 * 86400000);
          const regClose = new Date(endDate.getTime() + 7 * 86400000);

          await prisma.shiftScheduleConfig.upsert({
            where: { weekNumber_year: { weekNumber, year } },
            update: { isLocked: false },
            create: {
              weekNumber,
              year,
              registrationOpenAt: regOpen,
              registrationCloseAt: regClose,
              isLocked: false,
              reopenedUserIds: "[]",
            },
          });
        }
      }

      for (const item of items) {
        try {
          const shiftDateObj = new Date(`${item.shiftDate}T00:00:00Z`);

          const existingShift = await prisma.shiftRegistration.findUnique({
            where: {
              userId_shiftDate_shiftType: {
                userId: item.userId,
                shiftDate: shiftDateObj,
                shiftType: item.shiftType,
              },
            },
          });

          if (existingShift) {
            if (mode === "SKIP") {
              skippedCount++;
              continue;
            }

            await prisma.shiftRegistration.update({
              where: { id: existingShift.id },
              data: {
                workMode: item.workMode || existingShift.workMode,
                status: item.status || existingShift.status,
                note: item.note || existingShift.note,
              },
            });
            updatedCount++;
          } else {
            await prisma.shiftRegistration.create({
              data: {
                userId: item.userId,
                shiftDate: shiftDateObj,
                shiftType: item.shiftType,
                workMode: item.workMode || "ONLINE",
                status: item.status || "COMPLETED",
                weekNumber: item.weekNumber,
                year: item.year,
                note: item.note || "Nạp từ file Excel",
              },
            });
            createdCount++;
          }
        } catch (err: any) {
          errorCount++;
          errorLogs.push({ row: item.row, message: err.message || "Lỗi tạo ca làm việc." });
        }
      }
    }

    // ==============================================================
    // 3. IMPORT BÁO CÁO SEEDING & QC (EXCEL)
    // ==============================================================
    else if (type === "bao-cao-seeding") {
      const reviewerId = currentUser.userId;

      for (const item of items) {
        try {
          const shiftDateObj = new Date(`${item.reportDate}T00:00:00Z`);

          let shift = await prisma.shiftRegistration.findUnique({
            where: {
              userId_shiftDate_shiftType: {
                userId: item.userId,
                shiftDate: shiftDateObj,
                shiftType: item.shiftType,
              },
            },
          });

          if (!shift) {
            shift = await prisma.shiftRegistration.create({
              data: {
                userId: item.userId,
                shiftDate: shiftDateObj,
                shiftType: item.shiftType,
                workMode: "ONLINE",
                status: "COMPLETED",
                weekNumber: item.weekNumber,
                year: item.year,
                note: "Tự động tạo từ Báo cáo Seeding",
              },
            });
          }

          const existingReport = await prisma.dailyReport.findUnique({
            where: { shiftRegistrationId: shift.id },
            include: { qcReview: true },
          });

          const reportData = {
            fbLinks: JSON.stringify(item.fbLinks || []),
            threadLinks: JSON.stringify(item.threadLinks || []),
            commentDriveLink: item.commentDriveLink || null,
            femaleContentLinks: JSON.stringify(item.femaleContentLinks || []),
            viralPostLinks: JSON.stringify(item.viralPostLinks || []),
            submittedAt: new Date(`${item.reportDate}T23:59:59Z`),
          };

          let reportId: number;

          if (existingReport) {
            if (mode === "SKIP") {
              skippedCount++;
              continue;
            }
            const updated = await prisma.dailyReport.update({
              where: { id: existingReport.id },
              data: reportData,
            });
            reportId = updated.id;
            updatedCount++;
          } else {
            const created = await prisma.dailyReport.create({
              data: {
                userId: item.userId,
                shiftRegistrationId: shift.id,
                reportDate: shiftDateObj,
                shiftType: item.shiftType,
                ...reportData,
              },
            });
            reportId = created.id;
            createdCount++;
          }

          await prisma.qcReview.upsert({
            where: { dailyReportId: reportId },
            update: {
              reviewerId,
              fbApproved: item.fbApproved,
              threadApproved: item.threadApproved,
              commentApproved: item.commentApproved,
              result: item.qcResult || "PASS",
              feedback: item.qcNote || null,
              reviewedAt: new Date(),
            },
            create: {
              dailyReportId: reportId,
              reviewerId,
              fbApproved: item.fbApproved,
              threadApproved: item.threadApproved,
              commentApproved: item.commentApproved,
              result: item.qcResult || "PASS",
              feedback: item.qcNote || null,
              reviewedAt: new Date(),
            },
          });
        } catch (err: any) {
          errorCount++;
          errorLogs.push({ row: item.row, message: err.message || "Lỗi tạo báo cáo seeding." });
        }
      }
    }

    // ==============================================================
    // 4. IMPORT THƯỞNG VIRAL (EXCEL)
    // ==============================================================
    else if (type === "thuong-viral") {
      const bonusTiers = await prisma.viralBonusTier.findMany({
        orderBy: [{ minLikes: "desc" }],
      });

      for (const item of items) {
        try {
          const shiftDateObj = new Date(`${item.submittedAt}T00:00:00Z`);

          const weekInfo = getISOWeekAndYear(shiftDateObj);
          let shift = await prisma.shiftRegistration.findUnique({
            where: {
              userId_shiftDate_shiftType: {
                userId: item.userId,
                shiftDate: shiftDateObj,
                shiftType: item.shiftType,
              },
            },
          });

          if (!shift) {
            shift = await prisma.shiftRegistration.create({
              data: {
                userId: item.userId,
                shiftDate: shiftDateObj,
                shiftType: item.shiftType,
                workMode: "ONLINE",
                status: "COMPLETED",
                weekNumber: weekInfo.weekNumber,
                year: weekInfo.year,
                note: "Tự động tạo từ Thưởng Viral",
              },
            });
          }

          let report = await prisma.dailyReport.findUnique({
            where: { shiftRegistrationId: shift.id },
          });

          if (!report) {
            report = await prisma.dailyReport.create({
              data: {
                userId: item.userId,
                shiftRegistrationId: shift.id,
                reportDate: shiftDateObj,
                shiftType: item.shiftType,
                viralPostLinks: JSON.stringify([item.postUrl]),
                submittedAt: shiftDateObj,
              },
            });
          }

          let finalBonus = item.bonusAmount;
          if (!finalBonus || finalBonus === 0) {
            const matchedTier = bonusTiers.find(
              (t) =>
                t.platform === item.platform &&
                t.contentType === item.contentType &&
                item.likes >= t.minLikes
            );
            if (matchedTier) finalBonus = matchedTier.bonusAmount;
          }

          await prisma.viralPost.create({
            data: {
              userId: item.userId,
              dailyReportId: report.id,
              postUrl: item.postUrl,
              platform: item.platform,
              contentType: item.contentType,
              likes: item.likes,
              bonusAmount: finalBonus || 0,
              shiftType: item.shiftType,
              submittedAt: shiftDateObj,
            },
          });

          createdCount++;
        } catch (err: any) {
          errorCount++;
          errorLogs.push({ row: item.row, message: err.message || "Lỗi tạo bài viết viral." });
        }
      }
    }

    return NextResponse.json({
      success: true,
      type,
      totalProcessed: items.length,
      createdCount,
      updatedCount,
      skippedCount,
      errorCount,
      errors: errorLogs,
    });
  } catch (err: any) {
    console.error("Lỗi khi thực thi import:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: `Quá trình import thất bại: ${err.message || String(err)}` },
      { status: 500 }
    );
  }
}
