function dateCell(value) {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (typeof value === "number" && typeof XLSX !== "undefined" && XLSX.SSF) {
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const mm = String(parsed.m).padStart(2, "0");
        const dd = String(parsed.d).padStart(2, "0");
        return `${parsed.y}-${mm}-${dd}`;
      }
    } catch {}
  }
  return s;
}

function buildWorkbook(list) {
  const headers = EXCEL_COLUMNS.map((c) => c.header);
  const rows = list.map((p, i) => {
    const rec = enrich(p);
    return EXCEL_COLUMNS.map((c) => {
      if (c.key === "_index") return i + 1;
      const v = rec[c.key];
      if (v == null) return "";
      return v;
    });
  });
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = EXCEL_COLUMNS.map((c) => ({
    wch: Math.min(22, Math.max(8, c.header.length + 4))
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "名單");
  return wb;
}

function downloadExcel(list) {
  const wb = buildWorkbook(list);
  const stamp = todayISO().replace(/-/g, "");
  XLSX.writeFile(wb, `準保戶市場開發名單-${stamp}.xlsx`);
}

function parseSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("無法讀取檔案"));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
        resolve(rowsToProspects(aoa));
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function rowsToProspects(aoa) {
  if (!aoa || aoa.length < 2) return [];
  let headerRow = 0;
  for (let i = 0; i < Math.min(5, aoa.length); i++) {
    const row = (aoa[i] || []).map((c) => String(c).trim());
    if (row.includes("姓名")) {
      headerRow = i;
      break;
    }
  }
  const headers = (aoa[headerRow] || []).map((c) => String(c).trim());
  const keyOf = {};
  EXCEL_COLUMNS.forEach((c) => {
    const idx = headers.indexOf(c.header);
    if (idx >= 0) keyOf[c.key] = idx;
  });
  if (keyOf.name == null) {
    throw new Error("找不到「姓名」欄位，請確認是本工具或工作簿匯出的檔案。");
  }
  const out = [];
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const name = String(row[keyOf.name] ?? "").trim();
    if (!name) continue;
    const p = { id: uid(), isDemo: name.includes("示範") && name.includes("虛構") };
    EXCEL_COLUMNS.forEach((c) => {
      if (c.exportOnly || c.key === "_index") return;
      const idx = keyOf[c.key];
      if (idx == null) return;
      let val = row[idx];
      if (c.key === "contactDate" || c.key === "followDate") val = dateCell(val);
      else if (c.key === "age") val = val === "" || val == null ? "" : String(val).trim();
      else val = val == null ? "" : String(val).trim();
      if (!c.computed) p[c.key] = val;
    });
    out.push(enrich(p));
  }
  return out;
}
