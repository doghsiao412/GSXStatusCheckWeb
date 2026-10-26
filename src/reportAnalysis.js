const SA_READY_STATUS = ["抵達門市", "工程師完成"];
const SA_CLOSED_STATUS = ["顧客領回"];

export const emptyResults = () => ({
  unclosed: [],
  notReady: [],
  mismatch: [],
  all: [],
  duplicates: [],
});

const orderKey = (value) => (value || "").toUpperCase().split("-")[0].trim();

const groupOrders = (data, key) => {
  const groups = new Map();
  data.forEach((row, index) => {
    const order = orderKey(row[key]);
    if (!order) return;
    if (!groups.has(order)) groups.set(order, []);
    groups.get(order).push({ row, position: index + 1 });
  });
  return groups;
};

export function analyzeReports(saData, gsxData, { rKey, sKey, poH, idH, statusH }) {
  const results = emptyResults();
  const saGroups = groupOrders(saData, rKey);
  const gsxGroups = groupOrders(gsxData, poH);

  for (const [source, groups, orderH, stateH] of [
    ["SA", saGroups, rKey, sKey],
    ["GSX", gsxGroups, poH, statusH],
  ]) {
    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;
      results.duplicates.push({
        source,
        key,
        rows: entries.map(({ row, position }) => ({
          position,
          orderID: row[orderH],
          repairID: source === "GSX" ? row[idH] || "—" : "",
          status: row[stateH] || "—",
        })),
      });
    }
  }

  saData.forEach((sa, index) => {
    const rmaID = sa[rKey];
    const saStatus = sa[sKey];
    const key = orderKey(rmaID);
    const gsxEntries = gsxGroups.get(key);
    if (!rmaID || !saStatus || saGroups.get(key)?.length !== 1 || gsxEntries?.length !== 1) return;
    const gsx = gsxEntries[0].row;
    const gsxStatus = (gsx[statusH] || "").trim();
    const record = {
      id: `${index}-${rmaID}-${gsx[idH] || ""}`,
      gsxID: gsx[idH] || "-",
      rmaID,
      saStatus,
      gsxStatus,
      isAnomaly: false,
      reason: "",
    };
    const gsxClosed = gsxStatus.includes("已由系統關閉");
    const gsxReady = gsxStatus.includes("待取件");
    const saClosed = SA_CLOSED_STATUS.includes(saStatus);
    const saReady = SA_READY_STATUS.includes(saStatus);
    let category;
    if (saClosed && !gsxClosed) {
      category = "unclosed";
      record.reason = "SA 已領回，但 GSX 尚未關閉";
    } else if (saReady && !gsxReady && !gsxClosed) {
      category = "notReady";
      record.reason = "SA 已完修，但 GSX 狀態未更新";
    } else if (
      (gsxReady || gsxClosed) &&
      ![...SA_READY_STATUS, ...SA_CLOSED_STATUS, "寄送到門市"].includes(saStatus)
    ) {
      category = "mismatch";
      record.reason = "GSX 已完成／待取，但 SA 進度落後";
    }
    if (category) {
      record.isAnomaly = true;
      results[category].push(record);
    }
    results.all.push(record);
  });
  return results;
}
