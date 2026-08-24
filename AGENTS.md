# AGENTS — AI Agent 指引（專案級）

目的：幫助 AI 代理（如 Copilot / Claude / 等）快速理解本專案、常用指令與注意事項，能安全且最小改動地進行開發或提議修改。

快速上手
- 啟動開發伺服器：`npm run dev`
- 本機預覽（已 build）：`npm run preview`
- 建置：`npm run build`
- 部署到 GitHub Pages：`npm run deploy`（含 `predeploy`）

關鍵檔案
- 專案說明與使用方式：[README.md](README.md)
- 入口：`src/main.jsx` → 元件：`src/App.jsx`（主要 UI 與 CSV 處理邏輯）
- 套件與腳本：[package.json](package.json)

架構與慣例（精簡）
- 前端：React + Vite。樣式使用 TailwindCSS（請避免改動全域 Tailwind 設定，除非經過討論）。
- 資料處理：CSV 在瀏覽器端解析，程式碼位於 `src/App.jsx`（包含 UTF-8 / Big5 自動偵測與自製 CSV 切割器）。
- 隱私說明：所有資料僅在瀏覽器端處理，不會上傳至網路（見 README）。修改或測試時請確保維持此行為。

對 AI 代理的建議工作流程
- 首先閱讀並引用現有文件（例如 [README.md](README.md)），**不要複製大量文件內容**。
- 小幅變更：直接修改相應檔案並附上簡短說明與測試步驟。
- 有破壞性或跨區域改動：先提出 PR 建議草案，並在 PR 說明中列出驗證步驟。
- 執行本機檢查：使用 `npm run dev` 在瀏覽器中驗證 UI 與主要流程（載入 CSV、分析、匯出）。

Claude 專用：請參閱 [CLAUDE.md](CLAUDE.md)

聯絡與回報
- 若有不確定的設計或需求，請在提交修改前開 issue 並標註維護者。
