import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from "recharts";

// ─────────────────────────────────────────────
// 설정 및 유틸리티
// ─────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby710o2zinVBcYrc1xCiq02vVlBbSroIsw-5UL83UE6VHRP3bf-AhJ2UZ7Dsavm0tEFbw/exec";
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const parseNum = (s) => {
  if (!s) return 0;
  const n = Number(String(s).replace(/,/g,"").trim());
  return isNaN(n) ? 0 : n;
};

const fmt = n => {
  if (!n && n!==0) return "-";
  const sign=n<0?"-":""; const abs=Math.abs(n);
  if (abs>=10000) return sign + Math.floor(abs/10000).toLocaleString() + "만 " + (abs%10000).toLocaleString() + "원";
  return sign + abs.toLocaleString() + "원";
};

const fmtM = n => {
  if (!n || n === 0) return "-";
  return Math.round(n/10000).toLocaleString() + "만";
};

// ─────────────────────────────────────────────
// 데이터 파싱 (행 추가 자동 대응)
// ─────────────────────────────────────────────
function parseRows(rows) {
  const curMonthIdx = new Date().getMonth();
  const income = {}, fixed = {}, variable = {}, debt = {}, assets = {};
  let lastA = "", lastB = "", lastC = "";

  rows.forEach((row, i) => {
    const a = String(row[0] || "").trim();
    const b = String(row[1] || "").trim();
    const c = String(row[2] || "").trim();
    const d = String(row[3] || "").trim();
    if (a) lastA = a; if (b) lastB = b; if (c) lastC = c;

    if (a === "구분" || d === "소분류" || [a,b,c,d].some(v => v.includes("합계"))) return;
    const skip = ["순이익", "저축", "잔금", "총 지출", "총 잔금"];
    if (skip.some(s => [lastA, lastB].some(v => v.includes(s)))) return;

    const getVals = () => Array.from({length:12}, (_,idx) => idx > curMonthIdx ? 0 : parseNum(row[4+idx]));
    const uKey = lastC && d ? `${lastC}::${d}` : (d || lastC);
    if (!uKey) return;

    if (lastA === "수익") income[uKey] = getVals();
    else if (lastA === "지출") {
      if (lastB === "고정지출") fixed[uKey] = getVals();
      else if (lastB === "변동지출") variable[uKey] = getVals();
    } else if (lastA === "부채") debt[lastC] = getVals();
    else if (lastA === "금융자산") assets[lastC] = getVals();
  });

  return { income, fixed, variable, debt, assets };
}

