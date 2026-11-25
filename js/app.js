(() => {
  const $ = (id) => document.getElementById(id);
  const app = $("app");

  const state = {
    list: loadProspects(),
    view: "list",
    query: "",
    sort: "follow",
    filters: {
      source: "",
      priority: "",
      status: "",
      job: "",
      relation: "",
      lifeStage: "",
      city: ""
    },
    editing: null,
    importPending: null,
    charts: {}
  };

  const SORTS = [
    { id: "follow", label: "跟進日" },
    { id: "priority", label: "優先序" },
    { id: "name", label: "姓名" },
    { id: "updated", label: "最近更新" }
  ];

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function confirmDialog(title, msg) {
    return new Promise((resolve) => {
      $("confirmTitle").textContent = title;
      $("confirmMsg").textContent = msg;
      $("confirmOverlay").classList.add("is-open");
      const yes = $("confirmYes");
      const no = $("confirmNo");
      const done = (val) => {
        $("confirmOverlay").classList.remove("is-open");
        yes.onclick = no.onclick = null;
        resolve(val);
      };
      yes.onclick = () => done(true);
      no.onclick = () => done(false);
    });
  }

  function setView(view) {
    state.view = view;
    app.dataset.view = view;
    ["list", "follow", "stats", "guide", "backup"].forEach((v) => {
      const map = {
        list: "viewList",
        follow: "viewFollow",
        stats: "viewStats",
        guide: "viewGuide",
        backup: "viewBackup"
      };
      const el = $(map[v]);
      if (el) el.hidden = v !== view;
    });
    document.querySelectorAll(".nav button").forEach((b) => {
      b.classList.toggle("is-on", b.dataset.view === view);
    });
    if (view === "stats") renderStats();
    if (view === "backup") renderBackupMeta();
    renderFollowBadge();
  }

  function applyFilters(list, { ignoreStatus } = {}) {
    const q = state.query.trim().toLowerCase();
    const f = state.filters;
    return list.filter((p) => {
      if (q) {
        const blob = [p.name, p.company, p.mobile, p.line, p.referrer, p.community, p.notes, p.title, p.honorific]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (f.source && p.source !== f.source) return false;
      if (f.priority && p.priority !== f.priority) return false;
      if (!ignoreStatus && f.status && p.status !== f.status) return false;
      if (f.job && p.job !== f.job) return false;
      if (f.relation && p.relation !== f.relation) return false;
      if (f.lifeStage && p.lifeStage !== f.lifeStage) return false;
      if (f.city && p.city !== f.city) return false;
      return true;
    });
  }

  function sortList(list) {
    const arr = list.slice();
    arr.sort((a, b) => {
      if (state.sort === "name") return (a.name || "").localeCompare(b.name || "", "zh-Hant");
      if (state.sort === "updated") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      if (state.sort === "priority") {
        const d = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
        if (d) return d;
      }
      const af = a.followDate || "9999-99-99";
      const bf = b.followDate || "9999-99-99";
      if (af !== bf) return af.localeCompare(bf);
      return (a.name || "").localeCompare(b.name || "", "zh-Hant");
    });
    return arr;
  }

  function cardHtml(p) {
    const overdue = isOverdue(p);
    const today = isDueToday(p);
    const cls = ["card", overdue ? "is-overdue" : "", today ? "is-today" : ""].filter(Boolean).join(" ");
    const priClass = p.priority === "高優先" ? "high" : p.priority === "中優先" ? "mid" : p.priority ? "low" : "";
    const bits = [p.source, p.sourceDetail, p.job, p.city].filter(Boolean).join(" · ");
    const follow = p.followDate
      ? `下次跟進 ${p.followDate}`
      : "尚未設定跟進日";
    return `<button type="button" class="${cls}" data-id="${escapeHtml(p.id)}">
      <div class="card-top">
        <div>
          <h3 class="card-name">${escapeHtml(p.name)}</h3>
          <p class="card-sub">${escapeHtml(bits || "尚未分類")}</p>
        </div>
      </div>
      <div class="badges">
        ${p.priority ? `<span class="badge ${priClass}">${escapeHtml(p.priority)}</span>` : ""}
        ${p.status ? `<span class="badge st-${escapeHtml(p.status)}">${escapeHtml(p.status)}</span>` : ""}
        ${overdue ? `<span class="badge due">已逾期</span>` : ""}
        ${today ? `<span class="badge today">今日跟進</span>` : ""}
      </div>
      <div class="card-meta">
        <span>${escapeHtml(p.mobile || p.line || p.company || "")}</span>
        <span>${escapeHtml(follow)}</span>
      </div>
    </button>`;
  }

  function emptyHtml(title, text, action) {
    return `<div class="empty">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
      ${action || ""}
    </div>`;
  }

  function renderList() {
    const filtered = sortList(applyFilters(state.list));
    $("countLine").textContent = `共 ${filtered.length} 筆${filtered.length !== state.list.length ? `（全部 ${state.list.length} 筆）` : ""}`;
    if (!state.list.length) {
      $("list").innerHTML = emptyHtml(
        "還沒有名單",
        "從緣故、推薦介紹或陌生開發開始新增準保戶。資料只會存在這支裝置。",
        `<div class="btn-row">
          <button class="btn btn-primary" type="button" id="emptyAdd">新增第一筆</button>
          <button class="btn btn-ghost" type="button" id="emptyDemo">載入示範資料（虛構）</button>
        </div>`
      );
    } else if (!filtered.length) {
      $("list").innerHTML = emptyHtml("沒有符合的名單", "試試清除篩選或換個關鍵字。", "");
    } else {
      $("list").innerHTML = filtered.map(cardHtml).join("");
    }
    $("demoBanner").hidden = !hasDemo(state.list);
    renderFollowBadge();
  }

  function renderFollow() {
    const due = sortList(state.list.filter(isFollowDue));
    const overdueN = due.filter(isOverdue).length;
    $("followCount").textContent = due.length
      ? `今天要跟進 ${due.length} 筆（其中已逾期 ${overdueN} 筆）`
      : "今天沒有待跟進的名單";
    $("followList").innerHTML = due.length
      ? due.map(cardHtml).join("")
      : emptyHtml("目前沒有待跟進", "為名單設定「下次跟進日」後，到期與逾期的人會出現在這裡。成交或不需要的不會列入。", "");
  }

  function renderFollowBadge() {
    const n = state.list.filter(isFollowDue).length;
    const dot = $("followDot");
    dot.hidden = n === 0;
    dot.textContent = n > 99 ? "99+" : String(n);
  }

  function renderSort() {
    $("sortRow").innerHTML = SORTS.map(
      (s) => `<button type="button" class="chip ${state.sort === s.id ? "is-on" : ""}" data-sort="${s.id}">${s.label}</button>`
    ).join("");
  }

  function activeFilterCount() {
    return Object.values(state.filters).filter(Boolean).length;
  }

  function syncFilterBtn() {
    const n = activeFilterCount();
    $("btnFilter").textContent = n ? `篩選 ${n}` : "篩選";
    $("btnFilter").classList.toggle("is-on", n > 0);
  }

  function optionList(arr, selected, emptyLabel) {
    return `<option value="">${emptyLabel}</option>` + arr.map((v) =>
      `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(v)}</option>`
    ).join("");
  }

  function renderFilterForm() {
    const f = state.filters;
    $("filterForm").innerHTML = `
      <div class="field"><label>名單來源</label><select id="f_source">${optionList(LISTS.名單來源, f.source, "全部")}</select></div>
      <div class="field"><label>開發優先序</label><select id="f_priority">${optionList(["高優先", "中優先", "待觀察"], f.priority, "全部")}</select></div>
      <div class="field"><label>開發狀態</label><select id="f_status">${optionList(LISTS.開發狀態, f.status, "全部")}</select></div>
      <div class="field"><label>職業分類</label><select id="f_job">${optionList(LISTS.職業分類, f.job, "全部")}</select></div>
      <div class="field"><label>關係分類</label><select id="f_relation">${optionList(LISTS.關係分類, f.relation, "全部")}</select></div>
      <div class="field"><label>人生階段</label><select id="f_lifeStage">${optionList(LISTS.人生階段, f.lifeStage, "全部")}</select></div>
      <div class="field"><label>縣市</label><select id="f_city">${optionList(LISTS.縣市, f.city, "全部")}</select></div>
    `;
  }

  function readFilters() {
    state.filters = {
      source: $("f_source").value,
      priority: $("f_priority").value,
      status: $("f_status").value,
      job: $("f_job").value,
      relation: $("f_relation").value,
      lifeStage: $("f_lifeStage").value,
      city: $("f_city").value
    };
  }

  function field(id, label, type, value, extra = "") {
    const span = extra.includes("span-2") ? " span-2" : "";
    if (type === "select") {
      return `<div class="field${span}"><label for="${id}">${label}</label><select id="${id}" name="${id}">${value}</select></div>`;
    }
    if (type === "textarea") {
      return `<div class="field${span}"><label for="${id}">${label}</label><textarea id="${id}" name="${id}" rows="2">${escapeHtml(value)}</textarea></div>`;
    }
    return `<div class="field${span}"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" value="${escapeHtml(value)}" ${extra.replace("span-2", "")} /></div>`;
  }

  function sourceDetailOptions(source, selected) {
    const items = SOURCE_DETAIL[source] || [];
    return optionList(items, selected, items.length ? "請選擇" : "請先選名單來源");
  }

  function renderForm(p = {}) {
    const cap = computeCapman(p);
    const priClass = cap.priority === "高優先" ? "high" : cap.priority === "中優先" ? "mid" : "low";
    $("formTitle").textContent = p.id ? "編輯準保戶" : "新增準保戶";
    $("btnDelete").hidden = !p.id;
    $("prospectForm").innerHTML = `
      <div class="form-group">
        <h3>基本資料</h3>
        <div class="grid">
          ${field("name", "姓名（必填）", "text", p.name || "", "span-2 required")}
          ${field("honorific", "稱呼", "text", p.honorific || "")}
          ${field("gender", "性別", "select", optionList(LISTS.性別, p.gender, "未填"))}
          ${field("mobile", "手機", "tel", p.mobile || "")}
          ${field("line", "LINE或其他", "text", p.line || "")}
          ${field("city", "縣市", "select", optionList(LISTS.縣市, p.city, "未填"))}
          ${field("district", "地區", "text", p.district || "")}
          ${field("company", "公司單位", "text", p.company || "")}
          ${field("title", "職稱", "text", p.title || "")}
        </div>
      </div>
      <div class="form-group">
        <h3 class="g-source">名單來源</h3>
        <div class="grid">
          ${field("source", "名單來源", "select", optionList(LISTS.名單來源, p.source, "請選擇"))}
          ${field("sourceDetail", "來源細項", "select", sourceDetailOptions(p.source, p.sourceDetail))}
          ${field("referrer", "介紹人", "text", p.referrer || "")}
          ${field("referrerRel", "與介紹人關係", "text", p.referrerRel || "")}
        </div>
      </div>
      <div class="form-group">
        <h3 class="g-class">五大分類</h3>
        <div class="grid">
          ${field("job", "職業分類", "select", optionList(LISTS.職業分類, p.job, "未填"))}
          ${field("relation", "關係分類", "select", optionList(LISTS.關係分類, p.relation, "未填"))}
          ${field("age", "年齡", "number", p.age || "", 'min="0" max="120"')}
          ${field("lifeStage", "人生階段", "select", optionList(LISTS.人生階段, p.lifeStage, "未填"))}
          ${field("community", "社群或巢", "text", p.community || "")}
          ${field("communityType", "社群類型", "select", optionList(LISTS.社群類型, p.communityType, "未填"))}
          ${field("income", "收入分類", "select", optionList(LISTS.收入分類, p.income, "未填") , "span-2")}
        </div>
      </div>
      <div class="form-group">
        <h3 class="g-cap">CAPMAN 評估</h3>
        <div class="capman-box" id="capmanPreview">符合 ${cap.capmanCount} 項　優先序：<strong class="${priClass}">${escapeHtml(cap.priority || "尚未評估")}</strong></div>
        <div class="grid">
          ${CAPMAN_FIELDS.map((f) => field(f.key, `${f.label}　${f.hint}`, "select", optionList(LISTS.CAPMAN, p[f.key], "未填"), "span-2")).join("")}
        </div>
      </div>
      <div class="form-group">
        <h3 class="g-bg">背景資訊</h3>
        <div class="grid">
          ${field("familyDuty", "家庭責任", "textarea", p.familyDuty || "", "span-2")}
          ${field("painPoint", "核心痛點", "textarea", p.painPoint || "", "span-2")}
          ${field("workBg", "工作背景", "textarea", p.workBg || "", "span-2")}
          ${field("lifeEvent", "生活動態", "textarea", p.lifeEvent || "", "span-2")}
          ${field("otherBg", "其他背景", "textarea", p.otherBg || "", "span-2")}
        </div>
      </div>
      <div class="form-group">
        <h3 class="g-track">開發追蹤</h3>
        <div class="grid">
          ${field("status", "開發狀態", "select", optionList(LISTS.開發狀態, p.status || "未聯絡", "請選擇"))}
          ${field("salesStage", "銷售階段", "select", optionList(LISTS.銷售階段, p.salesStage, "未填"))}
          ${field("contactDate", "聯絡日期", "date", p.contactDate || "")}
          ${field("followDate", "下次跟進日", "date", p.followDate || "")}
          ${field("notes", "備註", "textarea", p.notes || "", "span-2")}
        </div>
      </div>
    `;
    $("source").addEventListener("change", () => {
      $("sourceDetail").innerHTML = sourceDetailOptions($("source").value, "");
    });
    const updateCap = () => {
      const tmp = readForm();
      const c = computeCapman(tmp);
      const cls = c.priority === "高優先" ? "high" : c.priority === "中優先" ? "mid" : "low";
      $("capmanPreview").innerHTML = `符合 ${c.capmanCount} 項　優先序：<strong class="${cls}">${escapeHtml(c.priority || "尚未評估")}</strong>`;
    };
    CAPMAN_FIELDS.forEach((f) => $(f.key).addEventListener("change", updateCap));
  }

  function readForm() {
    const g = (id) => ($(id) ? $(id).value.trim() : "");
    const data = {
      name: g("name"),
      honorific: g("honorific"),
      gender: g("gender"),
      mobile: g("mobile"),
      line: g("line"),
      city: g("city"),
      district: g("district"),
      company: g("company"),
      title: g("title"),
      source: g("source"),
      sourceDetail: g("sourceDetail"),
      referrer: g("referrer"),
      referrerRel: g("referrerRel"),
      job: g("job"),
      relation: g("relation"),
      age: g("age"),
      lifeStage: g("lifeStage"),
      community: g("community"),
      communityType: g("communityType"),
      income: g("income"),
      familyDuty: g("familyDuty"),
      painPoint: g("painPoint"),
      workBg: g("workBg"),
      lifeEvent: g("lifeEvent"),
      otherBg: g("otherBg"),
      status: g("status"),
      salesStage: g("salesStage"),
      contactDate: g("contactDate"),
      followDate: g("followDate"),
      notes: g("notes")
    };
    CAPMAN_FIELDS.forEach((f) => { data[f.key] = g(f.key); });
    if (state.editing) {
      data.id = state.editing.id;
      data.createdAt = state.editing.createdAt;
      data.isDemo = state.editing.isDemo;
    }
    return data;
  }

  function openForm(p) {
    state.editing = p ? { ...p } : null;
    renderForm(p || { status: "未聯絡" });
    $("formOverlay").classList.add("is-open");
    setTimeout(() => $("name") && $("name").focus(), 50);
  }

  function closeForm() {
    $("formOverlay").classList.remove("is-open");
    state.editing = null;
  }

  function countBy(list, key, labels) {
    const map = {};
    labels.forEach((l) => { map[l] = 0; });
    list.forEach((p) => {
      const v = p[key] || "";
      if (!v) return;
      map[v] = (map[v] || 0) + 1;
    });
    return map;
  }

  function destroyCharts() {
    Object.values(state.charts).forEach((c) => c && c.destroy());
    state.charts = {};
  }

  function makeChart(id, type, labels, data, colors) {
    const canvas = $(id);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    state.charts[id] = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: type === "doughnut", position: "bottom", labels: { boxWidth: 12, font: { family: "Noto Sans TC", size: 11 } } } },
        scales: type === "doughnut" ? {} : {
          x: { ticks: { font: { size: 10, family: "Noto Sans TC" }, maxRotation: 45, minRotation: 0 } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  function tableHtml(title, map, total) {
    const rows = Object.keys(map).map((k) => {
      const n = map[k];
      const pct = total ? ((n / total) * 100).toFixed(1) + "%" : "0.0%";
      return `<tr><td>${escapeHtml(k)}</td><td class="num">${n}</td><td class="num">${pct}</td></tr>`;
    }).join("");
    const sum = Object.values(map).reduce((a, b) => a + b, 0);
    return `<h3>${escapeHtml(title)}</h3>
      <table><thead><tr><th>項目</th><th class="num">人數</th><th class="num">占比</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>小計</td><td class="num">${sum}</td><td class="num">${total ? ((sum / total) * 100).toFixed(1) + "%" : "0.0%"}</td></tr></tfoot>
      </table>`;
  }

  function renderStats() {
    const list = state.list.filter((p) => p.name);
    const total = list.length;
    const high = list.filter((p) => p.priority === "高優先").length;
    const mid = list.filter((p) => p.priority === "中優先").length;
    const low = list.filter((p) => p.priority === "待觀察").length;
    const done = list.filter((p) => p.status === "成交").length;
    $("kpis").innerHTML = `
      <div class="kpi"><b>${total}</b><span>名單總數</span></div>
      <div class="kpi high"><b>${high}</b><span>高優先</span></div>
      <div class="kpi mid"><b>${mid}</b><span>中優先</span></div>
      <div class="kpi"><b>${low}</b><span>待觀察</span></div>
      <div class="kpi done"><b>${done}</b><span>已成交</span></div>
    `;
    destroyCharts();
    const st = countBy(list, "status", LISTS.開發狀態);
    const src = countBy(list, "source", LISTS.名單來源);
    const pri = countBy(list, "priority", ["高優先", "中優先", "待觀察"]);
    const job = countBy(list, "job", LISTS.職業分類);
    makeChart("chartStatus", "doughnut", Object.keys(st), Object.values(st), ["#90a4ae", "#42a5f5", "#fb8c00", "#43a047", "#e57373"]);
    makeChart("chartSource", "bar", Object.keys(src), Object.values(src), ["#1e6b3a", "#0f4c81", "#c05621"]);
    makeChart("chartPriority", "doughnut", Object.keys(pri), Object.values(pri), ["#1e6b3a", "#c05621", "#90a4ae"]);
    makeChart("chartJob", "bar", Object.keys(job), Object.values(job), "#1f4e79");
    $("tableLife").innerHTML = tableHtml("依人生階段", countBy(list, "lifeStage", LISTS.人生階段), total);
    $("tableCity").innerHTML = tableHtml("依縣市", countBy(list, "city", LISTS.縣市), total);
  }

  function renderBackupMeta() {
    const meta = loadMeta();
    const n = state.list.length;
    const t = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "尚未儲存";
    $("backupMeta").textContent = `目前 ${n} 筆名單。最近更新（台北時間）：${t}`;
  }

  function refresh() {
    state.list = loadProspects();
    renderSort();
    syncFilterBtn();
    renderList();
    renderFollow();
    renderFollowBadge();
    if (state.view === "stats") renderStats();
    if (state.view === "backup") renderBackupMeta();
  }

  function downloadJSON(list) {
    const blob = new Blob([JSON.stringify(exportJSON(list), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `準保戶市場開發名單-${todayISO().replace(/-/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleImport(file) {
    const name = (file.name || "").toLowerCase();
    let incoming;
    try {
      if (name.endsWith(".json") || file.type === "application/json") {
        incoming = parseJSONBackup(await file.text());
      } else {
        incoming = await parseSpreadsheet(file);
      }
    } catch (err) {
      toast(err.message || "匯入失敗");
      return;
    }
    if (!incoming.length) {
      toast("檔案裡沒有可匯入的名單（需要有「姓名」）。");
      return;
    }
    const mode = await confirmDialog(
      `匯入 ${incoming.length} 筆名單`,
      "要「取代」現有全部名單，還是「附加」在現有名單後面？確定＝取代，取消後會再問一次附加。"
    );
    if (mode) {
      state.list = replaceAll(incoming);
      toast(`已取代為 ${incoming.length} 筆`);
    } else {
      const add = await confirmDialog("改為附加？", `將新增 ${incoming.length} 筆到現有 ${state.list.length} 筆後面。`);
      if (!add) return;
      state.list = replaceAll(state.list.concat(incoming.map((p) => ({ ...p, id: uid() }))));
      toast(`已附加 ${incoming.length} 筆`);
    }
    refresh();
  }

  /* events */
  document.querySelector(".nav").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]");
    if (btn) setView(btn.dataset.view);
  });

  $("fabAdd").addEventListener("click", () => openForm(null));
  $("btnBackup").addEventListener("click", () => setView("backup"));
  $("btnCloseForm").addEventListener("click", closeForm);
  $("btnCancelForm").addEventListener("click", closeForm);
  $("btnCloseFilter").addEventListener("click", () => $("filterOverlay").classList.remove("is-open"));
  $("btnFilter").addEventListener("click", () => {
    renderFilterForm();
    $("filterOverlay").classList.add("is-open");
  });
  $("btnApplyFilter").addEventListener("click", () => {
    readFilters();
    $("filterOverlay").classList.remove("is-open");
    syncFilterBtn();
    renderList();
  });
  $("btnResetFilter").addEventListener("click", () => {
    state.filters = { source: "", priority: "", status: "", job: "", relation: "", lifeStage: "", city: "" };
    renderFilterForm();
    syncFilterBtn();
    renderList();
  });
  $("searchInput").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderList();
  });
  $("sortRow").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    state.sort = b.dataset.sort;
    renderSort();
    renderList();
  });
  $("list").addEventListener("click", (e) => {
    if (e.target.closest("#emptyAdd")) return openForm(null);
    if (e.target.closest("#emptyDemo")) {
      state.list = makeDemoProspects();
      toast("已載入 3 筆虛構示範資料");
      refresh();
      return;
    }
    const card = e.target.closest(".card[data-id]");
    if (card) {
      const p = state.list.find((x) => x.id === card.dataset.id);
      if (p) openForm(p);
    }
  });
  $("followList").addEventListener("click", (e) => {
    const card = e.target.closest(".card[data-id]");
    if (card) {
      const p = state.list.find((x) => x.id === card.dataset.id);
      if (p) openForm(p);
    }
  });

  $("prospectForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data.name) {
      toast("請填寫姓名");
      $("name").focus();
      return;
    }
    state.list = upsertProspect(state.list, data);
    closeForm();
    refresh();
    toast("已儲存");
  });

  $("btnDelete").addEventListener("click", async () => {
    if (!state.editing) return;
    const ok = await confirmDialog("刪除這筆名單？", `將刪除「${state.editing.name}」，此動作無法復原。`);
    if (!ok) return;
    state.list = removeProspect(state.list, state.editing.id);
    closeForm();
    refresh();
    toast("已刪除");
  });

  $("btnExportXlsx").addEventListener("click", () => {
    downloadExcel(state.list);
    toast("已匯出 Excel，請存到你的雲端或電腦備份");
  });
  $("btnExportJson").addEventListener("click", () => {
    downloadJSON(state.list);
    toast("已匯出 JSON 備份");
  });
  $("btnImportFile").addEventListener("click", () => $("fileImport").click());
  $("fileImport").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) await handleImport(file);
  });
  $("btnDemo").addEventListener("click", async () => {
    if (state.list.length && !hasDemo(state.list)) {
      const ok = await confirmDialog("載入示範資料？", "這會取代目前的名單。請先匯出備份。示範資料皆為虛構。");
      if (!ok) return;
    }
    state.list = makeDemoProspects();
    toast("已載入 3 筆虛構示範資料");
    refresh();
    setView("list");
  });
  $("btnClearDemo").addEventListener("click", () => {
    state.list = replaceAll(state.list.filter((p) => !p.isDemo && !(p.name && p.name.includes("示範") && p.name.includes("虛構"))));
    toast("已清除示範資料");
    refresh();
  });
  $("btnClearAll").addEventListener("click", async () => {
    const ok = await confirmDialog("清除全部名單？", "這會刪掉這支裝置上的所有準保戶，無法復原。請確認已匯出備份。");
    if (!ok) return;
    state.list = clearAll();
    toast("已清除全部名單");
    refresh();
  });

  $("formOverlay").addEventListener("click", (e) => { if (e.target === $("formOverlay")) closeForm(); });
  $("filterOverlay").addEventListener("click", (e) => { if (e.target === $("filterOverlay")) $("filterOverlay").classList.remove("is-open"); });
  $("confirmOverlay").addEventListener("click", (e) => {
    if (e.target === $("confirmOverlay")) $("confirmNo").click();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  renderSort();
  refresh();
  setView("list");
})();
