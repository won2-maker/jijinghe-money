import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, Cell, CartesianGrid, Dot } from "recharts";

// ─────────────────────────────────────────────
// 구글 시트 설정
// 시트ID: 1_l6xtPvZ2a3Unbqt7GbbOn7-HjqfGFU70eDpiFOFdbk
// gid   : 1399369916 (2026년 시트)
// ─────────────────────────────────────────────
const SHEET_ID  = "1_l6xtPvZ2a3Unbqt7GbbOn7-HjqfGFU70eDpiFOFdbk";
const SHEET_GID = "1399369916";
// Apps Script 중계 URL (CORS 우회 + JSON 반환)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby710o2zinVBcYrc1xCiq02vVlBbSroIsw-5UL83UE6VHRP3bf-AhJ2UZ7Dsavm0tEFbw/exec";

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

// ─────────────────────────────────────────────
// CSV 파싱 & 데이터 추출
// 스프레드시트 구조:
//   행3~4   : 급여(원중/혜지)   → 수입
//   행5     : 기타 수익
//   행11~38 : 고정지출 항목들
//   행40~57 : 변동지출 항목들
//   행75~83 : 부채
//   행84~89 : 금융자산
// 월 데이터: E열(1월)~P열(12월) = CSV 인덱스 4~15
// ─────────────────────────────────────────────
function parseNum(s) {
  if (!s) return 0;
  const n = Number(String(s).replace(/,/g,"").trim());
  return isNaN(n) ? 0 : n;
}

// Apps Script에서 받은 2D 배열(rows)을 파싱
function parseRows(rows) {

  // 월별 값 추출 (col 4~15 = 1월~12월)
  const getMonthly = (rowIdx) => {
    const r = rows[rowIdx] || [];
    return Array.from({length:12}, (_,i) => parseNum(r[4+i]));
  };

  // 소분류(D열=col3) 기준으로 행 찾기
  const findRow = (label) => rows.findIndex(r => {
    const cell = (r[3]||r[2]||"").replace(/\s/g,"");
    return cell.includes(label.replace(/\s/g,""));
  });

  // 구분(A열) + 대분류(B) + 중분류(C) + 소분류(D) 기준 탐색
  const findRowBy = (colIdx, label) => rows.findIndex(r =>
    (r[colIdx]||"").replace(/\s/g,"").includes(label.replace(/\s/g,""))
  );

  // ── 수입 ──
  // row 2(idx2)=헤더, idx3=급여원중(원종), idx4=급여혜지(폐지), idx5=기타
  const income = {
    "급여 (원중)": getMonthly(2),  // row3
    "급여 (혜지)": getMonthly(3),  // row4
    "기타 수익":   getMonthly(4),  // row5
  };

  // ── 고정지출 행 매핑 (소분류 D열 기준, 1-indexed → 0-indexed)
  // 스프레드시트 이미지 기준 행번호
  const fixedRowMap = {
    "교통비":          10,  // row11
    "물돈":            12,  // row13 (원중)
    "보험":            14,  // row15 (원중)
    "통신비":          17,  // row18 (원중본)
    "계모임":          20,  // row21 (원중)
    "생활비카드":      21,  // row22
    "카드부 상환":     24,  // row25
    "집대출 (원중)":   27,  // row28 (원증신한대출35)
    "집세 (신한은행)": 37,  // row38 (집세신한은행)
    "가스":            32,  // row33 전기세
    "가스비":          34,  // row35
    "관리비":          35,  // row36
    "수도세":          36,  // row37
  };
  const fixed = {};
  for (const [k,ri] of Object.entries(fixedRowMap)) {
    fixed[k] = getMonthly(ri);
  }

  // ── 변동지출
  const varRowMap = {
    "주거 원중대출(35%)": 27,
    "주거 혜지대출(14%)": 28,
    "원중 하나비상금":    29,
    "원중 카카오":        30,
    "원중 신한비상금":    31,
    "혜지 카카오비상금":  32,
    "자동차 유지비":      39,
    "자동차 정비":        40,
    "자동차 보험료":      41,
    "자동차 톨비":        42,
    "자동차 과태료":      43,
    "의료비":             44,
    "경조사":             45,
    "명절":               48,
    "여행경비":           49,
    "구독서비스":         50,
    "미용":               51,
    "물품구매":           52,
    "운동":               54,
    "이동교통비":         55,
    "기타":               56,
  };
  const variable = {};
  for (const [k,ri] of Object.entries(varRowMap)) {
    variable[k] = getMonthly(ri);
  }

  // ── 부채 (row 75~83 → idx 74~82)
  const debtRowMap = {
    "신담은행(기금)": 74,
    "원중 IBS":       76,
    "원중 우리":      77,
    "원중 신한":      78,
    "원중 하나":      79,
    "원중 카카오":    80,
    "혜지 카카오":    81,
  };
  const debt = {};
  for (const [k,ri] of Object.entries(debtRowMap)) {
    debt[k] = getMonthly(ri);
  }

  // ── 금융자산 (row 84~93 → idx 83~92)
  const assetRowMap = {
    "연금저축": 83,
    "배당주":   84,
    "원금투자": 85,
    "잔여코인": 88,
  };
  const assets = {};
  for (const [k,ri] of Object.entries(assetRowMap)) {
    assets[k] = getMonthly(ri);
  }

  // ── 실물자산: A열 "실물자산" 텍스트로 위치 동적 탐색
  // 행이 추가/이동돼도 A열 구분값 기준으로 찾으므로 행 번호 무관
  const physicalAssets = {};
  const physStartIdx = findRowBy(0, "실물자산");
  if (physStartIdx !== -1) {
    for (let i = physStartIdx + 1; i < rows.length; i++) {
      const aCol = (rows[i][0] || "").trim(); // A열 구분
      const bCol = (rows[i][1] || "").trim(); // B열 대분류
      const dCol = (rows[i][3] || "").trim(); // D열 소분류(항목명)
      // A열에 다른 구분값이 나타나면 섹션 종료
      if (aCol && aCol !== "실물자산") break;
      // 합계 행 스킵
      if (bCol.includes("합계") || dCol.includes("합계")) continue;
      // 항목명 없으면 스킵
      if (!dCol) continue;
      physicalAssets[dCol] = getMonthly(i);
    }
  }

  return { income, fixed, variable, debt, assets, physicalAssets };
}

// ─────────────────────────────────────────────
// 고정 그룹핑 정의
// ─────────────────────────────────────────────
const FIXED_GROUPS = {
  "주거 대출":  ["집대출 (원중)","집세 (신한은행)"],
  "집 관리비":  ["가스","가스비","관리비","수도세"],
  "생활 고정":  ["교통비","물돈","보험","통신비","계모임","생활비카드","카드부 상환"],
};
const VAR_GROUPS = {
  "주거":        ["주거 원중대출(35%)","주거 혜지대출(14%)","원중 하나비상금","원중 카카오","원중 신한비상금","혜지 카카오비상금"],
  "자동차·의료": ["자동차 유지비","자동차 정비","자동차 보험료","자동차 톨비","자동차 과태료","의료비"],
  "생활비":      ["경조사","명절","여행경비","구독서비스","미용","물품구매","운동","이동교통비","기타"],
};

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
const sum    = arr => (arr||[]).reduce((a,b)=>a+b,0);
const fwIdx  = (keys,src,i) => keys.reduce((s,k)=>s+(src[k]?.[i]||0),0);
const fwAll  = (keys,src)   => keys.reduce((s,k)=>s+sum(src[k]),0);

