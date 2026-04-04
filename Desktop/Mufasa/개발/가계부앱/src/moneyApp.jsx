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

  // 현재 월 인덱스 (0=1월) - 이번 달 이후 데이터 제외
  const curMonthIdx = new Date().getMonth();

  const getMonthly = (rowIdx) => {
    const r = rows[rowIdx] || [];
    return Array.from({length:12}, (_,i) => {
      if (i > curMonthIdx) return 0; // 이번 달 이후 제외
      return parseNum(r[4+i]);
    });
  };

  const addMonthly = (target, key, rowIdx) => {
    const vals = getMonthly(rowIdx);
    if (!target[key]) target[key] = Array(12).fill(0);
    vals.forEach((v,i) => { target[key][i] += v; });
  };

  const income         = {};
  const incomeGroupKeys= {}; // uKey → C열 중분류
  const incomeBGroup   = {}; // uKey → B열 대분류 (급여/기타 구분용)
  const fixedByItem    = {};
  const variableByItem = {};
  const fixedGroups    = {};
  const varGroups      = {};
  const fixedGroupKeys = {}; // "중분류::소분류" → 집세통합 중분류
  const varGroupKeys   = {}; // "중분류::소분류" → 중분류
  const debt           = {};
  const assets         = {};
  const physicalAssets = {};

  let lastA = "", lastB = "", lastC = "";

  rows.forEach((row, i) => {
    const aRaw = String(row[0] || "").trim();
    const bRaw = String(row[1] || "").trim();
    const cRaw = String(row[2] || "").trim();
    const dCol = String(row[3] || "").trim();

    if (aRaw) lastA = aRaw;
    if (bRaw) lastB = bRaw;
    if (cRaw) lastC = cRaw;

    // 헤더 행 스킵 (구분/대분류/중분류/소분류 같은 컬럼명)
    if (aRaw === "구분" || dCol === "소분류") return;

    // 합계 행 스킵
    if ([aRaw,bRaw,cRaw,dCol].some(v => v.includes("합계"))) return;

    // 순이익/저축/잔금 등 비집계 섹션 스킵
    const skipSections = ["순이익", "저축", "잔금", "총 지출", "총 잔금"];
    if (skipSections.some(s => [aRaw,bRaw].some(v => v.includes(s)))) return;
    if (skipSections.some(s => lastA.includes(s) || lastB.includes(s))) return;

    if (lastA === "수익") {
      // D열 있으면 D열, 없으면 C열로 항목명 결정
      const itemName = dCol || lastC;
      if (!itemName) return;
      const uKey = lastC && dCol ? `${lastC}::${dCol}` : itemName;
      addMonthly(income, uKey, i);
      incomeGroupKeys[uKey] = lastC || "기타";
      incomeBGroup[uKey]    = lastB || "기타"; // B열 대분류 저장
      return;
    }

    if (lastA === "지출") {
      // D열 있으면 D열, 없으면 C열로 항목명 결정 (추가 지출 등 D열 없는 케이스 처리)
      const itemName = dCol || lastC;
      if (!itemName) return;
      const uKey = lastC && dCol ? `${lastC}::${dCol}` : itemName;
      const groupName = (lastC === "주거" || lastC === "집 관리비") ? "집세" : lastC;

      if (lastB === "고정지출") {
        addMonthly(fixedByItem, uKey, i);
        if (groupName) fixedGroupKeys[uKey] = groupName;
      } else if (lastB === "변동지출") {
        addMonthly(variableByItem, uKey, i);
        if (lastC) varGroupKeys[uKey] = lastC;
      }
      return;
    }

    // 부채/금융자산/실물자산: C열이 항목명, C열 새 값 있는 행만
    const skipKeywords = ["수익률", "투자수익", "소득 대비", "총 부채상환", "총 자산", "잔금"];
    if (skipKeywords.some(k => [bRaw,cRaw,dCol].some(v => v.includes(k)))) return;
    if (!cRaw) return; // C열 새 값 없으면 스킵

    if (lastA === "부채") {
      addMonthly(debt, lastC, i);
    } else if (lastA === "금융자산") {
      addMonthly(assets, lastC, i);
    } else if (lastA === "실물자산") {
      addMonthly(physicalAssets, lastC, i);
    }
  });

  // 유니크키 기반으로 fixedGroups/varGroups 재계산
  Object.entries(fixedGroupKeys).forEach(([uKey, groupName]) => {
    if (!fixedByItem[uKey]) return;
    if (!fixedGroups[groupName]) fixedGroups[groupName] = Array(12).fill(0);
    fixedByItem[uKey].forEach((v,i) => { fixedGroups[groupName][i] += v; });
  });
  Object.entries(varGroupKeys).forEach(([uKey, cKey]) => {
    if (!variableByItem[uKey]) return;
    if (!varGroups[cKey]) varGroups[cKey] = Array(12).fill(0);
    variableByItem[uKey].forEach((v,i) => { varGroups[cKey][i] += v; });
  });

  return {
    income, incomeGroupKeys, incomeBGroup,
    fixed: fixedByItem, variable: variableByItem,
    fixedGroups, varGroups, fixedGroupKeys, varGroupKeys,
    debt, assets, physicalAssets,
  };
}

// ─────────────────────────────────────────────
// 그룹핑은 parseRows에서 직접 처리하므로 별도 함수 불필요
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
const sum    = arr => (arr||[]).reduce((a,b)=>a+b,0);
const fwIdx  = (keys,src,i) => keys.reduce((s,k)=>s+(src[k]?.[i]||0),0);
const fwAll  = (keys,src)   => keys.reduce((s,k)=>s+sum(src[k]),0);
const mask   = (privacy) => privacy ? "●●●" : null; // 민감정보 마스킹

