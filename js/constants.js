/* 與「準保戶市場開發名單」工作簿相同的分類與欄位 */
const LISTS = {
  性別: ["男", "女"],
  縣市: [
    "基隆市", "台北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣",
    "台中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣",
    "台南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "台東縣",
    "澎湖縣", "金門縣", "連江縣"
  ],
  名單來源: ["緣故市場", "推薦介紹", "陌生開發"],
  職業分類: [
    "科技資訊", "製造業", "金融保險", "醫療保健", "教育學術",
    "公務軍警", "專業服務", "批發零售", "餐飲旅宿", "營建不動產",
    "運輸物流", "自由業自營", "家管", "退休", "學生", "其他"
  ],
  關係分類: ["家人", "親戚", "好友", "同學同事", "舊識", "現有客戶", "轉介紹", "陌生"],
  人生階段: ["單身獨立", "新婚成家", "育兒成長", "子女教育", "責任高峰", "退休規劃", "已退休"],
  社群類型: ["公司同事", "家族親族", "社團學會", "校友", "宗教團體", "運動興趣", "同鄉", "其他"],
  收入分類: ["未確認", "年收入100萬以下", "年收入100-200萬", "年收入200-300萬", "年收入300萬以上"],
  CAPMAN: ["符合", "未確認", "不符合"],
  開發狀態: ["未聯絡", "已聯絡", "約訪", "成交", "不需要"],
  銷售階段: ["開拓準保戶", "接觸", "第一次面談", "第二次面談", "說明與成交", "遞送保單", "售後服務"]
};

const SOURCE_DETAIL = {
  "緣故市場": ["親朋好友", "舊識圈"],
  "推薦介紹": ["影響力中心(COI)", "巢"],
  "陌生開發": ["問卷展業", "活動集客", "社群行銷", "冷開拓"]
};

const CAPMAN_FIELDS = [
  { key: "cChar", label: "C個人特質", en: "Character", hint: "具備責任感與關愛家人" },
  { key: "aApproach", label: "A可接近", en: "Approachable", hint: "易於溝通互動，可約見面談" },
  { key: "pPass", label: "P可核保", en: "Pass", hint: "身體健康，符合體況與投保資格" },
  { key: "mMoney", label: "M有付費能力", en: "Money", hint: "經濟穩定，擁有持續繳納保費之預算" },
  { key: "aAuth", label: "A有決定權", en: "Authority", hint: "具備最終要保與財務決策權限" },
  { key: "nNeeds", label: "N有需求", en: "Needs", hint: "存在保障缺口或財務規劃需求" }
];

/** 與 Excel 工作簿欄位順序、標題完全一致（匯出／匯入用） */
const EXCEL_COLUMNS = [
  { header: "編號", key: "_index", exportOnly: true },
  { header: "姓名", key: "name" },
  { header: "稱呼", key: "honorific" },
  { header: "性別", key: "gender" },
  { header: "手機", key: "mobile" },
  { header: "LINE或其他", key: "line" },
  { header: "縣市", key: "city" },
  { header: "地區", key: "district" },
  { header: "公司單位", key: "company" },
  { header: "職稱", key: "title" },
  { header: "名單來源", key: "source" },
  { header: "來源細項", key: "sourceDetail" },
  { header: "介紹人", key: "referrer" },
  { header: "與介紹人關係", key: "referrerRel" },
  { header: "職業分類", key: "job" },
  { header: "關係分類", key: "relation" },
  { header: "年齡", key: "age" },
  { header: "人生階段", key: "lifeStage" },
  { header: "社群或巢", key: "community" },
  { header: "社群類型", key: "communityType" },
  { header: "收入分類", key: "income" },
  { header: "C個人特質", key: "cChar" },
  { header: "A可接近", key: "aApproach" },
  { header: "P可核保", key: "pPass" },
  { header: "M有付費能力", key: "mMoney" },
  { header: "A有決定權", key: "aAuth" },
  { header: "N有需求", key: "nNeeds" },
  { header: "符合項數", key: "capmanCount", computed: true },
  { header: "開發優先序", key: "priority", computed: true },
  { header: "家庭責任", key: "familyDuty" },
  { header: "核心痛點", key: "painPoint" },
  { header: "工作背景", key: "workBg" },
  { header: "生活動態", key: "lifeEvent" },
  { header: "其他背景", key: "otherBg" },
  { header: "開發狀態", key: "status" },
  { header: "銷售階段", key: "salesStage" },
  { header: "聯絡日期", key: "contactDate" },
  { header: "下次跟進日", key: "followDate" },
  { header: "備註", key: "notes" }
];

const PRIORITY_RANK = { "高優先": 3, "中優先": 2, "待觀察": 1 };

function computeCapman(p) {
  const filled = CAPMAN_FIELDS.filter((f) => p[f.key]);
  const count = CAPMAN_FIELDS.filter((f) => p[f.key] === "符合").length;
  if (!filled.length) return { capmanCount: 0, priority: "" };
  let priority = "待觀察";
  if (count >= 5) priority = "高優先";
  else if (count >= 3) priority = "中優先";
  return { capmanCount: count, priority };
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function isClosed(p) {
  return p.status === "成交" || p.status === "不需要";
}

function isOverdue(p) {
  if (!p.followDate || !p.name || isClosed(p)) return false;
  return p.followDate < todayISO();
}

function isDueToday(p) {
  if (!p.followDate || !p.name || isClosed(p)) return false;
  return p.followDate === todayISO();
}

function isFollowDue(p) {
  return isOverdue(p) || isDueToday(p);
}

function enrich(p) {
  const cap = computeCapman(p);
  return { ...p, capmanCount: cap.capmanCount, priority: cap.priority };
}

function uid() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