function buildMonthly(raw) {
  return MONTHS.map((month,i) => {
    const 급여 = (raw.income["급여 (원중)"]?.[i]||0)+(raw.income["급여 (혜지)"]?.[i]||0);
    const 기타 = raw.income["기타 수익"]?.[i]||0;
    const income   = { 급여, 기타, total:급여+기타 };
    const fixed    = Object.values(raw.fixed).reduce((s,a)=>s+(a[i]||0),0);
    const variable = Object.values(raw.variable).reduce((s,a)=>s+(a[i]||0),0);
    const fixedGroups = Object.fromEntries(Object.entries(FIXED_GROUPS).map(([g,ks])=>[g,fwIdx(ks,raw.fixed,i)]));
    const varGroups   = Object.fromEntries(Object.entries(VAR_GROUPS).map(([g,ks])=>[g,fwIdx(ks,raw.variable,i)]));
    const totalDebt     = Object.values(raw.debt).reduce((s,a)=>s+(a[i]||0),0);
    const totalAsset    = Object.values(raw.assets).reduce((s,a)=>s+(a[i]||0),0);
    const totalPhysical = Object.values(raw.physicalAssets||{}).reduce((s,a)=>s+(a[i]||0),0);
    return { month, income, fixed, variable, fixedGroups, varGroups, 순익:income.total-fixed-variable, totalDebt, totalAsset, totalPhysical };
  });
}

// ─────────────────────────────────────────────
// 포맷
// ─────────────────────────────────────────────
const fmt = n => {
  if (!n && n!==0) return "-";
  if (n===0) return "-";
  const sign=n<0?"-":""; const abs=Math.abs(n);
  if (abs>=100000000) {
    const 억=Math.floor(abs/100000000);
    const 만=Math.floor((abs%100000000)/10000);
    return sign+억.toLocaleString()+"억"+(만>0?" "+만.toLocaleString()+"만원":"원");
  }
  const 만=Math.floor(abs/10000); const 원=abs%10000;
  if (만>0&&원>0) return sign+만.toLocaleString()+"만 "+원.toLocaleString()+"원";
  if (만>0) return sign+만.toLocaleString()+"만원";
  return sign+원.toLocaleString()+"원";
};
const fmtM = n => {
  if (!n||n===0) return "-";
  const sign=n<0?"-":""; const abs=Math.abs(n);
  if (abs>=100000000) {
    const 억=Math.floor(abs/100000000);
    const 만=Math.round((abs%100000000)/10000);
    return sign+억.toLocaleString()+"억"+(만>0?" "+만.toLocaleString()+"만원":"원");
  }
  return sign+Math.round(abs/10000).toLocaleString()+"만원";
};

// ─────────────────────────────────────────────
// 공통 UI 컴포넌트
// ─────────────────────────────────────────────
const TT = ({ active:a, payload, label }) => {
  if (!a||!payload?.length) return null;
  return (
    <div style={{ background:"#EDEDED", border:"1px solid #ffffff15", borderRadius:8, padding:"8px 12px", fontSize:11 }}>
      <div style={{ color:"#FF7E36", fontWeight:700, marginBottom:4 }}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{ color:p.color||"#ccc", marginBottom:1 }}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
};

function MonthTabs({ selIdx, onSelect, color="#FF7E36", active }) {
  return (
    <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
      {active.map(a => {
        const idx=MONTHS.indexOf(a.month); const on=idx===selIdx;
        return (
          <button key={a.month} onClick={()=>onSelect(idx)} style={{
            flexShrink:0, background:on?`${color}18`:"#FFFFFF",
            border:`1px solid ${on?color:"#D5D5D5"}`,
            borderRadius:8, color:on?color:"#333333",
            padding:"6px 16px", fontSize:13, cursor:"pointer",
            fontFamily:"inherit", fontWeight:on?700:400,
          }}>{a.month}</button>
        );
      })}
    </div>
  );
}

function AccordionCard({ label, value, color, sub, isOpen, onToggle, children }) {
  return (
    <div style={{ marginBottom:8 }}>
      <div onClick={onToggle} style={{
        background:isOpen?`${color}15`:"#FFFFFF",
        border:`1px solid ${isOpen?color:color+"33"}`,
        borderRadius:14, padding:"14px 16px", cursor:"pointer", transition:"all .15s",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:9, color, fontWeight:700, letterSpacing:.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:isOpen?color:"#1A1A1A" }}>{fmt(value)}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            {sub}
            <div style={{ fontSize:9, color, marginTop:6 }}>{isOpen?"▲ 닫기":"▼ 세부내역"}</div>
          </div>
        </div>
      </div>
      {isOpen && <div style={{ marginTop:4 }}>{children}</div>}
    </div>
  );
}