function buildMonthly(raw) {
  const fg = raw.fixedGroups  || {};
  const vg = raw.varGroups    || {};
  return MONTHS.map((month,i) => {
    const incomeTotal = Object.values(raw.income).reduce((s,a)=>s+(a[i]||0),0);
    // 급여/기타 분리
    const income급여 = Object.entries(raw.income)
      .filter(([uKey]) => (raw.incomeBGroup?.[uKey]||"") === "급여")
      .reduce((s,[,a])=>s+(a[i]||0),0);
    const income기타 = incomeTotal - income급여;
    const income      = { total: incomeTotal, 급여: income급여, 기타: income기타 };
    // KB카드에 포함된 통신비 항목들 - 이중집계 방지
    const KB_MERGED = ["통신비::원중 + 인터넷","통신비::원중폰보험","통신비::공통 (인터넷, tv등)","통신비::혜지"];
    const kbMergedSum = KB_MERGED.reduce((s,k) => s + (raw.fixed[k]?.[i]||0), 0);
    const fixed    = Object.values(raw.fixed).reduce((s,a)=>s+(a[i]||0),0) - kbMergedSum;
    const variable = Object.values(raw.variable).reduce((s,a)=>s+(a[i]||0),0);

    // C열 중분류별 월별 합계 (parseRows에서 이미 집세로 통합됨)
    const fixedGroups = Object.fromEntries(Object.entries(fg).map(([g,arr])=>[g, arr[i]||0]));
    const varGroups   = Object.fromEntries(Object.entries(vg).map(([g,arr])=>[g, arr[i]||0]));
    const totalDebt     = Object.values(raw.debt).reduce((s,a)=>s+(a[i]||0),0);
    const totalAsset    = Object.values(raw.assets).reduce((s,a)=>s+(a[i]||0),0);
    // 투자자산 = 주식/코인 관련 항목만
    const totalInvest   = Object.entries(raw.assets)
      .filter(([k]) => { const l=k.toLowerCase(); return l.includes("연금")||l.includes("배당")||l.includes("투자")||l.includes("코인")||l.includes("토스")||l.includes("주식"); })
      .reduce((s,[,a])=>s+(a[i]||0),0);
    const totalPhysical = Object.values(raw.physicalAssets||{}).reduce((s,a)=>s+(a[i]||0),0);
    return { month, income, fixed, variable, fixedGroups, varGroups, 순익:income.total-fixed-variable, totalDebt, totalAsset, totalInvest, totalPhysical };
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
        background:isOpen?`${color}15`:"#EDE8E3",
        border:`1px solid ${isOpen?color:"transparent"}`,
        borderRadius:14, padding:"14px 16px", cursor:"pointer", transition:"all .15s",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, color, fontWeight:700, marginBottom:6, textAlign:"left" }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:isOpen?color:"#1A1A1A", textAlign:"left" }}>
              {typeof value === "string" ? value : fmt(value)}
            </div>
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