// ─────────────────────────────────────────────
// 탭: 세부 항목 (DetailListTab) - 신설
// ─────────────────────────────────────────────
function DetailListTab({ raw, active, privacy }) {
  const lastIdx = MONTHS.indexOf(active[active.length-1]?.month);
  const [selIdx, setSelIdx] = useState(lastIdx);

  const getList = (src) => Object.entries(src)
    .map(([k, v]) => ({ label: k.replace("::", " "), val: v[selIdx] || 0 }))
    .filter(item => item.val > 0)
    .sort((a,b) => b.val - a.val);

  const sections = [
    { title: "💰 수입 상세", data: getList(raw.income), color: "#FF7E36" },
    { title: "📌 고정지출 상세", data: getList(raw.fixed), color: "#F04452" },
    { title: "💸 변동지출 상세", data: getList(raw.variable), color: "#8B5CF6" },
  ];

  return (
    <div>
      <MonthTabs selIdx={selIdx} onSelect={setSelIdx} active={active} color="#555" />
      {sections.map(sec => (
        <div key={sec.title} style={{ background:"#EDE8E3", borderRadius:14, padding:"16px", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:sec.color, marginBottom:10, borderBottom:`2px solid ${sec.color}33`, paddingBottom:5 }}>{sec.title}</div>
          {sec.data.length > 0 ? sec.data.map((item, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #DDD8D3", fontSize:12 }}>
              <span style={{ color:"#555" }}>{item.label}</span>
              <span style={{ fontWeight:700 }}>{privacy && sec.title.includes("수입") ? "●●●" : fmt(item.val)}</span>
            </div>
          )) : <div style={{ fontSize:11, color:"#999", textAlign:"center", padding:"10px 0" }}>내역 없음</div>}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 차트 컴포넌트 (막대: 숫자X, 선: 숫자O)
// ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"1px solid #ddd", borderRadius:8, padding:"8px 12px", fontSize:11, boxShadow:"0 2px 4px rgba(0,0,0,0.1)" }}>
      <div style={{ fontWeight:700, marginBottom:4 }}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{ color:p.color }}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
};

function MonthTabs({ selIdx, onSelect, active, color }) {
  return (
    <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
      {active.map(a => {
        const idx=MONTHS.indexOf(a.month); const on=idx===selIdx;
        return (
          <button key={a.month} onClick={()=>onSelect(idx)} style={{
            flexShrink:0, background:on?`${color}18`:"#FFFFFF", border:`1px solid ${on?color:"#D5D5D5"}`,
            borderRadius:8, color:on?color:"#333", padding:"6px 14px", fontSize:12, cursor:"pointer"
          }}>{a.month}</button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 앱
// ─────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("monthly");
  const [status, setStatus] = useState("loading");
  const [raw, setRaw] = useState(null);
  const [active, setActive] = useState([]);
  const [privacy, setPrivacy] = useState(false);

  const fetchData = useCallback(() => {
    setStatus("loading");
    fetch(APPS_SCRIPT_URL).then(r => r.json()).then(rows => {
      const parsed = parseRows(rows);
      setRaw(parsed);
      const monData = MONTHS.map((m, i) => {
        const inc = Object.values(parsed.income).reduce((s,v)=>s+(v[i]||0),0);
        const fix = Object.values(parsed.fixed).reduce((s,v)=>s+(v[i]||0),0);
        const vari = Object.values(parsed.variable).reduce((s,v)=>s+(v[i]||0),0);
        return { month: m, 수입: inc, 지출: fix + vari, 순익: inc - (fix + vari) };
      });
      setActive(monData.filter(m => m.수입 > 0 || m.지출 > 0));
      setStatus("ok");
    }).catch(() => setStatus("error"));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={{ minHeight:"100vh", background:"#F5F0EB", fontFamily:"'Noto Sans KR', sans-serif", paddingBottom:40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');`}</style>
      
      <div style={{ background: "#fff", padding: "20px 16px", borderBottom: "1px solid #E8E0D8", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h1 style={{ fontSize:18, color:"#FF7E36", margin:0 }}>💰 지중헤 Money v1.9.5</h1>
          <div style={{ display:"flex", gap:5 }}>
            <button onClick={()=>setPrivacy(!privacy)} style={{ fontSize:10, padding:"5px 10px", borderRadius:6, border:"1px solid #ddd", background:"#fff" }}>{privacy?"🔓":"🔒"}</button>
            <button onClick={fetchData} style={{ fontSize:10, padding:"5px 10px", borderRadius:6, border:"1px solid #ddd", background:"#fff" }}>↻</button>
          </div>
        </div>
        <div style={{ maxWidth:600, margin:"15px auto 0", display:"flex", gap:10, overflowX:"auto" }}>
          {[["monthly","월별"],["detail","세부 항목"],["trend","추이"]].map(t => (
            <button key={t[0]} onClick={()=>setTab(t[0])} style={{
              padding:"8px 15px", border:"none", background:tab===t[0]?"#FF7E36":"none", color:tab===t[0]?"#fff":"#555",
              borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap"
            }}>{t[1]}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"20px auto", padding:"0 16px" }}>
        {status === "ok" && tab === "monthly" && (
          <div style={{ background:"#EDE8E3", borderRadius:14, padding:"16px" }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:15 }}>📊 최근 지출 현황 (Y축 기준 표시)</div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={active.slice(-4)} margin={{ top:20, right:10, left:10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8D3CE" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:11}} />
                <YAxis width={45} axisLine={false} tickLine={false} tick={{fontSize:9}} tickFormatter={fmtM} />
                <RechartTooltip content={<CustomTooltip />} cursor={{fill:"rgba(0,0,0,0.03)"}} />
                <Bar dataKey="지출" fill="#F04452" radius={[4,4,0,0]} name="총 지출" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {status === "ok" && tab === "trend" && (
          <div style={{ background:"#EDE8E3", borderRadius:14, padding:"16px" }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:15 }}>📈 순이익 추이 (금액 표기)</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={active} margin={{ top:30, right:20, left:10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8D3CE" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:11}} />
                <YAxis width={45} axisLine={false} tickLine={false} tick={{fontSize:9}} tickFormatter={fmtM} />
                <RechartTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="순익" stroke="#00C471" strokeWidth={3} name="순이익" dot={{ r: 4, fill: "#00C471" }}>
                  <LabelList dataKey="순익" position="top" formatter={fmtM} style={{ fontSize:10, fill:"#00C471", fontWeight:700 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {status === "ok" && tab === "detail" && <DetailListTab raw={raw} active={active} privacy={privacy} />}
        
        {status === "loading" && <div style={{ textAlign:"center", padding:50, color:"#999" }}>데이터 동기화 중...</div>}
      </div>
    </div>
  );
}