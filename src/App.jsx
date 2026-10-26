import React, { useMemo, useRef, useState } from "react";

import { analyzeReports, emptyResults } from "./reportAnalysis.js";

const VERSION = "v1.7";
const GSX_REQUIRED_STATUSES = [
  "已退回更換完成的設備",
  "已退回濫用的設備",
  "已退回無法重現故障的設備",
  "已退回維修完成的設備",
  "待取件",
  "待更換的設備",
  "正在等待零件",
  "維修中",
  "維修已從處理中釋放",
  "退回 - 無購買證明",
  "退回 - 遭竄改",
];

const rmaTicketUrl = (rmaID) =>
  `https://rma0.studioarma.com/rma/?m=ticket-common&op=view&id=${encodeURIComponent(rmaID)}`;

const Icon = ({ name, size = 18 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  const paths = {
    sparkle: (
      <>
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        <path d="M5 3v4M3 5h4M19 17v4m-2-2h4" />
      </>
    ),
    file: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h6" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m0 0L7 8m5-5 5 5" />
        <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </>
    ),
    check: <path d="m20 6-11 11-5-5" />,
    alert: (
      <>
        <path d="m10.3 3.6-8.1 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.4l-8.1-14a2 2 0 0 0-3.3 0Z" />
        <path d="M12 9v4m0 4h.01" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5M12 15V3" />
      </>
    ),
    external: (
      <>
        <path d="M15 3h6v6m-11 5L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    close: <path d="m18 6-12 12M6 6l12 12" />,
    clipboard: (
      <>
        <rect width="13" height="13" x="8" y="8" rx="2" ry="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
};

const splitCsvLine = (line, delimiter) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, "").trim());
};

const parseCSV = (text) => {
  if (!text) return { data: [], headers: [] };
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim());
  if (!lines.length) return { data: [], headers: [] };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map((header) =>
    header.replace(/[^\x20-\x7E\u4E00-\u9FFF]/g, ""),
  );
  const data = lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      if (header) row[header] = values[index] || "";
    });
    return row;
  });
  return { data, headers };
};

