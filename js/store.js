const STORE_KEY = "zhunbaohu.prospects.v1";
const META_KEY = "zhunbaohu.prospects.meta.v1";

function loadProspects() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(enrich) : [];
  } catch (err) {
    console.error("loadProspects", err);
    return [];
  }
}

function saveProspects(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
  const meta = loadMeta();
  meta.updatedAt = new Date().toISOString();
  meta.count = list.length;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || "{}");
  } catch {
    return {};
  }
}

function upsertProspect(list, data) {
  const now = new Date().toISOString();
  const record = enrich({
    ...data,
    id: data.id || uid(),
    createdAt: data.createdAt || now,
    updatedAt: now
  });
  const idx = list.findIndex((p) => p.id === record.id);
  const next = list.slice();
  if (idx >= 0) next[idx] = record;
  else next.unshift(record);
  saveProspects(next);
  return next;
}

function removeProspect(list, id) {
  const next = list.filter((p) => p.id !== id);
  saveProspects(next);
  return next;
}

function replaceAll(list) {
  const now = new Date().toISOString();
  const next = list.map((p) =>
    enrich({
      ...p,
      id: p.id || uid(),
      createdAt: p.createdAt || now,
      updatedAt: p.updatedAt || now
    })
  );
  saveProspects(next);
  return next;
}

function clearAll() {
  saveProspects([]);
  return [];
}

function exportJSON(list) {
  return {
    app: "準保戶開發名單",
    version: 1,
    exportedAt: new Date().toISOString(),
    timeZone: "Asia/Taipei",
    prospects: list
  };
}

function parseJSONBackup(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.prospects)) return data.prospects;
  throw new Error("JSON 格式不正確，找不到 prospects 名單。");
}

function makeDemoProspects() {
  const today = todayISO();
  const yday = shiftDate(today, -2);
  const tmrw = shiftDate(today, 3);
  return replaceAll([
    {
      id: uid(),
      isDemo: true,
      name: "示範－甲（虛構）",
      honorific: "示範甲先生",
      gender: "男",
      mobile: "0900-000-001",
      line: "",
      city: "台北市",
      district: "",
      company: "示範公司（虛構）",
      title: "課長",
      source: "緣故市場",
      sourceDetail: "舊識圈",
      referrer: "",
      referrerRel: "",
      job: "科技資訊",
      relation: "舊識",
      age: "38",
      lifeStage: "育兒成長",
      community: "",
      communityType: "公司同事",
      income: "年收入100-200萬",
      cChar: "符合",
      aApproach: "符合",
      pPass: "符合",
      mMoney: "符合",
      aAuth: "符合",
      nNeeds: "符合",
      familyDuty: "雙薪、有一位小孩",
      painPoint: "想檢視保障是否足夠",
      workBg: "科技業主管",
      lifeEvent: "",
      otherBg: "此筆為示範資料，可在「資料與備份」一鍵清除。",
      status: "已聯絡",
      salesStage: "接觸",
      contactDate: yday,
      followDate: today,
      notes: "示範：今日待跟進"
    },
    {
      id: uid(),
      isDemo: true,
      name: "示範－乙（虛構）",
      honorific: "示範乙小姐",
      gender: "女",
      mobile: "0900-000-002",
      city: "新北市",
      company: "示範診所（虛構）",
      title: "護理師",
      source: "推薦介紹",
      sourceDetail: "巢",
      referrer: "示範－甲（虛構）",
      referrerRel: "同事",
      job: "醫療保健",
      relation: "轉介紹",
      age: "32",
      lifeStage: "新婚成家",
      community: "示範社團（虛構）",
      communityType: "社團學會",
      income: "年收入100萬以下",
      cChar: "符合",
      aApproach: "符合",
      pPass: "未確認",
      mMoney: "符合",
      aAuth: "未確認",
      nNeeds: "符合",
      familyDuty: "",
      painPoint: "",
      workBg: "",
      lifeEvent: "",
      otherBg: "此筆為示範資料。",
      status: "約訪",
      salesStage: "第一次面談",
      contactDate: yday,
      followDate: yday,
      notes: "示範：已逾期跟進"
    },
    {
      id: uid(),
      isDemo: true,
      name: "示範－丙（虛構）",
      honorific: "示範丙先生",
      gender: "男",
      mobile: "0900-000-003",
      city: "桃園市",
      company: "",
      title: "",
      source: "陌生開發",
      sourceDetail: "活動集客",
      job: "製造業",
      relation: "陌生",
      age: "45",
      lifeStage: "責任高峰",
      communityType: "其他",
      income: "未確認",
      cChar: "未確認",
      aApproach: "符合",
      pPass: "未確認",
      mMoney: "未確認",
      aAuth: "未確認",
      nNeeds: "未確認",
      status: "未聯絡",
      salesStage: "開拓準保戶",
      contactDate: "",
      followDate: tmrw,
      notes: "示範：尚未逾期"
    }
  ]);
}

function shiftDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function hasDemo(list) {
  return list.some((p) => p.isDemo || (p.name && p.name.includes("示範") && p.name.includes("虛構")));
}
