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

  const getMonthly = (rowIdx) => {
    const r = rows[rowIdx] || [];
    return Array.from({length:12}, (_,i) => parseNum(r[4+i]));
  };

  const addMonthly = (target, key, rowIdx) => {
    const vals = getMonthly(rowIdx);
    if (!target[key]) target[key] = Array(12).fill(0);
    vals.forEach((v,i) => { target[key][i] += v; });
  };

  const income         = {};
  const fixedByItem    = {};
  const variableByItem = {};
  const fixedGroups    = {};
  const varGroups      = {};
  const fixedGroupKeys = {}; // 소분류→중분류 역매핑
  const varGroupKeys   = {}; // 소분류→중분류 역매핑
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

    // "합계" 포함 행 스킵 (현재 행 기준)
    if ([aRaw,bRaw,cRaw,dCol].some(v => v.includes("합계"))) return;
    if (lastA === "수익" || lastA === "지출") {
      if (!dCol) return; // D열 없으면 스킵
      if (lastA === "수익") {
        addMonthly(income, dCol, i);
      } else if (lastB === "고정지출") {
        addMonthly(fixedByItem, dCol, i);
        if (lastC) { addMonthly(fixedGroups, lastC, i); fixedGroupKeys[dCol] = lastC; }
      } else if (lastB === "변동지출") {
        addMonthly(variableByItem, dCol, i);
        if (lastC) { addMonthly(varGroups, lastC, i); varGroupKeys[dCol] = lastC; }
      }
      return;
    }

    // ── 부채/금융자산/실물자산: C열이 항목명 ──
    // 합계 행 스킵 (이미 위에서 처리됨)
    // 계산용 행 스킵 (투자수익, 비중 등)
    const skipKeywords = ["수익률", "투자수익", "소득 대비", "총 부채상환", "총 자산", "잔금"];
    if (skipKeywords.some(k => [bRaw,cRaw,dCol].some(v => v.includes(k)))) return;
    if (!lastC) return;

    if (lastA === "부채") {
      addMonthly(debt, lastC, i);
    } else if (lastA === "금융자산") {
      addMonthly(assets, lastC, i);
    } else if (lastA === "실물자산") {
      addMonthly(physicalAssets, lastC, i);
    }
  });

  return {
    income,
    fixed:    fixedByItem,
    variable: variableByItem,
    fixedGroups,
    varGroups,
    fixedGroupKeys,
    varGroupKeys,
    debt,
    assets,
    physicalAssets,
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
    const income      = { total: incomeTotal };
    const fixed       = Object.values(raw.fixed).reduce((s,a)=>s+(a[i]||0),0);
    const variable    = Object.values(raw.variable).reduce((s,a)=>s+(a[i]||0),0);

    // C열 중분류별 월별 합계 — "주거"+"집 관리비"를 "집세"로 통합 표시
    const fixedGroupsRaw = Object.fromEntries(Object.entries(fg).map(([g,arr])=>[g, arr[i]||0]));
    const fixedGroups = {};
    let 집세 = 0;
    Object.entries(fixedGroupsRaw).forEach(([g, v]) => {
      if (g === "주거" || g === "집 관리비") {
        집세 += v;
      } else {
        fixedGroups[g] = v;
      }
    });
    if (집세 > 0) fixedGroups["집세"] = 집세;

    const varGroups   = Object.fromEntries(Object.entries(vg).map(([g,arr])=>[g, arr[i]||0]));
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
        background:isOpen?`${color}15`:"#EDE8E3",
        border:`1px solid ${isOpen?color:"transparent"}`,
        borderRadius:14, padding:"14px 16px", cursor:"pointer", transition:"all .15s",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:9, color, fontWeight:700, letterSpacing:.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:isOpen?color:"#1A1A1A" }}>
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
  // 중분류별 소분류 항목 찾기
  const src = isFixed ? (raw?.fixed || {}) : (raw?.variable || {});
  const groupMap = isFixed ? (raw?.fixedGroups || {}) : (raw?.varGroups || {});

  return (
    <div style={{ background:"#E8E3DE", borderRadius:12, padding:"12px 14px" }}>
      {Object.entries(groups).map(([group, groupTotal]) => {
        if (!groupTotal) return null;
        // 이 중분류에 속하는 소분류 항목들 찾기 (raw.fixed/variable에서 C열 기준 매칭)
        // groupMap에서 해당 그룹의 키 배열 가져오기 (없으면 빈 배열)
        const itemKeys = Object.keys(src).filter(k => {
          // 해당 그룹에 속하는 항목인지 확인 (groupMap 역매핑)
          return raw[isFixed?"fixedGroupKeys":"varGroupKeys"]?.[k] === group;
        });
        const items = itemKeys
          .map(k => ({ k, v: monthIdx !== null ? (src[k]?.[monthIdx] || 0) : (src[k] || []).reduce((a,b)=>a+b,0) }))
          .filter(x => x.v > 0);

        return (
          <div key={group} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color, fontWeight:700, marginBottom:4, paddingBottom:4, borderBottom:`1px solid ${color}22` }}>
              <span>{group}</span>
              <span style={{ fontWeight:700 }}>{privacy?"●●●":fmt(groupTotal)}</span>
            </div>
            {items.map(({k,v}) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666666", padding:"2px 0 2px 8px" }}>
                <span>{k}</span>
                <span style={{ fontWeight:500, color:"#555555" }}>{privacy?"●●●":fmt(v)}</span>
              </div>
            ))}
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
      <div>
        <div style={{ fontSize:9, color:"#888888", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>{label}</div>
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
          <div className="summary-3col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
            <div onClick={()=>!privacy && toggle("income")} style={{ background:open==="income"?"#FF7E3618":"#EDE8E3", border:`1px solid ${open==="income"?"#FF7E36":"transparent"}`, borderRadius:12, padding:"12px 10px", cursor:privacy?"default":"pointer" }}>
              <div style={{ fontSize:8, color:"#FF7E36", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>수입</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#FF7E36" }}>{privacy?"●●●":fmtM(m.income.total)}</div>
              <div style={{ fontSize:8, color:"#888888", marginTop:4 }}>{privacy?"":open==="income"?"▲":"▼ 세부"}</div>
            </div>
            <div onClick={()=>toggle("fixed")} style={{ background:open==="fixed"?"#c96a6a18":"#EDE8E3", border:`1px solid ${open==="fixed"?"#F04452":"transparent"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer" }}>
              <div style={{ fontSize:8, color:"#F04452", fontWeight:700, letterSpacing:.8, marginBottom:4 }}>고정지출</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#F04452", marginBottom:4 }}>{fmtM(m.fixed)}</div>
              {/* 집세 / 기타 분리 */}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#888888" }}>
                <span>집세 {fmtM(m.fixedGroups["집세"]||0)}</span>
                <span>기타 {fmtM((m.fixed||0)-(m.fixedGroups["집세"]||0))}</span>
              </div>
              <div style={{ fontSize:8, color:"#888888", marginTop:3 }}>{open==="fixed"?"▲":"▼"} 세부</div>
            </div>
            <div onClick={()=>toggle("variable")} style={{ background:open==="variable"?"#9b77c918":"#EDE8E3", border:`1px solid ${open==="variable"?"#8B5CF6":"transparent"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer" }}>
              <div style={{ fontSize:8, color:"#8B5CF6", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>변동지출</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#8B5CF6" }}>{fmtM(m.variable)}</div>
              <div style={{ fontSize:8, color:"#888888", marginTop:4 }}>{open==="variable"?"▲":"▼"} 세부</div>
            </div>
          </div>

          {/* 세부내역 드로어 */}
          {open==="income" && !privacy && (
            <div style={{ marginBottom:8 }}>
              <div style={{ background:"#E8E3DE", borderRadius:12, padding:"12px 14px" }}>
                {Object.entries(raw.income).map(([k,arr])=>{
                  const v = arr[selIdx]||0;
                  return v>0 ? (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555555", padding:"4px 0", borderBottom:"1px solid #DDD8D3" }}>
                      <span>{k}</span><span style={{ fontWeight:600, color:"#FF7E36" }}>{fmt(v)}</span>
                    </div>
                  ) : null;
                })}
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
                <div>
                  <div style={{ fontSize:9, color:"#888888", fontWeight:700, letterSpacing:.8, marginBottom:8 }}>총 순자산</div>
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
    { key:"수입",    color:"#FF7E36", sensitive: true },
    { key:"고정지출", color:"#F04452", sensitive: false },
    { key:"변동지출", color:"#8B5CF6", sensitive: false },
  ];
  // privacy 모드면 수입 탭 숨기기
  const LINES = privacy ? ALL_LINES.filter(l => !l.sensitive) : ALL_LINES;
  const [activeLine, setActiveLine] = useState("고정지출");
  // privacy 켜질 때 수입 선택돼있으면 고정지출로 전환
  const curLine = LINES.find(l=>l.key===activeLine) || LINES[0];

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
          <YAxis hide />
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

  const totalIncome = { total: sum(monthly.map(m=>m.income.total)) };
  const totalFixed    = sum(monthly.map(m=>m.fixed));
  const totalVariable = sum(monthly.map(m=>m.variable));
  const totalNet      = sum(monthly.map(m=>m.순익));
  const fg = raw.fixedGroups || {};
  const vg = raw.varGroups   || {};
  const yearFixedGroupsRaw = Object.fromEntries(Object.entries(fg).map(([g,arr])=>[g, sum(arr)]));
  const yearFixedGroups = {};
  let 집세연간 = 0;
  Object.entries(yearFixedGroupsRaw).forEach(([g,v]) => {
    if (g === "주거" || g === "집 관리비") { 집세연간 += v; }
    else { yearFixedGroups[g] = v; }
  });
  if (집세연간 > 0) yearFixedGroups["집세"] = 집세연간;
  const yearVarGroups = Object.fromEntries(Object.entries(vg).map(([g,arr])=>[g, sum(arr)]));
  const barData = active.map(a=>({ name:a.month, 수입:a.income.total, 고정지출:a.fixed, 변동지출:a.variable }));

  return (
    <div>
      <div style={{ fontSize:11, color:"#333333", marginBottom:14 }}>1~{active.length}월 누적 기준</div>

      <AccordionCard label="총 수입" value={privacy?"●●●":totalIncome.total} color="#FF7E36" isOpen={open==="income"&&!privacy} onToggle={()=>!privacy&&toggle("income")}
        sub={<div style={{ fontSize:10, color:"#333333" }}>연간 합계</div>}>
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
        <DetailPanel groups={yearFixedGroups} raw={raw} monthIdx={null} color="#F04452" isFixed={true} />
      </AccordionCard>

      <AccordionCard label="총 변동지출" value={totalVariable} color="#8B5CF6" isOpen={open==="variable"} onToggle={()=>toggle("variable")}
        sub={<div style={{ fontSize:10, color:"#333333" }}>수입 대비 {totalIncome.total>0?(totalVariable/totalIncome.total*100).toFixed(0):"-"}%</div>}>
        <DetailPanel groups={yearVarGroups} raw={raw} monthIdx={null} color="#8B5CF6" isFixed={false} />
      </AccordionCard>

      <NetCard label="연간 순이익 (누적)" net={totalNet} income={totalIncome.total} expense={totalFixed+totalVariable} privacy={privacy} />

      <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
        <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>월별 흐름</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={barData} barGap={2}>
            <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <RechartTooltip content={<TT />} />
            {!privacy && <Bar dataKey="수입" fill="#FF7E3666" name="수입" radius={[3,3,0,0]} />}
            <Bar dataKey="고정지출" fill="#c96a6a66" name="고정지출" radius={[3,3,0,0]} />
            <Bar dataKey="변동지출" fill="#8B5CF666" name="변동지출" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:12, justifyContent:"center", fontSize:10, color:"#444444", marginTop:4 }}>
          {!privacy && <span><span style={{color:"#FF7E36"}}>■</span> 수입</span>}
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
            <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
              <div style={{ fontSize:9, color:"#00C471", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>투자자산</div>
              <div style={{ fontSize:20, fontWeight:700, color:"#00C471" }}>{fmtM(totalAsset)}</div>
            </div>
            <div style={{ background:"#EDE8E3", border:`1px solid ${investGain===null||investGain>=0?"#00C47133":"#F0445233"}`, borderRadius:14, padding:"14px 12px" }}>
              <div style={{ fontSize:9, color:"#333333", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>전월 대비</div>
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
          {/* 투자자산 추이 */}
          <div style={{ background:"#EDE8E3", borderRadius:14, padding:"14px 12px" }}>
            <div style={{ fontSize:10, color:"#333333", fontWeight:700, marginBottom:10 }}>투자자산 추이</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={barData} onClick={d=>{ if(d?.activeLabel){ const i=MONTHS.indexOf(d.activeLabel); if(i>=0) setSelIdx(i); } }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8D3CE" />
                <XAxis dataKey="name" tick={{ fill:"#999999", fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartTooltip content={<TT />} />
                <Line
                  type="monotone" dataKey="금융자산" name="투자자산"
                  stroke="#00C471" strokeWidth={2} dot={false}
                  activeDot={{ r:5, fill:"#00C471", stroke:"#EDE8E3", strokeWidth:2 }}
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
    const cur  = arr[selIdx]  || 0;
    const prev = prevIdx >= 0 ? (arr[prevIdx] || 0) : 0;
    const diff = cur - prev;
    return { k, cur, prev, diff };
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
        <div style={{ fontSize:9, color:"#888888", fontWeight:700, letterSpacing:.8, marginBottom:6 }}>총 지출 전월 대비</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            {totalDiff === null ? (
              <div style={{ fontSize:20, fontWeight:700, color:"#1A1A1A" }}>{fmtM(totalCur)}</div>
            ) : (
              <>
                <div style={{ fontSize:20, fontWeight:700, color:totalDiff>0?"#F04452":"#00C471" }}>
                  {totalDiff>0?"+":""}{fmtM(totalDiff)}
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:totalDiff>0?"#F04452":"#00C471", marginTop:4 }}>
                  {totalDiff>0 ? spentMore : spentLess}
                </div>
              </>
            )}
          </div>
          {totalDiff !== null && (
            <div style={{ textAlign:"right", fontSize:11, color:"#888888" }}>
              <div>{fmtM(totalPrev)}</div>
              <div style={{ fontSize:9, marginTop:2 }}>→ {fmtM(totalCur)}</div>
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
              {increased.map(x => <Row key={x.k} label={x.k} cur={x.cur} prev={x.prev} diff={x.diff} color={C.up} />)}
            </div>
          )}
          {newItems.length > 0 && (
            <div style={{ background:"#EDE8E3", border:"1px solid #8B5CF633", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#8B5CF6", fontWeight:700, marginBottom:4 }}>🆕 이번 달 새로 생긴 지출 ({newItems.length}개)</div>
              {newItems.map(x => <Row key={x.k} label={x.k} cur={x.cur} prev={0} diff={x.diff} color={C.new} />)}
            </div>
          )}
          {decreased.length > 0 && (
            <div style={{ background:"#EDE8E3", border:"1px solid #00C47122", borderRadius:14, padding:"14px", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#00C471", fontWeight:700, marginBottom:4 }}>📉 줄어든 지출 ({decreased.length}개)</div>
              {decreased.map(x => <Row key={x.k} label={x.k} cur={x.cur} prev={x.prev} diff={x.diff} color={C.down} />)}
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