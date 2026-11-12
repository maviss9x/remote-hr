import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_KPI, getDefaultKpiConfig, getUserEffectiveKpi } from "../kpiService";

test("FALLBACK_KPI contains production standard defaults", () => {
  assert.equal(FALLBACK_KPI.fbPerShift, 10);
  assert.equal(FALLBACK_KPI.threadPerShift, 4);
  assert.equal(FALLBACK_KPI.commentPerShift, 50);
  assert.equal(FALLBACK_KPI.minShiftsPerWeek, 5);
});

test("getUserEffectiveKpi returns default values when user has no custom config", async () => {
  const defaultKpi = await getDefaultKpiConfig();
  const effectiveKpi = await getUserEffectiveKpi(999999);
  assert.equal(effectiveKpi.isCustom, false);
  assert.equal(effectiveKpi.fbPerShift, defaultKpi.fbPerShift);
  assert.equal(effectiveKpi.threadPerShift, defaultKpi.threadPerShift);
  assert.equal(effectiveKpi.commentPerShift, defaultKpi.commentPerShift);
  assert.equal(effectiveKpi.minShiftsPerWeek, defaultKpi.minShiftsPerWeek);
  process.exit(0);
});
