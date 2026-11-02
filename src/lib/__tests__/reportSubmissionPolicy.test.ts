import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSubmission, type SubmissionInput } from "../reportSubmissionPolicy";

// Thứ Tư 28/10/2026, ca sáng 08:30 - 12:30 (giờ Việt Nam)
const WEDNESDAY = new Date("2026-10-28T00:00:00.000Z");
const vn = (iso: string) => new Date(`${iso}+07:00`);

function input(overrides: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    shiftDate: WEDNESDAY,
    shiftTime: { startTime: "08:30", endTime: "12:30" },
    checkInAt: vn("2026-10-28T08:35:00"),
    linkCountsAtShiftEnd: null,
    specialReopen: null,
    now: vn("2026-10-28T10:00:00"),
    rules: { lateCheckinMinutes: 60, postShiftEditMinutes: 60, participationThresholdPercent: 70 },
    kpi: { fbPerShift: 10, threadPerShift: 4 },
    ...overrides,
  };
}

test("nhân sự đã Vào ca đúng hạn được nộp tự do trong giờ ca", () => {
  const decision = evaluateSubmission(input());

  assert.equal(decision.phase, "IN_SHIFT");
  assert.equal(decision.canSubmit, true);
  assert.equal(decision.canDeleteApprovedLinks, true);
  assert.deepEqual(decision.closesAt, vn("2026-10-28T12:30:00"));
});

test("trước giờ bắt đầu ca thì chưa được nộp", () => {
  const decision = evaluateSubmission(input({ checkInAt: null, now: vn("2026-10-28T08:00:00") }));

  assert.equal(decision.phase, "BEFORE_SHIFT");
  assert.equal(decision.canSubmit, false);
});

test("đã đến giờ ca nhưng chưa Vào ca thì phải Vào ca trước khi nộp, hạn là 60 phút đầu ca", () => {
  const decision = evaluateSubmission(input({ checkInAt: null, now: vn("2026-10-28T09:00:00") }));

  assert.equal(decision.phase, "AWAITING_CHECKIN");
  assert.equal(decision.canSubmit, false);
  assert.deepEqual(decision.closesAt, vn("2026-10-28T09:30:00"));
});

test("quá 60 phút đầu ca mà chưa Vào ca thì ca bị khóa (Vào muộn quá hạn)", () => {
  const decision = evaluateSubmission(input({ checkInAt: null, now: vn("2026-10-28T09:31:00") }));

  assert.equal(decision.phase, "LATE_LOCKED");
  assert.equal(decision.canSubmit, false);
});

test("Vào ca sau mốc 60 phút cũng bị coi là Vào muộn quá hạn", () => {
  const decision = evaluateSubmission(input({ checkInAt: vn("2026-10-28T09:45:00"), now: vn("2026-10-28T10:00:00") }));

  assert.equal(decision.phase, "LATE_LOCKED");
});

test("hết ca và đạt ngưỡng (7 FB, 3 Thread) thì được sửa thêm 60 phút nhưng không được xóa link đã duyệt", () => {
  const decision = evaluateSubmission(
    input({ linkCountsAtShiftEnd: { fb: 7, thread: 3 }, now: vn("2026-10-28T12:45:00") })
  );

  assert.equal(decision.phase, "POST_SHIFT_EDIT");
  assert.equal(decision.canSubmit, true);
  assert.equal(decision.canDeleteApprovedLinks, false);
  assert.equal(decision.capAtKpi, false);
  assert.deepEqual(decision.closesAt, vn("2026-10-28T13:30:00"));
});

test("ngưỡng Thread làm tròn lên: 4 x 70% = 2,8 nên 2 link Thread là không đạt", () => {
  const decision = evaluateSubmission(
    input({ linkCountsAtShiftEnd: { fb: 10, thread: 2 }, now: vn("2026-10-28T12:45:00") })
  );

  assert.equal(decision.phase, "BELOW_THRESHOLD");
  assert.equal(decision.canSubmit, false);
});

