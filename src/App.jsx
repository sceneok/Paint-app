import React, { useState, useEffect, useRef } from "react";

/* ──────────────────────────────────────────────
   도장 현장수첩 — 공수 · 자재 · 견적 · 장부 관리
   벽 해배 = (가로+세로)×2×층고 / 천장 = 가로×세로
   ────────────────────────────────────────────── */

const C = {
  bg: "#F1F2EF",
  card: "#FFFFFF",
  ink: "#1A1B1E",
  mut: "#71757D",
  tape: "#FFC400",
  blue: "#2E5AAC",
  line: "#E3E4DF",
  red: "#C2452D",
  orange: "#E8862E",
  gray: "#9AA0A6",
  green: "#3A7D44",
};

const DEFAULT_SETTINGS = {
  dayRate: 350000,       // 내 하루 일당 (원)
  coverageNew: 21,       // 신축(석고+투퍼티) 18L 한 말당 ㎡ (초벌+재벌)
  coverageRe: 30,        // 재도장 18L 한 말당 ㎡ (2회)
  puttyCoverage: 15,     // 투퍼티 기준 퍼티 1포(20kg)당 ㎡
  paintPrice: 110000,    // 국산 수성 18L 한 말 (원)
  puttyPrice: 15000,     // 퍼티 1포 (원)
  primerPrice: 90000,    // 하도(프라이머) 18L 한 말 (원)
  stuccoPrice: 45000,    // 스타코 1포(20kg) (원)
  plasterPrice: 50000,   // 유럽·암석미장재 1포(20kg) (원)
  dailyAreaNew: 75,      // 신축 1인 1일 처리량 ㎡ (올퍼티+2회)
  dailyAreaRe: 110,      // 재도장 1인 1일 처리량 ㎡
  subRate: 600,          // 부자재 해배당 (원/㎡)
  etcPerDay: 20000,      // 기타비(주차·유류·식대) 1일당 (원)
  marginPct: 15,         // 기본 이윤 %
  incomeDeduction: 1500000, // 종소세 소득공제 (기본공제 본인 150만)
  simpleExpRate: 0,      // 단순경비율 % (0 = 미설정, 국세청 업종코드별 확인)
  bizName: "씬테리어",
  bizOwner: "김흥섭",
  bizNo: "781-21-02645",
  bizAddr: "서울특별시 구로구 고척로31길 83-4, 201호",
  bizPhone: "",
  bizAccount: "",
};

const QUOTE_CATS = ["도장공사", "퍼티·보수", "인건비", "자재", "부자재", "기타경비", "할인·조정"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmt = (n) => (isFinite(n) ? Math.round(n).toLocaleString("ko-KR") : "0");
const num = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
};
const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/* ── 문서 내보내기 ── */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const downloadFile = (filename, content, type, setToast, okMsg) => {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setToast(okMsg || "파일 저장됨");
  } catch {
    setToast("이 환경에서는 파일 저장이 안 돼요");
  }
};
const downloadHTML = (filename, html, setToast) =>
  downloadFile(filename, html, "text/html;charset=utf-8", setToast, "파일 저장됨 · 열어서 인쇄하면 PDF로 저장돼요");
/* 문서 미리보기 — 새 창 대신 앱 안에서 열어서 "돌아가기"가 항상 보이게 */
function DocOverlay({ html, close }) {
  const ref = useRef(null);
  const print = () => {
    try {
      ref.current.contentWindow.focus();
      ref.current.contentWindow.print();
    } catch {}
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: C.ink, padding: "10px 12px", paddingTop: "calc(10px + env(safe-area-inset-top))" }}>
        <button onClick={close}
          style={{ border: "none", background: "transparent", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: "8px 6px" }}>
          ← 앱으로 돌아가기
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={print}
          style={{ border: "none", background: C.tape, color: C.ink, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "9px 14px", borderRadius: 8 }}>
          🖨 인쇄 · PDF 저장
        </button>
      </div>
      <iframe ref={ref} srcDoc={html} title="문서 미리보기" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
    </div>
  );
}
const docShell = (title, inner) => `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1a1b1e;margin:0 auto;padding:24px;max-width:760px}
h1{font-size:22px;border-bottom:3px solid #1a1b1e;padding-bottom:8px;letter-spacing:.3em}
h2{font-size:15px;margin:20px 0 6px}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{border:1px solid #d7d8d4;padding:8px 10px;font-size:13px;text-align:left}
th{background:#f3f4f1}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.total td{background:#1a1b1e;color:#ffc400;font-weight:800}
.meta{font-size:13px;color:#555;margin:4px 0}
.print-btn{margin:18px 0;padding:12px 18px;background:#1a1b1e;color:#ffc400;border:none;border-radius:8px;font-weight:800;font-size:14px;cursor:pointer}
@media print{.print-btn{display:none}body{padding:0}}
</style></head><body>${inner}<button class="print-btn" onclick="window.print()">🖨 인쇄 / PDF로 저장</button></body></html>`;

/* ── 저장소 (클로드 storage → localStorage 자동 폴백) ── */
const storeGet = async (k) => {
  try {
    if (window.storage && window.storage.get) {
      const r = await window.storage.get(k);
      if (r && r.value != null) return r.value;
    }
  } catch {}
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const storeSet = async (k, v) => {
  try {
    if (window.storage && window.storage.set) await window.storage.set(k, v);
  } catch {}
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const loadKey = async (k, fb) => {
  try {
    const r = await storeGet(k);
    return r ? JSON.parse(r) : fb;
  } catch {
    return fb;
  }
};
const saveKey = (k, v) => {
  try {
    storeSet(k, JSON.stringify(v)).catch(() => {});
  } catch {}
};

/* ── 공정(퍼티·마감) 종류 ── */
const PROCESSES = [
  { k: "one",    label: "원퍼티",   kind: "paint",   matName: "퍼티 20kg",       matCov: 30, matPriceKey: "puttyPrice",   dailyMul: 1.25, hint: "퍼티 1회 + 샌딩 + 도장 2회" },
  { k: "two",    label: "투퍼티",   kind: "paint",   matName: "퍼티 20kg",       matCov: 15, matPriceKey: "puttyPrice",   dailyMul: 1,    hint: "퍼티 2회 + 샌딩 + 도장 2회" },
  { k: "all",    label: "올퍼티",   kind: "paint",   matName: "퍼티 20kg",       matCov: 10, matPriceKey: "puttyPrice",   dailyMul: 0.8,  hint: "전면 퍼티 + 샌딩 + 도장 2회" },
  { k: "re",     label: "재도장",   kind: "paint",   matName: "퍼티 20kg",       matCov: 60, matPriceKey: "puttyPrice",   dailyMul: 1,    hint: "부분 퍼티 보수 + 도장 2회" },
  { k: "stucco", label: "스타코",   kind: "texture", matName: "스타코 20kg",     matCov: 16, matPriceKey: "stuccoPrice",  daily: 45,      hint: "하도 + 스타코 뿜칠·미장 마감" },
  { k: "euro",   label: "유럽미장", kind: "texture", matName: "유럽미장재 20kg", matCov: 8,  matPriceKey: "plasterPrice", daily: 35,      hint: "하도 + 유럽미장 텍스처 마감" },
  { k: "rock",   label: "암석미장", kind: "texture", matName: "암석미장재 20kg", matCov: 6,  matPriceKey: "plasterPrice", daily: 30,      hint: "하도 + 골재 미장 마감" },
];
const procOf = (site) => PROCESSES.find((p) => p.k === (site.process || (site.workType === "re" ? "re" : "two"))) || PROCESSES[1];

/* ── 장부(경리) 상수 ── */
const IN_CATS = ["도장공사", "일당", "기타수입"];
const OUT_CATS = ["자재비", "부자재·소모품", "인건비 지급", "유류·차량", "식대·경비", "장비·공구", "보험·공과금", "기타지출"];
// 증빙 유형 — vat: 부가세 매출·매입세액 집계 대상 (적격증빙)
const EVI_TYPES = [
  { k: "tax",    label: "세금계산서",  vat: true },
  { k: "card",   label: "카드",        vat: true },
  { k: "cash",   label: "현금영수증",  vat: true },
  { k: "w33",    label: "3.3% 원천",   vat: false },
  { k: "simple", label: "간이·무증빙", vat: false },
];
const eviOf = (k) => EVI_TYPES.find((e) => e.k === k) || EVI_TYPES[4];
// 부가세 포함 금액(공급대가)에서 세액 분리: 10/110
const vatOf = (a) => Math.round(a / 11);

// 종합소득세 기본세율 (2023년 귀속분 이후) — [과세표준 상한, 세율, 누진공제]
const TAX_BRACKETS = [
  [14000000, 0.06, 0],
  [50000000, 0.15, 1260000],
  [88000000, 0.24, 5760000],
  [150000000, 0.35, 15440000],
  [300000000, 0.38, 19940000],
  [500000000, 0.40, 25940000],
  [1000000000, 0.42, 35940000],
  [Infinity, 0.45, 65940000],
];
const calcIncomeTax = (base) => {
  if (base <= 0) return 0;
  const [, rate, ded] = TAX_BRACKETS.find(([cap]) => base <= cap);
  return Math.max(0, Math.round(base * rate - ded));
};

/* ── 계산 로직 ── */
function calcSite(site, st) {
  let wall = 0, ceilA = 0;
  (site.spaces || []).forEach((sp) => {
    const w = num(sp.w), l = num(sp.l), h = num(sp.h);
    const wc = sp.walls == null ? 4 : sp.walls;
    wall += (w + l) * 2 * (wc / 4) * h;
    if (sp.ceiling) ceilA += w * l;
  });
  const area = wall + ceilA;
  const proc = procOf(site);
  const isTex = proc.kind === "texture";
  const ov = site.ov || {};
  const pick = (o, auto) => (num(o) > 0 ? num(o) : auto);
  // 도료: 일반 공정은 수성페인트, 미장·스타코 공정은 하도(프라이머)
  const paintCov = isTex ? 50 : proc.k === "re" ? st.coverageRe : st.coverageNew;
  const autoCans = area > 0 ? Math.ceil(area / Math.max(paintCov, 1)) : 0;
  const cans = pick(ov.cans, autoCans);
  const cansName = isTex ? "하도(프라이머) 18L" : "수성페인트 18L";
  const cansPrice = pick(ov.cansPrice, isTex ? st.primerPrice : st.paintPrice);
  // 마감재: 퍼티 / 스타코 / 미장재 — 투퍼티는 단가설정의 퍼티 소모량을 따름
  const matCov = proc.k === "two" ? st.puttyCoverage : proc.matCov;
  const autoBags = area > 0 ? Math.ceil(area / Math.max(matCov, 1)) : 0;
  const bags = pick(ov.bags, autoBags);
  const matPrice = pick(ov.matPrice, st[proc.matPriceKey] || 0);
  // 공수
  const dailyBase = isTex ? proc.daily : proc.k === "re" ? st.dailyAreaRe : st.dailyAreaNew * proc.dailyMul;
  const autoDays = area > 0 ? Math.ceil(area / Math.max(dailyBase, 1)) : 0;
  const days = pick(ov.days, autoDays);
  const dayRate = pick(ov.dayRate, st.dayRate);
  const labor = days * dayRate;
  const paintCost = cans * cansPrice;
  const matCost = bags * matPrice;
  const sub = area > 0 ? Math.max(30000, Math.round((area * st.subRate) / 10000) * 10000) : 0;
  const etc = days * st.etcPerDay;
  const base = labor + paintCost + matCost + sub + etc;
  const pct = site.marginPct == null ? st.marginPct : site.marginPct;
  const margin = Math.round(base * (pct / 100));
  const total = Math.floor((base + margin) / 10000) * 10000; // 만원 절사
  const unit = area > 0 ? Math.round(total / area) : 0;
  return { wall, ceilA, area, proc, isTex, cans, cansName, cansPrice, bags, matName: proc.matName, matPrice, matCov, paintCov, days, dayRate, autoCans, autoBags, autoDays, labor, paintCost, matCost, sub, etc, base, pct, margin, total, unit };
}

/* ── 공용 UI ── */
const Tape = ({ children, small }) => (
  <span
    style={{
      display: "inline-block",
      background: C.tape,
      color: C.ink,
      fontWeight: 800,
      fontSize: small ? 11 : 13,
      letterSpacing: "0.06em",
      padding: small ? "2px 8px" : "3px 10px",
      transform: "rotate(-1.2deg)",
      boxShadow: "1px 2px 0 rgba(0,0,0,0.12)",
    }}
  >
    {children}
  </span>
);

const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, ...style }}>{children}</div>
);