function FileDropZone({ title, hint, fileName, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const accept = (file) => {
    if (file) onFile(file);
  };
  return (
    <section
      className={`file-zone ${dragging ? "is-dragging" : ""} ${fileName ? "has-file" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        accept(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="file-icon">
        <Icon name={fileName ? "check" : "upload"} size={20} />
      </div>
      <div className="file-copy">
        <strong>{title}</strong>
        <span>{fileName || hint}</span>
      </div>
      <button
        className="quiet-button"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {fileName ? "更換檔案" : "選擇檔案"}
      </button>
    </section>
  );
}

export default function App() {
  const [saData, setSaData] = useState([]);
  const [gsxData, setGsxData] = useState([]);
  const [saHeaders, setSaHeaders] = useState([]);
  const [gsxHeaders, setGsxHeaders] = useState([]);
  const [saFileName, setSaFileName] = useState("");
  const [gsxFileName, setGsxFileName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("等待選擇兩份報表");
  const [results, setResults] = useState(emptyResults);
  const analysisTimer = useRef(null);
  const fileReaders = useRef({ SA: null, GSX: null });
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedIDs, setSelectedIDs] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: "" });
  const [showPromptModal, setShowPromptModal] = useState(true);

  const triggerToast = (message) => {
    setToast({ show: true, message });
    window.clearTimeout(window.__gsxToastTimer);
    window.__gsxToastTimer = window.setTimeout(
      () => setToast({ show: false, message: "" }),
      2200,
    );
  };
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      triggerToast(`已複製：${text}`);
    } catch {
      triggerToast("無法存取剪貼簿");
    }
  };
  const loadFile = (file, type) => {
    if (!file) return;
    window.clearTimeout(analysisTimer.current);
    setIsAnalyzing(false);
    setResults(emptyResults());
    setSelectedIDs(new Set());
    setSelectedTab(0);
    setStatusMessage(`正在載入 ${type} 報表，請重新比對`);
    if (type === "SA") {
      setSaFileName(file.name);
      setSaData([]);
      setSaHeaders([]);
    } else {
      setGsxFileName(file.name);
      setGsxData([]);
      setGsxHeaders([]);
    }
    fileReaders.current[type]?.abort();
    const reader = new FileReader();
    fileReaders.current[type] = reader;
    reader.onerror = () => {
      if (fileReaders.current[type] !== reader) return;
      setStatusMessage(`${type} 報表讀取失敗，請重新選擇檔案`);
    };
    reader.onload = (event) => {
      if (fileReaders.current[type] !== reader) return;
      const buffer = event.target.result;
      let content = new TextDecoder("utf-8").decode(buffer);
      const looksUtf8 =
        content.includes("單號") ||
        content.includes("維修") ||
        content.includes("採購");
      if (!looksUtf8 && buffer.byteLength > 10) {
        try {
          content = new TextDecoder("big5").decode(buffer);
        } catch {
          /* UTF-8 is retained when Big5 is unavailable. */
        }
      }
      const parsed = parseCSV(content);
      if (type === "SA") {
        setSaData(parsed.data);
        setSaHeaders(parsed.headers);
      } else {
        setGsxData(parsed.data);
        setGsxHeaders(parsed.headers);
      }
      setStatusMessage(
        `${type} 載入成功 · ${parsed.data.length.toLocaleString()} 筆資料，請重新比對`,
      );
    };
    reader.readAsArrayBuffer(file);
  };
  const analyze = () => {
    if (!saData.length || !gsxData.length) {
      setStatusMessage("請先載入 SA 與 GSX 兩份檔案");
      return;
    }
    setIsAnalyzing(true);
    setStatusMessage("正在比對資料…");
    setSelectedIDs(new Set());
    analysisTimer.current = window.setTimeout(() => {
      const rKey = saHeaders.find((header) => header === "單號");
      const sKey = saHeaders.find((header) => header === "狀態");
      if (!rKey || !sKey) {
        setIsAnalyzing(false);
        const missing = [!rKey && "「單號」", !sKey && "「狀態」"].filter(
          Boolean,
        );
        setStatusMessage(`SA 報表格式錯誤：缺少必要欄位 ${missing.join("、")}`);
        return;
      }
      const poH = gsxHeaders.find((header) => header === "採購訂單");
      const idH = gsxHeaders.find(
        (header) => header === "維修" || header === "維修 ID",
      );
      const statusH = gsxHeaders.find((header) => header === "維修狀態");
      if (!poH || !idH || !statusH) {
        setIsAnalyzing(false);
        const missing = [
          !poH && "「採購訂單」",
          !idH && "「維修」或「維修 ID」",
          !statusH && "「維修狀態」",
        ].filter(Boolean);
        setStatusMessage(
          `GSX 報表格式錯誤：缺少必要欄位 ${missing.join("、")}`,
        );
        return;
      }
      const nextResults = analyzeReports(saData, gsxData, {
        rKey, sKey, poH, idH, statusH,
      });
      setResults(nextResults);
      setSelectedIDs(new Set(nextResults.unclosed.map((row) => row.id)));
      setIsAnalyzing(false);
      setSelectedTab(0);
      setStatusMessage(
        `分析完成 · 成功匹配 ${nextResults.all.length.toLocaleString()} 筆資料` +
          (nextResults.duplicates.length
            ? ` · ${nextResults.duplicates.length} 組重複單號已排除`
            : ""),
      );
    }, 380);
  };
  const currentList = useMemo(
    () =>
      [results.unclosed, results.notReady, results.mismatch, results.all][
        selectedTab
      ],
    [results, selectedTab],
  );
  const exportCSV = () => {
    const list = results.unclosed.filter((row) => selectedIDs.has(row.id));
    if (!list.length) {
      triggerToast("請先勾選要匯出的項目");
      return;
    }
    const csv =
      '\uFEFFStatus,Repair ID,Repair Status,Technician ID,Part Details,Error Message\n,repairId,repairStatus,technicianId,"parts[number, kgbDeviceDetail.id]",\n' +
      list.map((row) => `,${row.gsxID},SPCM,,,`).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    link.download = `GSX_Upload_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    triggerToast(`已匯出 ${list.length} 筆資料`);
  };
  const toggle = (id) =>
    setSelectedIDs((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const tabs = [
    { label: "GSX 未關閉", count: results.unclosed.length, tone: "red" },
    { label: "GSX 未待取", count: results.notReady.length, tone: "orange" },
    { label: "SA 狀態需注意", count: results.mismatch.length, tone: "orange" },
    { label: "所有匹配", count: results.all.length, tone: "neutral" },
  ];
  const badge = (status) =>
    status.includes("已由系統關閉")
      ? "badge neutral"
      : status.includes("待取件")
        ? "badge green"
        : "badge blue";

  return (
    <div className="liquid-page">
      <div className="ambient-field" aria-hidden="true">
        <i className="orb one" />
        <i className="orb two" />
        <i className="orb three" />
        <i className="orb four" />
      </div>
      {showPromptModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-note-title"
        >
          <div className="liquid-modal">
            <div className="modal-title">
              <span className="warning-icon">
                <Icon name="alert" />
              </span>
              <div>
                <h2 id="report-note-title">匯入前的小提醒</h2>
                <p>請確認 GSX 報表已包含「維修狀態」欄位。</p>
              </div>
            </div>
            <div className="status-list">
              {GSX_REQUIRED_STATUSES.map((status) => (
                <span key={status}>{status}</span>
              ))}
            </div>
            <button
              className="primary-button modal-action"
              onClick={() => setShowPromptModal(false)}
            >
              我知道了 <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
      )}
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="sparkle" />
            </span>
            <div>
              <h1>GSX 狀態檢查</h1>
              <p>
                 <b>{VERSION}</b>
              </p>
            </div>
          </div>
          <div className="status-pill">
            <span
              className={`status-dot ${saData.length && gsxData.length ? "ready" : ""}`}
            />
            {statusMessage}
          </div>
        </header>
        <section className="hero glass-panel">
          <div className="hero-copy">
            <span className="eyebrow">下班ㄌ下班ㄌ</span>
            <h2>
              沒有這個關單真的
              <br />
              超 麻 煩
            </h2>
            <p>匯入 SA 與 GSX 報表，找出可以關單跟忘記改狀態的案件。</p>
          </div>
          <div className="hero-metric">
            <span>已載入</span>
            <strong>{(saData.length + gsxData.length).toLocaleString()}</strong>
            <small>筆原始資料</small>
          </div>
        </section>
        <section className="upload-grid">
          <FileDropZone
            title="SA 報表(Report..."
            hint="拖放 CSV，或從 Finder 選擇"
            fileName={saFileName}
            onFile={(file) => loadFile(file, "SA")}
          />
          <FileDropZone
            title="GSX 維修報表(repair_data..."
            hint="拖放 CSV，或從 Finder 選擇"
            fileName={gsxFileName}
            onFile={(file) => loadFile(file, "GSX")}
          />
        </section>
        <button
          className="primary-button analyze-button"
          onClick={analyze}
          disabled={isAnalyzing || !saData.length || !gsxData.length}
        >
          {isAnalyzing ? <span className="spinner" /> : <Icon name="sparkle" />}{" "}
          {isAnalyzing ? "正在分析…" : "開始比對報表"}
        </button>
        <section className="results-area">
          <div className="results-head">
            <div>
              <span className="eyebrow">Analysis results</span>
              <h2>比對結果</h2>
            </div>
            <div className="segmented" role="tablist">
              {tabs.map((tab, index) => (
                <button
                  key={tab.label}
                  role="tab"
                  aria-selected={selectedTab === index}
                  onClick={() => setSelectedTab(index)}
                  className={selectedTab === index ? "active" : ""}
                >
                  {tab.label}
                  <b className={tab.tone}>{tab.count}</b>
                </button>
              ))}
            </div>
          </div>
          {results.duplicates.length > 0 && (
            <aside className="duplicate-warning" aria-labelledby="duplicate-title">
              <h3 id="duplicate-title">
                <Icon name="alert" size={17} />
                發現 {results.duplicates.length} 組重複單號
              </h3>
              <p>以下單號未納入自動比對與匯出，請先確認報表。比對單號會忽略大小寫、前後空白及「-」後綴。</p>
              <details>
                <summary>查看重複明細</summary>
                <div className="duplicate-details">
                  {results.duplicates.map((group) => (
                    <section key={`${group.source}-${group.key}`}>
                      <strong>{group.source} · {group.key}（{group.rows.length} 筆）</strong>
                      <ul>
                        {group.rows.map((row) => (
                          <li key={row.position}>
                            第 {row.position} 筆資料 · {row.orderID}
                            {row.repairID && ` · 維修 ${row.repairID}`} · {row.status}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </details>
            </aside>
          )}
          <div className="table-card">
            {selectedTab === 0 && currentList.length > 0 && (
              <div className="table-actions">
                <span>
                  已選取 <b>{selectedIDs.size}</b> 筆資料
                </span>
                <div>
                  <button
                    className="small-button"
                    onClick={() =>
                      setSelectedIDs(new Set(currentList.map((row) => row.id)))
                    }
                  >
                    全選
                  </button>
                  <button className="export-button" onClick={exportCSV}>
                    <Icon name="download" size={15} /> 匯出 GSX 上傳清單
                  </button>
                </div>
              </div>
            )}
            {currentList.length === 0 ? (
              <div className="empty-state">
                <span>
                  <Icon name="file" size={25} />
                </span>
                <strong>這裡暫時沒有資料</strong>
                <p>匯入報表並開始比對後，結果會顯示於此。</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {selectedTab === 0 && <th className="check-col">勾選</th>}
                      <th>GSX 單號</th>
                      <th>RMA 單號</th>
                      <th>GSX 狀態</th>
                      <th>SA 狀態</th>
                      <th>檢查結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentList.map((row) => (
                      <tr key={row.id}>
                        {selectedTab === 0 && (
                          <td className="check-col">
                            <input
                              type="checkbox"
                              aria-label={`選取 ${row.gsxID}`}
                              checked={selectedIDs.has(row.id)}
                              onChange={() => toggle(row.id)}
                            />
                          </td>
                        )}
                        <td>
                          <span className="id-cell">
                            <a
                              className="id-link"
                              href={`https://gsx2.apple.com/repairs/${row.gsxID}`}
                              target="_blank"
                              rel="noreferrer"
                              title="在 GSX 開啟維修單"
                            >
                              {row.gsxID}
                              <Icon name="external" size={12} />
                            </a>
                            <button
                              type="button"
                              className="id-copy"
                              title="複製 GSX 單號"
                              aria-label={`複製 ${row.gsxID}`}
                              onClick={() => copyToClipboard(row.gsxID)}
                            >
                              <Icon name="clipboard" size={12} />
                            </button>
                          </span>
                        </td>
                        <td>
                          <span className="id-cell muted">
                            <a
                              className="id-link"
                              href={rmaTicketUrl(row.rmaID)}
                              target="_blank"
                              rel="noreferrer"
                              title="在 Studio ARMA 開啟 RMA 工單"
                            >
                              {row.rmaID}
                              <Icon name="external" size={12} />
                            </a>
                            <button
                              type="button"
                              className="id-copy"
                              title="複製 RMA 單號"
                              aria-label={`複製 ${row.rmaID}`}
                              onClick={() => copyToClipboard(row.rmaID)}
                            >
                              <Icon name="clipboard" size={12} />
                            </button>
                          </span>
                        </td>
                        <td>
                          <span className={badge(row.gsxStatus)}>
                            {row.gsxStatus || "—"}
                          </span>
                        </td>
                        <td>
                          <span className="sa-status">{row.saStatus}</span>
                        </td>
                        <td>
                          {row.isAnomaly ? (
                            <span className="reason">
                              <i />
                              {row.reason}
                            </span>
                          ) : (
                            <span className="clear">
                              <Icon name="check" size={14} /> 正常
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        <footer>GSX Status Checker · 僅於本機瀏覽器處理資料</footer>
      </main>
      <div className={`toast ${toast.show ? "visible" : ""}`}>
        <span>
          <Icon name="check" size={15} />
        </span>
        {toast.message}
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  * { box-sizing: border-box; } button, input { font: inherit; } button { cursor: pointer; } button:disabled { cursor: not-allowed; }
  .liquid-page { min-height: 100vh; overflow: hidden; position: relative; color: #f5f5f7; background: radial-gradient(ellipse 74% 66% at 45% -18%, #5b4c4c 0%, #3e383b 37%, #292a2e 70%, #1e2024 100%); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif; letter-spacing: -.01em; }
  .ambient-field { position: fixed; inset: 0; pointer-events: none; overflow: hidden; } .orb { position: absolute; display: block; border-radius: 999px; filter: blur(96px); opacity: .2; animation: drift 16s ease-in-out infinite alternate; } .orb.one { width: 34rem; height: 34rem; background:#9b6253; top:-17rem; left:7%; } .orb.two { width: 24rem; height:24rem; background:#74556e; right:-10rem; top:25%; animation-delay:-6s; } .orb.three { width:21rem; height:21rem; background:#3f6573; left:-10rem; bottom:4%; animation-delay:-10s; } .orb.four { width:16rem; height:16rem; background:#d8c5b7; opacity:.06; top:34%; left:46%; animation-delay:-3s; }
  .app-shell { position:relative; z-index:1; width:min(1160px, calc(100% - 32px)); margin:0 auto; padding:32px 0 26px; } .topbar { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:28px; } .brand { display:flex; gap:12px; align-items:center; } .brand-mark { display:grid; place-items:center; width:38px; height:38px; color:#fff; border:1px solid rgba(255,255,255,.26); border-radius:13px; background:linear-gradient(145deg, rgba(87,185,255,.95), rgba(0,94,197,.87)); box-shadow:inset 0 1px rgba(255,255,255,.38), 0 8px 20px rgba(0,68,160,.3); } .brand h1 { margin:0; font-size:17px; line-height:1.05; font-weight:700; } .brand p { margin:4px 0 0; color:rgba(235,235,245,.52); font-size:11px; } .brand b { font-weight:600; color:rgba(235,235,245,.72); margin-left:5px; } .status-pill { display:flex; align-items:center; gap:8px; color:rgba(235,235,245,.62); font-size:12px; padding:8px 12px; border:1px solid rgba(255,255,255,.09); border-radius:999px; background:rgba(255,255,255,.045); backdrop-filter:blur(18px); } .status-dot { width:7px; height:7px; border-radius:50%; background:#ff9f0a; box-shadow:0 0 0 3px rgba(255,159,10,.12); } .status-dot.ready { background:#30d158; box-shadow:0 0 0 3px rgba(48,209,88,.12); }
  .glass-panel, .file-zone, .table-card { border:1px solid rgba(255,255,255,.13); background:linear-gradient(135deg, rgba(255,255,255,.105), rgba(255,255,255,.04) 38%, rgba(255,255,255,.025)); box-shadow:inset 0 1px rgba(255,255,255,.19), inset 0 -1px rgba(255,255,255,.035), 0 20px 55px rgba(0,0,0,.2); backdrop-filter:blur(38px) saturate(165%); -webkit-backdrop-filter:blur(38px) saturate(165%); }
  .hero { min-height:204px; padding:31px 36px; display:flex; align-items:center; justify-content:space-between; overflow:hidden; border-radius:28px; position:relative; } .hero:after { content:''; position:absolute; width:290px; height:290px; right:-80px; top:-150px; border-radius:50%; background:radial-gradient(circle, rgba(156,211,255,.19), transparent 68%); } .eyebrow { display:block; color:#76bfff; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; } .hero h2 { font-size:29px; letter-spacing:-.045em; line-height:1.08; margin:7px 0 10px; } .hero p { color:rgba(235,235,245,.58); font-size:13px; margin:0; } .hero-metric { position:relative; z-index:1; min-width:152px; padding:18px 20px; text-align:right; border-left:1px solid rgba(255,255,255,.12); } .hero-metric span, .hero-metric small { display:block; color:rgba(235,235,245,.5); font-size:11px; } .hero-metric strong { display:block; margin:4px 0 1px; font-size:33px; letter-spacing:-.06em; }
  .upload-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px; } .file-zone { border-radius:21px; padding:17px; min-height:92px; display:flex; align-items:center; gap:12px; transition:transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease; } .file-zone:hover { transform:translateY(-1px); border-color:rgba(255,255,255,.22); background:linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,.055)); } .file-zone.is-dragging { transform:scale(1.01); border-color:rgba(84,170,255,.8); background:rgba(32,129,230,.15); box-shadow:inset 0 1px rgba(255,255,255,.25), 0 0 0 3px rgba(18,132,255,.12); } .file-zone.has-file .file-icon { color:#44df74; background:rgba(48,209,88,.12); border-color:rgba(48,209,88,.2); } .file-zone input { display:none; } .file-icon { display:grid; place-items:center; flex:0 0 auto; width:42px; height:42px; color:#8dcaff; border:1px solid rgba(145,205,255,.2); border-radius:14px; background:rgba(70,154,232,.12); } .file-copy { min-width:0; display:flex; flex-direction:column; gap:4px; } .file-copy strong { font-size:14px; } .file-copy span { overflow:hidden; color:rgba(235,235,245,.52); font-size:11px; text-overflow:ellipsis; white-space:nowrap; } .quiet-button { margin-left:auto; padding:7px 10px; flex:0 0 auto; color:rgba(255,255,255,.9); font-size:11px; font-weight:600; border:1px solid rgba(255,255,255,.12); border-radius:9px; background:rgba(255,255,255,.06); transition:background .16s ease; } .quiet-button:hover { background:rgba(255,255,255,.13); }
  .primary-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; color:white; border:1px solid rgba(255,255,255,.27); border-radius:999px; background:linear-gradient(180deg, #1594ff, #0672df); box-shadow:inset 0 1px rgba(255,255,255,.39), inset 0 -1px rgba(0,0,0,.17), 0 10px 25px rgba(0,107,221,.26); font-size:13px; font-weight:700; transition:transform .16s ease, filter .16s ease, box-shadow .16s ease; } .primary-button:hover:not(:disabled) { filter:brightness(1.08); box-shadow:inset 0 1px rgba(255,255,255,.42), 0 13px 30px rgba(0,107,221,.36); } .primary-button:active:not(:disabled) { transform:scale(.985); } .primary-button:disabled { opacity:.43; } .analyze-button { width:100%; min-height:46px; margin:16px 0 38px; } .spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,.35); border-top-color:white; border-radius:50%; animation:spin .65s linear infinite; }
  .results-head { display:flex; align-items:end; justify-content:space-between; gap:18px; margin:0 4px 13px; } .results-head h2 { margin:3px 0 0; font-size:22px; letter-spacing:-.04em; } .segmented { padding:4px; display:flex; gap:2px; border:1px solid rgba(255,255,255,.1); border-radius:999px; background:rgba(255,255,255,.05); box-shadow:inset 0 1px rgba(255,255,255,.1), 0 8px 20px rgba(0,0,0,.13); backdrop-filter:blur(24px); } .segmented button { display:flex; gap:6px; align-items:center; border:0; padding:7px 10px; border-radius:999px; color:rgba(235,235,245,.58); background:transparent; font-size:11px; white-space:nowrap; transition:color .16s ease, background .16s ease, box-shadow .16s ease; } .segmented button:hover { color:#fff; } .segmented button.active { color:#fff; background:linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.09)); box-shadow:inset 0 1px rgba(255,255,255,.25), 0 2px 7px rgba(0,0,0,.17); } .segmented b { min-width:16px; padding:1px 5px; color:#fff; border-radius:999px; background:rgba(255,255,255,.13); font-size:10px; } .segmented b.red { background:rgba(255,69,58,.78); } .segmented b.orange { background:rgba(255,159,10,.78); color:#251600; }
  .duplicate-warning { margin:0 0 16px; padding:16px 20px; border:1px solid rgba(255,159,10,.35); border-radius:18px; background:rgba(255,159,10,.08); color:#ffd29a; font-size:12px; overflow-wrap:anywhere; } .duplicate-warning h3 { display:flex; align-items:center; gap:8px; margin:0 0 8px; font-size:14px; } .duplicate-warning p { margin:0 0 10px; line-height:1.6; } .duplicate-warning summary { cursor:pointer; padding:4px 0; } .duplicate-details { max-height:280px; overflow:auto; margin-top:12px; } .duplicate-details section + section { margin-top:14px; } .duplicate-details ul { margin:6px 0 0; padding-left:20px; line-height:1.8; }
  .table-card { overflow:hidden; min-height:404px; border-radius:25px; } .table-actions { min-height:59px; padding:11px 16px 11px 20px; display:flex; align-items:center; justify-content:space-between; gap:14px; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.028); color:rgba(235,235,245,.57); font-size:12px; } .table-actions b { color:#fff; } .table-actions > div { display:flex; gap:8px; } .small-button, .export-button { border-radius:9px; font-size:11px; font-weight:650; transition:filter .16s ease, transform .16s ease; } .small-button { padding:7px 10px; color:#fff; border:1px solid rgba(255,255,255,.11); background:rgba(255,255,255,.08); } .export-button { display:inline-flex; align-items:center; gap:6px; padding:7px 11px; color:#052b16; border:1px solid rgba(195,255,209,.39); background:linear-gradient(180deg, #50e37a, #30c85e); box-shadow:inset 0 1px rgba(255,255,255,.38); } .small-button:hover, .export-button:hover { filter:brightness(1.08); } .small-button:active, .export-button:active { transform:scale(.98); }
  .table-scroll { overflow:auto; } table { width:100%; min-width:790px; border-collapse:collapse; text-align:left; } th { position:sticky; top:0; z-index:1; padding:13px 18px; color:rgba(235,235,245,.48); border-bottom:1px solid rgba(255,255,255,.075); background:rgba(22,29,39,.73); box-shadow:inset 0 -1px rgba(255,255,255,.035); backdrop-filter:blur(24px); font-size:10px; font-weight:700; letter-spacing:.045em; text-transform:uppercase; } td { padding:13px 18px; border-bottom:1px solid rgba(255,255,255,.06); color:rgba(245,245,247,.84); font-size:12px; } tbody tr { transition:background .15s ease; } tbody tr:last-child td { border-bottom:0; } tbody tr:hover { background:rgba(255,255,255,.043); } .check-col { width:66px; text-align:center; } input[type=checkbox] { appearance:none; width:16px; height:16px; vertical-align:middle; border:1px solid rgba(255,255,255,.27); border-radius:5px; background:rgba(0,0,0,.14); transition:all .13s ease; } input[type=checkbox]:checked { border-color:#0a84ff; background:#0a84ff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m5 12 4 4L19 6' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/12px no-repeat; box-shadow:0 0 0 3px rgba(10,132,255,.12); } .id-cell { display:inline-flex; align-items:center; gap:7px; color:#f4f7ff; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:11px; font-weight:600; } .id-link { display:inline-flex; align-items:center; gap:5px; color:inherit; line-height:1; text-decoration:none; } .id-link:hover { color:#7fc5ff; text-decoration:underline; text-underline-offset:3px; } .id-copy { display:grid; place-items:center; padding:3px; border:0; border-radius:5px; color:#c9e6ff; background:rgba(255,255,255,.1); opacity:0; transition:opacity .15s; } tr:hover .id-copy, .id-copy:focus-visible { opacity:1; } .id-cell.muted { cursor:copy; color:rgba(235,235,245,.66); } .badge { display:inline-flex; max-width:178px; padding:4px 8px; overflow:hidden; border:1px solid; border-radius:999px; text-overflow:ellipsis; white-space:nowrap; font-size:10px; font-weight:650; backdrop-filter:blur(12px); } .badge.neutral { color:#c6c6c8; border-color:rgba(199,199,204,.18); background:rgba(199,199,204,.1); } .badge.green { color:#63ed8a; border-color:rgba(48,209,88,.22); background:rgba(48,209,88,.1); } .badge.blue { color:#80c9ff; border-color:rgba(10,132,255,.22); background:rgba(10,132,255,.1); } .sa-status { color:rgba(255,255,255,.78); } .reason, .clear { display:inline-flex; align-items:center; gap:6px; font-size:11px; } .reason { color:#ffc477; } .reason i { display:block; width:6px; height:6px; border-radius:50%; background:#ff9f0a; box-shadow:0 0 0 3px rgba(255,159,10,.12); } .clear { color:#68e991; }
  .empty-state { height:404px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:rgba(235,235,245,.5); text-align:center; } .empty-state span { display:grid; place-items:center; width:48px; height:48px; margin-bottom:12px; color:rgba(235,235,245,.6); border:1px solid rgba(255,255,255,.1); border-radius:16px; background:rgba(255,255,255,.04); } .empty-state strong { color:rgba(255,255,255,.8); font-size:13px; } .empty-state p { margin:5px 0 0; font-size:11px; } footer { margin:22px 0 0; color:rgba(235,235,245,.32); text-align:center; font-size:10px; }
  .modal-backdrop { position:fixed; z-index:20; inset:0; display:grid; place-items:center; padding:18px; background:rgba(0,0,0,.36); backdrop-filter:blur(24px); } .liquid-modal { width:min(440px, 100%); padding:27px; border:1px solid rgba(255,255,255,.2); border-radius:28px; background:linear-gradient(145deg, rgba(255,255,255,.16), rgba(255,255,255,.065)); box-shadow:inset 0 1px rgba(255,255,255,.3), inset 0 -1px rgba(255,255,255,.04), 0 35px 100px rgba(0,0,0,.46); backdrop-filter:blur(50px) saturate(185%); animation:modal-in .24s ease-out; } .modal-title { display:flex; gap:12px; align-items:flex-start; } .warning-icon { display:grid; place-items:center; flex:0 0 auto; width:38px; height:38px; color:#ffb340; border:1px solid rgba(255,179,64,.24); border-radius:13px; background:rgba(255,159,10,.12); } .modal-title h2 { margin:1px 0 5px; font-size:16px; letter-spacing:-.025em; } .modal-title p { margin:0; color:rgba(235,235,245,.58); font-size:11px; line-height:1.45; } .status-list { display:flex; flex-wrap:wrap; gap:6px; margin:20px 0; padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:15px; background:rgba(0,0,0,.11); } .status-list span { padding:4px 7px; color:rgba(245,245,247,.69); border-radius:7px; background:rgba(255,255,255,.06); font-size:10px; } .modal-action { width:100%; min-height:40px; }
  .toast { position:fixed; z-index:30; left:50%; bottom:24px; display:flex; align-items:center; gap:8px; padding:10px 13px; color:#fff; border:1px solid rgba(255,255,255,.18); border-radius:14px; background:rgba(35,39,47,.78); box-shadow:inset 0 1px rgba(255,255,255,.18), 0 12px 28px rgba(0,0,0,.3); backdrop-filter:blur(24px); font-size:12px; opacity:0; transform:translate(-50%, 14px) scale(.97); pointer-events:none; transition:opacity .2s ease, transform .2s ease; } .toast.visible { opacity:1; transform:translate(-50%, 0) scale(1); } .toast span { display:grid; place-items:center; width:20px; height:20px; color:#063616; border-radius:50%; background:#49dd74; }
  @keyframes drift { to { transform:translate3d(32px, 20px, 0) scale(1.07); } } @keyframes spin { to { transform:rotate(360deg); } } @keyframes modal-in { from { opacity:0; transform:translateY(8px) scale(.98); } to { opacity:1; transform:none; } }
  @media (max-width: 820px) { .topbar, .results-head { align-items:flex-start; flex-direction:column; } .status-pill { max-width:100%; } .hero { padding:27px 24px; } .hero-metric { display:none; } .segmented { width:100%; overflow:auto; } .segmented button { flex:0 0 auto; } } @media (max-width: 610px) { .app-shell { width:min(100% - 22px, 1160px); padding-top:18px; } .upload-grid { grid-template-columns:1fr; } .hero h2 { font-size:25px; } .file-zone { min-height:82px; padding:13px; } .quiet-button { padding:6px 8px; } .table-actions { align-items:flex-start; flex-direction:column; } .table-actions > div { width:100%; } .small-button, .export-button { flex:1; justify-content:center; } .results-head { margin-left:2px; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior:auto !important; animation-duration:.001ms !important; transition-duration:.001ms !important; } }
`;
