import assert from "node:assert/strict";
import test from "node:test";
import { analyzeReports } from "../src/reportAnalysis.js";

const keys = { rKey: "單號", sKey: "狀態", poH: "採購訂單", idH: "維修", statusH: "維修狀態" };
const sa = (id, status) => ({ 單號: id, 狀態: status });
const gsx = (id, repair, status) => ({ 採購訂單: id, 維修: repair, 維修狀態: status });

test("所有匹配與三個異常分頁保留一致的原因，正常案件不誤標", () => {
  const result = analyzeReports(
    [sa("A", "顧客領回"), sa("B", "工程師完成"), sa("C", "維修中"), sa("D", "抵達門市"), sa("E", "顧客領回"), sa("F", "寄送到門市")],
    [gsx("A", "R1", "待取件"), gsx("B", "R2", "維修中"), gsx("C", "R3", "已由系統關閉"), gsx("D", "R4", "待取件"), gsx("E", "R5", "已由系統關閉"), gsx("F", "R6", "待取件")],
    keys,
  );
  for (const category of ["unclosed", "notReady", "mismatch"]) {
    assert.equal(result[category].length, 1);
    const row = result[category][0];
    assert.equal(row.isAnomaly, true);
    assert.ok(row.reason);
    assert.deepEqual(result.all.find((item) => item.id === row.id), row);
  }
  assert.equal(result.all.length, 6);
  assert.equal(result.all.filter((row) => !row.isAnomaly && !row.reason).length, 3);
});

test("GSX 重複採購訂單保留每筆明細，排除整組並繼續比對其他案件", () => {
  const result = analyzeReports(
    [sa("TEST", "顧客領回"), sa("OTHER", "顧客領回")],
    [gsx("test-1", "R1", "維修中"), gsx(" TEST-2 ", "R2", "待取件"), gsx("OTHER", "R3", "待取件")],
    keys,
  );
  assert.deepEqual(result.all.map((row) => row.gsxID), ["R3"]);
  assert.deepEqual(result.unclosed.map((row) => row.gsxID), ["R3"]);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].source, "GSX");
  assert.equal(result.duplicates[0].key, "TEST");
  assert.deepEqual(result.duplicates[0].rows.map((row) => [row.position, row.repairID, row.status]), [[1, "R1", "維修中"], [2, "R2", "待取件"]]);
});

test("SA 重複單號即使狀態不同也不自行挑選，不會重複匯出", () => {
  const result = analyzeReports(
    [sa("TEST-1", "顧客領回"), sa("test-2", "維修中")],
    [gsx("TEST", "R1", "待取件")],
    keys,
  );
  assert.equal(result.all.length, 0);
  assert.equal(result.unclosed.length, 0);
  assert.equal(result.duplicates[0].source, "SA");
  assert.deepEqual(result.duplicates[0].rows.map((row) => row.status), ["顧客領回", "維修中"]);
});

test("空白與未匹配單號不會形成假的重複群組", () => {
  const result = analyzeReports(
    [sa("", "顧客領回"), sa("", "維修中"), sa("UNMATCHED", "顧客領回")],
    [gsx("", "R1", "待取件"), gsx("", "R2", "待取件")],
    keys,
  );
  assert.equal(result.duplicates.length, 0);
  assert.equal(result.all.length, 0);
});
