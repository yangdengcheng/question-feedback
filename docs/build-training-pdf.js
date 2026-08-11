// 将 training.md 转换为适合发微信群的高清 PDF（图片按原图嵌入，不压缩）。
// 无需 npm 依赖，使用本机 Chrome 无头模式打印。
// 用法：node docs/build-training-pdf.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const DOCS_DIR = __dirname;
const MD_FILE = path.join(DOCS_DIR, "training.md");
const OUT_PDF = path.join(DOCS_DIR, "training-guide.pdf");
const TMP_HTML = path.join(DOCS_DIR, ".training-print.html");
const TMP_PROFILE = path.join(DOCS_DIR, ".chrome-tmp-profile");

// ---------- 1. 定位 Chrome ----------
function findChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    console.error("未找到 Chrome，请确认已安装（用于无头打印 PDF）");
    process.exit(1);
  }
  return found;
}

// ---------- 2. 极简 Markdown → HTML（覆盖 training.md 用到的语法） ----------
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 行内：**加粗**、`代码`
function inline(s) {
  let html = escapeHtml(s);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return html;
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行
    if (!line.trim()) { i++; continue; }

    // 分隔线
    if (/^---+$/.test(line.trim())) { out.push("<hr>"); i++; continue; }

    // 标题
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    // 图片（alt 作为图注）
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      const src = img[2];
      out.push(
        `<figure><img src="${src}" alt="${escapeHtml(img[1])}">` +
        (img[1] ? `<figcaption>${inline(img[1])}</figcaption>` : "") +
        `</figure>`
      );
      i++; continue;
    }

    // 引用块（连续 > 行合并）
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${buf.map((b) => b.trim()).filter(Boolean).map(inline).join("<br>")}</blockquote>`);
      continue;
    }

    // 表格（当前行以 | 开头且下一行是分隔行）
    if (/^\|/.test(line.trim()) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const parseRow = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const headers = parseRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) { rows.push(parseRow(lines[i])); i++; }
      out.push(
        "<table><thead><tr>" + headers.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table>"
      );
      continue;
    }

    // 有序列表（用首项真实数字作 start，保证跨图片后编号续接）
    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    if (ol) {
      const start = parseInt(ol[1], 10);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\.\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      out.push(`<ol${start > 1 ? ` start="${start}"` : ""}>` + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ol>");
      continue;
    }

    // 无序列表
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^-\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ul>");
      continue;
    }

    // 普通段落（连续文本行合并）
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|!\[|\||-\s|\d+\.\s|---)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${buf.map(inline).join("<br>")}</p>`);
  }

  return out.join("\n");
}

// ---------- 3. 打印样式（白底，适合屏幕阅读与打印） ----------
const CSS = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
    color: #1e293b;
    font-size: 12px;
    line-height: 1.75;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 {
    font-size: 22px; color: #0b1120; text-align: center;
    padding-bottom: 10px; margin: 0 0 14px;
    border-bottom: 3px solid #f59e0b;
  }
  h2 {
    font-size: 16px; color: #0b1120;
    border-left: 4px solid #f59e0b; padding-left: 8px;
    margin: 22px 0 10px;
    page-break-after: avoid;
  }
  h3 { font-size: 13.5px; color: #334155; margin: 16px 0 6px; page-break-after: avoid; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  strong { color: #b45309; }
  code {
    font-family: Consolas, "Courier New", monospace;
    background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 3px;
    padding: 1px 4px; font-size: 11px; color: #0f172a;
  }
  blockquote {
    margin: 8px 0; padding: 8px 12px;
    background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;
    color: #78350f; page-break-inside: avoid;
  }
  table {
    width: 100%; border-collapse: collapse; margin: 8px 0;
    font-size: 11.5px; page-break-inside: avoid;
  }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
  th { background: #f8fafc; color: #0f172a; }
  figure { margin: 10px 0; text-align: center; page-break-inside: avoid; }
  figure img {
    max-width: 100%; height: auto;
    border: 1px solid #e2e8f0; border-radius: 6px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, .08);
  }
  figcaption { font-size: 10.5px; color: #64748b; margin-top: 4px; }
  hr { border: none; border-top: 1px dashed #cbd5e1; margin: 16px 0; }
`;

// ---------- 主流程 ----------
function main() {
  const md = fs.readFileSync(MD_FILE, "utf-8");

  // 校验图片是否齐全
  const missing = [...md.matchAll(/\]\((\.\/images\/[^)]+)\)/g)]
    .map((m) => m[1])
    .filter((rel) => !fs.existsSync(path.join(DOCS_DIR, rel)));
  if (missing.length) {
    console.error("缺少以下图片，请先补齐：\n  " + missing.join("\n  "));
    process.exit(1);
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>问题反馈工单平台 · 图文使用指南</title>
<style>${CSS}</style>
</head>
<body>
${mdToHtml(md)}
</body>
</html>`;
  fs.writeFileSync(TMP_HTML, html, "utf-8");

  const chrome = findChrome();
  fs.mkdirSync(TMP_PROFILE, { recursive: true });

  const args = [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    `--user-data-dir=${TMP_PROFILE}`,
    "--no-pdf-header-footer",
    "--virtual-time-budget=20000",
    `--print-to-pdf=${OUT_PDF}`,
    pathToFileURL(TMP_HTML).href,
  ];
  console.log("正在生成 PDF …");
  const r = spawnSync(chrome, args, { stdio: "inherit" });
  if (r.status !== 0 || !fs.existsSync(OUT_PDF)) {
    console.error("PDF 生成失败");
    process.exit(1);
  }

  // 清理临时文件（Chrome 可能仍持有锁，失败不影响结果）
  try { fs.rmSync(TMP_HTML, { force: true }); } catch {}
  try { fs.rmSync(TMP_PROFILE, { recursive: true, force: true }); } catch {}

  const mb = (fs.statSync(OUT_PDF).size / 1024 / 1024).toFixed(2);
  console.log(`\n完成：${OUT_PDF}（${mb} MB），可直接发微信群。`);
}

main();