function DetailPanel({ groups, src, monthIdx, color }) {
  const allGroups = { ...FIXED_GROUPS, ...VAR_GROUPS };
  return (
    <div style={{ background:"#F5F0EB", border:`1px solid ${color}22`, borderRadius:12, padding:"12px 14px" }}>
      {Object.entries(groups).map(([group, groupTotal]) => {
        const keys  = allGroups[group]||[];
        const items = keys
          .map(k=>({ k, v: monthIdx!==null ? (src[k]?.[monthIdx]||0) : sum(src[k]||[]) }))
          .filter(x=>x.v>0);
        if (!groupTotal && !items.length) return null;
        return (
          <div key={group} style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color, fontWeight:700, marginBottom:6, paddingBottom:4, borderBottom:`1px solid ${color}22` }}>
              {group} <span style={{ fontWeight:400, color:"#333333" }}>{fmt(groupTotal)}</span>
            </div>
            {items.map(({k,v})=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#333333", padding:"3px 0", borderBottom:"1px solid #E8E0D8" }}>
                <span>{k}</span><span style={{ fontWeight:600, color:"#333333" }}>{fmt(v)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function NetCard({ label, net, income, expense }) {
  const pos=net>=0;
  return (
    <div style={{ background:"#FFFFFF", border:`1px solid ${pos?"#00C47133":"#F0445233"}`, borderRadius:14, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <div>
        <div style={{ fontSize:9, color:"#333333", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:700, color:pos?"#00C471":"#F04452" }}>{pos?"+":""}{fmt(net)}</div>
      </div>
      <div style={{ textAlign:"right", fontSize:11, color:"#444444" }}>
        <div style={{ color:"#FF7E3688" }}>수입 {fmtM(income)}</div>
        <div style={{ marginTop:2 }}>지출 {fmtM(expense)}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 월별
// ─────────────────────────────────────────────
function MonthlyTab({ monthly, active, totalPhysicalByMonth, totalDebtByMonth }) {
  const lastIdx = MONTHS.indexOf(active[active.length-1].month);
  const [selIdx, setSelIdx] = useState(lastIdx);
  const [open, setOpen]     = useState(null);
  const toggle = key => setOpen(p=>p===key?null:key);
  const m = monthly[selIdx];
  const barData = active.map(a=>({ name:a.month, 수입:a.income.total, 고정지출:a.fixed, 변동지출:a.variable }));

  // 순자산 = 실물자산(시트) + 금융자산 - 부채
  const totalPhysical  = totalPhysicalByMonth[selIdx] || 0;
  const totalDebt      = totalDebtByMonth[selIdx] || 0;
  const totalFinancial = monthly[selIdx]?.totalAsset || 0;
  const netWorth       = totalPhysical + totalFinancial - totalDebt;
  // 전월 순자산
  const prevSelIdx     = selIdx - 1;
  const prevDebt       = prevSelIdx >= 0 ? (totalDebtByMonth[prevSelIdx] || 0) : null;
  const prevFinancial  = prevSelIdx >= 0 ? (monthly[prevSelIdx]?.totalAsset || 0) : null;
  const prevPhysical   = prevSelIdx >= 0 ? (totalPhysicalByMonth[prevSelIdx] || 0) : null;
  const prevNetWorth   = prevDebt !== null ? (prevPhysical + prevFinancial - prevDebt) : null;
  const netWorthChange = prevNetWorth !== null ? netWorth - prevNetWorth : null;

  return (
    <div>
      <MonthTabs selIdx={selIdx} onSelect={i=>{ setSelIdx(i); setOpen(null); }} active={active} />

      <div className="desktop-2col">
        {/* 왼쪽: 카드 영역 */}
        <div className="desktop-left">
          {/* 3칸 요약 카드 */}
          <div className="summary-3col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
            <div onClick={()=>toggle("income")} style={{ background:open==="income"?"#FF7E3618":"#FFFFFF", border:`1px solid ${open==="income"?"#FF7E36":"#FF7E3633"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer" }}>
              <div style={{ fontSize:8, color:"#FF7E36", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>수입</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#FF7E36" }}>{fmtM(m.income.total)}</div>
              <div style={{ fontSize:8, color:"#333333", marginTop:4 }}>{open==="income"?"▲":"▼"} 세부</div>
            </div>
            <div onClick={()=>toggle("fixed")} style={{ background:open==="fixed"?"#c96a6a18":"#FFFFFF", border:`1px solid ${open==="fixed"?"#F04452":"#F0445233"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer" }}>
              <div style={{ fontSize:8, color:"#F04452", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>고정지출</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#F04452" }}>{fmtM(m.fixed)}</div>
              <div style={{ fontSize:8, color:"#333333", marginTop:4 }}>{open==="fixed"?"▲":"▼"} 세부</div>
            </div>
            <div onClick={()=>toggle("variable")} style={{ background:open==="variable"?"#9b77c918":"#FFFFFF", border:`1px solid ${open==="variable"?"#8B5CF6":"#8B5CF633"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer" }}>
              <div style={{ fontSize:8, color:"#8B5CF6", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>변동지출</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#8B5CF6" }}>{fmtM(m.variable)}</div>
              <div style={{ fontSize:8, color:"#333333", marginTop:4 }}>{open==="variable"?"▲":"▼"} 세부</div>
            </div>
          </div>

          {/* 세부내역 드로어 */}
          {open==="income" && (
            <div style={{ marginBottom:8 }}>
              <div style={{ background:"#F5F0EB", border:"1px solid #e8c76a22", borderRadius:12, padding:"12px 14px" }}>
                {[["급여 (원중)", m.income.급여/2],["급여 (혜지)", m.income.급여/2],["기타 수익", m.income.기타]].map(([k,v])=>
                  v>0 ? <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#333333", padding:"4px 0", borderBottom:"1px solid #E8E0D8" }}><span>{k}</span><span style={{ fontWeight:600, color:"#FF7E36" }}>{fmt(v)}</span></div> : null
                )}
              </div>
            </div>
          )}
          {open==="fixed" && (
            <div style={{ marginBottom:8 }}>
              <DetailPanel groups={m.fixedGroups} src={{}} monthIdx={selIdx} color="#F04452" />
            </div>
          )}
          {open==="variable" && (
            <div style={{ marginBottom:8 }}>
              <DetailPanel groups={m.varGroups} src={{}} monthIdx={selIdx} color="#8B5CF6" />
            </div>
          )}

          {/* 순이익 */}
          <NetCard label={`${m.month} 순이익`} net={m.순익} income={m.income.total} expense={m.fixed+m.variable} />

          {/* 총 순자산 */}
          <div style={{ marginBottom:16 }}>
            <div onClick={()=>toggle("networth")} style={{
              background:"#FFFFFF", border:`1px solid ${netWorth>=0?"#00C47144":"#F0445244"}`,
              borderRadius:14, padding:"14px 16px", cursor:"pointer",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:9, color:"#333333", fontWeight:700, letterSpacing:.8, marginBottom:8 }}>총 순자산</div>
                  <div style={{ fontSize:24, fontWeight:700, color:netWorth>=0?"#00C471":"#F04452" }}>
                    {netWorth>=0?"+":""}{fmtM(netWorth)}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  {netWorthChange !== null && (
                    <div style={{ marginBottom:6 }}>
                      <div style={{ fontSize:9, color:"#333333", marginBottom:3 }}>전월 대비</div>
                      <div style={{ fontSize:13, fontWeight:700, color:netWorthChange>=0?"#00C471":"#F04452" }}>
                        <span style={{ fontSize:9 }}>{netWorthChange>=0?"▲ ":"▼ "}</span>
                        {netWorthChange>=0?"+":""}{fmtM(Math.abs(netWorthChange))}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize:9, color:"#333333", marginTop:4 }}>{open==="networth"?"▲ 닫기":"▼ 세부내역"}</div>
                </div>
              </div>
            </div>
            {open==="networth" && (
              <div style={{ background:"#F5F0EB", border:"1px solid #6ac99722", borderRadius:12, padding:"12px 14px", marginTop:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#333333", padding:"4px 0", borderBottom:"1px solid #E8E0D8" }}>
                  <span>🏠 실물자산</span><span style={{ color:"#00C471", fontWeight:600 }}>{fmtM(totalPhysical)}</span>
                </div>
                {totalFinancial > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#333333", padding:"4px 0", borderBottom:"1px solid #E8E0D8" }}>
                    <span>📈 금융자산</span><span style={{ color:"#00C471", fontWeight:600 }}>{fmtM(totalFinancial)}</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#F04452", padding:"6px 0 2px", fontWeight:600 }}>
                  <span>🏦 부채</span><span>{fmtM(totalDebt)}</span>
                </div>
              </div>
            )}
          </div>
        </div>{/* desktop-left end */}

        {/* 오른쪽: 차트 영역 */}
        <div className="desktop-right">
          {/* 추이 선 그래프 */}
          <TrendChart active={active} selIdx={selIdx} setSelIdx={setSelIdx} setOpen={setOpen} />
        </div>
      </div>{/* desktop-2col end */}
    </div>
  );
}

function TrendChart({ active, selIdx, setSelIdx, setOpen }) {
  const LINES = [
    { key:"수입",    color:"#FF7E36" },
    { key:"고정지출", color:"#F04452" },
    { key:"변동지출", color:"#8B5CF6" },
  ];
  const [activeLine, setActiveLine] = useState("수입");
  const cur = LINES.find(l=>l.key===activeLine);

  const lineData = active.map(a=>({
    name: a.month,
    수입: a.income.total,
    고정지출: a.fixed,
    변동지출: a.variable,
  }));

  const CustomDot = (props) => {
    const { cx, cy, payload, value } = props;
    const isSelected = payload.name === active[selIdx]?.month;
    return (
      <g key={`dot-${payload.name}`}>
        <circle cx={cx} cy={cy} r={isSelected?6:4}
          fill={isSelected ? cur.color : "#F5F0EB"}
          stroke={cur.color} strokeWidth={2} />
        <text x={cx} y={cy-14} textAnchor="middle"
          fontSize={8} fill={isSelected ? cur.color : "#555555"} fontWeight={isSelected?700:400}>
          {fmtM(value)}
        </text>
      </g>
    );
  };

  return (
    <div style={{ background:"#FFFFFF", border:"1px solid #1e1e38", borderRadius:14, padding:"14px 12px" }}>
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {LINES.map(l=>(
          <button key={l.key} onClick={()=>setActiveLine(l.key)} style={{
            background: activeLine===l.key ? `${l.color}22` : "transparent",
            border: `1px solid ${activeLine===l.key ? l.color : "#D5D5D5"}`,
            borderRadius:8, color: activeLine===l.key ? l.color : "#555555",
            fontSize:11, padding:"4px 12px", cursor:"pointer",
            fontFamily:"inherit", fontWeight: activeLine===l.key ? 700 : 400,
          }}>{l.key}</button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={230} className="chart-height-lg">
        <LineChart data={lineData} margin={{ top:30, right:16, left:16, bottom:0 }} onClick={d=>{ if(d?.activeLabel){ const i=MONTHS.indexOf(d.activeLabel); if(i>=0){ setSelIdx(i); setOpen(null); } } }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" />
          <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <RechartTooltip content={<TT />} />
          <Line
            type="monotone" dataKey={activeLine} name={activeLine}
            stroke={cur.color} strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r:7, fill:cur.color, stroke:"#F5F0EB", strokeWidth:2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


function YearTab({ monthly, active, raw }) {
  const [open, setOpen] = useState(null);
  const toggle = key => setOpen(p=>p===key?null:key);

  const totalIncome = {
    급여: sum(monthly.map(m=>m.income.급여)),
    기타: sum(monthly.map(m=>m.income.기타)),
    total: sum(monthly.map(m=>m.income.total)),
  };
  const totalFixed    = sum(monthly.map(m=>m.fixed));
  const totalVariable = sum(monthly.map(m=>m.variable));
  const totalNet      = sum(monthly.map(m=>m.순익));
  const yearFixedGroups = Object.fromEntries(Object.entries(FIXED_GROUPS).map(([g,ks])=>[g,fwAll(ks,raw.fixed)]));
  const yearVarGroups   = Object.fromEntries(Object.entries(VAR_GROUPS).map(([g,ks])=>[g,fwAll(ks,raw.variable)]));
  const barData = active.map(a=>({ name:a.month, 수입:a.income.total, 고정지출:a.fixed, 변동지출:a.variable }));

  return (
    <div>
      <div style={{ fontSize:11, color:"#333333", marginBottom:14 }}>1~{active.length}월 누적 기준</div>

      <AccordionCard label="총 수입" value={totalIncome.total} color="#FF7E36" isOpen={open==="income"} onToggle={()=>toggle("income")}
        sub={<><div style={{ fontSize:10, color:"#333333", marginBottom:1 }}>급여 {fmtM(totalIncome.급여)}</div><div style={{ fontSize:10, color:"#333333" }}>기타 {fmtM(totalIncome.기타)}</div></>}>
        <div style={{ background:"#F5F0EB", border:"1px solid #e8c76a22", borderRadius:12, padding:"12px 14px" }}>
          {Object.entries(raw.income).map(([k,arr])=>{ const v=sum(arr); if(!v) return null; return (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#333333", padding:"4px 0", borderBottom:"1px solid #E8E0D8" }}>
              <span>{k}</span><span style={{ fontWeight:600, color:"#FF7E36" }}>{fmt(v)}</span>
            </div>
          ); })}
        </div>
      </AccordionCard>

      <AccordionCard label="총 고정지출" value={totalFixed} color="#F04452" isOpen={open==="fixed"} onToggle={()=>toggle("fixed")}
        sub={<div style={{ fontSize:10, color:"#333333" }}>수입 대비 {totalIncome.total>0?(totalFixed/totalIncome.total*100).toFixed(0):"-"}%</div>}>
        <DetailPanel groups={yearFixedGroups} src={{}} monthIdx={null} color="#F04452" />
      </AccordionCard>

      <AccordionCard label="총 변동지출" value={totalVariable} color="#8B5CF6" isOpen={open==="variable"} onToggle={()=>toggle("variable")}
        sub={<div style={{ fontSize:10, color:"#333333" }}>수입 대비 {totalIncome.total>0?(totalVariable/totalIncome.total*100).toFixed(0):"-"}%</div>}>
        <DetailPanel groups={yearVarGroups} src={{}} monthIdx={null} color="#8B5CF6" />
      </AccordionCard>

      <NetCard label="연간 순이익 (누적)" net={totalNet} income={totalIncome.total} expense={totalFixed+totalVariable} />

      <div style={{ background:"#FFFFFF", border:"1px solid #1e1e38", borderRadius:14, padding:"14px 12px" }}>
        <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>월별 흐름</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={barData} barGap={2}>
            <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <RechartTooltip content={<TT />} />
            <Bar dataKey="수입" fill="#FF7E3666" name="수입" radius={[3,3,0,0]} />
            <Bar dataKey="고정지출" fill="#c96a6a66" name="고정지출" radius={[3,3,0,0]} />
            <Bar dataKey="변동지출" fill="#8B5CF666" name="변동지출" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:12, justifyContent:"center", fontSize:10, color:"#444444", marginTop:4 }}>
          <span><span style={{color:"#FF7E36"}}>■</span> 수입</span>
          <span><span style={{color:"#F04452"}}>■</span> 고정지출</span>
          <span><span style={{color:"#8B5CF6"}}>■</span> 변동지출</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 부채
// ─────────────────────────────────────────────
function DebtTab({ monthly, active, raw }) {
  const lastIdx = MONTHS.indexOf(active[active.length-1].month);
  const [selIdx, setSelIdx] = useState(lastIdx);

  const debtItems  = Object.entries(raw.debt).map(([k,arr])=>({ k, v:arr[selIdx]||0, prev:arr[selIdx-1]||0 })).filter(x=>x.v>0);
  const totalDebt  = debtItems.reduce((s,x)=>s+x.v,0);

  // 이전 달 총 부채 (증감 계산용)
  const prevIdx    = selIdx - 1;
  const prevDebt   = prevIdx >= 0 ? Object.values(raw.debt).reduce((s,arr)=>s+(arr[prevIdx]||0),0) : null;
  const debtChange = prevDebt !== null ? totalDebt - prevDebt : null;

  // 월별 증감 데이터
  const changeData = active.map((a, i) => {
    const curIdx  = MONTHS.indexOf(a.month);
    const prevI   = curIdx - 1;
    const cur     = a.totalDebt;
    const prev    = prevI >= 0 ? Object.values(raw.debt).reduce((s,arr)=>s+(arr[prevI]||0),0) : cur;
    return { name: a.month, 증감: cur - prev };
  });

  const DC = ["#F04452","#d4855a","#c9a06a","#b8c96a","#6ab8c9","#6a7ec9","#a06ac9"];

  return (
    <div>
      <MonthTabs selIdx={selIdx} onSelect={setSelIdx} color="#F04452" active={active} />

      <div className="desktop-2col">
        <div className="desktop-left">
          {/* 이번 달 갚은 금액 — 메인 동기부여 카드 */}
          {debtChange !== null && debtChange < 0 && (
            <div style={{ background:"linear-gradient(135deg, #E6F9F1 0%, #FFFFFF 100%)", border:"1px solid #6ac99755", borderRadius:16, padding:"20px", marginBottom:12, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#6ac997aa", marginBottom:10, letterSpacing:.5 }}>🎉 이번 달 갚은 금액</div>
              <div style={{ fontSize:34, fontWeight:700, color:"#00C471", marginBottom:6 }}>
                {fmtM(Math.abs(debtChange))}
              </div>
              <div style={{ fontSize:11, color:"#00C47166" }}>잘 하고 있어요 💪</div>
            </div>
          )}
          {debtChange !== null && debtChange > 0 && (
            <div style={{ background:"#FFFFFF", border:"1px solid #c96a6a33", borderRadius:16, padding:"16px 20px", marginBottom:12, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#F04452aa", marginBottom:6 }}>⚠ 이번 달 부채 증가</div>
              <div style={{ fontSize:26, fontWeight:700, color:"#F04452" }}>+{fmtM(debtChange)}</div>
            </div>
          )}

          {/* 총 부채 */}
          <div style={{ background:"#FFFFFF", border:"1px solid #c96a6a22", borderRadius:14, padding:"14px 16px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:9, color:"#333333", fontWeight:700, letterSpacing:.8, marginBottom:4 }}>현재 총 부채</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#F04452" }}>{fmtM(totalDebt)}</div>
            </div>
            {debtChange !== null && (
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, color:"#333333", marginBottom:4 }}>전월 대비</div>
                <div style={{ fontSize:14, fontWeight:700, color: debtChange<=0?"#00C471":"#F04452" }}>
                  {debtChange<=0?"▼":"▲"} {fmtM(Math.abs(debtChange))}
                </div>
              </div>
            )}
          </div>

          {/* 항목별 부채 */}
          <div style={{ background:"#FFFFFF", border:"1px solid #c96a6a22", borderRadius:14, padding:"14px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#F04452", fontWeight:700, marginBottom:12 }}>항목별 부채</div>
            {debtItems.map(({k,v,prev},i)=>{
              const pct    = totalDebt>0?(v/totalDebt*100).toFixed(0):0;
              const change = selIdx>0 ? v-prev : null;
              return (
                <div key={k} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#333333", marginBottom:4 }}>
                    <span>{k}</span>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ fontWeight:700 }}>{fmt(v)}</span>
                      {change!==null && change!==0 && (
                        <span style={{ fontSize:10, color:change<0?"#00C471":"#F04452", marginLeft:6 }}>
                          {change<0?"↓":"↑"}{fmtM(Math.abs(change))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ width:"100%", height:5, background:"#EDEDED", borderRadius:3 }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:DC[i%DC.length], borderRadius:3 }}/>
                  </div>
                  <div style={{ fontSize:9, color:"#333333", marginTop:2 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="desktop-right">
          {/* 부채 총액 추이 — 선 그래프 */}
          <div style={{ background:"#FFFFFF", border:"1px solid #1e1e38", borderRadius:14, padding:"14px 12px" }}>
            <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>부채 추이</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={active.map(a=>({ name:a.month, 부채:a.totalDebt }))} onClick={d=>{ if(d?.activeLabel){ const i=MONTHS.indexOf(d.activeLabel); if(i>=0) setSelIdx(i); } }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" />
                <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartTooltip content={<TT />} />
                <Line
                  type="monotone" dataKey="부채" name="부채"
                  stroke="#F04452" strokeWidth={2} dot={false}
                  activeDot={{ r:5, fill:"#F04452", stroke:"#F5F0EB", strokeWidth:2 }}
                />
              </LineChart>
            </ResponsiveContainer>
            {/* 월별 증감 표 */}
            <div style={{ marginTop:12, borderTop:"1px solid #1e1e38", paddingTop:10 }}>
              <div style={{ fontSize:9, color:"#333333", fontWeight:700, marginBottom:8 }}>월별 증감</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {changeData.map((d,i)=>(
                  <div key={d.name} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"3px 0", borderBottom:"1px solid #E8E0D8" }}>
                    <span style={{ color: MONTHS.indexOf(d.name)===selIdx?"#FF7E36":"#555555" }}>{d.name}</span>
                    <span style={{ fontWeight:700, color: d.증감<0?"#00C471":d.증감>0?"#F04452":"#999999" }}>
                      {d.증감===0 ? "-" : (d.증감<0?"↓ -":"↑ +")+fmtM(Math.abs(d.증감))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 투자
// ─────────────────────────────────────────────
function InvestTab({ monthly, active, raw }) {
  const lastIdx = MONTHS.indexOf(active[active.length-1].month);
  const [selIdx, setSelIdx] = useState(lastIdx);

  const assetItems = Object.entries(raw.assets).map(([k,arr])=>({ k, v:arr[selIdx]||0 })).filter(x=>x.v>0);
  const totalAsset = assetItems.reduce((s,x)=>s+x.v,0);
  const prevSelIdx = selIdx - 1;
  const prevAsset  = prevSelIdx >= 0
    ? Object.entries(raw.assets).reduce((s,[,arr])=>s+(arr[prevSelIdx]||0),0)
    : null;
  const investGain = prevAsset !== null ? totalAsset - prevAsset : null;

  const barData = active.map(a=>({ name:a.month, 금융자산:a.totalAsset }));
  const AC = ["#00C471","#38BDF8","#8B5CF6","#FF7E36","#6ab8c9"];

  return (
    <div>
      <MonthTabs selIdx={selIdx} onSelect={setSelIdx} color="#00C471" active={active} />

      <div className="desktop-2col">
        <div className="desktop-left">
          {/* 요약 카드 2개 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div style={{ background:"#FFFFFF", border:"1px solid #6ac99733", borderRadius:14, padding:"14px 12px" }}>
              <div style={{ fontSize:9, color:"#00C471", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>금융자산</div>
              <div style={{ fontSize:20, fontWeight:700, color:"#00C471" }}>{fmtM(totalAsset)}</div>
            </div>
            <div style={{ background:"#FFFFFF", border:`1px solid ${investGain===null||investGain>=0?"#00C47133":"#F0445233"}`, borderRadius:14, padding:"14px 12px" }}>
              <div style={{ fontSize:9, color:"#333333", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>투자수익</div>
              <div style={{ fontSize:20, fontWeight:700, color:investGain===null?"#999999":investGain>=0?"#00C471":"#F04452" }}>
                {investGain===null ? "-" : (investGain>=0?"+":"")+fmtM(investGain)}
              </div>
              <div style={{ fontSize:9, color:"#444444", marginTop:4 }}>전월 대비</div>
            </div>
          </div>

          {/* 자산 항목별 */}
          {assetItems.length > 0 ? (
            <div style={{ background:"#FFFFFF", border:"1px solid #6ac99722", borderRadius:14, padding:"14px", marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#00C471", fontWeight:700, marginBottom:12 }}>자산 항목별</div>
              {assetItems.map(({k,v},i)=>{
                const pct=totalAsset>0?(v/totalAsset*100).toFixed(0):0;
                return (
                  <div key={k} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#333333", marginBottom:4 }}>
                      <span>{k}</span><span style={{ fontWeight:700, color:"#00C471" }}>{fmt(v)}</span>
                    </div>
                    <div style={{ width:"100%", height:5, background:"#EDEDED", borderRadius:3 }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:AC[i%AC.length], borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:9, color:"#333333", marginTop:2 }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background:"#FFFFFF", border:"1px solid #1e1e38", borderRadius:14, padding:"24px", textAlign:"center", marginBottom:12, color:"#444444", fontSize:12 }}>
              이 달 자산 데이터 없음
            </div>
          )}
        </div>

        <div className="desktop-right">
          {/* 금융자산 추이 — 선 그래프 */}
          <div style={{ background:"#FFFFFF", border:"1px solid #1e1e38", borderRadius:14, padding:"14px 12px" }}>
            <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>금융자산 추이</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={barData} onClick={d=>{ if(d?.activeLabel){ const i=MONTHS.indexOf(d.activeLabel); if(i>=0) setSelIdx(i); } }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" />
                <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartTooltip content={<TT />} />
                <Line
                  type="monotone" dataKey="금융자산" name="금융자산"
                  stroke="#00C471" strokeWidth={2} dot={false}
                  activeDot={{ r:5, fill:"#00C471", stroke:"#F5F0EB", strokeWidth:2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 지출 알림
// ─────────────────────────────────────────────
function AlertTab({ monthly, active, raw }) {
  const lastIdx = MONTHS.indexOf(active[active.length-1].month);
  const [selIdx, setSelIdx] = useState(lastIdx);

  const curM   = monthly[selIdx];
  const prevIdx = selIdx - 1;
  const prevM  = prevIdx >= 0 ? monthly[prevIdx] : null;

  // 고정 + 변동 항목별 전월 대비 증감 계산
  const allSrc = { ...raw.fixed, ...raw.variable };
  const items = Object.entries(allSrc).map(([k, arr]) => {
    const cur  = arr[selIdx]  || 0;
    const prev = prevIdx >= 0 ? (arr[prevIdx] || 0) : 0;
    const diff = cur - prev;
    return { k, cur, prev, diff };
  });

  const increased = items.filter(x => x.diff > 0 && x.cur > 0).sort((a,b) => b.diff - a.diff);
  const decreased = items.filter(x => x.diff < 0 && x.prev > 0).sort((a,b) => a.diff - b.diff);
  const newItems  = items.filter(x => x.diff > 0 && x.prev === 0 && x.cur > 0);

  // 총 지출 전월 대비
  const totalCur  = curM.fixed + curM.variable;
  const totalPrev = prevM ? prevM.fixed + prevM.variable : null;
  const totalDiff = totalPrev !== null ? totalCur - totalPrev : null;

  const C = { up:"#F04452", down:"#00C471", new:"#8B5CF6", bg:"#FFFFFF", border:"#EDEDED" };

  const Row = ({ label, cur, prev, diff, color }) => {
    const pct = prev > 0 ? ((diff/prev)*100).toFixed(0) : null;
    return (
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:12, color:"#1A1A1A", fontWeight:500 }}>{label}</div>
          <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>
            {prev > 0 ? `${fmtM(prev)} → ${fmtM(cur)}` : `신규 ${fmtM(cur)}`}
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:13, fontWeight:700, color }}>
            {diff > 0 ? "+" : ""}{fmtM(diff)}
          </div>
          {pct && <div style={{ fontSize:9, color, marginTop:2 }}>{diff>0?"+":""}{pct}%</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <MonthTabs selIdx={selIdx} onSelect={setSelIdx} color="#F04452" active={active} />

      {/* 총 지출 변화 요약 */}
      <div style={{ background:"#FFFFFF", border:`1px solid ${totalDiff===null||totalDiff<=0?"#00C47133":"#F0445233"}`, borderRadius:14, padding:"14px 16px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:9, color:"#888888", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>총 지출 전월 대비</div>
          <div style={{ fontSize:22, fontWeight:700, color: totalDiff===null?"#1A1A1A":totalDiff>0?"#F04452":"#00C471" }}>
            {totalDiff===null ? fmtM(totalCur) : (totalDiff>0?"+":"")+fmtM(totalDiff)}
          </div>
        </div>
        {totalDiff !== null && (
          <div style={{ textAlign:"right", fontSize:11, color:"#888888" }}>
            <div>{fmtM(totalPrev)}</div>
            <div style={{ fontSize:9, marginTop:2 }}>→ {fmtM(totalCur)}</div>
          </div>
        )}
      </div>

      {prevM === null ? (
        <div style={{ background:"#FFFFFF", border:"1px solid #EDEDED", borderRadius:14, padding:"24px", textAlign:"center", color:"#AAAAAA", fontSize:12 }}>
          비교할 전월 데이터가 없어요
        </div>
      ) : (
        <>
          {/* 증가한 항목 */}
          {increased.length > 0 && (
            <div style={{ background:"#FFFFFF", border:"1px solid #F0445222", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#F04452", fontWeight:700, marginBottom:4 }}>📈 늘어난 지출 ({increased.length}개)</div>
              {increased.map(x => <Row key={x.k} label={x.k} cur={x.cur} prev={x.prev} diff={x.diff} color={C.up} />)}
            </div>
          )}

          {/* 신규 항목 */}
          {newItems.length > 0 && (
            <div style={{ background:"#FFFFFF", border:"1px solid #8B5CF633", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#8B5CF6", fontWeight:700, marginBottom:4 }}>🆕 이번 달 새로 생긴 지출 ({newItems.length}개)</div>
              {newItems.map(x => <Row key={x.k} label={x.k} cur={x.cur} prev={0} diff={x.diff} color={C.new} />)}
            </div>
          )}

          {/* 감소한 항목 */}
          {decreased.length > 0 && (
            <div style={{ background:"#FFFFFF", border:"1px solid #00C47122", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#00C471", fontWeight:700, marginBottom:4 }}>📉 줄어든 지출 ({decreased.length}개)</div>
              {decreased.map(x => <Row key={x.k} label={x.k} cur={x.cur} prev={x.prev} diff={x.diff} color={C.down} />)}
            </div>
          )}

          {increased.length === 0 && newItems.length === 0 && (
            <div style={{ background:"#FFFFFF", border:"1px solid #00C47133", borderRadius:14, padding:"24px", textAlign:"center" }}>
              <div style={{ fontSize:20, marginBottom:8 }}>🎉</div>
              <div style={{ fontSize:13, color:"#00C471", fontWeight:700 }}>전월 대비 늘어난 지출이 없어요!</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 목업 데이터 (구글 시트 연동 전 미리보기용)
// ─────────────────────────────────────────────
const MOCK_RAW = {
  income: {
    "급여 (원중)": [2930000,3006938,3915400,3365720,0,0,0,0,0,0,0,0],
    "급여 (혜지)": [2950000,3037045,4120000,3126500,0,0,0,0,0,0,0,0],
    "기타 수익":   [410000, 5923755,0,       225000, 0,0,0,0,0,0,0,0],
  },
  fixed: {
    "교통비":          [100000,49100, 67550, 0,      0,0,0,0,0,0,0,0],
    "물돈":            [100000,119600,62450, 300000, 0,0,0,0,0,0,0,0],
    "보험":            [0,     300000,300000,0,      0,0,0,0,0,0,0,0],
    "통신비":          [100000,89100, 90000, 0,      10800,10800,10800,10800,10800,10800,10800,10800],
    "계모임":          [30000, 60000, 60000, 60000,  0,0,0,0,0,0,0,0],
    "생활비카드":      [700000,900000,300000,250000, 0,0,0,0,0,0,0,0],
    "카드부 상환":     [0,     0,     1021311,0,     0,0,0,0,0,0,0,0],
    "집대출 (원중)":   [1373019,1375014,1376869,1378724,1380579,1382434,1384289,1386144,1387999,1389854,1391709,1393564],
    "집세 (신한은행)": [2172901,2167686,2024803,1890178,1380579,1382434,1384289,1386144,1387999,1389854,1391709,1393564],
    "가스":            [19260, 19260, 28500, 0,      0,0,0,0,0,0,0,0],
    "가스비":          [310600,200000,109800,0,      0,0,0,0,0,0,0,0],
    "관리비":          [129000,141000,143100,139920, 0,0,0,0,0,0,0,0],
    "수도세":          [0,     0,     27020, 0,      0,0,0,0,0,0,0,0],
  },
  variable: {
    "주거 원중대출(35%)": [273995,272939,278534,278534,0,0,0,0,0,0,0,0],
    "주거 혜지대출(14%)": [0,     65000, 58000, 58000, 0,0,0,0,0,0,0,0],
    "원중 하나비상금":    [12500, 10000, 0,     15000, 0,0,0,0,0,0,0,0],
    "원중 카카오":        [19527, 15768, 15000, 0,     0,0,0,0,0,0,0,0],
    "원중 신한비상금":    [10000, 8785,  5000,  5000,  0,0,0,0,0,0,0,0],
    "혜지 카카오비상금":  [25000, 15000, 15000, 15000, 0,0,0,0,0,0,0,0],
    "자동차 유지비":  [0,     110000,0,      0,     0,0,0,0,0,0,0,0],
    "자동차 정비":    [0,     90000, 0,      0,     0,0,0,0,0,0,0,0],
    "자동차 보험료":  [625700,0,     0,      0,     0,0,0,0,0,0,0,0],
    "자동차 톨비":    [0,     3900,  0,      0,     0,0,0,0,0,0,0,0],
    "자동차 과태료":  [0,     0,     130000, 0,     0,0,0,0,0,0,0,0],
    "의료비":         [0,     0,     217800, 0,     0,0,0,0,0,0,0,0],
    "경조사":    [232000,371500,560000,300000,0,0,0,0,0,0,0,0],
    "명절":      [0,     110000,0,     0,     0,0,0,0,0,0,0,0],
    "여행경비":  [0,     0,     850000,0,     0,0,0,0,0,0,0,0],
    "구독서비스":[65000, 64000, 9000,  0,     0,0,0,0,0,0,0,0],
    "미용":      [112000,217800,0,     0,     0,0,0,0,0,0,0,0],
    "물품구매":  [0,     0,     1005086,0,    0,0,0,0,0,0,0,0],
    "운동":      [0,     420000,0,     0,     0,0,0,0,0,0,0,0],
    "이동교통비":[175000,0,     100000,80000, 0,0,0,0,0,0,0,0],
    "기타":      [182000,0,     0,     0,     0,0,0,0,0,0,0,0],
  },
  debt: {
    "신담은행(기금)": [413953762,413949898,413811476,413803431,0,0,0,0,0,0,0,0],
    "원중 IBS":       [35000000, 34344524, 34213556, 34082026, 0,0,0,0,0,0,0,0],
    "원중 우리":      [14000000, 14000000, 14000000, 14000000, 0,0,0,0,0,0,0,0],
    "원중 신한":      [2559298,  2999999,  139997,   0,        0,0,0,0,0,0,0,0],
    "원중 하나":      [3000000,  1115229,  3000000,  743389,   0,0,0,0,0,0,0,0],
    "원중 카카오":    [3000000,  0,        0,        0,        0,0,0,0,0,0,0,0],
    "혜지 카카오":    [3000000,  3000000,  3000000,  3000000,  0,0,0,0,0,0,0,0],
  },
  assets: {
    "연금저축": [0,       2300000,2470585,2490585,0,0,0,0,0,0,0,0],
    "배당주":   [0,       0,      0,      0,      0,0,0,0,0,0,0,0],
    "원금투자": [0,       0,      0,      20000,  0,0,0,0,0,0,0,0],
    "잔여코인": [1500000, 1500000,1500000,1500000,0,0,0,0,0,0,0,0],
  },
  // 실물자산 목업 (구글 시트 연동 전)
  physicalAssets: {
    "집":  [500000000,500000000,500000000,500000000,0,0,0,0,0,0,0,0],
    "차":  [30000000, 29500000, 29000000, 28500000, 0,0,0,0,0,0,0,0],
  },
};

// ─────────────────────────────────────────────
// 메인 앱
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 실물자산 관리 팝업
// ─────────────────────────────────────────────
const ASSET_PRESETS = [
  { id:"home",  icon:"🏠", name:"집",    placeholder:"예: 50000" },
  { id:"car",   icon:"🚗", name:"차",    placeholder:"예: 2500" },
  { id:"etc",   icon:"💎", name:"기타",  placeholder:"예: 1000" },
];

function PhysicalAssetModal({ assets, onChange, onClose }) {
  const [vals, setVals] = useState(
    Object.fromEntries(ASSET_PRESETS.map(p=>[ p.id, assets.find(a=>a.id===p.id)?.value||0 ]))
  );
  const [custom, setCustom] = useState(assets.filter(a=>!ASSET_PRESETS.find(p=>p.id===a.id)));
  const [newName, setNewName] = useState(""); const [newVal, setNewVal] = useState("");

  const save = () => {
    const result = [
      ...ASSET_PRESETS.map(p=>({ ...p, value: Number(String(vals[p.id]).replace(/,/g,""))*10000 })).filter(a=>a.value>0),
      ...custom.filter(a=>a.value>0),
    ];
    onChange(result); onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:"#FFFFFF", border:"1px solid #2a2a4a", borderRadius:"20px 20px 0 0", padding:"24px 20px", width:"100%", maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>실물자산 등록</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#333333", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
        {ASSET_PRESETS.map(p=>(
          <div key={p.id} style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:"#333333", marginBottom:6 }}>{p.icon} {p.name} (만원)</div>
            <input
              type="number" value={vals[p.id]||""} placeholder={p.placeholder}
              onChange={e=>setVals(v=>({...v,[p.id]:e.target.value}))}
              style={{ width:"100%", background:"#F5F0EB", border:"1px solid #2a2a4a", borderRadius:8, padding:"8px 12px", color:"#1A1A1A", fontSize:13, fontFamily:"inherit", outline:"none" }}
            />
          </div>
        ))}
        {custom.map((c,i)=>(
          <div key={c.id} style={{ marginBottom:14, display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"#333333", marginBottom:6 }}>{c.name} (만원)</div>
              <input type="number" value={c.value/10000||""} onChange={e=>setCustom(cs=>cs.map((x,j)=>j===i?{...x,value:Number(e.target.value)*10000}:x))}
                style={{ width:"100%", background:"#F5F0EB", border:"1px solid #2a2a4a", borderRadius:8, padding:"8px 12px", color:"#1A1A1A", fontSize:13, fontFamily:"inherit", outline:"none" }} />
            </div>
            <button onClick={()=>setCustom(cs=>cs.filter((_,j)=>j!==i))} style={{ background:"transparent", border:"none", color:"#F04452", fontSize:16, cursor:"pointer", marginTop:18 }}>✕</button>
          </div>
        ))}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="항목명" style={{ flex:1, background:"#F5F0EB", border:"1px solid #2a2a4a", borderRadius:8, padding:"8px 10px", color:"#1A1A1A", fontSize:12, fontFamily:"inherit", outline:"none" }} />
          <input value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder="만원" type="number" style={{ width:80, background:"#F5F0EB", border:"1px solid #2a2a4a", borderRadius:8, padding:"8px 10px", color:"#1A1A1A", fontSize:12, fontFamily:"inherit", outline:"none" }} />
          <button onClick={()=>{ if(newName&&newVal){ setCustom(c=>[...c,{id:`c_${Date.now()}`,icon:"💼",name:newName,value:Number(newVal)*10000}]); setNewName(""); setNewVal(""); } }}
            style={{ background:"#D5D5D5", border:"none", borderRadius:8, color:"#1A1A1A", fontSize:12, padding:"8px 12px", cursor:"pointer", fontFamily:"inherit" }}>추가</button>
        </div>
        <button onClick={save} style={{ width:"100%", background:"#00C47122", border:"1px solid #6ac997", borderRadius:10, color:"#00C471", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer", fontFamily:"inherit" }}>저장</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,     setTab]     = useState("monthly");
  const [status,  setStatus]  = useState("ok");
  const [lastSync,setLastSync]= useState(new Date());
  const mockMonthly = buildMonthly(MOCK_RAW);
  const [raw,     setRaw]     = useState(MOCK_RAW);
  const [monthly, setMonthly] = useState(mockMonthly);
  const [active,  setActive]  = useState(mockMonthly.filter(m=>m.income.total>0));
  const [showAssetModal, setShowAssetModal] = useState(false);

  // 월별 부채 합계 (순자산 계산용)
  const totalDebtByMonth = MONTHS.map((_,i)=>
    Object.values(raw.debt).reduce((s,arr)=>s+(arr[i]||0),0)
  );

  // 월별 실물자산 합계 — 구글 시트 physicalAssets에서 읽음
  const totalPhysicalByMonth = MONTHS.map((_,i)=>
    Object.values(raw.physicalAssets||{}).reduce((s,arr)=>s+(arr[i]||0),0)
  );

  // Apps Script → JSON 2D배열 → parseRows → state 업데이트
  const fetchData = useCallback(() => {
    setStatus("loading");
    fetch(APPS_SCRIPT_URL)
      .then(r => { if (!r.ok) throw new Error("fetch fail"); return r.json(); })
      .then(rows => {
        const parsed = parseRows(rows);
        const mon    = buildMonthly(parsed);
        setRaw(parsed);
        setMonthly(mon);
        setActive(mon.filter(m=>m.income.total>0));
        setLastSync(new Date());
        setStatus("ok");
      })
      .catch(() => {
        // 실패 시 목업 유지
        const mon = buildMonthly(MOCK_RAW);
        setRaw(MOCK_RAW);
        setMonthly(mon);
        setActive(mon.filter(m=>m.income.total>0));
        setLastSync(new Date());
        setStatus("error");
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { id:"monthly", label:"월별" },
    { id:"year",    label:"2026 전체" },
    { id:"debt",    label:"부채" },
    { id:"invest",  label:"투자" },
    { id:"alert",   label:"지출 알림" },
  ];

  const timeStr = lastSync
    ? `${lastSync.getHours().toString().padStart(2,"0")}:${lastSync.getMinutes().toString().padStart(2,"0")} 업데이트`
    : "";

  return (
    <div style={{ minHeight:"100vh", background:"#F5F0EB", color:"#1A1A1A", fontFamily:"'Noto Sans KR', sans-serif", paddingBottom:40 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

        /* 반응형 헬퍼 */
        .app-inner { max-width:1200px; margin:0 auto; }
        .header-row { display:flex; align-items:center; gap:12px; }
        .tab-bar { display:flex; overflow-x:auto; }
        .content-pad { padding:0 16px; }

        /* 태블릿+ (768px~) */
        @media(min-width:768px){
          .app-inner { padding:0 32px; }
          .content-pad { padding:0; }
          .header-top { padding:24px 0 0; }
          .tab-bar { gap:4px; }
          .tab-btn { font-size:14px !important; padding:10px 20px !important; }
          .summary-3col { grid-template-columns:1fr 1fr 1fr; gap:12px !important; }
          .month-tabs-wrap { display:flex; flex-wrap:wrap; gap:8px; }
        }

        /* 데스크탑 (1024px~) : 좌/우 2열 레이아웃 */
        @media(min-width:1024px){
          .desktop-2col { display:grid; grid-template-columns:420px 1fr; gap:24px; align-items:start; }
          .desktop-left { min-width:0; }
          .desktop-right { min-width:0; }
          .chart-height-lg { height:280px !important; }
          .header-logo { font-size:22px !important; }
        }
      `}</style>

      {/* 헤더 */}
      <div style={{ borderBottom:"1px solid #E8E0D8", marginBottom:20, padding:"20px 16px 0" }}>
        <div className="app-inner">
          <div className="header-row" style={{ marginBottom:4 }}>
            <div className="header-logo" style={{ fontSize:18, fontWeight:800, letterSpacing:-.5, color:"#FF7E36" }}>💰 지중헤 Money</div>
            <div style={{ marginLeft:"auto", display:"flex", gap:6, flexShrink:0 }}>
              <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}`} target="_blank" rel="noopener noreferrer"
                style={{ background:"transparent", border:"1px solid #2a2a4a", borderRadius:8, color:"#00C471", fontSize:11, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", textDecoration:"none" }}>
                🏠 시트에서 수정
              </a>
              <button onClick={fetchData} title="새로고침" style={{
                background:"transparent", border:"1px solid #2a2a4a",
                borderRadius:8, color: status==="loading"?"#FF7E36":"#555555",
                fontSize:11, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", gap:4,
              }}>
                <span style={{ display:"inline-block", animation: status==="loading"?"spin 1s linear infinite":"none" }}>↻</span>
                {status==="loading" ? "…" : "↻"}
              </button>
            </div>
          </div>
          <div style={{ fontSize:10, color: status==="error"?"#F0445288":"#AAAAAA", marginBottom:10 }}>
            {status==="error" ? "목업 데이터 미리보기" : status==="loading" ? "구글 시트 불러오는 중…" : `목업 데이터 미리보기 · ${timeStr}`}
          </div>
          <div className="tab-bar">
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className="tab-btn" style={{
                background:"transparent", border:"none",
                borderBottom:`2px solid ${tab===t.id?"#FF7E36":"transparent"}`,
                color:tab===t.id?"#FF7E36":"#555555",
                fontSize:13, fontWeight:tab===t.id?700:400,
                padding:"8px 14px", cursor:"pointer", fontFamily:"inherit",
                marginBottom:-1, transition:"all .15s", whiteSpace:"nowrap", flexShrink:0,
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="content-pad" style={{ padding:"0 16px" }}>
        <div className="app-inner">
          {/* 로딩 */}
          {status==="loading" && (
            <div style={{ textAlign:"center", paddingTop:60, color:"#444444" }}>
              <div style={{ fontSize:28, marginBottom:12 }}>📊</div>
              <div style={{ fontSize:13 }}>구글 시트에서 데이터를 불러오는 중…</div>
            </div>
          )}

          {/* 에러 */}
          {status==="error" && (
            <div style={{ textAlign:"center", paddingTop:60, color:"#F04452" }}>
              <div style={{ fontSize:28, marginBottom:12 }}>⚠️</div>
              <div style={{ fontSize:13, marginBottom:16 }}>구글 시트 연결에 실패했어요.</div>
              <div style={{ fontSize:11, color:"#333333", marginBottom:20 }}>시트가 "링크 있는 모든 사용자 - 뷰어"로 공개되어 있는지 확인해 주세요.</div>
              <button onClick={fetchData} style={{ background:"#F0445222", border:"1px solid #c96a6a", borderRadius:8, color:"#F04452", padding:"8px 20px", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>다시 시도</button>
            </div>
          )}

          {/* 데이터 정상 */}
          {status==="ok" && raw && active.length>0 && (
            <>
              {tab==="monthly" && <MonthlyTab monthly={monthly} active={active} raw={raw} totalPhysicalByMonth={totalPhysicalByMonth} totalDebtByMonth={totalDebtByMonth} />}
              {tab==="year"    && <YearTab    monthly={monthly} active={active} raw={raw} />}
              {tab==="debt"    && <DebtTab    monthly={monthly} active={active} raw={raw} />}
              {tab==="invest"  && <InvestTab  monthly={monthly} active={active} raw={raw} />}
              {tab==="alert"   && <AlertTab   monthly={monthly} active={active} raw={raw} />}
            </>
          )}
        </div>
      </div>

    </div>
  );
}