const Field = ({ label, children }) => (
  <label style={{ display: "block" }}>
    <div style={{ fontSize: 11, color: C.mut, marginBottom: 4, fontWeight: 600 }}>{label}</div>
    {children}
  </label>
);

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: `1.5px solid ${C.line}`,
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 15,
  color: C.ink,
  background: "#FBFBFA",
  outline: "none",
  fontFamily: "'IBM Plex Mono', monospace",
};
const textStyle = { ...inputStyle, fontFamily: "inherit" };

const NumIn = ({ v, set, ph, suffix }) => (
  <div style={{ position: "relative" }}>
    <input
      inputMode="decimal"
      value={v}
      placeholder={ph || "0"}
      onChange={(e) => set(e.target.value.replace(/[^0-9.,-]/g, ""))}
      style={{ ...inputStyle, paddingRight: suffix ? 34 : 10 }}
    />
    {suffix && (
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.mut }}>{suffix}</span>
    )}
  </div>
);

const Btn = ({ children, onClick, kind, style, disabled }) => {
  const base = {
    border: "none",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 800,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontFamily: "inherit",
  };
  const kinds = {
    tape: { background: C.ink, color: C.tape },
    ghost: { background: "transparent", color: C.ink, border: `1.5px solid ${C.line}` },
    blue: { background: C.blue, color: "#fff" },
    danger: { background: "transparent", color: C.red, border: `1.5px solid ${C.line}` },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...(kinds[kind || "tape"]), ...style }}>
      {children}
    </button>
  );
};

const Row = ({ l, r, bold, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
    <span style={{ fontSize: 13, color: bold ? C.ink : C.mut, fontWeight: bold ? 800 : 500 }}>{l}</span>
    <span style={{ fontSize: bold ? 18 : 14, fontWeight: bold ? 800 : 600, color: color || C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{r}</span>
  </div>
);

const Chip = ({ on, onClick, children, color }) => (
  <button
    onClick={onClick}
    style={{
      padding: "8px 12px",
      borderRadius: 999,
      fontWeight: 800,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
      border: `2px solid ${on ? C.ink : C.line}`,
      background: on ? (color || C.tape) : "#FBFBFA",
      color: C.ink,
    }}
  >
    {children}
  </button>
);

/* ── 사진 압축 ── */
const compressImage = (file) =>
  new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 560 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.55));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("이미지를 읽지 못했습니다")); };
    img.src = url;
  });