test("ngưỡng tính theo từng loại: đủ Thread nhưng chỉ 6 FB là không đạt", () => {
  const decision = evaluateSubmission(
    input({ linkCountsAtShiftEnd: { fb: 6, thread: 4 }, now: vn("2026-10-28T12:45:00") })
  );

  assert.equal(decision.phase, "BELOW_THRESHOLD");
});

test("hết ca mà chưa có báo cáo nào thì không đạt ngưỡng", () => {
  const decision = evaluateSubmission(input({ linkCountsAtShiftEnd: null, now: vn("2026-10-28T12:45:00") }));

  assert.equal(decision.phase, "BELOW_THRESHOLD");
});

test("sau Cửa sổ sửa sau ca, ca đạt ngưỡng được Nộp bù tuần đến hết Chủ nhật, giới hạn theo KPI", () => {
  const decision = evaluateSubmission(
    input({ linkCountsAtShiftEnd: { fb: 7, thread: 3 }, now: vn("2026-10-30T21:00:00") })
  );

  assert.equal(decision.phase, "WEEKLY_MAKEUP");
  assert.equal(decision.canSubmit, true);
  assert.equal(decision.canDeleteApprovedLinks, false);
  assert.equal(decision.capAtKpi, true);
  assert.deepEqual(decision.closesAt, vn("2026-11-01T23:59:59.999"));
});

test("qua Chủ nhật 23:59 thì ca bị khóa hẳn", () => {
  const decision = evaluateSubmission(
    input({ linkCountsAtShiftEnd: { fb: 10, thread: 4 }, now: vn("2026-11-02T08:00:00") })
  );

  assert.equal(decision.phase, "CLOSED");
  assert.equal(decision.canSubmit, false);
});

test("ca tối Chủ nhật vẫn được sửa đủ 60 phút sau ca, sang 00:59 thứ Hai", () => {
  const sundayEvening = {
    shiftDate: new Date("2026-11-01T00:00:00.000Z"),
    shiftTime: { startTime: "20:00", endTime: "24:00" },
    checkInAt: vn("2026-11-01T20:05:00"),
    linkCountsAtShiftEnd: { fb: 7, thread: 3 },
  };

  const during = evaluateSubmission(input({ ...sundayEvening, now: vn("2026-11-02T00:30:00") }));
  assert.equal(during.phase, "POST_SHIFT_EDIT");
  assert.deepEqual(during.closesAt, vn("2026-11-02T01:00:00"));

  const after = evaluateSubmission(input({ ...sundayEvening, now: vn("2026-11-02T01:01:00") }));
  assert.equal(after.phase, "CLOSED");
});

test("Mở bù đặc cách còn hiệu lực ghi đè mọi trạng thái khóa (kể cả không đạt ngưỡng hoặc quá Chủ Nhật)", () => {
  const decision = evaluateSubmission(
    input({
      linkCountsAtShiftEnd: { fb: 0, thread: 0 },
      specialReopen: { until: vn("2026-11-05T12:00:00") },
      now: vn("2026-11-04T10:00:00"),
    })
  );

  assert.equal(decision.phase, "SPECIAL_REOPEN");
  assert.equal(decision.canSubmit, true);
  assert.equal(decision.canDeleteApprovedLinks, false);
  assert.deepEqual(decision.closesAt, vn("2026-11-05T12:00:00"));
});

test("Mở bù đặc cách khi đã hết hạn sẽ trở về trạng thái khóa", () => {
  const decision = evaluateSubmission(
    input({
      linkCountsAtShiftEnd: { fb: 0, thread: 0 },
      specialReopen: { until: vn("2026-11-03T12:00:00") },
      now: vn("2026-11-04T10:00:00"),
    })
  );

  assert.equal(decision.phase, "CLOSED");
  assert.equal(decision.canSubmit, false);
});