function DetailPanel({ groups, raw, monthIdx, color, privacy, isFixed }) {
  const src    = isFixed ? (raw?.fixed || {}) : (raw?.variable || {});
  const keyMap = isFixed ? (raw?.fixedGroupKeys || {}) : (raw?.varGroupKeys || {});

  // 통신비 → KB카드 합산 매핑 (표시용, 실집계 변경 없음)
  // 나중에 카드 사용 안 할 때 이 설정만 바꾸면 됨
  const MERGE_INTO = {
    "통신비::원중 + 인터넷":       "생활비::원중 카드(KB) - 기타",
    "통신비::원중폰보험":           "생활비::원중 카드(KB) - 기타",
    "통신비::공통 (인터넷, tv등)":  "생활비::원중 카드(KB) - 기타",
    "통신비::혜지":                 "생활비::혜지 카드(KB) - 장보기",
  };
  const MERGED_KEYS = new Set(Object.keys(MERGE_INTO));

  const getVal = (uKey) => monthIdx !== null
    ? (src[uKey]?.[monthIdx] || 0)
    : (src[uKey] || []).reduce((a,b)=>a+b, 0);

  return (
    <div style={{ background:"#E8E3DE", borderRadius:12, padding:"12px 14px" }}>
      {Object.entries(groups).map(([group, groupTotal]) => {
        if (!groupTotal) return null;

        // KB카드로 합산되는 통신비 항목 (참고용 표시)
        const mergedItems = Object.entries(keyMap)
          .filter(([,g]) => g === group)
          .filter(([uKey]) => MERGED_KEYS.has(uKey))
          .map(([uKey]) => ({ uKey, label: uKey.replace("::", ": "), v: getVal(uKey) }))
          .filter(x => x.v > 0);

        // 일반 항목 (합계에 포함)
        const normalItems = Object.entries(keyMap)
          .filter(([,g]) => g === group)
          .filter(([uKey]) => !MERGED_KEYS.has(uKey))
          .map(([uKey]) => {
            let v = getVal(uKey);
            let suffix = "";
            // 이 항목으로 합산되는 통신비 찾기
            const merged = Object.entries(MERGE_INTO)
              .filter(([,target]) => target === uKey)
              .map(([srcKey]) => ({ srcKey, sv: getVal(srcKey) }))
              .filter(x => x.sv > 0);
            if (merged.length > 0) {
              const mergedSum = merged.reduce((s,x)=>s+x.sv,0);
              v += mergedSum;
              suffix = " (통신비 포함)";
            }
            return { uKey, label: (uKey.includes("::") ? uKey.replace("::", ": ") : uKey) + suffix, v };
          })
          .filter(x => x.v > 0);

        // 그룹 합계에서 통신비 제외한 실제 합계
        const adjustedTotal = groupTotal - mergedItems.reduce((s,x)=>s+x.v,0);

        // 소분류 라벨: "중분류: 소분류" 대신 소분류만
        const getLabel = (uKey) => uKey.includes("::") ? uKey.split("::")[1] : uKey;

        return (
          <div key={group} style={{ marginBottom:10 }}>
            {/* 중분류 헤더 + 소분류 항목들 */}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color, fontWeight:700, marginBottom:4, paddingBottom:4, borderBottom:`1px solid ${color}22` }}>
              <span>{group}</span>
              <span>{privacy?"●●●":fmt(adjustedTotal > 0 ? adjustedTotal : groupTotal)}</span>
            </div>
            {normalItems.map(({uKey, label, v}) => {
              const suffix = label.includes("(통신비 포함)") ? " (통신비 포함)" : "";
              return (
                <div key={uKey} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666666", padding:"3px 0 3px 8px", borderBottom:"1px solid #DDD8D3" }}>
                  <span>{getLabel(uKey)}{suffix}</span>
                  <span style={{ fontWeight:500, color:"#555555" }}>{privacy?"●●●":fmt(v)}</span>
                </div>
              );
            })}
            {mergedItems.length > 0 && (
              <div style={{ marginTop:4, padding:"4px 8px", background:"#E0DBD6", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"#999999", marginBottom:3 }}>KB카드에 포함 (참고)</div>
                {mergedItems.map(({uKey, v}) => (
                  <div key={uKey} style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#AAAAAA", padding:"2px 0" }}>
                    <span>{getLabel(uKey)}</span>
                    <span>{privacy?"●●●":fmt(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NetCard({ label, net, income, expense, privacy }) {
  const pos=net>=0;
  return (
    <div style={{ background:"#EDE8E3", border:`1px solid ${pos?"#00C47133":"#F0445233"}`, borderRadius:14, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <div style={{ textAlign:"left" }}>
        <div style={{ fontSize:11, color:"#888888", fontWeight:700, marginBottom:6 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:700, color:pos?"#00C471":"#F04452" }}>{privacy?"●●●":(pos?"+":"")+fmt(net)}</div>
      </div>
      <div style={{ textAlign:"right", fontSize:11, color:"#666666" }}>
        <div style={{ color:"#FF7E3688" }}>수입 {privacy?"●●●":fmtM(income)}</div>
        <div style={{ marginTop:2 }}>지출 {privacy?"●●●":fmtM(expense)}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 월별
// ─────────────────────────────────────────────
function MonthlyTab({ monthly, active, raw, totalPhysicalByMonth, totalDebtByMonth, privacy }) {
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
          {/* 3칸 요약 카드 - 항상 3칸 유지, privacy시 수입만 마스킹 */}
          {(() => {
            // 급여 / 급여 외 소득 분리 계산
            const 급여합계 = Object.entries(raw.income)
              .filter(([uKey]) => (raw.incomeBGroup?.[uKey] || "") === "급여")
              .reduce((s,[,arr]) => s + (arr[selIdx]||0), 0);
            const 기타합계 = Object.entries(raw.income)
              .filter(([uKey]) => (raw.incomeBGroup?.[uKey] || "") !== "급여")
              .reduce((s,[,arr]) => s + (arr[selIdx]||0), 0);
            return (
              <div className="summary-3col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                <div onClick={()=>!privacy && toggle("income")} style={{ background:open==="income"?"#FF7E3618":"#EDE8E3", border:`1px solid ${open==="income"?"#FF7E36":"transparent"}`, borderRadius:12, padding:"12px 10px", cursor:privacy?"default":"pointer" }}>
                  <div style={{ fontSize:11, color:"#FF7E36", fontWeight:700, marginBottom:4 }}>수입</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#FF7E36", marginBottom:4 }}>{privacy?"●●●":fmtM(m.income.total)}</div>
                  {!privacy && (
                    <div style={{ fontSize:9, color:"#888888" }}>
                      <div>급여 {fmtM(급여합계)}</div>
                      <div>기타 {fmtM(기타합계)}</div>
                    </div>
                  )}
                  <div style={{ fontSize:9, color:"#888888", marginTop:3 }}>{privacy?"":open==="income"?"▲":"▼ 세부"}</div>
                </div>
                <div onClick={()=>toggle("fixed")} style={{ background:open==="fixed"?"#c96a6a18":"#EDE8E3", border:`1px solid ${open==="fixed"?"#F04452":"transparent"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer" }}>
                  <div style={{ fontSize:11, color:"#F04452", fontWeight:700, marginBottom:4 }}>고정지출</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#F04452", marginBottom:4 }}>{fmtM(m.fixed)}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#888888" }}>
                    <span>집세 {fmtM(m.fixedGroups["집세"]||0)}</span>
                    <span>기타 {fmtM((m.fixed||0)-(m.fixedGroups["집세"]||0))}</span>
                  </div>
                  <div style={{ fontSize:9, color:"#888888", marginTop:3 }}>{open==="fixed"?"▲":"▼"} 세부</div>
                </div>
                <div onClick={()=>toggle("variable")} style={{ background:open==="variable"?"#9b77c918":"#EDE8E3", border:`1px solid ${open==="variable"?"#8B5CF6":"transparent"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer" }}>
                  <div style={{ fontSize:11, color:"#8B5CF6", fontWeight:700, marginBottom:6 }}>변동지출</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#8B5CF6" }}>{fmtM(m.variable)}</div>
                  <div style={{ fontSize:9, color:"#888888", marginTop:4 }}>{open==="variable"?"▲":"▼"} 세부</div>
                </div>
              </div>
            );
          })()}

          {/* 세부내역 드로어 */}
          {open==="income" && !privacy && (
            <div style={{ marginBottom:8 }}>
              <div style={{ background:"#E8E3DE", borderRadius:12, padding:"12px 14px" }}>
                {(() => {
                  // 급여 항목들 (원중/혜지 각각)
                  const 급여Items = Object.entries(raw.income)
                    .filter(([uKey]) => (raw.incomeBGroup?.[uKey]||"") === "급여")
                    .map(([uKey, arr]) => ({
                      // "원중::25일" → "원중: 25일"
                      label: uKey.includes("::") ? uKey.replace("::", ": ") : uKey,
                      v: arr[selIdx]||0
                    }))
                    .filter(x => x.v > 0);

                  // 급여 외 소득 항목들
                  const 기타Items = Object.entries(raw.income)
                    .filter(([uKey]) => {
                      const v = (raw.income[uKey]?.[selIdx]||0);
                      return v > 0 && (raw.incomeBGroup?.[uKey]||"") !== "급여";
                    })
                    .map(([uKey, arr]) => ({
                      label: uKey.includes("::") ? uKey.split("::")[1] : uKey,
                      v: arr[selIdx]||0
                    }));

                  const ROW = (label, v, bold=false) => (
                    <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, color:"#555555", padding:"5px 0", borderBottom:"1px solid #DDD8D3" }}>
                      <span style={{ fontWeight:bold?700:400, color:bold?"#FF7E36":"#555555" }}>{label}</span>
                      <span style={{ fontWeight:600, color:"#FF7E36" }}>{fmt(v)}</span>
                    </div>
                  );

                  return (
                    <>
                      {급여Items.map(({label,v}) => ROW(label, v))}
                      {기타Items.length === 1
                        ? ROW("급여 외 소득", 기타Items[0].v, true)
                        : 기타Items.map(({label,v}) => ROW(label, v))
                      }
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          {open==="fixed" && (
            <div style={{ marginBottom:8 }}>
              <DetailPanel groups={m.fixedGroups} raw={raw} monthIdx={selIdx} color="#F04452" privacy={false} isFixed={true} />
            </div>
          )}
          {open==="variable" && (
            <div style={{ marginBottom:8 }}>
              <DetailPanel groups={m.varGroups} raw={raw} monthIdx={selIdx} color="#8B5CF6" privacy={false} isFixed={false} />
            </div>
          )}

          {/* 순이익 - privacy시 마스킹 */}
          <NetCard label={`${m.month} 순이익`} net={m.순익} income={m.income.total} expense={m.fixed+m.variable} privacy={privacy} />

          {/* 총 순자산 */}
          <div style={{ marginBottom:16 }}>
            <div onClick={()=>toggle("networth")} style={{
              background:"#EDE8E3", border:`1px solid ${netWorth>=0?"#00C47133":"#F0445233"}`,
              borderRadius:14, padding:"14px 16px", cursor:"pointer",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:11, color:"#888888", fontWeight:700, marginBottom:8 }}>총 순자산</div>
                  <div style={{ fontSize:24, fontWeight:700, color:netWorth>=0?"#00C471":"#F04452" }}>
                    {(netWorth>=0?"+":"")+fmtM(netWorth)}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  {netWorthChange !== null && (
                    <div style={{ marginBottom:6 }}>
                      <div style={{ fontSize:9, color:"#888888", marginBottom:3 }}>전월 대비</div>
                      <div style={{ fontSize:13, fontWeight:700, color:netWorthChange>=0?"#00C471":"#F04452" }}>
                        <span style={{ fontSize:9 }}>{netWorthChange>=0?"▲ ":"▼ "}</span>
                        {privacy?"●●●":(netWorthChange>=0?"+":"")+fmtM(Math.abs(netWorthChange))}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize:9, color:"#888888", marginTop:4 }}>{open==="networth"?"▲ 닫기":"▼ 세부내역"}</div>
                </div>
              </div>
            </div>
            {open==="networth" && (
              <div style={{ background:"#E8E3DE", borderRadius:12, padding:"12px 14px", marginTop:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555555", padding:"4px 0", borderBottom:"1px solid #DDD8D3" }}>
                  <span>🏠 실물자산</span><span style={{ color:"#00C471", fontWeight:600 }}>{fmtM(totalPhysical)}</span>
                </div>
                {totalFinancial > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555555", padding:"4px 0", borderBottom:"1px solid #DDD8D3" }}>
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
          <TrendChart active={active} selIdx={selIdx} setSelIdx={setSelIdx} setOpen={setOpen} privacy={privacy} />
        </div>
      </div>
    </div>
  );
}

function TrendChart({ active, selIdx, setSelIdx, setOpen, privacy }) {
  const ALL_LINES = [
    { key:"급여",     color:"#FF7E36", sensitive: true },
    { key:"급여 외",  color:"#FFB347", sensitive: true },
    { key:"고정지출", color:"#F04452", sensitive: false },
    { key:"변동지출", color:"#8B5CF6", sensitive: false },
  ];
  const LINES = privacy ? ALL_LINES.filter(l => !l.sensitive) : ALL_LINES;
  const [activeLine, setActiveLine] = useState("급여");
  const curLine = LINES.find(l=>l.key===activeLine) || LINES[0];

  const lineData = active.map(a=>({
    name: a.month,
    급여: a.income.급여,
    "급여 외": a.income.기타,
    고정지출: a.fixed,
    변동지출: a.variable,
  }));

  const CustomDot = (props) => {
    const { cx, cy, payload, value } = props;
    const isSelected = payload.name === active[selIdx]?.month;
    return (
      <g key={`dot-${payload.name}`}>
        <circle cx={cx} cy={cy} r={isSelected?6:4}
          fill={isSelected ? curLine.color : "#EDE8E3"}
          stroke={curLine.color} strokeWidth={2} />
        <text x={cx} y={cy-14} textAnchor="middle"
          fontSize={8} fill={isSelected ? curLine.color : "#888888"} fontWeight={isSelected?700:400}>
          {fmtM(value)}
        </text>
      </g>
    );
  };

  return (
    <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {LINES.map(l=>(
          <button key={l.key} onClick={()=>setActiveLine(l.key)} style={{
            background: curLine.key===l.key ? `${l.color}22` : "transparent",
            border: `1px solid ${curLine.key===l.key ? l.color : "#C8C3BE"}`,
            borderRadius:8, color: curLine.key===l.key ? l.color : "#777777",
            fontSize:11, padding:"4px 12px", cursor:"pointer",
            fontFamily:"inherit", fontWeight: curLine.key===l.key ? 700 : 400,
          }}>{l.key}</button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={230} className="chart-height-lg">
        <LineChart data={lineData} margin={{ top:30, right:16, left:16, bottom:0 }} onClick={d=>{ if(d?.activeLabel){ const i=MONTHS.indexOf(d.activeLabel); if(i>=0){ setSelIdx(i); setOpen(null); } } }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D8D3CE" />
          <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
          <YAxis hide={false} tickFormatter={v=>fmtM(v)} tick={{ fill:"#BBBBBB", fontSize:8 }} axisLine={false} tickLine={false} width={48} domain={['auto','auto']} />
          <RechartTooltip content={<TT />} />
          <Line
            type="monotone" dataKey={curLine.key} name={curLine.key}
            stroke={curLine.color} strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r:7, fill:curLine.color, stroke:"#EDE8E3", strokeWidth:2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


function YearTab({ monthly, active, raw, privacy }) {
  const [open, setOpen] = useState(null);
  const toggle = key => setOpen(p=>p===key?null:key);

  const totalIncome   = { total: sum(monthly.map(m=>m.income.total)) };
  const totalFixed    = sum(monthly.map(m=>m.fixed));
  const totalVariable = sum(monthly.map(m=>m.variable));
  const totalNet      = sum(monthly.map(m=>m.순익));
  const fg = raw.fixedGroups || {};
  const vg = raw.varGroups   || {};
  const yearFixedGroups = Object.fromEntries(Object.entries(fg).map(([g,arr])=>[g, sum(arr)]));
  const yearVarGroups   = Object.fromEntries(Object.entries(vg).map(([g,arr])=>[g, sum(arr)]));

  const barData = active.map(a=>({
    name: a.month,
    급여: a.income.급여,
    "급여 외": a.income.기타,
    고정지출: a.fixed,
    변동지출: a.variable,
  }));

  return (
    <div>
      <div style={{ fontSize:11, color:"#333333", marginBottom:14 }}>1~{active.length}월 누적 기준</div>

      <AccordionCard label="총 수입" value={privacy?"●●●":totalIncome.total} color="#FF7E36" isOpen={open==="income"&&!privacy} onToggle={()=>!privacy&&toggle("income")}
        sub={<div style={{ fontSize:10, color:"#333333" }}>연간 합계</div>}>
        <div style={{ background:"#E8E3DE", borderRadius:12, padding:"12px 14px" }}>
          {(() => {
            const groups = {};
            Object.entries(raw.income).forEach(([uKey,arr]) => {
              const v = sum(arr); if (!v) return;
              const cKey = raw.incomeGroupKeys?.[uKey] || "기타";
              const label = uKey.includes("::") ? uKey.replace("::", ": ") : uKey;
              if (!groups[cKey]) groups[cKey] = [];
              groups[cKey].push({ label, v });
            });
            return Object.entries(groups).map(([cKey, items]) => (
              <div key={cKey} style={{ marginBottom:8 }}>
                <div style={{ fontSize:10, color:"#FF7E36", fontWeight:700, marginBottom:4, paddingBottom:3, borderBottom:"1px solid #FF7E3622" }}>{cKey}</div>
                {items.map(({label,v}) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555555", padding:"3px 0 3px 8px", borderBottom:"1px solid #DDD8D3" }}>
                    <span>{label}</span><span style={{ fontWeight:600, color:"#FF7E36" }}>{fmt(v)}</span>
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      </AccordionCard>

      <AccordionCard label="총 고정지출" value={totalFixed} color="#F04452" isOpen={open==="fixed"} onToggle={()=>toggle("fixed")}
        sub={<div style={{ fontSize:10, color:"#333333" }}>수입 대비 {totalIncome.total>0?(totalFixed/totalIncome.total*100).toFixed(0):"-"}%</div>}>
        <DetailPanel groups={yearFixedGroups} raw={raw} monthIdx={null} color="#F04452" isFixed={true} />
      </AccordionCard>

      <AccordionCard label="총 변동지출" value={totalVariable} color="#8B5CF6" isOpen={open==="variable"} onToggle={()=>toggle("variable")}
        sub={<div style={{ fontSize:10, color:"#333333" }}>수입 대비 {totalIncome.total>0?(totalVariable/totalIncome.total*100).toFixed(0):"-"}%</div>}>
        <DetailPanel groups={yearVarGroups} raw={raw} monthIdx={null} color="#8B5CF6" isFixed={false} />
      </AccordionCard>

      <NetCard label="연간 순이익 (누적)" net={totalNet} income={totalIncome.total} expense={totalFixed+totalVariable} privacy={privacy} />

      <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
        <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>월별 흐름</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} barGap={4} margin={{ top:8, right:8, left:8, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D8D3CE" vertical={false} />
            <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <RechartTooltip content={<TT />} />
            {!privacy && <Bar dataKey="급여" stackId="income" fill="#FF7E36AA" name="급여" />}
            {!privacy && <Bar dataKey="급여 외" stackId="income" fill="#FFB347AA" name="급여 외" radius={[3,3,0,0]} />}
            <Bar dataKey="고정지출" stackId="spend" fill="#F04452AA" name="고정지출" />
            <Bar dataKey="변동지출" stackId="spend" fill="#8B5CF6AA" name="변동지출" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:10, justifyContent:"center", fontSize:10, color:"#666666", marginTop:6, flexWrap:"wrap" }}>
          {!privacy && <span><span style={{color:"#FF7E36"}}>■</span> 급여</span>}
          {!privacy && <span><span style={{color:"#FFB347"}}>■</span> 급여 외</span>}
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
          {/* 이번 달 갚은 금액 */}
          {debtChange !== null && debtChange < 0 && (
            <div style={{ background:"linear-gradient(135deg, #E6F9F1 0%, #EDE8E3 100%)", border:"1px solid #6ac99755", borderRadius:16, padding:"20px", marginBottom:12, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#6ac997aa", marginBottom:10, letterSpacing:.5 }}>🎉 이번 달 갚은 금액</div>
              <div style={{ fontSize:34, fontWeight:700, color:"#00C471", marginBottom:6 }}>{fmtM(Math.abs(debtChange))}</div>
              <div style={{ fontSize:11, color:"#00C47166" }}>잘 하고 있어요 💪</div>
            </div>
          )}
          {debtChange !== null && debtChange > 0 && (
            <div style={{ background:"#EDE8E3", border:"1px solid #c96a6a33", borderRadius:16, padding:"16px 20px", marginBottom:12, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#F04452aa", marginBottom:6 }}>⚠ 이번 달 부채 증가</div>
              <div style={{ fontSize:26, fontWeight:700, color:"#F04452" }}>+{fmtM(debtChange)}</div>
            </div>
          )}

          {/* 총 부채 */}
          <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 16px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:11, color:"#888888", fontWeight:700, marginBottom:4, textAlign:"left" }}>현재 총 부채</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#F04452" }}>{fmtM(totalDebt)}</div>
            </div>
            {debtChange !== null && (
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, color:"#888888", marginBottom:4 }}>전월 대비</div>
                <div style={{ fontSize:14, fontWeight:700, color: debtChange<=0?"#00C471":"#F04452" }}>
                  {debtChange<=0?"▼":"▲"} {fmtM(Math.abs(debtChange))}
                </div>
              </div>
            )}
          </div>

          {/* 항목별 부채 */}
          <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#F04452", fontWeight:700, marginBottom:12 }}>항목별 부채</div>
            {debtItems.map(({k,v,prev},i)=>{
              const pct    = totalDebt>0?(v/totalDebt*100).toFixed(0):0;
              const change = selIdx>0 ? v-prev : null;
              return (
                <div key={k} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555555", marginBottom:4 }}>
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
                  <div style={{ width:"100%", height:5, background:"#D8D3CE", borderRadius:3 }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:DC[i%DC.length], borderRadius:3 }}/>
                  </div>
                  <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="desktop-right">
          {/* 부채 총액 추이 + 월별 증감 */}
          <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
            <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>부채 추이</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={active.map(a=>({ name:a.month, 부채:a.totalDebt }))} onClick={d=>{ if(d?.activeLabel){ const i=MONTHS.indexOf(d.activeLabel); if(i>=0) setSelIdx(i); } }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8D3CE" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v=>fmtM(v)} tick={{ fill:"#AAAAAA", fontSize:8 }} axisLine={false} tickLine={false} width={50} domain={['auto','auto']} />
                <RechartTooltip content={<TT />} />
                <Line type="monotone" dataKey="부채" name="부채"
                  stroke="#F04452" strokeWidth={2} dot={{ fill:"#F04452", r:3, stroke:"#EDE8E3", strokeWidth:1 }}
                  activeDot={{ r:6, fill:"#F04452", stroke:"#EDE8E3", strokeWidth:2 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* 월별 증감 바차트 */}
            <div style={{ marginTop:12, borderTop:"1px solid #D8D3CE", paddingTop:10 }}>
              <div style={{ fontSize:9, color:"#888888", fontWeight:700, marginBottom:8 }}>월별 증감 (↓ 감소 = 상환)</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={changeData} margin={{ top:4, right:4, left:4, bottom:0 }}>
                  <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <RechartTooltip formatter={(v) => [fmtM(Math.abs(v)), v<0?"상환":"증가"]} />
                  <Bar dataKey="증감" name="증감" radius={[3,3,0,0]}>
                    {changeData.map((d,i) => (
                      <Cell key={i} fill={d.증감<0?"#00C471AA":d.증감>0?"#F04452AA":"#CCCCCC"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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

  // 투자 = 주식(B열) + 코인(B열)만 — 비상금/저축 제외
  // raw.assets는 C열 중분류 키로 저장됨
  const INVEST_KEYS = ["주식", "코인"]; // B열 중분류명
  // B열 중분류별로 그룹핑된 값 사용 (없으면 C열 전체)
  // raw.assets에서 주식/코인 관련 항목만 필터
  const investItems = Object.entries(raw.assets)
    .filter(([k]) => {
      // C열 소분류 기준 — 주식계좌, 코인 관련 항목
      const lower = k.toLowerCase();
      return lower.includes("연금") || lower.includes("배당") || lower.includes("투자") || lower.includes("코인") || lower.includes("토스") || lower.includes("주식");
    })
    .map(([k,arr]) => ({ k, v: arr[selIdx]||0 }))
    .filter(x => x.v > 0);

  const totalAsset = investItems.reduce((s,x)=>s+x.v, 0);
  const prevSelIdx = selIdx - 1;
  const prevAsset  = prevSelIdx >= 0
    ? Object.entries(raw.assets)
        .filter(([k]) => {
          const lower = k.toLowerCase();
          return lower.includes("연금") || lower.includes("배당") || lower.includes("투자") || lower.includes("코인") || lower.includes("토스") || lower.includes("주식");
        })
        .reduce((s,[,arr])=>s+(arr[prevSelIdx]||0),0)
    : null;
  // 전월대비: 현재 - 전월 (양수=증가, 음수=감소)
  const investGain = prevAsset !== null ? totalAsset - prevAsset : null;

  // 투자자산 추이 - monthly에서 totalInvest 사용 (카드와 동일한 집계)
  const investData = active
    .map(a => ({ name: a.month, 투자자산: a.totalInvest || null }))
    .filter(d => d.투자자산);

  const AC = ["#00C471","#38BDF8","#8B5CF6","#FF7E36","#6ab8c9"];

  const InvestDot = (props) => {
    const { cx, cy, payload, value } = props;
    const isSelected = payload.name === active[selIdx]?.month;
    if (!value) return null;
    return (
      <g>
        <circle cx={cx} cy={cy} r={isSelected?6:4} fill={isSelected?"#00C471":"#EDE8E3"} stroke="#00C471" strokeWidth={2} />
        <text x={cx} y={cy-12} textAnchor="middle" fontSize={8} fill={isSelected?"#00C471":"#888888"} fontWeight={isSelected?700:400}>
          {fmtM(value)}
        </text>
      </g>
    );
  };

  return (
    <div>
      <MonthTabs selIdx={selIdx} onSelect={setSelIdx} color="#00C471" active={active} />

      <div className="desktop-2col">
        <div className="desktop-left">
          {/* 요약 카드 2개 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
              <div style={{ fontSize:11, color:"#00C471", fontWeight:700, marginBottom:6 }}>투자자산</div>
              <div style={{ fontSize:20, fontWeight:700, color:"#00C471" }}>{fmtM(totalAsset)}</div>
            </div>
            <div style={{ background:"#EDE8E3", border:`1px solid ${investGain===null||investGain>=0?"#00C47133":"#F0445233"}`, borderRadius:14, padding:"14px 12px" }}>
              <div style={{ fontSize:11, color:"#333333", fontWeight:700, marginBottom:6 }}>전월 대비</div>
              <div style={{ fontSize:20, fontWeight:700, color:investGain===null?"#999999":investGain>=0?"#00C471":"#F04452" }}>
                {investGain===null ? "-" : (investGain>=0?"+":"")+fmtM(investGain)}
              </div>
            </div>
          </div>

          {/* 자산 항목별 */}
          {investItems.length > 0 ? (
            <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px", marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#00C471", fontWeight:700, marginBottom:12 }}>항목별</div>
              {investItems.map(({k,v},i)=>{
                const pct=totalAsset>0?(v/totalAsset*100).toFixed(0):0;
                return (
                  <div key={k} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555555", marginBottom:4 }}>
                      <span>{k}</span><span style={{ fontWeight:700, color:"#00C471" }}>{fmt(v)}</span>
                    </div>
                    <div style={{ width:"100%", height:5, background:"#D8D3CE", borderRadius:3 }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:AC[i%AC.length], borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background:"#EDE8E3", borderRadius:14, padding:"24px", textAlign:"center", marginBottom:12, color:"#888888", fontSize:12 }}>
              이 달 투자 데이터 없음
            </div>
          )}
        </div>

        <div className="desktop-right">
          {/* 투자자산 추이 - Y축 유동, 점+숫자 */}
          <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
            <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>투자자산 추이</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={investData} margin={{ top:30, right:16, left:16, bottom:0 }}
                onClick={d=>{ if(d?.activeLabel){ const i=MONTHS.indexOf(d.activeLabel); if(i>=0) setSelIdx(i); } }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8D3CE" />
                <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis hide={false} tickFormatter={v=>fmtM(v)} tick={{ fill:"#AAAAAA", fontSize:8 }} axisLine={false} tickLine={false} width={50} />
                <RechartTooltip content={<TT />} />
                <Line type="monotone" dataKey="투자자산" name="투자자산"
                  stroke="#00C471" strokeWidth={2}
                  dot={<InvestDot />}
                  activeDot={{ r:7, fill:"#00C471", stroke:"#EDE8E3", strokeWidth:2 }}
                  connectNulls={false}
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
function AlertTab({ monthly, active, raw, privacy }) {
  const lastIdx = MONTHS.indexOf(active[active.length-1].month);
  const [selIdx, setSelIdx] = useState(lastIdx);
  const isLatest = selIdx === MONTHS.indexOf(active[active.length-1].month);

  const curM   = monthly[selIdx];
  const prevIdx = selIdx - 1;
  const prevM  = prevIdx >= 0 ? monthly[prevIdx] : null;

  const allSrc = { ...raw.fixed, ...raw.variable };
  const items = Object.entries(allSrc).map(([k, arr]) => {
    const cur   = arr[selIdx]  || 0;
    const prev  = prevIdx >= 0 ? (arr[prevIdx] || 0) : 0;
    const diff  = cur - prev;
    const label = k.includes("::") ? k.replace("::", ": ") : k;
    return { k, label, cur, prev, diff };
  });

  const increased = items.filter(x => x.diff > 0 && x.cur > 0).sort((a,b) => b.diff - a.diff);
  const decreased = items.filter(x => x.diff < 0 && x.prev > 0).sort((a,b) => a.diff - b.diff);
  const newItems  = items.filter(x => x.diff > 0 && x.prev === 0 && x.cur > 0);

  const totalCur  = curM.fixed + curM.variable;
  const totalPrev = prevM ? prevM.fixed + prevM.variable : null;
  const totalDiff = totalPrev !== null ? totalCur - totalPrev : null;

  // 문구: 최신 달이면 "더 쓰고있어요/덜 쓰고있어요", 이전 달이면 "더 썼어요/덜 썼어요"
  const spentMore = isLatest ? "더 쓰고있어요 📈" : "더 썼어요 📈";
  const spentLess = isLatest ? "덜 쓰고있어요 📉" : "덜 썼어요 📉";

  const C = { up:"#F04452", down:"#00C471", new:"#8B5CF6", border:"#DDD8D3" };

  const Row = ({ label, cur, prev, diff, color }) => {
    const pct = prev > 0 ? Math.abs((diff/prev)*100).toFixed(0) : null;
    return (
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, color:"#1A1A1A", fontWeight:500 }}>{label}</div>
          <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>
            {prev > 0 ? `${fmtM(prev)} → ${fmtM(cur)}` : `신규 ${fmtM(cur)}`}
          </div>
        </div>
        <div style={{ textAlign:"right", minWidth:70 }}>
          <div style={{ fontSize:16, fontWeight:700, color }}>{fmtM(Math.abs(diff))}</div>
          {pct && <div style={{ fontSize:9, color, marginTop:2 }}>{pct}%</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <MonthTabs selIdx={selIdx} onSelect={setSelIdx} color="#F04452" active={active} />

      {/* 총 지출 변화 요약 */}
      <div style={{ background:"#EDE8E3", border:`1px solid ${totalDiff===null||totalDiff<=0?"#00C47133":"#F0445233"}`, borderRadius:14, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#888888", fontWeight:700, marginBottom:8, textAlign:"left" }}>총 지출 전월 대비</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            {totalDiff === null ? (
              <div style={{ fontSize:22, fontWeight:700, color:"#1A1A1A" }}>{fmtM(totalCur)}</div>
            ) : (
              <>
                <div style={{ fontSize:24, fontWeight:700, color:totalDiff>0?"#F04452":"#00C471", marginBottom:4 }}>
                  {fmtM(Math.abs(totalDiff))}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:totalDiff>0?"#F04452":"#00C471" }}>
                  {totalDiff>0 ? spentMore : spentLess}
                </div>
              </>
            )}
          </div>
          {totalDiff !== null && (
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, color:"#888888", marginBottom:4 }}>이번 달 총 지출</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#1A1A1A" }}>{fmtM(totalCur)}</div>
              <div style={{ fontSize:10, color:"#AAAAAA", marginTop:2 }}>전월 {fmtM(totalPrev)}</div>
            </div>
          )}
        </div>
      </div>

      {prevM === null ? (
        <div style={{ background:"#EDE8E3", borderRadius:14, padding:"24px", textAlign:"center", color:"#AAAAAA", fontSize:12 }}>
          비교할 전월 데이터가 없어요
        </div>
      ) : (
        <>
          {increased.length > 0 && (
            <div style={{ background:"#EDE8E3", border:"1px solid #F0445222", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#F04452", fontWeight:700, marginBottom:4 }}>📈 늘어난 지출 ({increased.length}개)</div>
              {increased.map(x => <Row key={x.k} label={x.label} cur={x.cur} prev={x.prev} diff={x.diff} color={C.up} />)}
            </div>
          )}
          {newItems.length > 0 && (
            <div style={{ background:"#EDE8E3", border:"1px solid #8B5CF633", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#8B5CF6", fontWeight:700, marginBottom:4 }}>🆕 이번 달 새로 생긴 지출 ({newItems.length}개)</div>
              {newItems.map(x => <Row key={x.k} label={x.label} cur={x.cur} prev={0} diff={x.diff} color={C.new} />)}
            </div>
          )}
          {decreased.length > 0 && (
            <div style={{ background:"#EDE8E3", border:"1px solid #00C47122", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#00C471", fontWeight:700, marginBottom:4 }}>📉 줄어든 지출 ({decreased.length}개)</div>
              {decreased.map(x => <Row key={x.k} label={x.label} cur={x.cur} prev={x.prev} diff={x.diff} color={C.down} />)}
            </div>
          )}
          {increased.length === 0 && newItems.length === 0 && (
            <div style={{ background:"#EDE8E3", border:"1px solid #00C47133", borderRadius:14, padding:"24px", textAlign:"center" }}>
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
  // 그룹핑 목업 (C열 중분류 기준 월별 합산)
  fixedGroups: {
    "주거대출":  [3545920,3542700,3401672,3268902,2761158,2764868,2768578,2772288,2775998,2779708,2783418,2787128],
    "집관리비":  [458860, 360260, 308420, 139920, 0,0,0,0,0,0,0,0],
    "생활고정":  [1030000,1517800,1601311,610000, 10800,10800,10800,10800,10800,10800,10800,10800],
  },
  varGroups: {
    "주거":        [341022,372492,371534,371534,0,0,0,0,0,0,0,0],
    "자동차·의료": [625700,203900,347800,0,     0,0,0,0,0,0,0,0],
    "생활비":      [766000,1183300,2524086,380000,0,0,0,0,0,0,0,0],
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

// ─────────────────────────────────────────────
// 업데이트 로그
// ─────────────────────────────────────────────
const CHANGELOG = [
  {
    version: "1.6.7",
    date: "2026-04-04",
    items: [
      "수입 세부내역 원중/혜지 각각 한 줄로 표시 (원중: 25일)",
      "중분류 헤더 제거, 왼쪽 정렬",
    ],
  },
  {
    version: "1.6.6",
    date: "2026-04-04",
    items: [
      "총 순자산/현재 총 부채/투자자산/지출분석 라벨 왼쪽 정렬 및 크기 통일",
    ],
  },
  {
    version: "1.6.5",
    date: "2026-04-04",
    items: [
      "세부내역 중분류 헤더+소분류 이중 표시 제거 (소분류명만 표시)",
      "총수입/순이익 등 라벨 왼쪽 정렬",
      "AccordionCard 라벨 글씨 크기 개선",
    ],
  },
  {
    version: "1.6.4",
    date: "2026-04-04",
    items: [
      "통신비 4개 항목 KB카드에 합산 표시 (통신비 포함)",
      "통신비는 KB카드에서 이미 나가므로 고정지출 합계에서 제외",
      "세부내역에서 통신비 참고용으로 회색 표시",
    ],
  },
  {
    version: "1.6.3",
    date: "2026-04-04",
    items: [
      "헤더 행 스킵으로 고정지출 이중집계 수정",
    ],
  },
  {
    version: "1.6.2",
    date: "2026-04-04",
    items: [
      "탭 이름 변경: 지출 알림 → 지출 분석",
      "항목명 표시 :: → : 로 변경 (생활비: 혜지 카드(KB) - 장보기)",
    ],
  },
  {
    version: "1.6.1",
    date: "2026-04-04",
    items: [
      "변동지출 추가 지출 (D열 없는 항목) 집계 수정",
      "순이익/저축 섹션이 지출로 잘못 집계되던 버그 수정",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-04-04",
    items: [
      "월별 추이 그래프 수입 급여/급여 외로 분리",
      "전체 탭 바차트 급여+급여외 스택, 고정+변동 스택으로 수입/지출 비교",
      "수입 막대가 먼저, 지출 막대가 오른쪽에 표시",
    ],
  },
  {
    version: "1.5.3",
    date: "2026-04-04",
    items: [
      "수입 카드 - 급여/급여 외 소득 분리 표시",
      "급여 외 소득 (기타 대분류) 수익 집계 수정",
      "수입 세부내역 - 급여 합계 한 줄, 기타 소득 항목별 표시",
    ],
  },
  {
    version: "1.5.2",
    date: "2026-04-04",
    items: [
      "카드 라벨 글씨 크기 개선 (수입/고정지출/변동지출/순이익/순자산)",
      "모든 그래프 Y축 유동으로 변경",
      "투자자산 집계/그래프 일치 (buildMonthly totalInvest 통일)",
    ],
  },
  {
    version: "1.5.1",
    date: "2026-04-04",
    items: [
      "투자 전월대비 계산 수정",
      "투자/부채 그래프 Y축 유동, 점+숫자 표시",
      "지출알림 금액 먼저, 문구 아래로",
      "소분류 이름 :: 이중 표시 수정",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-04-04",
    items: [
      "집계 버그 수정 - 중분류::소분류 유니크키로 동명 소분류 충돌 방지",
      "이번 달 이후 데이터 집계 제외",
      "전체 탭 이름 변경 (2026 전체 → 전체)",
      "전체 탭 차트 - 수입 + 고정/변동 스택 바차트",
      "부채 추이 차트 - 증감 바차트 추가, 베이지 배경",
    ],
  },
  {
    version: "1.4.3",
    date: "2026-04-04",
    items: [
      "수입/고정/변동지출 세부내역 C열+D열 같이 표시",
      "집세 통합 이중합산 버그 수정",
      "총 고정지출 계산 정확도 개선",
    ],
  },
  {
    version: "1.4.2",
    date: "2026-04-04",
    items: [
      "세부내역 소분류 표시 버그 수정 (fixedGroupKeys 접근 오류)",
      "지출 알림 총액 카드 - 부호 제거, 총액 크게 표시",
    ],
  },
  {
    version: "1.4.1",
    date: "2026-04-04",
    items: [
      "중분류 이중집계 버그 수정 (통신비 등 소분류 합산 오류)",
      "연간 탭 월별 흐름 - 수입/지출 라인차트로 변경",
      "연간 탭 총 고정지출 계산 수정",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-04-04",
    items: [
      "PWA 앱 아이콘 적용 (홈화면 추가 지원)",
      "투자 탭 - 주식/코인만 투자자산으로 계산",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-04-04",
    items: [
      "세부내역 - 중분류/소분류 모두 표시",
      "고정지출 카드 - 집세/기타 분리 표시",
      "지출 알림 Row - +/- 제거, 금액 크게",
    ],
  },
  {
    version: "1.1.3",
    date: "2026-04-04",
    items: [
      "부채/금융자산/실물자산 C열 기준 파싱으로 수정",
      "투자수익 등 계산행 집계 제외",
      "파싱 로직 단순화 - 합계 행만 스킵",
    ],
  },
  {
    version: "1.1.2",
    date: "2026-04-04",
    items: [
      "합계 행 이중집계 버그 수정",
      "집세 별도 합계 행 제거 - 주거+집 관리비 통합",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-04-04",
    items: [
      "C열 중분류 기준 집계 방식 수정",
      "FIXED_GROUPS/VAR_GROUPS 하드코딩 완전 제거",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-04",
    items: [
      "민감정보 가리기 기능 추가",
      "지출 알림 문구 개선 (더 썼어요 / 덜 썼어요)",
      "카드 배경색 개선",
      "업데이트 로그 UI 소형화",
    ],
  },
  {
    version: "1.0.1",
    date: "2026-04-04",
    items: [
      "A열 구분 기준 동적 파싱 (행 번호 하드코딩 완전 제거)",
      "목업 문구 제거, 스크롤바 숨기기",
      "업데이트 로그 패널 추가",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-04",
    items: [
      "구글 시트 연동 (Apps Script 중계)",
      "월별·연간·부채·투자·지출알림 탭",
      "실물자산 시트 연동 및 순자산 계산",
      "반응형 레이아웃 (모바일/태블릿/데스크탑)",
      "Vercel 배포",
    ],
  },
];

function ChangelogPanel() {
  const [expanded, setExpanded] = useState(false);
  const latest = CHANGELOG[0];
  const older  = CHANGELOG.slice(1);

  return (
    <div style={{ margin:"24px 0 8px", borderTop:"1px solid #E8E0D8", paddingTop:14 }}>
      <div style={{ fontSize:9, color:"#BBBBBB", fontWeight:700, letterSpacing:.8, marginBottom:8 }}>업데이트 기록</div>

      {/* 최신 버전 */}
      <div style={{ background:"#EDE8E3", borderRadius:10, padding:"8px 12px", marginBottom:6 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
          <span style={{ fontSize:10, fontWeight:700, color:"#FF7E36" }}>v{latest.version}</span>
          <span style={{ fontSize:9, color:"#AAAAAA" }}>{latest.date}</span>
        </div>
        {latest.items.map((item,i)=>(
          <div key={i} style={{ fontSize:10, color:"#666666", padding:"2px 0" }}>· {item}</div>
        ))}
      </div>

      {/* 이전 버전 더 보기 */}
      {older.length > 0 && (
        <>
          <button onClick={()=>setExpanded(p=>!p)} style={{
            background:"transparent", border:"none",
            color:"#BBBBBB", fontSize:10, padding:"4px 0", cursor:"pointer",
            fontFamily:"inherit", width:"100%", textAlign:"left",
          }}>
            {expanded ? "▲ 접기" : `▼ 이전 업데이트 (${older.length}개)`}
          </button>
          {expanded && older.map(log=>(
            <div key={log.version} style={{ background:"#E8E3DE", borderRadius:10, padding:"8px 12px", marginTop:4 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <span style={{ fontSize:10, fontWeight:700, color:"#999999" }}>v{log.version}</span>
                <span style={{ fontSize:9, color:"#AAAAAA" }}>{log.date}</span>
              </div>
              {log.items.map((item,i)=>(
                <div key={i} style={{ fontSize:10, color:"#888888", padding:"2px 0" }}>· {item}</div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [tab,     setTab]     = useState("monthly");
  const [status,  setStatus]  = useState("ok");
  const [lastSync,setLastSync]= useState(new Date());
  const [privacy, setPrivacy] = useState(false); // 민감정보 가리기
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
    { id:"year",    label:"전체" },
    { id:"debt",    label:"부채" },
    { id:"invest",  label:"투자" },
    { id:"alert",   label:"지출 분석" },
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

        /* 스크롤바 숨기기 */
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; -ms-overflow-style: none; }

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
              <button onClick={()=>setPrivacy(p=>!p)} style={{
                background: privacy?"#FF7E3622":"transparent",
                border:`1px solid ${privacy?"#FF7E36":"#2a2a4a"}`,
                borderRadius:8, color:privacy?"#FF7E36":"#888888",
                fontSize:11, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap"
              }}>
                {privacy?"🔓 공개":"🔒 가리기"}
              </button>
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
            {status==="error" ? "시트 연결 실패 · 이전 데이터 표시 중" : status==="loading" ? "구글 시트 불러오는 중…" : timeStr}
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
              {tab==="monthly" && <MonthlyTab monthly={monthly} active={active} raw={raw} totalPhysicalByMonth={totalPhysicalByMonth} totalDebtByMonth={totalDebtByMonth} privacy={privacy} />}
              {tab==="year"    && <YearTab    monthly={monthly} active={active} raw={raw} privacy={privacy} />}
              {tab==="debt"    && <DebtTab    monthly={monthly} active={active} raw={raw} privacy={privacy} />}
              {tab==="invest"  && <InvestTab  monthly={monthly} active={active} raw={raw} privacy={privacy} />}
              {tab==="alert"   && <AlertTab   monthly={monthly} active={active} raw={raw} privacy={privacy} />}
            </>
          )}

          {/* 업데이트 로그 */}
          <ChangelogPanel />
        </div>
      </div>

    </div>
  );
}