/* ══════════════ 메인 앱 ══════════════ */
export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("calc");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [sites, setSites] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [cal, setCal] = useState({});
  const [ledger, setLedger] = useState([]);
  const [editSite, setEditSite] = useState(null); // site id
  const [editQuote, setEditQuote] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      const [s, si, q, c, lg] = await Promise.all([
        loadKey("pj-settings", DEFAULT_SETTINGS),
        loadKey("pj-sites", []),
        loadKey("pj-quotes", []),
        loadKey("pj-cal", {}),
        loadKey("pj-ledger", []),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setSites(si);
      setQuotes(q);
      setCal(c);
      setLedger(lg);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) saveKey("pj-settings", settings); }, [settings, ready]);
  useEffect(() => { if (ready) saveKey("pj-sites", sites); }, [sites, ready]);
  useEffect(() => { if (ready) saveKey("pj-quotes", quotes); }, [quotes, ready]);
  useEffect(() => { if (ready) saveKey("pj-cal", cal); }, [cal, ready]);
  useEffect(() => { if (ready) saveKey("pj-ledger", ledger); }, [ledger, ready]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const sendToQuote = (site, r) => {
    const q = {
      id: uid(),
      title: site.name || "현장 견적",
      client: site.client || "",
      date: todayStr(),
      vat: false,
      memo: `${r.proc.label} 공정 · 총 해배 ${fmt(r.area)}㎡ · 예상 공수 ${r.days}일`,
      items: [
        { id: uid(), cat: "인건비", name: `${r.proc.label} 노무비 (${r.proc.hint})`, qty: r.days, unit: "공수", price: r.dayRate },
        { id: uid(), cat: "자재", name: r.cansName, qty: r.cans, unit: "말", price: r.cansPrice },
        { id: uid(), cat: "자재", name: r.matName, qty: r.bags, unit: "포", price: r.matPrice },
        { id: uid(), cat: "부자재", name: "부자재 일체 (테이프·비닐·롤러·사포)", qty: 1, unit: "식", price: r.sub },
        { id: uid(), cat: "기타경비", name: "운반·주차·식대 등", qty: 1, unit: "식", price: r.etc },
        { id: uid(), cat: "기타경비", name: "기업이윤 및 일반관리비", qty: 1, unit: "식", price: r.margin },
      ],
    };
    setQuotes((p) => [q, ...p]);
    setEditQuote(q.id);
    setTab("quote");
    setToast("견적서로 옮겼어요");
  };

  // 견적서 → 장부 매출 기록 (중복 방지)
  const recordSale = (q, total) => {
    if (ledger.some((e) => e.src === "quote" && e.ref === q.id)) {
      setToast("이미 장부에 기록된 견적이에요");
      return;
    }
    setLedger((p) => [
      { id: uid(), date: q.date || todayStr(), kind: "in", cat: "도장공사", amount: total, evi: q.vat ? "tax" : "simple", client: q.client || "", memo: q.title || "도장공사", src: "quote", ref: q.id },
      ...p,
    ]);
    setToast("장부에 매출로 기록했어요 · 장부 탭에서 확인");
  };

  const importAll = (data) => {
    if (!data || typeof data !== "object") { setToast("백업 파일 형식이 아니에요"); return; }
    if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    if (Array.isArray(data.sites)) setSites(data.sites);
    if (Array.isArray(data.quotes)) setQuotes(data.quotes);
    if (data.cal && typeof data.cal === "object") setCal(data.cal);
    if (Array.isArray(data.ledger)) setLedger(data.ledger);
    setToast("백업을 복원했어요");
  };

  if (!ready)
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.mut, fontFamily: "'IBM Plex Sans KR', sans-serif" }}>
        불러오는 중…
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'IBM Plex Sans KR', -apple-system, sans-serif", paddingBottom: 84 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500;700&display=swap');
        input:focus, textarea:focus, select:focus { border-color: ${C.ink} !important; }
        button:active { transform: translateY(1px); }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* 헤더 */}
      <div style={{ padding: "18px 16px 10px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 26, lineHeight: 1 }}>현장수첩</div>
          <div style={{ fontSize: 11, color: C.mut, marginTop: 4 }}>도장 공수 · 자재 · 견적 · 장부</div>
        </div>
        <Tape small>{settings.bizName || "현장수첩"}</Tape>
      </div>

      <div style={{ padding: "0 14px" }}>
        {tab === "calc" && (
          <CalcTab
            sites={sites} setSites={setSites} settings={settings}
            editId={editSite} setEditId={setEditSite}
            onQuote={sendToQuote} setToast={setToast}
          />
        )}
        {tab === "quote" && (
          <QuoteTab quotes={quotes} setQuotes={setQuotes} editId={editQuote} setEditId={setEditQuote} setToast={setToast} settings={settings} onLedger={recordSale} />
        )}
        {tab === "cal" && <CalTab cal={cal} setCal={setCal} settings={settings} sites={sites} />}
        {tab === "book" && (
          <BookTab ledger={ledger} setLedger={setLedger} cal={cal} settings={settings} setSettings={setSettings} setToast={setToast} />
        )}
        {tab === "set" && (
          <SetTab settings={settings} setSettings={setSettings} setToast={setToast}
            allData={{ settings, sites, quotes, cal, ledger }} importAll={importAll} />
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{ position: "fixed", bottom: 92, left: "50%", transform: "translateX(-50%)", background: C.ink, color: C.tape, fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 999, zIndex: 60, boxShadow: "0 4px 14px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* 하단 탭 */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.line}`, display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[
          ["calc", "📐", "현장"],
          ["quote", "🧾", "견적서"],
          ["cal", "🗓", "달력"],
          ["book", "💰", "장부"],
          ["set", "⚙️", "설정"],
        ].map(([k, ic, lb]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{ flex: 1, background: "none", border: "none", padding: "10px 0 12px", cursor: "pointer", fontFamily: "inherit" }}
          >
            <div style={{ fontSize: 18, filter: tab === k ? "none" : "grayscale(1) opacity(0.55)" }}>{ic}</div>
            <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2, color: tab === k ? C.ink : C.mut, borderBottom: tab === k ? `3px solid ${C.tape}` : "3px solid transparent", display: "inline-block", paddingBottom: 1 }}>
              {lb}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════ 1. 현장 계산 탭 ══════════════ */
function CalcTab({ sites, setSites, settings, editId, setEditId, onQuote, setToast }) {
  const site = sites.find((s) => s.id === editId);

  const newSite = () => {
    const s = {
      id: uid(), name: "", client: "", process: "two", marginPct: settings.marginPct,
      photos: [], createdAt: Date.now(),
      spaces: [{ id: uid(), name: "공간 1", w: "", l: "", h: "2.4", walls: 4, ceiling: true }],
    };
    setSites((p) => [s, ...p]);
    setEditId(s.id);
  };

  if (!site)
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <Btn onClick={newSite}>＋ 새 현장 실측 시작</Btn>
        {sites.length === 0 && (
          <Card style={{ textAlign: "center", padding: 28 }}>
            <div style={{ fontSize: 30 }}>📐</div>
            <div style={{ fontWeight: 800, marginTop: 8 }}>아직 등록한 현장이 없어요</div>
            <div style={{ fontSize: 13, color: C.mut, marginTop: 6, lineHeight: 1.6 }}>
              가로·세로·층고만 넣으면 해배, 페인트 말 수,<br />퍼티 포 수, 공수, 예상 금액까지 계산해요.
            </div>
          </Card>
        )}
        {sites.map((s) => {
          const r = calcSite(s, settings);
          return (
            <Card key={s.id} style={{ cursor: "pointer" }} >
              <div onClick={() => setEditId(s.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{s.name || "이름 없는 현장"}</div>
                  <Tape small>{procOf(s).label}</Tape>
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                  <span>해배 <b>{fmt(r.area)}</b>㎡</span>
                  <span>공수 <b>{r.days}</b>일</span>
                  <span style={{ color: C.blue, fontWeight: 700 }}>{fmt(r.total)}원</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );

  return <SiteEditor site={site} setSites={setSites} settings={settings} back={() => setEditId(null)} onQuote={onQuote} setToast={setToast} />;
}

function SiteEditor({ site, setSites, settings, back, onQuote, setToast }) {
  const r = calcSite(site, settings);
  const fileRef = useRef(null);
  const [showOv, setShowOv] = useState(false);
  const [docView, setDocView] = useState(null);
  const up = (patch) => setSites((p) => p.map((s) => (s.id === site.id ? { ...s, ...patch } : s)));
  const upSpace = (sid, patch) => up({ spaces: site.spaces.map((sp) => (sp.id === sid ? { ...sp, ...patch } : sp)) });
  const upOv = (key, v) => up({ ov: { ...(site.ov || {}), [key]: v } });

  const buildSiteDoc = () => {
    const spRows = site.spaces.map((sp) => {
      const w = num(sp.w), l = num(sp.l), h = num(sp.h);
      const wc = sp.walls == null ? 4 : sp.walls;
      const wa = (w + l) * 2 * (wc / 4) * h;
      const ca = sp.ceiling ? w * l : 0;
      return `<tr><td>${esc(sp.name)}</td><td class="num">${w}m</td><td class="num">${l}m</td><td class="num">${h}m</td><td class="num">${wc}면</td><td>${sp.ceiling ? "포함" : "제외"}</td><td class="num">${fmt(wa + ca)}㎡</td></tr>`;
    }).join("");
    const inner = `<h1>현장 실측·견적서</h1>
<p class="meta"><b>${esc(settings.bizName || "")}</b> · 대표 ${esc(settings.bizOwner || "")} · 사업자등록번호 ${esc(settings.bizNo || "")}${settings.bizPhone ? ` · ☎ ${esc(settings.bizPhone)}` : ""}</p>
<p class="meta">현장: ${esc(site.name || "-")} · 발주처: ${esc(site.client || "-")} · 공정: ${esc(r.proc.label)} (${esc(r.proc.hint)}) · 작성일: ${todayStr()}</p>
<h2>1. 실측 내용</h2>
<table><thead><tr><th>공간</th><th class="num">가로</th><th class="num">세로</th><th class="num">층고</th><th class="num">벽면</th><th>천장</th><th class="num">해배</th></tr></thead>
<tbody>${spRows}<tr class="total"><td colspan="6">총 도장 해배 (벽 ${fmt(r.wall)}㎡ + 천장 ${fmt(r.ceilA)}㎡)</td><td class="num">${fmt(r.area)}㎡</td></tr></tbody></table>
<h2>2. 자재 산출</h2>
<table><thead><tr><th>품목</th><th class="num">수량</th><th class="num">단가(원)</th><th class="num">금액(원)</th></tr></thead><tbody>
<tr><td>${esc(r.cansName)}</td><td class="num">${r.cans}말</td><td class="num">${fmt(r.cansPrice)}</td><td class="num">${fmt(r.paintCost)}</td></tr>
<tr><td>${esc(r.matName)}</td><td class="num">${r.bags}포</td><td class="num">${fmt(r.matPrice)}</td><td class="num">${fmt(r.matCost)}</td></tr>
<tr><td>부자재 일체</td><td class="num">1식</td><td class="num">-</td><td class="num">${fmt(r.sub)}</td></tr></tbody></table>
<h2>3. 견적 금액</h2>
<table><tbody>
<tr><td>인건비 (${r.days}공수 × ${fmt(r.dayRate)}원)</td><td class="num">${fmt(r.labor)}</td></tr>
<tr><td>자재비</td><td class="num">${fmt(r.paintCost + r.matCost + r.sub)}</td></tr>
<tr><td>기타비 (운반·주차·식대)</td><td class="num">${fmt(r.etc)}</td></tr>
<tr><td>이윤 및 일반관리비 (${r.pct}%)</td><td class="num">${fmt(r.margin)}</td></tr>
<tr class="total"><td>총 견적 금액 (해배당 약 ${fmt(r.unit)}원/㎡)</td><td class="num">${fmt(r.total)}원</td></tr></tbody></table>`;
    const doc = docShell(`실측견적 ${site.name || ""}`, inner);
    return doc;
  };
  const printSite = () => setDocView(buildSiteDoc());
  const exportSite = () => downloadHTML(`실측견적_${site.name || "현장"}.html`, buildSiteDoc(), setToast);

  const addPhoto = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - (site.photos || []).length);
    try {
      const imgs = await Promise.all(files.map(compressImage));
      up({ photos: [...(site.photos || []), ...imgs] });
    } catch {
      setToast("사진을 불러오지 못했어요");
    }
    e.target.value = "";
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Btn kind="ghost" onClick={back} style={{ padding: "8px 12px" }}>← 목록</Btn>
        <Btn kind="danger" style={{ padding: "8px 12px" }} onClick={() => { setSites((p) => p.filter((s) => s.id !== site.id)); back(); }}>삭제</Btn>
      </div>

      {/* 기본 정보 */}
      <Card>
        <Tape>현장 정보</Tape>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <Field label="현장명">
            <input style={textStyle} value={site.name} placeholder="예) 마포 상가 2층" onChange={(e) => up({ name: e.target.value })} />
          </Field>
          <Field label="발주처 / 연락처 (선택)">
            <input style={textStyle} value={site.client} placeholder="예) 김사장 010-…" onChange={(e) => up({ client: e.target.value })} />
          </Field>
          <div>
            <div style={{ fontSize: 11, color: C.mut, fontWeight: 600, marginBottom: 6 }}>공정 · 마감 종류</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PROCESSES.map((p) => (
                <button key={p.k} onClick={() => up({ process: p.k })}
                  style={{ padding: "9px 13px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                    border: `2px solid ${r.proc.k === p.k ? C.ink : C.line}`,
                    background: r.proc.k === p.k ? C.tape : "#FBFBFA", color: C.ink }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>{r.proc.hint}</div>
          </div>
        </div>

        {/* 사진 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: C.mut, fontWeight: 600, marginBottom: 6 }}>현장 사진 (최대 4장)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(site.photos || []).map((p, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={p} alt="현장" style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
                <button onClick={() => up({ photos: site.photos.filter((_, j) => j !== i) })}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: "none", background: C.ink, color: "#fff", fontSize: 11, cursor: "pointer", lineHeight: "20px", padding: 0 }}>✕</button>
              </div>
            ))}
            {(site.photos || []).length < 4 && (
              <button onClick={() => fileRef.current && fileRef.current.click()}
                style={{ width: 68, height: 68, borderRadius: 8, border: `2px dashed ${C.line}`, background: "#FBFBFA", fontSize: 22, color: C.mut, cursor: "pointer" }}>＋</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addPhoto} />
          </div>
        </div>
      </Card>

      {/* 공간 실측 */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tape>실측 · 공간</Tape>
          <button onClick={() => up({ spaces: [...site.spaces, { id: uid(), name: `공간 ${site.spaces.length + 1}`, w: "", l: "", h: "2.4", walls: 4, ceiling: true }] })}
            style={{ border: "none", background: "none", color: C.blue, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ＋ 공간 추가
          </button>
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {site.spaces.map((sp) => {
            const w = num(sp.w), l = num(sp.l), h = num(sp.h);
            const wallA = (w + l) * 2 * ((sp.walls == null ? 4 : sp.walls) / 4) * h;
            const ceilA = sp.ceiling ? w * l : 0;
            return (
              <div key={sp.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, background: "#FBFBFA" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <input value={sp.name} onChange={(e) => upSpace(sp.id, { name: e.target.value })}
                    style={{ border: "none", background: "none", fontWeight: 800, fontSize: 14, color: C.ink, outline: "none", fontFamily: "inherit", width: "60%" }} />
                  {site.spaces.length > 1 && (
                    <button onClick={() => up({ spaces: site.spaces.filter((x) => x.id !== sp.id) })}
                      style={{ border: "none", background: "none", color: C.mut, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>삭제</button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <Field label="가로"><NumIn v={sp.w} set={(v) => upSpace(sp.id, { w: v })} suffix="m" /></Field>
                  <Field label="세로"><NumIn v={sp.l} set={(v) => upSpace(sp.id, { l: v })} suffix="m" /></Field>
                  <Field label="층고"><NumIn v={sp.h} set={(v) => upSpace(sp.id, { h: v })} suffix="m" /></Field>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.mut, fontWeight: 600 }}>칠하는 벽면</span>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} onClick={() => upSpace(sp.id, { walls: n })}
                        style={{ width: 30, height: 30, borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer",
                          border: `2px solid ${(sp.walls == null ? 4 : sp.walls) === n ? C.ink : C.line}`,
                          background: (sp.walls == null ? 4 : sp.walls) === n ? C.tape : "#fff" }}>{n}</button>
                    ))}
                  </div>
                  <button onClick={() => upSpace(sp.id, { ceiling: !sp.ceiling })}
                    style={{ padding: "6px 10px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer",
                      border: `2px solid ${sp.ceiling ? C.ink : C.line}`, background: sp.ceiling ? C.tape : "#fff", fontFamily: "inherit" }}>
                    천장 {sp.ceiling ? "포함" : "제외"}
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: C.mut, fontFamily: "'IBM Plex Mono', monospace" }}>
                  벽 {fmt(wallA)}㎡ + 천장 {fmt(ceilA)}㎡ = <b style={{ color: C.ink }}>{fmt(wallA + ceilA)}㎡</b>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 결과: 해배 + 자재 */}
      <Card>
        <Tape>해배 · 자재 산출</Tape>
        <div style={{ marginTop: 10 }}>
          <Row l="벽 해배  (가로+세로)×2×층고" r={`${fmt(r.wall)} ㎡`} />
          <Row l="천장 해배  가로×세로" r={`${fmt(r.ceilA)} ㎡`} />
          <div style={{ borderTop: `2px solid ${C.ink}`, marginTop: 4, paddingTop: 4 }}>
            <Row l="총 도장 해배" r={`${fmt(r.area)} ㎡`} bold />
            <div style={{ fontSize: 11, color: C.mut, textAlign: "right" }}>약 {fmt(r.area / 3.3)}평 규모</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            [r.isTex ? "하도(프라이머)" : "수성페인트", r.cans, "말", "18L"],
            [r.matName.replace(" 20kg", ""), r.bags, "포", "20kg"],
            ["예상 공수", r.days, "일", "1인 기준"],
          ].map(([lb, v, un, sub2]) => (
            <div key={lb} style={{ background: "#FBFBFA", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.mut, fontWeight: 600 }}>{lb}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                {v}<span style={{ fontSize: 13 }}>{un}</span>
              </div>
              <div style={{ fontSize: 10, color: C.mut }}>{sub2}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
          {r.proc.label} 기준: {r.isTex ? "하도" : "도료"} 한 말당 {r.paintCov}㎡ · {r.matName.replace(" 20kg", "")} 1포당 {r.matCov}㎡ · 단가설정에서 조정 가능
        </div>
      </Card>

      {/* 금액 산출 */}
      <Card style={{ borderColor: C.ink, borderWidth: 1.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tape>견적 금액 산출</Tape>
          <button onClick={() => setShowOv(!showOv)}
            style={{ border: "none", background: "none", color: C.blue, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            ✏️ 수량·단가 수정 {showOv ? "▲" : "▼"}
          </button>
        </div>
        {showOv && (
          <div style={{ marginTop: 10, border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 10, background: "#FBFBFA" }}>
            <div style={{ fontSize: 11, color: C.mut, marginBottom: 8 }}>비워두면 자동 계산값을 사용해요. 이 현장에만 적용됩니다.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label={`공수 (자동 ${r.autoDays}일)`}>
                <NumIn v={(site.ov && site.ov.days) || ""} set={(v) => upOv("days", v)} ph={String(r.autoDays)} suffix="일" />
              </Field>
              <Field label="하루 일당">
                <NumIn v={(site.ov && site.ov.dayRate) || ""} set={(v) => upOv("dayRate", v)} ph={fmt(settings.dayRate)} suffix="원" />
              </Field>
              <Field label={`${r.isTex ? "하도" : "페인트"} (자동 ${r.autoCans}말)`}>
                <NumIn v={(site.ov && site.ov.cans) || ""} set={(v) => upOv("cans", v)} ph={String(r.autoCans)} suffix="말" />
              </Field>
              <Field label="한 말 단가">
                <NumIn v={(site.ov && site.ov.cansPrice) || ""} set={(v) => upOv("cansPrice", v)} ph={fmt(r.isTex ? settings.primerPrice : settings.paintPrice)} suffix="원" />
              </Field>
              <Field label={`${r.matName.replace(" 20kg", "")} (자동 ${r.autoBags}포)`}>
                <NumIn v={(site.ov && site.ov.bags) || ""} set={(v) => upOv("bags", v)} ph={String(r.autoBags)} suffix="포" />
              </Field>
              <Field label="1포 단가">
                <NumIn v={(site.ov && site.ov.matPrice) || ""} set={(v) => upOv("matPrice", v)} ph={fmt(settings[r.proc.matPriceKey] || 0)} suffix="원" />
              </Field>
            </div>
            <Btn kind="ghost" style={{ width: "100%", marginTop: 8, padding: "9px 0", fontSize: 13 }} onClick={() => up({ ov: {} })}>자동값으로 초기화</Btn>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <Row l={`인건비  ${r.days}일 × ${fmt(r.dayRate)}원`} r={`${fmt(r.labor)}원`} />
          <Row l={`${r.isTex ? "하도" : "페인트"}  ${r.cans}말 × ${fmt(r.cansPrice)}원`} r={`${fmt(r.paintCost)}원`} />
          <Row l={`${r.matName.replace(" 20kg", "")}  ${r.bags}포 × ${fmt(r.matPrice)}원`} r={`${fmt(r.matCost)}원`} />
          <Row l="부자재 (테이프·비닐·롤러·사포)" r={`${fmt(r.sub)}원`} />
          <Row l={`기타비  ${r.days}일 × ${fmt(settings.etcPerDay)}원`} r={`${fmt(r.etc)}원`} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <span style={{ fontSize: 13, color: C.mut, whiteSpace: "nowrap" }}>이윤 <b style={{ color: C.ink }}>{r.pct}%</b></span>
            <input type="range" min="0" max="30" step="1" value={r.pct}
              onChange={(e) => setSites((p) => p.map((s) => (s.id === site.id ? { ...s, marginPct: +e.target.value } : s)))}
              style={{ flex: 1, accentColor: C.tape }} />
            <span style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{fmt(r.margin)}원</span>
          </div>
          <div style={{ background: C.ink, borderRadius: 10, padding: "12px 14px", marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: C.tape, fontWeight: 800, fontSize: 13 }}>총 견적 (만원 절사)</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(r.total)}원</span>
            </div>
            <div style={{ color: "#B9BCC2", fontSize: 11, textAlign: "right", marginTop: 2 }}>해배당 약 {fmt(r.unit)}원/㎡</div>
          </div>
        </div>
        <Btn kind="blue" style={{ width: "100%", marginTop: 12 }} onClick={() => onQuote(site, r)} disabled={r.area <= 0}>
          이 내용으로 견적서 만들기 →
        </Btn>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Btn kind="ghost" style={{ flex: 1 }} onClick={printSite} disabled={r.area <= 0}>🖨 열기·인쇄</Btn>
          <Btn kind="ghost" style={{ flex: 1 }} onClick={exportSite} disabled={r.area <= 0}>📄 파일 저장</Btn>
        </div>
      </Card>
      {docView && <DocOverlay html={docView} close={() => setDocView(null)} />}
    </div>
  );
}

/* ══════════════ 2. 견적서 탭 ══════════════ */
function QuoteTab({ quotes, setQuotes, editId, setEditId, setToast, settings, onLedger }) {
  const q = quotes.find((x) => x.id === editId);

  const newQuote = () => {
    const nq = { id: uid(), title: "", client: "", date: todayStr(), vat: false, memo: "", items: [] };
    setQuotes((p) => [nq, ...p]);
    setEditId(nq.id);
  };

  if (!q)
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <Btn onClick={newQuote}>＋ 새 견적서 작성</Btn>
        {quotes.length === 0 && (
          <Card style={{ textAlign: "center", padding: 28 }}>
            <div style={{ fontSize: 30 }}>🧾</div>
            <div style={{ fontWeight: 800, marginTop: 8 }}>작성한 견적서가 없어요</div>
            <div style={{ fontSize: 13, color: C.mut, marginTop: 6, lineHeight: 1.6 }}>
              현장계산 탭에서 "견적서 만들기"를 누르면<br />자재·공수가 자동으로 채워져요.
            </div>
          </Card>
        )}
        {quotes.map((x) => {
          const sum = x.items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);
          const total = x.vat ? Math.round(sum * 1.1) : sum;
          return (
            <Card key={x.id}>
              <div onClick={() => setEditId(x.id)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 800 }}>{x.title || "제목 없는 견적"}</div>
                  <div style={{ fontSize: 12, color: C.mut }}>{x.date}</div>
                </div>
                <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.mut }}>{x.client || "발주처 미입력"} · 항목 {x.items.length}개</span>
                  <span style={{ fontWeight: 800, color: C.blue, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(total)}원</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );

  return <QuoteEditor q={q} setQuotes={setQuotes} back={() => setEditId(null)} setToast={setToast} settings={settings} onLedger={onLedger} />;
}

function QuoteEditor({ q, setQuotes, back, setToast, settings, onLedger }) {
  const [docView, setDocView] = useState(null);
  const up = (patch) => setQuotes((p) => p.map((x) => (x.id === q.id ? { ...x, ...patch } : x)));
  const upItem = (iid, patch) => up({ items: q.items.map((it) => (it.id === iid ? { ...it, ...patch } : it)) });
  const addItem = (cat) => up({ items: [...q.items, { id: uid(), cat, name: "", qty: 1, unit: "식", price: "" }] });

  const supply = q.items.reduce((a, it) => a + num(it.qty) * num(it.price), 0);
  const vatAmt = q.vat ? Math.round(supply * 0.1) : 0;
  const total = supply + vatAmt;

  const copyText = async () => {
    const lines = [
      `[견 적 서]`,
      `현장: ${q.title || "-"}`,
      `발주처: ${q.client || "-"}`,
      `일자: ${q.date}`,
      `──────────────`,
    ];
    QUOTE_CATS.forEach((cat) => {
      const its = q.items.filter((it) => it.cat === cat);
      if (!its.length) return;
      lines.push(`■ ${cat}`);
      its.forEach((it) => lines.push(`- ${it.name || "품목"}: ${fmt(num(it.qty))}${it.unit} × ${fmt(num(it.price))}원 = ${fmt(num(it.qty) * num(it.price))}원`));
    });
    lines.push(`──────────────`);
    lines.push(`공급가액: ${fmt(supply)}원`);
    if (q.vat) lines.push(`부가세(10%): ${fmt(vatAmt)}원`);
    lines.push(`합계: ${fmt(total)}원`);
    if (q.memo) lines.push(`비고: ${q.memo}`);
    const txt = lines.join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setToast("견적서를 복사했어요 · 문자로 붙여넣기");
    } catch {
      setToast("복사가 지원되지 않는 환경이에요");
    }
  };

  const buildQuoteDoc = () => {
    const rows = QUOTE_CATS.map((cat) =>
      q.items.filter((it) => it.cat === cat).map((it) =>
        `<tr><td>${esc(cat)}</td><td>${esc(it.name || "품목")}</td><td class="num">${fmt(num(it.qty))} ${esc(it.unit)}</td><td class="num">${fmt(num(it.price))}</td><td class="num">${fmt(num(it.qty) * num(it.price))}</td></tr>`
      ).join("")
    ).join("");
    const bz = settings || {};
    const inner = `<h1>견 적 서</h1>
<p class="meta"><b>${esc(bz.bizName || "")}</b> · 대표 ${esc(bz.bizOwner || "")} · 사업자등록번호 ${esc(bz.bizNo || "")}${bz.bizPhone ? ` · ☎ ${esc(bz.bizPhone)}` : ""}</p>
<p class="meta">${esc(bz.bizAddr || "")}</p>
<p class="meta">현장: ${esc(q.title || "-")} · 발주처: ${esc(q.client || "-")} · 견적일: ${esc(q.date)}</p>
<table><thead><tr><th>구분</th><th>품명</th><th class="num">수량</th><th class="num">단가(원)</th><th class="num">금액(원)</th></tr></thead><tbody>${rows}
<tr><td colspan="4">공급가액</td><td class="num">${fmt(supply)}</td></tr>
${q.vat ? `<tr><td colspan="4">부가세 (10%)</td><td class="num">${fmt(vatAmt)}</td></tr>` : ""}
<tr class="total"><td colspan="4">합 계</td><td class="num">${fmt(total)}원</td></tr></tbody></table>
${q.memo ? `<p class="meta">비고: ${esc(q.memo)}</p>` : ""}
${bz.bizAccount ? `<p class="meta">입금계좌: ${esc(bz.bizAccount)}</p>` : ""}
<p class="meta">본 견적은 현장 여건에 따라 변동될 수 있습니다. 유효기간: 견적일로부터 30일</p>`;
    return docShell(`견적서 ${q.title || ""}`, inner);
  };
  const printQuote = () => setDocView(buildQuoteDoc());
  const exportQuote = () => downloadHTML(`견적서_${q.title || "현장"}_${q.date}.html`, buildQuoteDoc(), setToast);

  const copyTaxInfo = async () => {
    const sup = q.vat ? supply : total;
    const tax = Math.round(sup * 0.1);
    const txt = [
      "[전자세금계산서 발행 정보 — 손택스 입력용]",
      `공급자: ${settings.bizName || ""} (${settings.bizNo || ""}) 대표 ${settings.bizOwner || ""}`,
      `작성일자: ${q.date}`,
      `품목: ${q.title || "도장공사"}`,
      `공급가액: ${fmt(sup)}원`,
      `세액(10%): ${fmt(tax)}원`,
      `합계: ${fmt(sup + tax)}원`,
      `공급받는자: ${q.client || "(발주처 사업자번호 확인 필요)"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setToast("발행 정보 복사됨 · 손택스에 붙여넣으세요");
    } catch {
      setToast("복사가 지원되지 않는 환경이에요");
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Btn kind="ghost" onClick={back} style={{ padding: "8px 12px" }}>← 목록</Btn>
        <Btn kind="danger" style={{ padding: "8px 12px" }} onClick={() => { setQuotes((p) => p.filter((x) => x.id !== q.id)); back(); }}>삭제</Btn>
      </div>

      <Card>
        <Tape>견적 정보</Tape>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <Field label="현장명 / 제목"><input style={textStyle} value={q.title} placeholder="예) 마포 상가 도장공사" onChange={(e) => up({ title: e.target.value })} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="발주처"><input style={textStyle} value={q.client} onChange={(e) => up({ client: e.target.value })} /></Field>
            <Field label="일자"><input type="date" style={textStyle} value={q.date} onChange={(e) => up({ date: e.target.value })} /></Field>
          </div>
        </div>
      </Card>

      <Card>
        <Tape>항목 추가</Tape>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {QUOTE_CATS.map((cat) => (
            <button key={cat} onClick={() => addItem(cat)}
              style={{ padding: "7px 11px", borderRadius: 999, border: `1.5px solid ${C.line}`, background: "#FBFBFA", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              ＋ {cat}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, borderTop: `1px dashed ${C.line}`, paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: C.mut, fontWeight: 600, marginBottom: 6 }}>인건비 빠른 추가</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              ["반장 (본인)", (settings && settings.dayRate) || 350000],
              ["기공", 300000],
              ["조공·보조", 200000],
              ["반공수", 175000],
            ].map(([nm, pr]) => (
              <button key={nm} onClick={() => up({ items: [...q.items, { id: uid(), cat: "인건비", name: nm, qty: 1, unit: "공수", price: pr }] })}
                style={{ padding: "7px 11px", borderRadius: 999, border: `1.5px solid ${C.ink}`, background: C.tape, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                ＋ {nm}
              </button>
            ))}
          </div>
        </div>

        {QUOTE_CATS.map((cat) => {
          const its = q.items.filter((it) => it.cat === cat);
          if (!its.length) return null;
          return (
            <div key={cat} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.blue, marginBottom: 6 }}>■ {cat}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {its.map((it) => (
                  <div key={it.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, background: "#FBFBFA" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={{ ...textStyle, flex: 1 }} value={it.name} placeholder="품명 (예: 수성페인트 18L)" onChange={(e) => upItem(it.id, { name: e.target.value })} />
                      <button onClick={() => up({ items: q.items.filter((x) => x.id !== it.id) })}
                        style={{ border: "none", background: "none", color: C.mut, fontSize: 14, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1.4fr", gap: 6, marginTop: 6 }}>
                      <NumIn v={it.qty} set={(v) => upItem(it.id, { qty: v })} ph="수량" />
                      <input style={inputStyle} value={it.unit} placeholder="단위" onChange={(e) => upItem(it.id, { unit: e.target.value })} />
                      <NumIn v={it.price} set={(v) => upItem(it.id, { price: v })} ph="단가" suffix="원" />
                    </div>
                    <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>
                      = {fmt(num(it.qty) * num(it.price))}원
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Card>

      <Card style={{ borderColor: C.ink, borderWidth: 1.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tape>합계</Tape>
          <button onClick={() => up({ vat: !q.vat })}
            style={{ padding: "6px 10px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              border: `2px solid ${q.vat ? C.ink : C.line}`, background: q.vat ? C.tape : "#fff" }}>
            부가세 10% {q.vat ? "포함" : "미포함"}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <Row l="공급가액" r={`${fmt(supply)}원`} />
          {q.vat && <Row l="부가세 (10%)" r={`${fmt(vatAmt)}원`} />}
          <div style={{ background: C.ink, borderRadius: 10, padding: "12px 14px", marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ color: C.tape, fontWeight: 800, fontSize: 13 }}>합계 금액</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(total)}원</span>
          </div>
        </div>
        <Field label="비고">
          <textarea style={{ ...textStyle, minHeight: 56, resize: "vertical", marginTop: 4 }} value={q.memo}
            placeholder="예) 색상 2가지 초과 시 별도 협의, 폐기물 처리 포함" onChange={(e) => up({ memo: e.target.value })} />
        </Field>
        <Btn kind="blue" style={{ width: "100%", marginTop: 10 }} onClick={printQuote}>🖨 견적서 열기 (인쇄 · PDF 저장)</Btn>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Btn kind="ghost" style={{ flex: 1 }} onClick={exportQuote}>📄 파일 저장</Btn>
          <Btn kind="ghost" style={{ flex: 1 }} onClick={copyText}>📋 텍스트 복사</Btn>
        </div>
        <div style={{ fontSize: 11, color: C.mut, marginTop: 6, lineHeight: 1.6 }}>
          <b>보내는 법:</b> "견적서 열기" → 위쪽 <b>🖨 인쇄 · PDF 저장</b> 버튼 → <b>PDF로 저장</b> 선택 → 공유로 카톡·문자 전송. 다 보면 <b>← 앱으로 돌아가기</b>를 누르세요.
        </div>
        <Btn kind="ghost" style={{ width: "100%", marginTop: 10, borderColor: C.green, color: C.green }} onClick={() => onLedger(q, total)} disabled={total <= 0}>
          💰 공사 완료 — 장부에 매출로 기록
        </Btn>
        <div style={{ marginTop: 12, border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 10, background: "#FBFBFA" }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>🧾 전자세금계산서 발행</div>
          <div style={{ fontSize: 12, color: C.mut, marginTop: 4, lineHeight: 1.6 }}>
            세금계산서는 법적으로 홈택스(손택스 앱)에서만 발행할 수 있어요. 아래 버튼으로 발행 정보를 복사한 뒤, 손택스 → 전자세금계산서 발급 메뉴에 그대로 입력하세요.
          </div>
          <Btn kind="ghost" style={{ width: "100%", marginTop: 8 }} onClick={copyTaxInfo}>
            발행 정보 복사 (공급가액 {fmt(q.vat ? supply : total)}원 + 세액 {fmt(Math.round((q.vat ? supply : total) * 0.1))}원)
          </Btn>
        </div>
      </Card>
      {docView && <DocOverlay html={docView} close={() => setDocView(null)} />}
    </div>
  );
}

/* ══════════════ 3. 공수 달력 탭 ══════════════ */
const DAY_TYPES = [
  { k: "my", label: "내 현장", color: C.blue, gongsu: 1 },
  { k: "day", label: "일당", color: C.tape, gongsu: 1 },
  { k: "half", label: "반공수", color: C.orange, gongsu: 0.5 },
  { k: "off", label: "휴무·오디션", color: C.gray, gongsu: 0 },
];

function CalTab({ cal, setCal, settings }) {
  const today = new Date();
  const [ym, setYm] = useState([today.getFullYear(), today.getMonth()]);
  const [sel, setSel] = useState(null); // { start, end|null }
  const [drag, setDrag] = useState(null); // { start, end }
  const movedRef = useRef(false);

  const keyFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const btn = el && el.closest ? el.closest("[data-day]") : null;
    return btn ? btn.getAttribute("data-day") : null;
  };
  const inDrag = (key) => {
    if (!drag) return false;
    const a = drag.start < drag.end ? drag.start : drag.end;
    const b = drag.start < drag.end ? drag.end : drag.start;
    return key >= a && key <= b;
  };
  const endDrag = () => {
    if (!drag) return;
    const a = drag.start < drag.end ? drag.start : drag.end;
    const b = drag.start < drag.end ? drag.end : drag.start;
    setSel(movedRef.current && a !== b ? { start: a, end: b } : { start: drag.start, end: null });
    setDrag(null);
  };
  const [year, month] = ym;

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);

  const keyOf = (d) => `${year}-${pad2(month + 1)}-${pad2(d)}`;

  let gongsu = 0, income = 0, myCnt = 0, dayCnt = 0;
  Object.entries(cal).forEach(([k, v]) => {
    if (!k.startsWith(`${year}-${pad2(month + 1)}`)) return;
    const t = DAY_TYPES.find((x) => x.k === v.type);
    if (t) gongsu += t.gongsu;
    income += num(v.amount);
    if (v.type === "my") myCnt++;
    if (v.type === "day") dayCnt++;
  });

  const move = (dir) => {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setYm([y, m]);
    setSel(null);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* 월 요약 */}
      <Card style={{ background: C.ink, borderColor: C.ink }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => move(-1)} style={{ border: "none", background: "none", color: C.tape, fontSize: 20, cursor: "pointer", padding: 4 }}>‹</button>
          <div style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 20, color: "#fff" }}>{year}년 {month + 1}월</div>
          <button onClick={() => move(1)} style={{ border: "none", background: "none", color: C.tape, fontSize: 20, cursor: "pointer", padding: 4 }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, textAlign: "center" }}>
          {[["총 공수", `${gongsu}일`], ["내 현장 / 일당", `${myCnt} / ${dayCnt}`], ["이달 수입", `${fmt(income / 10000)}만`]].map(([lb, v]) => (
            <div key={lb}>
              <div style={{ fontSize: 11, color: "#B9BCC2" }}>{lb}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.tape, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 달력 */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", textAlign: "center", fontSize: 11, fontWeight: 800, color: C.mut, marginBottom: 6 }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div key={d} style={{ color: i === 0 ? C.red : i === 6 ? C.blue : C.mut }}>{d}</div>
          ))}
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, touchAction: "none" }}
          onPointerMove={(e) => {
            if (!drag) return;
            const k2 = keyFromPoint(e.clientX, e.clientY);
            if (k2 && k2 !== drag.end) {
              movedRef.current = movedRef.current || k2 !== drag.start;
              setDrag((d) => ({ ...d, end: k2 }));
            }
          }}
          onPointerUp={endDrag}
          onPointerCancel={() => setDrag(null)}
        >
          {cells.map((d, i) => {
            if (d == null) return <div key={i} />;
            const k = keyOf(d);
            const e = cal[k];
            const t = e && DAY_TYPES.find((x) => x.k === e.type);
            const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
            return (
              <button key={i} data-day={k}
                onPointerDown={() => { movedRef.current = false; setDrag({ start: k, end: k }); }}
                style={{ minHeight: 52, borderRadius: 8, padding: "4px 2px", cursor: "pointer", fontFamily: "inherit",
                  border: (sel && sel.start === k) || inDrag(k) ? `2px solid ${C.ink}` : `1px solid ${isToday ? C.ink : C.line}`,
                  background: inDrag(k) ? C.tape + "55" : t ? t.color + "22" : "#FBFBFA" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: i % 7 === 0 ? C.red : i % 7 === 6 ? C.blue : C.ink }}>{d}</div>
                {t && (
                  <>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: t.color, margin: "3px auto 0", border: `1px solid rgba(0,0,0,0.15)` }} />
                    {num(e.amount) > 0 && <div style={{ fontSize: 9, color: C.mut, fontFamily: "'IBM Plex Mono', monospace" }}>{Math.round(num(e.amount) / 10000)}만</div>}
                  </>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          {DAY_TYPES.map((t) => (
            <span key={t.k} style={{ fontSize: 11, color: C.mut, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: t.color, display: "inline-block", border: "1px solid rgba(0,0,0,0.15)" }} />{t.label}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>👆 하루는 탭, 여러 날은 드래그로 한 번에 선택하세요 · 수입은 장부 탭에서 한 번에 가져갈 수 있어요</div>
      </Card>

      {sel && <DayEditor key={sel.start + (sel.end || "")} k={sel.start} initEnd={sel.end} cal={cal} setCal={setCal} settings={settings} close={() => setSel(null)} />}
    </div>
  );
}

function DayEditor({ k, initEnd, cal, setCal, settings, close }) {
  const e = cal[k] || {};
  const [type, setType] = useState(e.type || "day");
  const [siteName, setSiteName] = useState(e.site || "");
  const [amount, setAmount] = useState(e.amount != null ? String(e.amount) : String(settings.dayRate));
  const [rangeOn, setRangeOn] = useState(!!initEnd);
  const [end, setEnd] = useState(initEnd || "");
  const [skipSun, setSkipSun] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const fmtD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseD = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
  const save = () => {
    const entry = { type, site: siteName, amount: type === "off" ? 0 : num(amount) };
    const c = { ...cal };
    if (rangeOn && end) {
      let a = parseD(k), b = parseD(end);
      if (b < a) { const t = a; a = b; b = t; }
      let cnt = 0;
      for (let d = new Date(a); d <= b && cnt < 92; d.setDate(d.getDate() + 1), cnt++) {
        if (skipSun && d.getDay() === 0) continue;
        c[fmtD(d)] = { ...entry };
      }
    } else {
      c[k] = entry;
    }
    setCal(c);
    close();
  };

  const pick = (t) => {
    setType(t.k);
    if (t.k === "off") setAmount("0");
    else if (t.k === "half") setAmount(String(Math.round(settings.dayRate / 2)));
    else if (!num(amount)) setAmount(String(settings.dayRate));
  };

  return (
    <div ref={boxRef}>
    <Card style={{ borderColor: C.ink, borderWidth: 1.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Tape>{k.slice(5).replace("-", "/")}{rangeOn && end ? ` ~ ${end.slice(5).replace("-", "/")}` : ""} 기록</Tape>
        <button onClick={close} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: C.mut }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {DAY_TYPES.map((t) => (
          <button key={t.k} onClick={() => pick(t)}
            style={{ padding: "8px 12px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              border: `2px solid ${type === t.k ? C.ink : C.line}`,
              background: type === t.k ? t.color + "33" : "#FBFBFA", color: C.ink }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <Field label="현장 / 메모">
          <input style={textStyle} value={siteName} placeholder="예) OO방수 김반장 현장" onChange={(ev) => setSiteName(ev.target.value)} />
        </Field>
        {type !== "off" && (
          <Field label="일당 / 수입 (하루 기준)">
            <NumIn v={amount} set={setAmount} suffix="원" />
          </Field>
        )}
        <div style={{ border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 10, background: "#FBFBFA" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>📅 기간으로 입력</span>
            <button onClick={() => setRangeOn(!rangeOn)}
              style={{ padding: "6px 12px", borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                border: `2px solid ${rangeOn ? C.ink : C.line}`, background: rangeOn ? C.tape : "#fff" }}>
              {rangeOn ? "켜짐" : "꺼짐"}
            </button>
          </div>
          {rangeOn && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="시작일"><input type="date" style={{ ...textStyle, background: "#EFEFEC" }} value={k} readOnly /></Field>
                <Field label="종료일"><input type="date" style={textStyle} value={end} min={k} onChange={(ev) => setEnd(ev.target.value)} /></Field>
              </div>
              <button onClick={() => setSkipSun(!skipSun)}
                style={{ justifySelf: "start", padding: "6px 12px", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  border: `2px solid ${skipSun ? C.ink : C.line}`, background: skipSun ? C.tape : "#fff" }}>
                일요일 제외 {skipSun ? "✓" : ""}
              </button>
              <div style={{ fontSize: 11, color: C.mut }}>기간 내 모든 날짜에 같은 기록이 저장돼요. 저장 후 하루씩 따로 수정할 수 있어요.</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {cal[k] && (
          <Btn kind="danger" style={{ flex: 1 }} onClick={() => { const c = { ...cal }; delete c[k]; setCal(c); close(); }}>기록 삭제</Btn>
        )}
        <Btn style={{ flex: 2 }} onClick={save}>
          {rangeOn && end ? "기간 저장" : "저장"}
        </Btn>
      </div>
    </Card>
    </div>
  );
}

/* ══════════════ 4. 장부(경리) 탭 ══════════════ */
function BookTab({ ledger, setLedger, cal, settings, setSettings, setToast }) {
  const today = new Date();
  const [ym, setYm] = useState([today.getFullYear(), today.getMonth()]);
  const [view, setView] = useState("month"); // month | vat | tax | invoice
  const [editId, setEditId] = useState(null); // 항목 id 또는 "new"
  const [year, month] = ym;
  const mp = `${year}-${pad2(month + 1)}`;

  const move = (dir) => {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setYm([y, m]);
    setEditId(null);
  };

  const monthEntries = ledger.filter((e) => (e.date || "").startsWith(mp)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const sumOf = (arr, kind) => arr.filter((e) => e.kind === kind).reduce((a, e) => a + num(e.amount), 0);
  const inSum = sumOf(monthEntries, "in");
  const outSum = sumOf(monthEntries, "out");

  // 최근 6개월 막대그래프 데이터
  const bars = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i, y = year;
    while (m < 0) { m += 12; y--; }
    const p = `${y}-${pad2(m + 1)}`;
    const es = ledger.filter((e) => (e.date || "").startsWith(p));
    bars.push({ label: `${m + 1}월`, in: sumOf(es, "in"), out: sumOf(es, "out") });
  }
  const barMax = Math.max(1, ...bars.map((b) => Math.max(b.in, b.out)));

  // 공수달력 → 장부 가져오기 (이번 달, 중복 방지)
  const importCal = () => {
    const existing = new Set(ledger.filter((e) => e.src === "cal").map((e) => e.ref));
    const adds = [];
    Object.entries(cal).forEach(([k, v]) => {
      if (!k.startsWith(mp)) return;
      if (!num(v.amount)) return;
      if (existing.has(k)) return;
      adds.push({
        id: uid(), date: k, kind: "in",
        cat: v.type === "my" ? "도장공사" : "일당",
        amount: num(v.amount),
        evi: v.type === "my" ? "simple" : "w33",
        client: v.site || "", memo: "공수달력에서 가져옴", src: "cal", ref: k,
      });
    });
    if (adds.length) {
      setLedger((p) => [...adds, ...p]);
      setToast(`달력에서 ${adds.length}건 가져왔어요`);
    } else {
      setToast("가져올 새 기록이 없어요");
    }
  };

  const editEntry = editId === "new" ? null : ledger.find((e) => e.id === editId);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* 보기 전환 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["month", "📒 월별 장부"], ["vat", "🧮 부가세"], ["tax", "🏛 종소세"], ["invoice", "🧾 계산서 대장"]].map(([k, lb]) => (
          <Chip key={k} on={view === k} onClick={() => { setView(k); setEditId(null); }}>{lb}</Chip>
        ))}
      </div>

      {view === "month" && (
        <>
          {/* 월 요약 */}
          <Card style={{ background: C.ink, borderColor: C.ink }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => move(-1)} style={{ border: "none", background: "none", color: C.tape, fontSize: 20, cursor: "pointer", padding: 4 }}>‹</button>
              <div style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 20, color: "#fff" }}>{year}년 {month + 1}월 장부</div>
              <button onClick={() => move(1)} style={{ border: "none", background: "none", color: C.tape, fontSize: 20, cursor: "pointer", padding: 4 }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, textAlign: "center" }}>
              {[["수입", inSum, C.tape], ["지출", outSum, "#FF8A80"], ["남는 돈", inSum - outSum, "#8AFFA0"]].map(([lb, v, cl]) => (
                <div key={lb}>
                  <div style={{ fontSize: 11, color: "#B9BCC2" }}>{lb}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: cl, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{fmt(v / 10000)}만</div>
                </div>
              ))}
            </div>
            {/* 6개월 추이 */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 14, height: 56 }}>
              {bars.map((b, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 40, width: "100%", justifyContent: "center" }}>
                    <div style={{ width: 8, height: Math.max(2, (b.in / barMax) * 40), background: C.tape, borderRadius: 2 }} />
                    <div style={{ width: 8, height: Math.max(2, (b.out / barMax) * 40), background: "#FF8A80", borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#B9BCC2" }}>{b.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#B9BCC2", textAlign: "right", marginTop: 4 }}>■ 노랑=수입 · 빨강=지출</div>
          </Card>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn style={{ flex: 1 }} onClick={() => setEditId("new")}>＋ 수입·지출 기록</Btn>
            <Btn kind="ghost" style={{ flex: 1 }} onClick={importCal}>🗓 달력 수입 가져오기</Btn>
          </div>

          {editId && (
            <EntryEditor key={editId} entry={editEntry} settings={settings}
              save={(en) => {
                if (editEntry) setLedger((p) => p.map((e) => (e.id === en.id ? en : e)));
                else setLedger((p) => [en, ...p]);
                setEditId(null);
              }}
              del={editEntry ? () => { setLedger((p) => p.filter((e) => e.id !== editEntry.id)); setEditId(null); } : null}
              close={() => setEditId(null)} />
          )}

          {/* 항목 목록 */}
          {monthEntries.length === 0 && !editId && (
            <Card style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 28 }}>💰</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>이달 기록이 없어요</div>
              <div style={{ fontSize: 13, color: C.mut, marginTop: 6, lineHeight: 1.6 }}>
                자재 사면 지출로, 공사비 받으면 수입으로 적어두세요.<br />
                부가세·종소세 신고 때 증빙별로 자동 집계돼요.
              </div>
            </Card>
          )}
          {monthEntries.map((e) => {
            const ev = eviOf(e.evi);
            return (
              <Card key={e.id} style={{ padding: 12, cursor: "pointer" }}>
                <div onClick={() => setEditId(e.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: e.kind === "in" ? C.green : C.red, display: "inline-block" }} />
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{e.cat}</span>
                      <span style={{ fontSize: 11, color: C.mut, border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 7px" }}>{ev.label}</span>
                    </div>
                    <span style={{ fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: e.kind === "in" ? C.green : C.red }}>
                      {e.kind === "in" ? "+" : "−"}{fmt(e.amount)}원
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: C.mut }}>
                    <span>{e.client || e.memo || ""}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{(e.date || "").slice(5).replace("-", "/")}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {view === "vat" && <VatView ledger={ledger} year={year} setYear={(y) => setYm([y, month])} />}
      {view === "tax" && <TaxView ledger={ledger} year={year} setYear={(y) => setYm([y, month])} settings={settings} setSettings={setSettings} />}
      {view === "invoice" && <InvoiceView ledger={ledger} year={year} setYear={(y) => setYm([y, month])} settings={settings} setToast={setToast} />}
    </div>
  );
}

/* ── 장부 항목 입력 ── */
function EntryEditor({ entry, settings, save, del, close }) {
  const [kind, setKind] = useState(entry ? entry.kind : "out");
  const [date, setDate] = useState(entry ? entry.date : todayStr());
  const [cat, setCat] = useState(entry ? entry.cat : "자재비");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [evi, setEvi] = useState(entry ? entry.evi : "card");
  const [client, setClient] = useState(entry ? entry.client || "" : "");
  const [memo, setMemo] = useState(entry ? entry.memo || "" : "");
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const cats = kind === "in" ? IN_CATS : OUT_CATS;
  const switchKind = (k) => {
    setKind(k);
    setCat(k === "in" ? "도장공사" : "자재비");
    setEvi(k === "in" ? "tax" : "card");
  };

  return (
    <div ref={boxRef}>
      <Card style={{ borderColor: C.ink, borderWidth: 1.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tape>{entry ? "기록 수정" : "새 기록"}</Tape>
          <button onClick={close} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: C.mut }}>✕</button>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Chip on={kind === "in"} onClick={() => switchKind("in")} color={C.green + "33"}>💵 수입 (들어온 돈)</Chip>
            <Chip on={kind === "out"} onClick={() => switchKind("out")} color={C.red + "22"}>🛒 지출 (나간 돈)</Chip>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 8 }}>
            <Field label="날짜"><input type="date" style={textStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="금액"><NumIn v={amount} set={setAmount} suffix="원" /></Field>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.mut, fontWeight: 600, marginBottom: 6 }}>분류</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {cats.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.mut, fontWeight: 600, marginBottom: 6 }}>
              증빙 {kind === "in" ? "(어떻게 받았나)" : "(어떻게 결제했나)"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EVI_TYPES.map((ev) => <Chip key={ev.k} on={evi === ev.k} onClick={() => setEvi(ev.k)}>{ev.label}</Chip>)}
            </div>
            <div style={{ fontSize: 11, color: C.mut, marginTop: 6, lineHeight: 1.5 }}>
              {kind === "in"
                ? "세금계산서·카드·현금영수증 매출은 부가세 신고에 자동 집계돼요. 일당을 3.3% 떼고 받으면 '3.3% 원천'을 고르세요."
                : "세금계산서·사업자카드·현금영수증(지출증빙) 지출만 부가세 매입공제가 돼요. 간이영수증은 종소세 경비로만 인정."}
            </div>
          </div>
          <Field label="거래처 (선택)">
            <input style={textStyle} value={client} placeholder={kind === "in" ? "예) 김사장, OO인테리어" : "예) OO페인트상사"} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label="메모 (선택)">
            <input style={textStyle} value={memo} placeholder="예) 마포 현장 자재" onChange={(e) => setMemo(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {del && <Btn kind="danger" style={{ flex: 1 }} onClick={del}>삭제</Btn>}
          <Btn style={{ flex: 2 }} disabled={!num(amount)} onClick={() =>
            save({ ...(entry || { id: uid() }), kind, date, cat, amount: num(amount), evi, client, memo, src: entry ? entry.src : undefined, ref: entry ? entry.ref : undefined })
          }>저장</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ── 연도 선택 공용 ── */
function YearNav({ year, setYear, suffix }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
      <button onClick={() => setYear(year - 1)} style={{ border: "none", background: "none", color: C.tape, fontSize: 20, cursor: "pointer", padding: 4 }}>‹</button>
      <div style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 20, color: "#fff" }}>{year}년 {suffix}</div>
      <button onClick={() => setYear(year + 1)} style={{ border: "none", background: "none", color: C.tape, fontSize: 20, cursor: "pointer", padding: 4 }}>›</button>
    </div>
  );
}

/* ── 부가세 요약 ── */
function VatView({ ledger, year, setYear }) {
  const [half, setHalf] = useState(new Date().getMonth() < 6 ? 1 : 2);
  const months = half === 1 ? ["01", "02", "03", "04", "05", "06"] : ["07", "08", "09", "10", "11", "12"];
  const inPeriod = (e) => {
    const d = e.date || "";
    return d.startsWith(`${year}-`) && months.includes(d.slice(5, 7));
  };
  const es = ledger.filter(inPeriod);
  const salesEvi = es.filter((e) => e.kind === "in" && eviOf(e.evi).vat);
  const salesEtc = es.filter((e) => e.kind === "in" && !eviOf(e.evi).vat);
  const buysEvi = es.filter((e) => e.kind === "out" && eviOf(e.evi).vat);
  const sSum = salesEvi.reduce((a, e) => a + num(e.amount), 0);
  const eSum = salesEtc.reduce((a, e) => a + num(e.amount), 0);
  const bSum = buysEvi.reduce((a, e) => a + num(e.amount), 0);
  const outVat = vatOf(sSum);
  const inVat = vatOf(bSum);
  const due = outVat - inVat;

  return (
    <>
      <Card style={{ background: C.ink, borderColor: C.ink }}>
        <YearNav year={year} setYear={setYear} suffix="부가세" />
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
          {[[1, "1기 (1~6월 · 7월 신고)"], [2, "2기 (7~12월 · 1월 신고)"]].map(([h, lb]) => (
            <button key={h} onClick={() => setHalf(h)}
              style={{ padding: "8px 12px", borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                border: `2px solid ${half === h ? C.tape : "#3A3B3E"}`, background: half === h ? C.tape : "transparent", color: half === h ? C.ink : "#B9BCC2" }}>
              {lb}
            </button>
          ))}
        </div>
        <div style={{ background: "#26272B", borderRadius: 10, padding: "12px 14px", marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ color: C.tape, fontWeight: 800, fontSize: 13 }}>예상 납부세액</span>
          <span style={{ color: due >= 0 ? "#fff" : "#8AFFA0", fontWeight: 800, fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }}>
            {due >= 0 ? `${fmt(due)}원` : `환급 ${fmt(-due)}원`}
          </span>
        </div>
      </Card>

      <Card>
        <Tape>매출 (판 것)</Tape>
        <div style={{ marginTop: 8 }}>
          <Row l={`과세 매출 ${salesEvi.length}건 (세금계산서·카드·현금영수증)`} r={`${fmt(sSum)}원`} />
          <Row l="→ 매출세액 (÷11)" r={`${fmt(outVat)}원`} bold color={C.red} />
          {eSum > 0 && <Row l={`기타 수입 ${salesEtc.length}건 (3.3%·무증빙 — 부가세 집계 제외)`} r={`${fmt(eSum)}원`} />}
        </div>
      </Card>
      <Card>
        <Tape>매입 (산 것)</Tape>
        <div style={{ marginTop: 8 }}>
          <Row l={`적격증빙 매입 ${buysEvi.length}건`} r={`${fmt(bSum)}원`} />
          <Row l="→ 매입세액 공제 (÷11)" r={`−${fmt(inVat)}원`} bold color={C.green} />
        </div>
        <div style={{ borderTop: `2px solid ${C.ink}`, marginTop: 6, paddingTop: 6 }}>
          <Row l="예상 납부세액 = 매출세액 − 매입세액" r={due >= 0 ? `${fmt(due)}원` : `환급 ${fmt(-due)}원`} bold />
        </div>
        <div style={{ fontSize: 11, color: C.mut, marginTop: 8, lineHeight: 1.6 }}>
          ⚠️ <b>일반과세자, 부가세 포함 금액 기준</b> 추정치예요. 예정고지·가산세·신용카드 발행 공제 등은 반영되지 않아요.
          실제 신고·납부는 홈택스(손택스)에서 하고, 금액이 크면 세무사 확인을 받으세요.
          간이과세자는 업종별 부가율이 달라 이 계산과 다릅니다.
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 800 }}>📌 부가세 달력</div>
        <div style={{ fontSize: 12, color: C.mut, marginTop: 6, lineHeight: 1.8 }}>
          · <b>1기 확정신고</b>: 7월 1일 ~ 25일 (1~6월분)<br />
          · <b>2기 확정신고</b>: 다음해 1월 1일 ~ 25일 (7~12월분)<br />
          · 세금계산서는 공급일이 속한 달의 <b>다음 달 10일까지</b> 발행해야 가산세가 없어요.
        </div>
      </Card>
    </>
  );
}

/* ── 종합소득세 요약 ── */
function TaxView({ ledger, year, setYear, settings, setSettings }) {
  const es = ledger.filter((e) => (e.date || "").startsWith(`${year}-`));
  const totalIn = es.filter((e) => e.kind === "in").reduce((a, e) => a + num(e.amount), 0);
  const totalOut = es.filter((e) => e.kind === "out").reduce((a, e) => a + num(e.amount), 0);
  const w33In = es.filter((e) => e.kind === "in" && e.evi === "w33").reduce((a, e) => a + num(e.amount), 0);
  const withheld = Math.round(w33In * 0.033); // 세전 일당 기준 3.3% 기납부 추정

  const bookIncome = Math.max(0, totalIn - totalOut);
  const ded = num(settings.incomeDeduction);
  const base = Math.max(0, bookIncome - ded);
  const tax = calcIncomeTax(base);
  const local = Math.round(tax * 0.1);
  const finalDue = Math.max(0, tax + local - withheld);

  const rate = num(settings.simpleExpRate);
  const simpleIncome = rate > 0 ? Math.max(0, Math.round(totalIn * (1 - rate / 100))) : null;

  return (
    <>
      <Card style={{ background: C.ink, borderColor: C.ink }}>
        <YearNav year={year} setYear={setYear} suffix="종합소득세" />
        <div style={{ fontSize: 11, color: "#B9BCC2", textAlign: "center", marginTop: 4 }}>다음해 5월 1일~31일 신고 · 홈택스</div>
        <div style={{ background: "#26272B", borderRadius: 10, padding: "12px 14px", marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ color: C.tape, fontWeight: 800, fontSize: 13 }}>예상 납부세액 (지방세 포함)</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(finalDue)}원</span>
        </div>
      </Card>

      <Card>
        <Tape>장부 기준 (기장)</Tape>
        <div style={{ marginTop: 8 }}>
          <Row l="총수입금액 (장부 수입 전체)" r={`${fmt(totalIn)}원`} />
          <Row l="필요경비 (장부 지출 전체)" r={`−${fmt(totalOut)}원`} />
          <Row l="소득금액" r={`${fmt(bookIncome)}원`} bold />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <Field label="소득공제 합계 (기본공제 등)">
            <NumIn v={settings.incomeDeduction} set={(v) => setSettings((p) => ({ ...p, incomeDeduction: num(v) }))} suffix="원" />
          </Field>
          <Field label="단순경비율 (선택, %)">
            <NumIn v={settings.simpleExpRate || ""} set={(v) => setSettings((p) => ({ ...p, simpleExpRate: num(v) }))} ph="미설정" suffix="%" />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Row l="과세표준 (소득금액 − 소득공제)" r={`${fmt(base)}원`} />
          <Row l="산출세액 (6~45% 누진)" r={`${fmt(tax)}원`} />
          <Row l="지방소득세 (10%)" r={`${fmt(local)}원`} />
          {withheld > 0 && <Row l="기납부세액 추정 (3.3% 원천징수분)" r={`−${fmt(withheld)}원`} color={C.green} />}
          <div style={{ borderTop: `2px solid ${C.ink}`, marginTop: 4, paddingTop: 4 }}>
            <Row l="예상 납부세액" r={`${fmt(finalDue)}원`} bold />
          </div>
        </div>
        {simpleIncome != null && (
          <div style={{ marginTop: 10, border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 10, background: "#FBFBFA" }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>단순경비율 {rate}% 적용 시 비교</div>
            <Row l="추정 소득금액 (수입 × (100−경비율)%)" r={`${fmt(simpleIncome)}원`} />
            <div style={{ fontSize: 11, color: C.mut, lineHeight: 1.5 }}>
              장부 소득금액({fmt(bookIncome)}원)과 비교해서 유리한 쪽을 세무사와 상의하세요. 단순경비율은 수입 규모 요건이 있어요.
            </div>
          </div>
        )}
        <div style={{ fontSize: 11, color: C.mut, marginTop: 8, lineHeight: 1.6 }}>
          ⚠️ 참고용 추정치예요. 인적공제·노란우산공제·국민연금·세액공제(자녀·표준 등)는 반영되지 않았어요.
          업종코드별 경비율은 홈택스에서 확인하세요 (도장공사는 건설업 코드). 실제 신고 전 세무사 상담을 권해요.
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 800 }}>📌 종소세 절세 체크리스트</div>
        <div style={{ fontSize: 12, color: C.mut, marginTop: 6, lineHeight: 1.9 }}>
          ✅ 자재는 <b>사업자 카드</b>로 사고 세금계산서 받기 (경비 인정 + 부가세 공제)<br />
          ✅ 인건비 지급은 계좌이체 + <b>3.3% 원천징수 신고</b>해야 경비로 인정<br />
          ✅ 유류비·차량비는 사업용으로 구분해서 기록<br />
          ✅ <b>노란우산공제</b> 가입하면 연 최대 500만원 소득공제<br />
          ✅ 5월 신고 전에 이 장부를 내보내서 세무사에게 전달하면 수수료가 줄어요
        </div>
      </Card>
    </>
  );
}

/* ── 세금계산서 발행 대장 ── */
function InvoiceView({ ledger, year, setYear, settings, setToast }) {
  const rows = ledger
    .filter((e) => e.kind === "in" && e.evi === "tax" && (e.date || "").startsWith(`${year}-`))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = rows.reduce((a, e) => a + num(e.amount), 0);
  const totalSupply = total - vatOf(total);

  const copyRow = async (e) => {
    const sup = num(e.amount) - vatOf(num(e.amount));
    const tax = vatOf(num(e.amount));
    const txt = [
      "[전자세금계산서 발행 정보 — 손택스 입력용]",
      `공급자: ${settings.bizName || ""} (${settings.bizNo || ""}) 대표 ${settings.bizOwner || ""}`,
      `작성일자: ${e.date}`,
      `품목: ${e.memo || e.cat || "도장공사"}`,
      `공급가액: ${fmt(sup)}원`,
      `세액(10%): ${fmt(tax)}원`,
      `합계: ${fmt(num(e.amount))}원`,
      `공급받는자: ${e.client || "(발주처 사업자번호 확인 필요)"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setToast("발행 정보 복사됨 · 손택스에 붙여넣으세요");
    } catch {
      setToast("복사가 지원되지 않는 환경이에요");
    }
  };

  return (
    <>
      <Card style={{ background: C.ink, borderColor: C.ink }}>
        <YearNav year={year} setYear={setYear} suffix="세금계산서 대장" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, textAlign: "center" }}>
          {[["발행 건수", `${rows.length}건`], ["공급가액", `${fmt(totalSupply / 10000)}만`], ["합계(세 포함)", `${fmt(total / 10000)}만`]].map(([lb, v]) => (
            <div key={lb}>
              <div style={{ fontSize: 11, color: "#B9BCC2" }}>{lb}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.tape, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {rows.length === 0 && (
        <Card style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 28 }}>🧾</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>{year}년 세금계산서 매출이 없어요</div>
          <div style={{ fontSize: 13, color: C.mut, marginTop: 6, lineHeight: 1.6 }}>
            장부에 수입을 기록할 때 증빙을 <b>세금계산서</b>로 고르면<br />여기 대장에 자동으로 올라와요.
          </div>
        </Card>
      )}
      {rows.map((e) => {
        const sup = num(e.amount) - vatOf(num(e.amount));
        return (
          <Card key={e.id} style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{e.client || e.memo || "거래처 미입력"}</div>
                <div style={{ fontSize: 12, color: C.mut, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {e.date} · 공급가 {fmt(sup)} + 세액 {fmt(vatOf(num(e.amount)))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{fmt(e.amount)}원</div>
                <button onClick={() => copyRow(e)}
                  style={{ border: `1.5px solid ${C.line}`, background: "#FBFBFA", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
                  📋 손택스용 복사
                </button>
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <div style={{ fontSize: 13, fontWeight: 800 }}>📌 발행 순서 (손택스)</div>
        <div style={{ fontSize: 12, color: C.mut, marginTop: 6, lineHeight: 1.9 }}>
          1️⃣ 위에서 <b>손택스용 복사</b> 누르기<br />
          2️⃣ 손택스 앱 → 전자(세금)계산서 → <b>발급</b><br />
          3️⃣ 복사한 내용대로 입력 (공급받는자 사업자번호 필수)<br />
          4️⃣ 공급일 <b>다음 달 10일까지</b> 발행해야 가산세가 없어요<br />
          ※ 개인(비사업자) 손님에게는 세금계산서 대신 <b>현금영수증(지출증빙)</b>을 발행하세요.
        </div>
      </Card>
    </>
  );
}

/* ══════════════ 5. 단가 설정 탭 ══════════════ */
function SetTab({ settings, setSettings, setToast, allData, importAll }) {
  const fileRef = useRef(null);
  const items = [
    ["dayRate", "내 하루 일당", "원", "하루 최소 목표 수입 기준"],
    ["marginPct", "기본 이윤", "%", "원가 합계에 붙이는 비율 (10~20% 권장)"],
    ["coverageNew", "신축: 한 말(18L)당 도장 면적", "㎡", "석고+투퍼티 초벌·재벌 기준 (약 5~8평)"],
    ["coverageRe", "재도장: 한 말(18L)당 도장 면적", "㎡", "2회 도장 기준 (약 8~10평)"],
    ["puttyCoverage", "퍼티 1포(20kg)당 면적", "㎡", "투퍼티 기준"],
    ["paintPrice", "수성페인트 한 말 가격", "원", "국산 수성 기준"],
    ["puttyPrice", "퍼티 1포 가격", "원", ""],
    ["primerPrice", "하도(프라이머) 한 말 가격", "원", "스타코·미장 공정용"],
    ["stuccoPrice", "스타코 1포(20kg) 가격", "원", ""],
    ["plasterPrice", "미장재 1포(20kg) 가격", "원", "유럽·암석미장"],
    ["dailyAreaNew", "신축: 1인 1일 처리량", "㎡", "올퍼티+샌딩+2회 도장 포함"],
    ["dailyAreaRe", "재도장: 1인 1일 처리량", "㎡", ""],
    ["subRate", "부자재 단가", "원/㎡", "테이프·비닐·롤러·사포 (최소 3만 원)"],
    ["etcPerDay", "기타비", "원/일", "주차·유류·식대"],
  ];

  const exportBackup = () => {
    const data = { app: "paint-site-notebook", version: 2, exportedAt: new Date().toISOString(), ...allData };
    downloadFile(`현장수첩_백업_${todayStr()}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8", setToast, "백업 파일 저장됨 · 카톡 나에게 보내기로 보관하세요");
  };
  const onImportFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importAll(JSON.parse(reader.result));
      } catch {
        setToast("백업 파일을 읽지 못했어요");
      }
    };
    reader.onerror = () => setToast("백업 파일을 읽지 못했어요");
    reader.readAsText(f);
    e.target.value = "";
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Card>
        <Tape>사업자 정보</Tape>
        <div style={{ fontSize: 12, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
          견적서·실측서 파일과 세금계산서 발행 정보에 자동으로 들어가요.
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="상호"><input style={textStyle} value={settings.bizName || ""} onChange={(e) => setSettings((p) => ({ ...p, bizName: e.target.value }))} /></Field>
            <Field label="대표자"><input style={textStyle} value={settings.bizOwner || ""} onChange={(e) => setSettings((p) => ({ ...p, bizOwner: e.target.value }))} /></Field>
          </div>
          <Field label="사업자등록번호"><input style={textStyle} value={settings.bizNo || ""} onChange={(e) => setSettings((p) => ({ ...p, bizNo: e.target.value }))} /></Field>
          <Field label="사업장 주소"><input style={textStyle} value={settings.bizAddr || ""} onChange={(e) => setSettings((p) => ({ ...p, bizAddr: e.target.value }))} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
            <Field label="연락처"><input style={textStyle} inputMode="tel" placeholder="010-0000-0000" value={settings.bizPhone || ""} onChange={(e) => setSettings((p) => ({ ...p, bizPhone: e.target.value }))} /></Field>
            <Field label="입금계좌 (선택)"><input style={textStyle} placeholder="은행 000-000-000000" value={settings.bizAccount || ""} onChange={(e) => setSettings((p) => ({ ...p, bizAccount: e.target.value }))} /></Field>
          </div>
        </div>
      </Card>

      <Card>
        <Tape>데이터 백업</Tape>
        <div style={{ fontSize: 12, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
          현장·견적·달력·장부 전체를 파일 하나로 저장해요. 폰을 바꾸거나 앱을 지워도 이 파일만 있으면 복원돼요.
          <b> 한 달에 한 번</b>은 백업해서 카톡 '나에게 보내기'로 보관하세요.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn style={{ flex: 1 }} onClick={exportBackup}>💾 백업 파일 저장</Btn>
          <Btn kind="ghost" style={{ flex: 1 }} onClick={() => fileRef.current && fileRef.current.click()}>📂 백업 복원</Btn>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onImportFile} />
        </div>
      </Card>

      <Card>
        <Tape>평균 단가 기준</Tape>
        <div style={{ fontSize: 12, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
          서울·수도권 평균치를 기본값으로 넣어뒀어요. 실제 시세와 본인 기준에 맞게 수정하면 모든 계산에 바로 반영돼요.
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {items.map(([key, label, unit, hint]) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                  {hint && <div style={{ fontSize: 11, color: C.mut, marginTop: 1 }}>{hint}</div>}
                </div>
                <div style={{ width: 128 }}>
                  <NumIn v={settings[key]} set={(v) => setSettings((p) => ({ ...p, [key]: num(v) }))} suffix={unit} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Btn kind="ghost" style={{ width: "100%", marginTop: 14 }} onClick={() => { setSettings(DEFAULT_SETTINGS); setToast("기본값으로 되돌렸어요"); }}>
          기본값으로 초기화
        </Btn>
      </Card>
      <div style={{ fontSize: 11, color: C.mut, textAlign: "center", lineHeight: 1.6, padding: "0 10px 10px" }}>
        입력한 현장·견적·달력·장부는 이 기기에 자동 저장돼요. (백업 파일로 옮길 수 있어요)<br />
        암산 공식 — 벽: (가로+세로)×2×층고 · 천장: 가로×세로 · 아파트 평×10 · 상가 평×9
      </div>
    </div>
  );
}
