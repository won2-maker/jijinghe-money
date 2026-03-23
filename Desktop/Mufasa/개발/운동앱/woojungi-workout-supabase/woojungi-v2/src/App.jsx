import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase";

const MUSCLE_GROUPS = [
  { id: "chest",    label: "가슴",   icon: "◈", color: "#FF4D6D" },
  { id: "back",     label: "등",     icon: "◇", color: "#00C9A7" },
  { id: "shoulder", label: "어깨",   icon: "△", color: "#845EF7" },
  { id: "leg",      label: "하체",   icon: "▽", color: "#339AF0" },
  { id: "bicep",    label: "이두",   icon: "◉", color: "#F76707" },
  { id: "tricep",   label: "삼두",   icon: "◎", color: "#20C997" },
  { id: "abs",      label: "복근",   icon: "◬", color: "#F59F00" },
  { id: "cardio",   label: "유산소", icon: "◌", color: "#E64980" },
  { id: "etc",      label: "기타",   icon: "◻", color: "#868E96" },
];

const WORKOUT_TYPES = [
  { id: "strength",     label: "스트렝스", desc: "5×5, 낮은 횟수 · 높은 무게", color: "#FF4D6D", bg: "#FF4D6D18", icon: "⚡" },
  { id: "bodybuilding", label: "보디빌딩", desc: "3×10~15, 근비대 중심",       color: "#845EF7", bg: "#845EF718", icon: "◎" },
];

const getMeta = (id) => MUSCLE_GROUPS.find((g) => g.id === id);
const getType = (id) => WORKOUT_TYPES.find((t) => t.id === id);
const uid     = () => Math.random().toString(36).slice(2, 9);

/* ── Data: type is now per GROUP ── */
const INITIAL_SESSIONS = [
  {
    date: "2026-03-20", condition: "상", bodyWeight: 78.5,
    groups: [
      { groupId: "chest",   type: "bodybuilding", exercises: [
        { name: "벤치프레스",        sets: [{ weight: 80,   reps: 8  }, { weight: 80,   reps: 8  }, { weight: 75,   reps: 10 }] },
        { name: "인클라인 덤벨프레스", sets: [{ weight: 28,   reps: 10 }, { weight: 28,   reps: 10 }, { weight: 26,   reps: 12 }] },
        { name: "케이블 플라이",      sets: [{ weight: 15,   reps: 15 }, { weight: 15,   reps: 15 }] },
      ]},
      { groupId: "tricep",  type: "strength", exercises: [
        { name: "트라이셉스 푸시다운", sets: [{ weight: 20,   reps: 12 }, { weight: 20,   reps: 12 }, { weight: 18,   reps: 15 }] },
        { name: "오버헤드 익스텐션",   sets: [{ weight: 16,   reps: 12 }, { weight: 14,   reps: 15 }] },
      ]},
    ],
  },
  {
    date: "2026-03-17", condition: "중", bodyWeight: 78.8,
    groups: [
      { groupId: "back",  type: "strength", exercises: [
        { name: "데드리프트", sets: [{ weight: 120, reps: 5  }, { weight: 120, reps: 5  }, { weight: 110, reps: 6  }] },
        { name: "바벨 로우",  sets: [{ weight: 70,  reps: 8  }, { weight: 70,  reps: 8  }, { weight: 65,  reps: 10 }] },
        { name: "랫풀다운",  sets: [{ weight: 65,  reps: 10 }, { weight: 65,  reps: 10 }, { weight: 60,  reps: 12 }] },
      ]},
      { groupId: "bicep", type: "bodybuilding", exercises: [
        { name: "바벨 컬",  sets: [{ weight: 35,  reps: 10 }, { weight: 35,  reps: 10 }, { weight: 30,  reps: 12 }] },
        { name: "해머 컬",  sets: [{ weight: 14,  reps: 12 }, { weight: 14,  reps: 12 }] },
      ]},
    ],
  },
  {
    date: "2026-03-13", condition: "하",
    groups: [
      { groupId: "chest", type: "bodybuilding", exercises: [
        { name: "벤치프레스",        sets: [{ weight: 77.5, reps: 8  }, { weight: 77.5, reps: 8  }, { weight: 75,   reps: 8  }] },
        { name: "인클라인 덤벨프레스", sets: [{ weight: 26,   reps: 10 }, { weight: 26,   reps: 10 }] },
      ]},
    ],
  },
  {
    date: "2026-03-10", condition: "상", bodyWeight: 79.2,
    groups: [
      { groupId: "shoulder", type: "strength",     exercises: [
        { name: "오버헤드프레스",      sets: [{ weight: 60,  reps: 8  }, { weight: 60,  reps: 8  }, { weight: 55,  reps: 10 }] },
        { name: "사이드 레터럴레이즈", sets: [{ weight: 12,  reps: 15 }, { weight: 12,  reps: 15 }, { weight: 10,  reps: 15 }] },
      ]},
      { groupId: "leg",      type: "bodybuilding", exercises: [
        { name: "스쿼트",        sets: [{ weight: 100, reps: 6  }, { weight: 100, reps: 6  }, { weight: 90,  reps: 8  }] },
        { name: "레그프레스",    sets: [{ weight: 160, reps: 10 }, { weight: 160, reps: 10 }] },
        { name: "레그 익스텐션", sets: [{ weight: 50,  reps: 15 }, { weight: 50,  reps: 15 }] },
      ]},
    ],
  },
  {
    date: "2026-03-05",
    groups: [
      { groupId: "chest",  type: "bodybuilding", exercises: [
        { name: "벤치프레스",        sets: [{ weight: 75,   reps: 8  }, { weight: 75,   reps: 8  }, { weight: 72.5, reps: 10 }] },
        { name: "인클라인 덤벨프레스", sets: [{ weight: 24,   reps: 10 }, { weight: 24,   reps: 10 }] },
        { name: "케이블 플라이",      sets: [{ weight: 14,   reps: 15 }, { weight: 14,   reps: 15 }] },
      ]},
      { groupId: "tricep", type: "strength",     exercises: [
        { name: "트라이셉스 푸시다운", sets: [{ weight: 18,   reps: 12 }, { weight: 18,   reps: 12 }] },
        { name: "오버헤드 익스텐션",   sets: [{ weight: 14,   reps: 12 }, { weight: 12,   reps: 15 }] },
      ]},
    ],
  },
  {
    date: "2026-02-26",
    groups: [
      { groupId: "back", type: "strength", exercises: [
        { name: "데드리프트", sets: [{ weight: 115, reps: 5  }, { weight: 115, reps: 5  }, { weight: 110, reps: 5  }] },
        { name: "바벨 로우",  sets: [{ weight: 67.5,reps: 8  }, { weight: 67.5,reps: 8  }] },
        { name: "랫풀다운",  sets: [{ weight: 62.5,reps: 10 }, { weight: 62.5,reps: 10 }] },
      ]},
    ],
  },
  {
    date: "2026-02-19",
    groups: [
      { groupId: "chest", type: "bodybuilding", exercises: [
        { name: "벤치프레스",        sets: [{ weight: 72.5, reps: 8  }, { weight: 72.5, reps: 8  }, { weight: 70,   reps: 10 }] },
        { name: "인클라인 덤벨프레스", sets: [{ weight: 22,   reps: 10 }, { weight: 22,   reps: 10 }] },
      ]},
    ],
  },
];

const INITIAL_ROUTINES = [
  {
    id: uid(), name: "Push Day",
    groupTypes: { chest: "bodybuilding", shoulder: "bodybuilding", tricep: "strength" },
    groups: ["chest", "shoulder", "tricep"],
    exercises: [
      { groupId: "chest",    name: "벤치프레스",        sets: 3, reps: 10, weight: 80  },
      { groupId: "chest",    name: "인클라인 덤벨프레스", sets: 3, reps: 12, weight: 28  },
      { groupId: "chest",    name: "케이블 플라이",      sets: 3, reps: 15, weight: 15  },
      { groupId: "shoulder", name: "사이드 레터럴레이즈", sets: 4, reps: 15, weight: 12  },
      { groupId: "tricep",   name: "트라이셉스 푸시다운", sets: 5, reps: 5,  weight: 20  },
    ],
  },
  {
    id: uid(), name: "Pull Day",
    groupTypes: { back: "strength", bicep: "bodybuilding" },
    groups: ["back", "bicep"],
    exercises: [
      { groupId: "back",  name: "데드리프트", sets: 5, reps: 5, weight: 120 },
      { groupId: "back",  name: "바벨 로우",  sets: 5, reps: 5, weight: 70  },
      { groupId: "back",  name: "랫풀다운",  sets: 3, reps: 8, weight: 65  },
      { groupId: "bicep", name: "바벨 컬",   sets: 3, reps: 8, weight: 35  },
    ],
  },
  {
    id: uid(), name: "Leg Day",
    groupTypes: { leg: "strength" },
    groups: ["leg"],
    exercises: [
      { groupId: "leg", name: "스쿼트",     sets: 5, reps: 5, weight: 100 },
      { groupId: "leg", name: "레그프레스", sets: 3, reps: 8, weight: 160 },
    ],
  },
];

/* ── Default exercise library per group ── */
const DEFAULT_LIBRARY = {
  chest:    ["벤치프레스", "인클라인 벤치프레스", "디클라인 벤치프레스", "덤벨 플라이", "인클라인 덤벨프레스", "케이블 플라이", "펙덱 플라이", "딥스"],
  back:     ["데드리프트", "바벨 로우", "덤벨 로우", "랫풀다운", "시티드 케이블 로우", "티바 로우", "풀업", "친업", "페이스 풀"],
  shoulder: ["오버헤드프레스", "덤벨 숄더프레스", "사이드 레터럴레이즈", "프론트 레이즈", "리어 델트 플라이", "업라이트 로우", "케이블 레터럴레이즈"],
  leg:      ["스쿼트", "레그프레스", "런지", "불가리안 스플릿 스쿼트", "레그 익스텐션", "레그 컬", "힙 스러스트", "카프 레이즈", "루마니안 데드리프트"],
  bicep:    ["바벨 컬", "덤벨 컬", "해머 컬", "인클라인 덤벨 컬", "케이블 컬", "컨센트레이션 컬", "프리처 컬"],
  tricep:   ["트라이셉스 푸시다운", "오버헤드 익스텐션", "클로즈그립 벤치프레스", "스컬크러셔", "딥스", "케이블 킥백", "다이아몬드 푸시업"],
  abs:      ["크런치", "레그 레이즈", "플랭크", "사이드 플랭크", "케이블 크런치", "행잉 레그 레이즈", "러시안 트위스트", "AB 휠 롤아웃", "마운틴 클라이머"],
  forearm:  ["리스트 컬", "리버스 리스트 컬", "그립 스퀴즈", "바 행잉", "핑거 컬", "리스트 롤러", "팔뚝 회내/회외"],
  cardio:   ["러닝", "사이클", "로잉 머신", "줄넘기", "버피", "일립티컬", "계단 오르기", "수영"],
  etc:      ["폼롤러", "스트레칭", "요가", "맨몸 스쿼트", "푸시업", "풀업", "리스트 컬", "그립 스퀴즈", "바 행잉"],
};
const getDaysAgo    = (d) => { const diff = Math.floor((new Date() - new Date(d)) / 86400000); return diff === 0 ? "오늘" : diff === 1 ? "어제" : `${diff}일 전`; };
const fmtDate       = (d) => new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
const fmtShort      = (d) => { const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`; };
const exVolume      = (ex) => ex.sets.reduce((a, s) => a + s.weight * s.reps, 0);
const groupVolume   = (g)  => g.exercises.reduce((a, ex) => a + exVolume(ex), 0);
const groupSets     = (g)  => g.exercises.reduce((a, ex) => a + ex.sets.length, 0);
const sessionVolume = (s)  => s.groups.reduce((a, g) => a + groupVolume(g), 0);
const sessionSets   = (s)  => s.groups.reduce((a, g) => a + groupSets(g), 0);
const getGroupSessions = (sessions, groupId) =>
  sessions.filter(s => s.groups.some(g => g.groupId === groupId))
          .map(s => ({ ...s, groupData: s.groups.find(g => g.groupId === groupId) }));

/* ── TypeBadge ── */
function TypeBadge({ typeId, small }) {
  const wt = getType(typeId);
  if (!wt) return null;
  return (
    <span style={{
      fontSize: small ? 9 : 10, background: wt.bg, color: wt.color,
      borderRadius: 20, padding: small ? "2px 7px" : "3px 9px", fontWeight: 700,
      fontFamily: "'Space Grotesk',sans-serif", whiteSpace: "nowrap",
    }}>{wt.icon} {wt.label}</span>
  );
}

/* ── TypeToggle: small inline toggle ── */
function TypeToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {WORKOUT_TYPES.map(t => {
        const act = value === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 10,
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
              background: act ? t.color : "#1A1A24",
              color: act ? "#0A0A0F" : "#555",
              border: `1px solid ${act ? t.color : "#2A2A38"}`,
              cursor: "pointer", transition: "all 0.15s",
            }}>{t.icon} {t.label}</button>
        );
      })}
    </div>
  );
}

/* ══ SVG Line Chart ══ */
function LineChart({ points, color, width = 320, height = 110 }) {
  if (!points.length) return null;
  if (points.length === 1) return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <circle cx={width/2} cy={height/2} r={5} fill={color} stroke="#0A0A0F" strokeWidth={2}/>
      <text x={width/2} y={height/2-12} textAnchor="middle" fill={color} fontSize="11" fontFamily="'DM Mono',monospace">{points[0].y}</text>
    </svg>
  );
  const pad = { l:8, r:8, t:16, b:14 };
  const W = width-pad.l-pad.r, H = height-pad.t-pad.b;
  const minV = Math.min(...points.map(p=>p.y)), maxV = Math.max(...points.map(p=>p.y)), range = maxV-minV||1;
  const px = (i) => pad.l + (i/(points.length-1))*W;
  const py = (v) => pad.t + H - ((v-minV)/range)*H;
  const pathD = points.map((p,i)=>`${i===0?"M":"L"} ${px(i)} ${py(p.y)}`).join(" ");
  const areaD = pathD + ` L ${px(points.length-1)} ${pad.t+H} L ${px(0)} ${pad.t+H} Z`;
  const gid = `g${color.replace("#","")}`;
  return (
    <svg width={width} height={height} style={{ overflow:"visible" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      {[0,0.5,1].map((t,i)=><line key={i} x1={pad.l} y1={pad.t+H*(1-t)} x2={pad.l+W} y2={pad.t+H*(1-t)} stroke="#1E1E2A" strokeWidth="1"/>)}
      <path d={areaD} fill={`url(#${gid})`}/>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {points.map((p,i)=>(
        <g key={i}>
          <circle cx={px(i)} cy={py(p.y)} r="4" fill={color} stroke="#0A0A0F" strokeWidth="2"/>
          <text x={px(i)} y={py(p.y)-10} textAnchor="middle" fill={color} fontSize="10" fontFamily="'DM Mono',monospace" fontWeight="500">{p.y}</text>
          <text x={px(i)} y={height} textAnchor="middle" fill="#444" fontSize="9" fontFamily="'DM Mono',monospace">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ══ Data Tab ══ */
function DataTab({ sessions }) {
  const [mainTab,    setMainTab]    = useState("weight"); // "weight" | "cardio" | "bodyweight"
  const [gid,        setGid]        = useState("chest");
  const [exName,     setEx]         = useState(null);
  const [weightType, setWeightType] = useState("all"); // "all" | "strength" | "bodybuilding"

  const meta = getMeta(mainTab === "cardio" ? "cardio" : gid);

  // exercise data filtered by tab + type
  const filteredSessions = mainTab === "bodyweight" ? sessions
    : mainTab === "cardio"
      ? sessions.filter(s => s.groups.some(g => g.groupId === "cardio"))
      : sessions.filter(s => s.groups.some(g =>
          g.groupId === gid &&
          g.groupId !== "cardio" &&
          (weightType === "all" || g.type === weightType)
        ));

  const gs = mainTab === "cardio"
    ? getGroupSessions(filteredSessions, "cardio").slice().reverse()
    : getGroupSessions(filteredSessions, gid).slice().reverse();
  const exNames  = [...new Set(gs.flatMap(s => s.groupData.exercises.map(e => e.name)))];
  const sel      = exName && exNames.includes(exName) ? exName : exNames[0] ?? null;

  const chartPts = gs.filter(s => s.groupData.exercises.some(e => e.name === sel)).map(s => {
    const ex = s.groupData.exercises.find(e => e.name === sel);
    return { y: Math.max(...ex.sets.map(st=>st.weight)), label: fmtShort(s.date), date: s.date, sets: ex.sets, setCount: ex.sets.length, typeId: s.groupData.type };
  });

  // body weight trend
  const bwPts = sessions
    .filter(s => s.bodyWeight)
    .slice().reverse()
    .map(s => ({ y: s.bodyWeight, label: fmtShort(s.date), date: s.date }));

  const firstW = chartPts[0]?.y ?? 0, lastW = chartPts[chartPts.length-1]?.y ?? 0;
  const maxW   = chartPts.length ? Math.max(...chartPts.map(p=>p.y)) : 0;
  const diff   = lastW - firstW;

  const TAB_DEFS = [
    { id:"weight",     label:"웨이트",  color:"#FF4D6D" },
    { id:"cardio",     label:"유산소",  color:"#E64980" },
    { id:"bodyweight", label:"몸무게",  color:"#74C0FC" },
  ];

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 20px 40px" }}>
      <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", marginBottom:6 }}>ANALYTICS</div>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, fontWeight:700, marginBottom:20 }}>
        운동 <span style={{ color:"#FF4D6D" }}>데이터</span>
      </div>

      {/* main tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:20, background:"#111118", borderRadius:12, padding:4, border:"1px solid #1E1E2A" }}>
        {TAB_DEFS.map(t => {
          const act = mainTab === t.id;
          return (
            <button key={t.id} className="btn" onClick={()=>{ setMainTab(t.id); setEx(null); }}
              style={{ flex:1, padding:"9px 0", borderRadius:9, fontSize:12,
                fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
                background: act ? t.color : "transparent",
                color: act ? "#0A0A0F" : "#555",
                transition:"all 0.15s" }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {/* ── 몸무게 탭 ── */}
      {mainTab === "bodyweight" && (
        <>
          {bwPts.length >= 1 ? (
            <div style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:16, padding:"18px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700 }}>몸무게</div>
                  <div style={{ fontSize:10, color:"#555", marginTop:2 }}>변화 추이 (kg)</div>
                </div>
                {bwPts.length >= 2 && (() => {
                  const bwDiff = bwPts[bwPts.length-1].y - bwPts[0].y;
                  return bwDiff !== 0 && (
                    <span style={{ fontSize:12, padding:"3px 10px", borderRadius:20, fontWeight:700,
                      background: bwDiff < 0 ? "#1A3A2A" : "#3A1A1A",
                      color:      bwDiff < 0 ? "#4ECDC4" : "#FF6B6B" }}>
                      {bwDiff > 0 ? `▲ +${bwDiff.toFixed(1)}` : `▼ ${bwDiff.toFixed(1)}`}kg
                    </span>
                  );
                })()}
              </div>
              <div style={{ overflowX:"auto" }}>
                <LineChart points={bwPts} color="#74C0FC" width={Math.max(300, bwPts.length*76)} height={110}/>
              </div>
              <div style={{ marginTop:14, borderTop:"1px solid #1A1A24", paddingTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                {[...bwPts].reverse().map((p,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:600 }}>{getDaysAgo(p.date)}</span>
                      <span style={{ fontSize:10, color:"#555" }}>{fmtDate(p.date)}</span>
                    </div>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, color:"#74C0FC" }}>{p.y}kg</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background:"#111118", border:"1px dashed #1E1E2A", borderRadius:16, padding:"40px 24px", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>⚖️</div>
              <div style={{ fontSize:14, color:"#444" }}>아직 몸무게 기록이 없어요</div>
              <div style={{ fontSize:11, color:"#333", marginTop:6, lineHeight:1.6 }}>운동 기록 설정에서<br/>몸무게를 입력하면 여기에 표시돼요</div>
            </div>
          )}
        </>
      )}

      {/* ── 웨이트 / 유산소 탭 ── */}
      {mainTab !== "bodyweight" && (
        <>
          {/* 부위 선택 — 웨이트만, 유산소는 cardio 고정 */}
          {mainTab === "weight" && (
            <>
              <div style={{ display:"flex", gap:6, marginBottom:10, overflowX:"auto", paddingBottom:4 }}>
                {MUSCLE_GROUPS.filter(g => g.id !== "cardio").map(g=>{ const act=gid===g.id; const has=getGroupSessions(sessions,g.id).length>0; return (
                  <button key={g.id} className="btn" onClick={()=>{ setGid(g.id); setEx(null); }} style={{ padding:"7px 13px", borderRadius:20, fontSize:11, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, background:act?g.color:"#111118", color:act?"#0A0A0F":has?"#777":"#333", border:`1px solid ${act?g.color:"#1E1E2A"}`, whiteSpace:"nowrap", flexShrink:0, transition:"all 0.15s", opacity:has?1:0.4 }}>{g.icon} {g.label}</button>
                );})}
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:16 }}>
                {[{id:"all",label:"전체",color:"#FF4D6D"}, ...WORKOUT_TYPES.map(t=>({id:t.id,label:t.label,color:t.color}))].map(t=>{
                  const act = weightType === t.id;
                  return (
                    <button key={t.id} className="btn" onClick={()=>setWeightType(t.id)}
                      style={{ padding:"5px 14px", borderRadius:20, fontSize:11, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, background:act?t.color:"#111118", color:act?"#0A0A0F":"#666", border:`1px solid ${act?t.color:"#1E1E2A"}`, transition:"all 0.15s" }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {exNames.length===0 ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:"#444" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>{meta.icon}</div>
              <div style={{ fontSize:14 }}>기록이 없어요</div>
            </div>
          ) : (
            <>
              {/* 운동 선택 */}
              <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
                {exNames.map(name=>(
                  <button key={name} className="btn" onClick={()=>setEx(name)} style={{ padding:"6px 13px", borderRadius:8, fontSize:12, fontFamily:"'DM Mono',monospace", background:sel===name?meta.color+"22":"#111118", color:sel===name?meta.color:"#666", border:`1px solid ${sel===name?meta.color+"60":"#1E1E2A"}`, transition:"all 0.15s" }}>{name}</button>
                ))}
              </div>

              {sel && chartPts.length>0 && (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                    {[
                      { label:"최고 무게", val:`${maxW}kg`, color:meta.color },
                      { label:"세션 수",   val:`${chartPts.length}회`, color:"#888" },
                      { label:"변화량",    val:diff===0?"–":`${diff>0?"+":""}${diff}kg`, color:diff>0?"#4ECDC4":diff<0?"#FF6B6B":"#888" },
                    ].map((s,i)=>(
                      <div key={i} style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:12, padding:"12px", textAlign:"center" }}>
                        <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>{s.label}</div>
                        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18, fontWeight:700, color:s.color }}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:16, padding:"18px", marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                      <div>
                        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700 }}>{sel}</div>
                        <div style={{ fontSize:10, color:"#555", marginTop:2 }}>최고 무게 추이 (kg)</div>
                      </div>
                      {diff!==0 && <span style={{ fontSize:12, padding:"3px 10px", borderRadius:20, fontWeight:700, background:diff>0?"#1A3A2A":"#3A1A1A", color:diff>0?"#4ECDC4":"#FF6B6B" }}>{diff>0?`▲ +${diff}kg`:`▼ ${diff}kg`}</span>}
                    </div>
                    <div style={{ overflowX:"auto" }}><LineChart points={chartPts} color={meta.color} width={Math.max(300,chartPts.length*76)} height={110}/></div>
                  </div>

                  <div style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:16, padding:"18px" }}>
                    <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:14 }}>세션별 상세</div>
                    {[...chartPts].reverse().map((p,i)=>(
                      <div key={i} style={{ borderBottom:i<chartPts.length-1?"1px solid #1A1A24":"none", paddingBottom:12, marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:600 }}>{getDaysAgo(p.date)}</span>
                            <span style={{ fontSize:10, color:"#555" }}>{fmtDate(p.date)}</span>
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <span style={{ fontSize:11, background:"#1A1A24", borderRadius:6, padding:"3px 8px", color:"#888" }}>{p.setCount}세트</span>
                            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, color:meta.color }}>{p.y}kg</span>
                          </div>
                        </div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                          {p.sets.map((st,si)=>(
                            <div key={si} style={{ background:"#0A0A14", border:"1px solid #1E1E2A", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                              <span style={{ color:meta.color }}>{st.weight}</span>
                              <span style={{ color:"#444" }}>kg × </span>
                              <span style={{ color:"#aaa" }}>{st.reps}회</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ══ Calendar Tab ══ */
function CalendarTab({ sessions, onOpenDate, onSaveRoutine }) {
  const today = new Date();
  const [year,        setYear]    = useState(today.getFullYear());
  const [month,       setMonth]   = useState(today.getMonth());
  const [selected,    setSel]     = useState(null);
  const [filterGroup, setFilter]  = useState(null); // null = 전체, or groupId

  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); setSel(null); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); setSel(null); };

  const rawFirstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const firstDay     = (rawFirstDay + 6) % 7; // shift: Mon=0 … Sun=6
  const daysInMonth  = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  const sessionMap = {};
  sessions.forEach(s => { sessionMap[s.date] = s; });

  const toKey     = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const todayKey  = today.toISOString().split("T")[0];
  const selectedSession = selected ? sessionMap[selected] : null;

  const DAYS        = ["월","화","수","목","금","토","일"];
  const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

  // streak
  let streak = 0;
  let chk = new Date(todayKey);
  while (sessionMap[chk.toISOString().split("T")[0]]) { streak++; chk.setDate(chk.getDate()-1); }

  const dow = today.getDay(); // 0=Sun
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((dow + 6) % 7)); // Monday
  weekStart.setHours(0,0,0,0);
  const weekSessions = sessions.filter(s => {
    const d = new Date(s.date); d.setHours(0,0,0,0);
    return d >= weekStart && d <= today;
  });

  // strip uses rolling 7 days (always visible)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  sevenDaysAgo.setHours(0,0,0,0);
  const last7Sessions = sessions.filter(s => {
    const d = new Date(s.date); d.setHours(0,0,0,0);
    return d >= sevenDaysAgo && d <= today;
  });
  const weekVol  = weekSessions.reduce((a,s)=>a+sessionVolume(s),0);
  const weekSetsCount = weekSessions.reduce((a,s)=>a+sessionSets(s),0);

  // month count
  const monthSessions = sessions.filter(s => { const d=new Date(s.date); return d.getFullYear()===year && d.getMonth()===month; });

  // highlighted dates: if filterGroup set, only days where that group was trained
  const highlightedDates = new Set();
  sessions.forEach(s => {
    if (!filterGroup || s.groups.some(g => g.groupId === filterGroup)) {
      highlightedDates.add(s.date);
    }
  });

  // per-day group highlight color (for filter mode)
  const getHighlightColor = (key) => {
    const s = sessionMap[key];
    if (!s) return null;
    if (filterGroup) {
      const g = s.groups.find(g => g.groupId === filterGroup);
      return g ? getMeta(filterGroup).color : null;
    }
    return "#FF4D6D";
  };

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 20px 40px" }}>
      <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", marginBottom:6 }}>CALENDAR</div>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, fontWeight:700, marginBottom:20 }}>
        운동 <span style={{ color:"#FF4D6D" }}>기록</span>
      </div>

      {/* stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
        {[
          { label:"연속",        val:`${streak}일`,               color:"#FF4D6D" },
          { label:"이번 주",     val:`${weekSessions.length}회`,   color:"#FFE66D" },
          { label:"이번 달",     val:`${monthSessions.length}회`,   color:"#4ECDC4" },
        ].map((s,i)=>(
          <div key={i} style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:12, padding:"12px", textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* this week detail strip */}
      {last7Sessions.length > 0 && (
        <div style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:10 }}>최근 7일 운동</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {last7Sessions.map((s,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:600 }}>
                    {new Date(s.date).toLocaleDateString("ko-KR", { weekday:"short", month:"numeric", day:"numeric" })}
                  </span>
                  <div style={{ display:"flex", gap:4 }}>
                    {s.groups.map((g,gi) => { const m=getMeta(g.groupId); return (
                      <span key={gi} style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:10, padding:"2px 7px", fontWeight:600 }}>{m.label}</span>
                    );})}
                  </div>
                </div>
                <span style={{ fontSize:11, color:"#555" }}>{sessionSets(s)}세트</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* calendar card */}
      <div style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:16, padding:"20px", marginBottom:12 }}>
        {/* month nav */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <button className="btn" onClick={prevMonth} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:32, height:32, fontSize:15 }}>‹</button>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:700 }}>{year}년 {MONTH_NAMES[month]}</div>
          <button className="btn" onClick={nextMonth} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:32, height:32, fontSize:15 }}>›</button>
        </div>

        {/* day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:8 }}>
          {DAYS.map((d,i)=>(
            <div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:600, color:i===5?"#6B9EFF":i===6?"#FF6B6B":"#555", paddingBottom:6 }}>{d}</div>
          ))}
        </div>

        {/* day cells */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {cells.map((d,i)=>{
            if (!d) return <div key={i}/>;
            const key      = toKey(d);
            const s        = sessionMap[key];
            const isTd     = key===todayKey;
            const isSel    = key===selected;
            const dow      = (firstDay+d-1)%7;
            const hlColor  = getHighlightColor(key);
            const dimmed   = filterGroup && s && !s.groups.some(g=>g.groupId===filterGroup);

            return (
              <div key={i} onClick={()=>s?setSel(isSel?null:key):null}
                style={{
                  borderRadius:8, padding:"6px 2px 5px", textAlign:"center",
                  cursor:s?"pointer":"default",
                  background: isSel ? (hlColor||"#FF4D6D")+"22" : isTd ? "#1A1A24" : "transparent",
                  border: isSel ? `1.5px solid ${hlColor||"#FF4D6D"}` : isTd ? "1.5px solid #2A2A38" : "1.5px solid transparent",
                  opacity: dimmed ? 0.3 : 1,
                  transition:"all 0.15s",
                }}>
                <div style={{
                  fontSize:12, fontFamily:"'Space Grotesk',sans-serif",
                  fontWeight: isTd||isSel ? 700 : 400,
                  color: isSel ? (hlColor||"#FF4D6D") : isTd ? "#E8E8E0" : dow===5?"#6B9EFF55":dow===6?"#FF6B6B55":"#666",
                  marginBottom:3,
                }}>{d}</div>
                {s && !dimmed && (
                  <div style={{ display:"flex", justifyContent:"center", gap:2 }}>
                    {(filterGroup
                      ? s.groups.filter(g=>g.groupId===filterGroup)
                      : s.groups
                    ).slice(0,3).map((g,gi)=>{ const m=getMeta(g.groupId); return (
                      <div key={gi} style={{ width:5, height:5, borderRadius:"50%", background:m.color }}/>
                    );})}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* group filter chips */}
        <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid #1A1A24" }}>
          <div style={{ fontSize:9, color:"#444", letterSpacing:"0.1em", marginBottom:8 }}>부위별 보기</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <button className="btn" onClick={()=>setFilter(null)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:11, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, background:!filterGroup?"#FF4D6D":"#1A1A24", color:!filterGroup?"#0A0A0F":"#555", border:`1px solid ${!filterGroup?"#FF4D6D":"#2A2A38"}`, transition:"all 0.15s" }}>
              전체
            </button>
            {MUSCLE_GROUPS.map(g => {
              const act = filterGroup === g.id;
              return (
                <button key={g.id} className="btn" onClick={()=>setFilter(act?null:g.id)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:11, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, background:act?g.color:"#1A1A24", color:act?"#0A0A0F":"#666", border:`1px solid ${act?g.color:"#2A2A38"}`, transition:"all 0.15s" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:act?"#0A0A0F":g.color, flexShrink:0 }}/>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* selected day detail */}
      {selected && selectedSession && (
        <div className="fade-in" style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"16px 18px", borderBottom:"1px solid #1A1A24" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:700, marginBottom:8 }}>
                  {new Date(selected).toLocaleDateString("ko-KR", { month:"long", day:"numeric", weekday:"short" })}
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom: (selectedSession.condition || selectedSession.bodyWeight) ? 8 : 0 }}>
                  {selectedSession.groups.map((g,gi)=>{ const m=getMeta(g.groupId); return (
                    <div key={gi} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:10, padding:"2px 8px", fontWeight:600 }}>{m.icon} {m.label}</span>
                      <TypeBadge typeId={g.type} small/>
                    </div>
                  );})}
                </div>
                {(selectedSession.condition || selectedSession.bodyWeight) && (
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {selectedSession.condition && (() => {
                      const map = { 상:{ emoji:"😤", color:"#4ECDC4" }, 중:{ emoji:"😊", color:"#FFE66D" }, 하:{ emoji:"😮‍💨", color:"#FF6B6B" } };
                      const c = map[selectedSession.condition];
                      return <span style={{ fontSize:11, background:c.color+"18", color:c.color, borderRadius:20, padding:"3px 9px", fontWeight:700 }}>{c.emoji} {selectedSession.condition}</span>;
                    })()}
                    {selectedSession.bodyWeight && (
                      <span style={{ fontSize:11, background:"#1A1A24", color:"#74C0FC", borderRadius:20, padding:"3px 9px", fontWeight:600 }}>⚖️ {selectedSession.bodyWeight}kg</span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>세트</div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700 }}>{sessionSets(selectedSession)}세트</div>
              </div>
            </div>
          </div>

          {selectedSession.groups.map((g,gi)=>{ const m=getMeta(g.groupId); return (
            <div key={gi} style={{ padding:"14px 18px", borderBottom:gi<selectedSession.groups.length-1?"1px solid #1A1A24":"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                <div style={{ fontSize:10, color:m.color, fontWeight:700, letterSpacing:"0.08em" }}>{m.label}</div>
                <TypeBadge typeId={g.type} small/>
              </div>
              {g.exercises.map((ex,ei)=>{ const maxW=Math.max(...ex.sets.map(st=>st.weight)); return (
                <div key={ei} style={{ marginBottom:ei<g.exercises.length-1?10:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:600 }}>{ex.name}</span>
                    <div style={{ display:"flex", gap:5 }}>
                      <span style={{ fontSize:10, background:"#1A1A24", borderRadius:4, padding:"2px 7px", color:"#888" }}>{ex.sets.length}세트</span>
                      <span style={{ fontSize:10, background:"#1A1A24", borderRadius:4, padding:"2px 7px", color:m.color }}>최대 {maxW}kg</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {ex.sets.map((st,si)=>(
                      <div key={si} style={{ background:"#0A0A14", border:"1px solid #1E1E2A", borderRadius:6, padding:"4px 9px", fontSize:11 }}>
                        <span style={{ color:m.color }}>{st.weight}</span>
                        <span style={{ color:"#444" }}>kg×</span>
                        <span style={{ color:"#aaa" }}>{st.reps}회</span>
                      </div>
                    ))}
                  </div>
                </div>
              );})}
            </div>
          );})}

          <div style={{ padding:"12px 18px", display:"flex", flexDirection:"column", gap:8 }}>
            <button className="btn" onClick={()=>{
                const s = selectedSession;
                if (!s) return;
                // Build routine from this session
                const groups = [...new Set(s.groups.map(g=>g.groupId))];
                const groupTypes = Object.fromEntries(s.groups.map(g=>[g.groupId, g.type]));
                const exercises = s.groups.flatMap(g =>
                  g.exercises.map(ex => ({
                    groupId: g.groupId,
                    name: ex.name,
                    sets: ex.sets.length,
                    reps: Math.round(ex.sets.reduce((a,st)=>a+st.reps,0)/ex.sets.length),
                    weight: Math.max(...ex.sets.map(st=>st.weight)),
                  }))
                );
                onSaveRoutine({ groups, groupTypes, exercises,
                  name: new Date(s.date).toLocaleDateString("ko-KR",{month:"long",day:"numeric"}) + " 루틴" });
              }}
              style={{ width:"100%", padding:"11px", background:"#FF4D6D22", border:"1px solid #FF4D6D60", color:"#FF4D6D", borderRadius:10, fontSize:12, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>
              ◻ 이 운동을 루틴으로 저장
            </button>
            <button className="btn" onClick={()=>onOpenDate(selected)}
              style={{ width:"100%", padding:"11px", background:"#1A1A24", border:"1px solid #2A2A38", color:"#aaa", borderRadius:10, fontSize:12, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
              상세 보기 →
            </button>
          </div>
        </div>
      )}
      {selected && !selectedSession && (
        <div style={{ textAlign:"center", padding:"28px 0", color:"#444", fontSize:13 }}>이 날은 운동 기록이 없어요</div>
      )}
    </div>
  );
}

/* ══ Feed Tab ══ */
const DEMO_USERS = [
  {
    id: "demo_minsu", name: "민수", avatar: "#4ECDC4",
    sessions: [
      {
        date: new Date(Date.now() - 2*3600000).toISOString().split("T")[0],
        groups: [
          { groupId:"back", type:"strength", exercises:[
            { name:"데드리프트", sets:[{weight:140,reps:5},{weight:140,reps:5},{weight:130,reps:5}] },
            { name:"바벨 로우",  sets:[{weight:80,reps:8},{weight:80,reps:8}] },
          ]},
        ],
      },
      {
        date: new Date(Date.now() - 3*86400000).toISOString().split("T")[0],
        groups: [
          { groupId:"chest", type:"bodybuilding", exercises:[
            { name:"벤치프레스", sets:[{weight:100,reps:8},{weight:100,reps:8},{weight:95,reps:10}] },
            { name:"케이블 플라이", sets:[{weight:18,reps:15},{weight:18,reps:15}] },
          ]},
        ],
      },
    ],
  },
  {
    id: "demo_jiyeon", name: "지연", avatar: "#FF8B94",
    sessions: [
      {
        date: new Date(Date.now() - 1*86400000).toISOString().split("T")[0],
        groups: [
          { groupId:"leg", type:"strength", exercises:[
            { name:"스쿼트",     sets:[{weight:90,reps:5},{weight:90,reps:5},{weight:85,reps:6}] },
            { name:"레그프레스", sets:[{weight:140,reps:10},{weight:140,reps:10}] },
          ]},
          { groupId:"shoulder", type:"bodybuilding", exercises:[
            { name:"사이드 레터럴레이즈", sets:[{weight:10,reps:15},{weight:10,reps:15},{weight:8,reps:15}] },
          ]},
        ],
      },
    ],
  },
  {
    id: "demo_junho", name: "준호", avatar: "#FFE66D",
    sessions: [
      {
        date: new Date(Date.now() - 5*3600000).toISOString().split("T")[0],
        groups: [
          { groupId:"chest", type:"strength", exercises:[
            { name:"벤치프레스", sets:[{weight:120,reps:3},{weight:120,reps:3},{weight:115,reps:5}] },
          ]},
          { groupId:"tricep", type:"strength", exercises:[
            { name:"클로즈그립 벤치프레스", sets:[{weight:80,reps:8},{weight:80,reps:8}] },
          ]},
        ],
      },
    ],
  },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
}

function Avatar({ name, color, photo, size = 36 }) {
  if (photo) return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}`,
      overflow: "hidden", flexShrink: 0,
      background: color + "30",
    }}>
      <img src={photo} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
    </div>
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color + "30", border: `2px solid ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
      fontSize: size * 0.38, color: color, flexShrink: 0,
    }}>{name[0]}</div>
  );
}

function FeedTab({ myName, myColor, myId, mySessions, sharedUsers, onSaveProfile, onResetData, onLogout }) {
  const [follows,     setFollows]     = useState(["demo_minsu", "demo_jiyeon", "demo_junho"]);
  const [viewUser,    setViewUser]    = useState(null);
  const [comments,    setComments]    = useState({});
  const [reactions,   setReactions]   = useState({});
  const [myReactions, setMyReactions] = useState({});
  const [openComment, setOpenComment] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [screen,      setScreen]      = useState("feed"); // "feed"|"profile"|"share"
  const [nameInput,   setNameInput]   = useState(myName);
  const [colorInput,  setColorInput]  = useState(myColor);
  const [myPhoto,     setMyPhoto]     = useState(null); // base64 string
  const [photoInput,  setPhotoInput]  = useState(null); // editing copy
  const photoFileRef = useRef(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Privacy settings
  // hideExercises: friends can't see exercise names/weights, only part counts
  // hideWeights: friends can see exercise names but not weights
  const [hideExercises, setHideExercises] = useState(false);
  const [hideWeights,   setHideWeights]   = useState(false);

  const PALETTE = ["#FF4D6D","#4ECDC4","#FFE66D","#FF8B94","#A8E6CF","#C7CEEA","#845EF7","#FF6B6B"];

  const allUsers      = [...DEMO_USERS, ...sharedUsers.filter(u => !DEMO_USERS.find(d => d.id === u.id))];
  const followedUsers = allUsers.filter(u => follows.includes(u.id));
  const otherUsers    = allUsers.filter(u => !follows.includes(u.id));
  const toggle        = (id) => setFollows(f => f.includes(id) ? f.filter(x=>x!==id) : [...f, id]);

  const feed = [
    // My own sessions shown to self (no privacy filter — I see everything)
    ...mySessions.slice(0,3).map((s,si) => ({ ...s, user:{ id:myId, name:myName, avatar:myColor, photo:myPhoto }, feedKey:`${myId}_${si}`, isMe:true })),
    // Friends' sessions
    ...followedUsers.flatMap(u => (u.sessions || []).map((s,si) => ({ ...s, user:u, feedKey:`${u.id}_${si}`, isMe:false }))),
  ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  const addReaction = (feedKey, emoji) => {
    const mine = myReactions[feedKey] || new Set();
    if (mine.has(emoji)) {
      setReactions(r => ({ ...r, [feedKey]: { ...(r[feedKey]||{}), [emoji]: Math.max(0,(r[feedKey]?.[emoji]||1)-1) } }));
      setMyReactions(r => { const next = new Set(r[feedKey]||[]); next.delete(emoji); return { ...r, [feedKey]: next }; });
    } else {
      setReactions(r => ({ ...r, [feedKey]: { ...(r[feedKey]||{}), [emoji]: (r[feedKey]?.[emoji]||0)+1 } }));
      setMyReactions(r => { const next = new Set(r[feedKey]||[]); next.add(emoji); return { ...r, [feedKey]: next }; });
    }
  };

  const submitComment = (feedKey) => {
    if (!commentText.trim()) return;
    const newComment = { author: myName, color: myColor, text: commentText.trim(), ts: Date.now() };
    setComments(c => ({ ...c, [feedKey]: [...(c[feedKey]||[]), newComment] }));
    setCommentText("");
  };

  // ── Profile screen ──
  if (screen === "profile") {
    const handleFileChange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoInput(ev.target.result);
      reader.readAsDataURL(file);
    };

    return (
    <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px 20px 40px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <button className="btn" onClick={()=>setScreen("feed")}
          style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>내 프로필</div>
      </div>

      {/* Photo upload */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:28 }}>
        <div style={{ position:"relative", marginBottom:12 }}>
          <Avatar name={nameInput||"?"} color={colorInput} photo={photoInput ?? myPhoto} size={88}/>
          <button className="btn" onClick={()=>photoFileRef.current?.click()}
            style={{
              position:"absolute", bottom:0, right:0,
              width:28, height:28, borderRadius:"50%",
              background:"#FF4D6D", border:"2px solid #0A0A0F",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, color:"#0A0A0F",
            }}>✎</button>
        </div>
        <input
          ref={photoFileRef}
          type="file"
          accept="image/*"
          style={{ display:"none" }}
          onChange={handleFileChange}
        />
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn" onClick={()=>photoFileRef.current?.click()}
            style={{ fontSize:12, color:"#888", background:"#1A1A24", border:"1px solid #2A2A38", borderRadius:20, padding:"6px 14px" }}>
            📷 사진 변경
          </button>
          {(photoInput || myPhoto) && (
            <button className="btn" onClick={()=>{ setPhotoInput(null); setMyPhoto(null); }}
              style={{ fontSize:12, color:"#FF6B6B", background:"#3A1A1A", border:"1px solid #FF6B6B30", borderRadius:20, padding:"6px 14px" }}>
              삭제
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:8 }}>이름</div>
        <input className="txt-input" placeholder="이름을 입력하세요" value={nameInput}
          onChange={e=>setNameInput(e.target.value)}/>
      </div>

      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:10 }}>컬러</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {PALETTE.map(c => (
            <div key={c} onClick={()=>setColorInput(c)} style={{
              width:38, height:38, borderRadius:"50%", background:c, cursor:"pointer",
              border: colorInput===c ? "3px solid #E8E8E0" : "3px solid transparent",
              boxShadow: colorInput===c ? `0 0 0 2px ${c}` : "none",
              transition:"all 0.15s",
            }}/>
          ))}
        </div>
      </div>

      <button className="btn" onClick={()=>{
          if(!nameInput.trim()) return;
          if(photoInput !== null) setMyPhoto(photoInput);
          onSaveProfile(nameInput.trim(), colorInput);
          setScreen("feed");
        }}
        disabled={!nameInput.trim()}
        style={{ width:"100%", padding:"15px", borderRadius:12, fontSize:15, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, background:nameInput.trim()?colorInput:"#1A1A24", color:nameInput.trim()?"#0A0A0F":"#444", transition:"all 0.2s", marginBottom: 20 }}>
        저장하기
      </button>

      {/* Privacy settings */}
      <div style={{ fontSize:10, letterSpacing:"0.14em", color:"#444", marginBottom:12 }}>공개 설정</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[
          {
            key: "exercises",
            val: hideExercises,
            set: setHideExercises,
            title: "운동 종목 숨기기",
            desc: "친구에게 어떤 운동을 했는지 보이지 않아요",
            icon: "◈",
          },
          {
            key: "weights",
            val: hideWeights,
            set: (v) => { setHideWeights(v); if(v) {} },
            title: "무게 숨기기",
            desc: "운동 이름은 보이지만 세트/무게는 숨겨요",
            icon: "△",
          },
        ].map(item => (
          <div key={item.key}
            style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, marginBottom:4, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>{item.icon}</span>
                  {item.title}
                </div>
                <div style={{ fontSize:11, color:"#555", lineHeight:1.5 }}>{item.desc}</div>
              </div>
              {/* toggle switch */}
              <div onClick={()=>item.set(!item.val)}
                style={{
                  width:46, height:26, borderRadius:13, marginLeft:14,
                  background: item.val ? colorInput : "#2A2A38",
                  position:"relative", cursor:"pointer",
                  transition:"background 0.2s", flexShrink:0,
                }}>
                <div style={{
                  position:"absolute", top:3,
                  left: item.val ? 23 : 3,
                  width:20, height:20, borderRadius:"50%",
                  background:"#E8E8E0",
                  transition:"left 0.2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.4)",
                }}/>
              </div>
            </div>
            {item.val && (
              <div style={{ marginTop:10, padding:"8px 12px", background:colorInput+"18", borderRadius:8, fontSize:11, color:colorInput }}>
                {item.key === "exercises" ? "친구 피드에서 운동 종목이 가려져요" : "친구 피드에서 무게/세트 수치가 가려져요"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview */}
      {(hideExercises || hideWeights) && (
        <div style={{ marginTop:16, background:"#111118", border:"1px dashed #2A2A38", borderRadius:14, padding:"16px" }}>
          <div style={{ fontSize:10, color:"#555", letterSpacing:"0.1em", marginBottom:12 }}>친구에게 보이는 모습 미리보기</div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Avatar name={nameInput||myName} color={colorInput} photo={photoInput ?? myPhoto} size={32}/>
            <div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:700 }}>{nameInput||myName}</div>
              <div style={{ fontSize:10, color:"#555" }}>방금 전</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <span style={{ background:"#FF4D6D18", color:"#FF4D6D", borderRadius:20, fontSize:10, padding:"3px 9px", fontWeight:600 }}>◈ 가슴</span>
            <span style={{ background:"#4ECDC418", color:"#4ECDC4", borderRadius:20, fontSize:10, padding:"3px 9px", fontWeight:600 }}>◇ 등</span>
          </div>
          {hideExercises ? (
            <div style={{ fontSize:12, color:"#444", fontStyle:"italic" }}>🔒 운동 내용이 비공개 설정되어 있어요</div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:"#777" }}>벤치프레스</span>
                <span style={{ fontSize:11, color:"#444" }}>3세트 <span style={{ background:"#1A1A24", borderRadius:4, padding:"2px 8px", color:"#666" }}>🔒 숨김</span></span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:"#777" }}>인클라인 덤벨프레스</span>
                <span style={{ fontSize:11, color:"#444" }}>2세트 <span style={{ background:"#1A1A24", borderRadius:4, padding:"2px 8px", color:"#666" }}>🔒 숨김</span></span>
              </div>
            </>
          )}
        </div>
      )}
      {/* 로그아웃 + 데이터 초기화 */}
      <div style={{ marginTop:32, paddingTop:20, borderTop:"1px solid #1A1A24", display:"flex", flexDirection:"column", gap:8 }}>
        <button className="btn" onClick={onLogout}
          style={{ width:"100%", padding:"12px", borderRadius:12, fontSize:13, color:"#888", background:"#1A1A24", border:"1px solid #2A2A38", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
          로그아웃
        </button>
        {!confirmReset ? (
          <button className="btn" onClick={()=>setConfirmReset(true)}
            style={{ width:"100%", padding:"12px", borderRadius:12, fontSize:13, color:"#FF6B6B", background:"#3A1A1A22", border:"1px solid #FF6B6B30", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
            🗑 데이터 초기화
          </button>
        ) : (
          <div style={{ background:"#1A1014", border:"1px solid #FF6B6B50", borderRadius:14, padding:"18px" }}>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700, color:"#FF6B6B", marginBottom:6 }}>
              정말 초기화 하시겠어요?
            </div>
            <div style={{ fontSize:12, color:"#888", marginBottom:16, lineHeight:1.6 }}>
              모든 운동 기록, 루틴, 컨디션/몸무게 데이터가<br/>삭제되며 복구할 수 없어요.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" onClick={()=>setConfirmReset(false)}
                style={{ flex:1, padding:"11px", background:"#1A1A24", border:"1px solid #2A2A38", color:"#aaa", borderRadius:10, fontSize:13, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
                취소
              </button>
              <button className="btn" onClick={()=>{ onResetData(); setConfirmReset(false); setScreen("feed"); }}
                style={{ flex:1, padding:"11px", background:"#FF6B6B", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>
                초기화
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  } // end profile screen

  // ── Share / invite screen ──
  if (screen === "share") return (
    <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <button className="btn" onClick={()=>setScreen("feed")}
          style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>친구 초대</div>
      </div>

      <div style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:16, padding:"28px 20px", textAlign:"center", marginBottom:14 }}>
        <div style={{ fontSize:44, marginBottom:14 }}>🔗</div>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700, marginBottom:10 }}>
          이 링크를 친구들에게 공유하세요
        </div>
        <div style={{ fontSize:13, color:"#666", lineHeight:1.7, marginBottom:20 }}>
          같은 링크로 접속하면 자동으로<br/>
          같은 공간에 연결돼요.<br/>
          각자 이름·컬러 설정 후 바로 사용 가능해요.
        </div>
        <div style={{ background:"#0A0A0F", border:"1px dashed #2A2A38", borderRadius:10, padding:"14px 16px", fontSize:12, color:"#666", fontFamily:"'DM Mono',monospace", lineHeight:1.8 }}>
          Claude.ai 아티팩트<br/>
          우측 상단 <span style={{ color:"#FF4D6D" }}>Share</span> 버튼<br/>
          → 링크 복사 후 카카오톡·문자로 전송
        </div>
      </div>

      <div style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"18px" }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:"0.1em", marginBottom:14 }}>현재 연결된 유저</div>
        {/* me */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <Avatar name={myName} color={myColor} photo={myPhoto} size={32}/>
          <div>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:700 }}>{myName}</span>
            <span style={{ fontSize:11, color:"#555", marginLeft:6 }}>(나)</span>
          </div>
          <div style={{ marginLeft:"auto", width:8, height:8, borderRadius:"50%", background:"#4ECDC4" }}/>
        </div>
        {/* real users */}
        {sharedUsers.map((u,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Avatar name={u.name} color={u.avatar||"#888"} size={32}/>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:700 }}>{u.name}</span>
          </div>
        ))}
        <div style={{ fontSize:11, color:"#333", marginTop:4 }}>+ 데모 유저 3명 (민수, 지연, 준호)</div>
      </div>
    </div>
  );

  // ── User profile view ──
  if (viewUser) {
    const u = allUsers.find(u => u.id === viewUser);
    if (!u) return null;
    const isFollowing = follows.includes(u.id);
    return (
      <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px 20px 40px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
          <button className="btn" onClick={()=>setViewUser(null)}
            style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Avatar name={u.name} color={u.avatar} photo={u.photo} size={44}/>
              <div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>{u.name}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>운동 {u.sessions?.length ?? 0}회 기록</div>
              </div>
            </div>
          </div>
          <button className="btn" onClick={()=>toggle(u.id)} style={{
            padding:"8px 16px", borderRadius:20, fontSize:12,
            fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
            background: isFollowing ? "#1A1A24" : "#FF4D6D",
            color: isFollowing ? "#888" : "#0A0A0F",
            border: `1px solid ${isFollowing ? "#2A2A38" : "#FF4D6D"}`,
          }}>{isFollowing ? "팔로잉" : "팔로우"}</button>
        </div>

        {(() => {
          const totalSets = (u.sessions||[]).reduce((a,s) => a+sessionSets(s), 0);
          return (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
              {[
                { label:"운동 횟수", val:`${u.sessions?.length??0}회`, color:u.avatar },
                { label:"총 세트",   val:`${totalSets}`,               color:"#888" },
              ].map((s,i) => (
                <div key={i} style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:12, padding:"12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700, color:s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {(u.sessions||[]).map((s,i) => (
          <div key={i} style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"16px", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700 }}>
                {new Date(s.date).toLocaleDateString("ko-KR", { month:"long", day:"numeric", weekday:"short" })}
              </span>
              <span style={{ fontSize:11, color:"#555" }}>{timeAgo(s.date)}</span>
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
              {s.groups.map((g,gi) => { const m=getMeta(g.groupId); return (
                <div key={gi} style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:10, padding:"2px 8px", fontWeight:600 }}>{m.icon} {m.label}</span>
                  <TypeBadge typeId={g.type} small/>
                </div>
              );})}
            </div>
            {s.groups.map((g,gi) => { const m=getMeta(g.groupId); return (
              <div key={gi} style={{ marginBottom: gi < s.groups.length-1 ? 8:0 }}>
                {g.exercises.map((ex,ei) => {
                  const maxW = Math.max(...ex.sets.map(st=>st.weight));
                  return (
                    <div key={ei} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"#777" }}>{ex.name}</span>
                      <div style={{ display:"flex", gap:5 }}>
                        <span style={{ fontSize:10, color:"#444" }}>{ex.sets.length}세트</span>
                        <span style={{ fontSize:11, background:"#1A1A24", borderRadius:4, padding:"2px 8px", color:m.color }}>최대 {maxW}kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );})}
          </div>
        ))}
        {(!u.sessions||u.sessions.length===0) && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#444", fontSize:13 }}>아직 기록이 없어요</div>
        )}
      </div>
    );
  }

  // ── Main Feed ──
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 20px 40px" }}>
      {/* header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", marginBottom:6 }}>SOCIAL</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, fontWeight:700 }}>
            친구 <span style={{ color:"#FF4D6D" }}>피드</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button className="btn" onClick={()=>setScreen("share")}
            style={{ background:"#1A1A24", border:"1px solid #2A2A38", color:"#888", borderRadius:10, padding:"8px 12px", fontSize:12, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
            🔗 초대
          </button>
          <div onClick={()=>{ setNameInput(myName); setColorInput(myColor); setScreen("profile"); }}
            style={{ cursor:"pointer" }}>
            <Avatar name={myName} color={myColor} photo={myPhoto} size={34}/>
          </div>
        </div>
      </div>

      {/* discover */}
      {otherUsers.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:10 }}>추천 친구</div>
          <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:6, marginLeft:-20, marginRight:-20, paddingLeft:20, paddingRight:20 }}>
            {otherUsers.map(u => (
              <div key={u.id} style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"14px", flexShrink:0, width:136, textAlign:"center" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
                  <Avatar name={u.name} color={u.avatar} photo={u.photo} size={40}/>
                </div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:700, marginBottom:4 }}>{u.name}</div>
                <div style={{ fontSize:10, color:"#555", marginBottom:10 }}>운동 {u.sessions?.length??0}회</div>
                <button className="btn" onClick={()=>toggle(u.id)} style={{
                  width:"100%", padding:"7px 0", borderRadius:20, fontSize:11,
                  fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
                  background:"#FF4D6D", color:"#0A0A0F",
                }}>팔로우</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* following avatars */}
      {followedUsers.length > 0 && (
        <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:6, marginBottom:20, marginLeft:-20, marginRight:-20, paddingLeft:20, paddingRight:20 }}>
          {followedUsers.map(u => {
            const lastSession = (u.sessions||[])[0];
            const isToday = lastSession && new Date()-new Date(lastSession.date) < 86400000;
            return (
              <div key={u.id} onClick={()=>setViewUser(u.id)}
                style={{ flexShrink:0, textAlign:"center", cursor:"pointer" }}>
                <div style={{ position:"relative", marginBottom:5 }}>
                  <Avatar name={u.name} color={u.avatar} photo={u.photo} size={46}/>
                  {isToday && <div style={{ position:"absolute", bottom:1, right:1, width:11, height:11, borderRadius:"50%", background:"#4ECDC4", border:"2px solid #0A0A0F" }}/>}
                </div>
                <div style={{ fontSize:10, color:"#aaa", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>{u.name}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* feed cards */}
      {feed.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#444" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>◎</div>
          <div style={{ fontSize:14 }}>팔로우한 친구의 운동이 여기 표시돼요</div>
        </div>
      ) : feed.map((s, fi) => {
        const u        = s.user;
        const fk       = s.feedKey;
        const sTot     = sessionSets(s);
        const vTot     = Math.round(sessionVolume(s)/100)/10;        const cList    = comments[fk] || [];
        const rMap     = reactions[fk] || {};
        const myR      = myReactions[fk] || new Set();
        const isOpen   = openComment === fk;

        return (
          <div key={fk} style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:16, marginBottom:14, overflow:"hidden" }}>
            {/* card header */}
            <div style={{ padding:"16px 16px 0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div onClick={()=>s.isMe ? setScreen("profile") : setViewUser(u.id)}
                  style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                  <Avatar name={u.name} color={u.avatar} photo={u.photo} size={34}/>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700 }}>{u.name}</div>
                      {s.isMe && <span style={{ fontSize:10, background:"#1A1A24", color:"#666", borderRadius:20, padding:"2px 7px" }}>나</span>}
                    </div>
                    <div style={{ fontSize:10, color:"#555" }}>{timeAgo(s.date)}</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {s.isMe && (hideExercises || hideWeights) && (
                    <span style={{ fontSize:10, background:"#1A1A2A", color:"#666", borderRadius:20, padding:"3px 9px", border:"1px solid #2A2A38" }}>
                      🔒 {hideExercises ? "전체 비공개" : "무게 숨김"}
                    </span>
                  )}
                  <div style={{ fontSize:11, color:"#555" }}>{sTot}세트</div>
                </div>
              </div>

              {/* groups */}
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                {s.groups.map((g,gi) => { const m=getMeta(g.groupId); return (
                  <div key={gi} style={{ display:"flex", alignItems:"center", gap:3 }}>
                    <span style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:10, padding:"3px 9px", fontWeight:600 }}>{m.icon} {m.label}</span>
                    <TypeBadge typeId={g.type} small/>
                  </div>
                );})}
              </div>

              {/* exercises — apply my privacy settings when showing my own posts */}
              {(() => {
                // For my own sessions, apply privacy simulation (what friends would see)
                // isMe=true means it's my post; we show a "preview of what friends see" indicator
                const applyPrivacy = s.isMe && (hideExercises || hideWeights);
                if (s.isMe && hideExercises) return (
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0 2px", color:"#555", fontSize:12 }}>
                    <span style={{ fontSize:14 }}>🔒</span>
                    <span>운동 내용 비공개 · 친구에게 숨겨져 있어요</span>
                  </div>
                );
                return s.groups.map((g,gi) => { const m=getMeta(g.groupId); return (
                  <div key={gi} style={{ marginBottom: gi<s.groups.length-1?8:0 }}>
                    <div style={{ fontSize:9, color:m.color, fontWeight:700, letterSpacing:"0.1em", marginBottom:5 }}>{m.label}</div>
                    {g.exercises.map((ex,ei) => {
                      const maxW = Math.max(...ex.sets.map(st=>st.weight));
                      const weightHidden = s.isMe && hideWeights;
                      return (
                        <div key={ei} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                          <span style={{ fontSize:12, color:"#777" }}>{ex.name}</span>
                          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                            <span style={{ fontSize:10, color:"#444" }}>{ex.sets.length}세트</span>
                            {weightHidden ? (
                              <span style={{ fontSize:11, background:"#1A1A24", borderRadius:4, padding:"2px 8px", color:"#555" }}>🔒 무게 숨김</span>
                            ) : (
                              <span style={{ fontSize:11, background:"#1A1A24", borderRadius:4, padding:"2px 8px", color:m.color }}>최대 {maxW}kg</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );});
              })()}
            </div>

            {/* reaction + comment toggle row */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderTop:"1px solid #1A1A24", marginTop:12 }}>
              <div style={{ display:"flex", gap:6 }}>
                {["💪","🔥","👊"].map(emoji => {
                  const cnt   = rMap[emoji] || 0;
                  const mine  = myR.has(emoji);
                  return (
                    <button key={emoji} className="btn" onClick={()=>addReaction(fk,emoji)}
                      style={{
                        display:"flex", alignItems:"center", gap:4,
                        fontSize:14, padding:"5px 10px",
                        background: mine ? "#FF4D6D20" : "#1A1A24",
                        borderRadius:20, color: mine ? "#FF4D6D" : "#888",
                        border:`1px solid ${mine?"#FF4D6D40":"#2A2A38"}`,
                        transition:"all 0.15s",
                      }}>
                      {emoji}{cnt > 0 && <span style={{ fontSize:11, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>{cnt}</span>}
                    </button>
                  );
                })}
              </div>
              <button className="btn" onClick={()=>setOpenComment(isOpen?null:fk)}
                style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:isOpen?"#FF4D6D":"#666",
                  padding:"5px 10px", background:isOpen?"#FF4D6D14":"#1A1A24", borderRadius:20,
                  border:`1px solid ${isOpen?"#FF4D6D40":"#2A2A38"}` }}>
                💬 <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
                  {cList.length > 0 ? `${cList.length}` : "댓글"}
                </span>
              </button>
            </div>

            {/* comments section */}
            {(cList.length > 0 || isOpen) && (
              <div style={{ borderTop:"1px solid #1A1A24", padding:"12px 16px" }}>
                {/* existing comments */}
                {cList.map((c, ci) => (
                  <div key={ci} style={{ display:"flex", gap:8, marginBottom:10, alignItems:"flex-start" }}>
                    <Avatar name={c.author} color={c.color} size={26}/>
                    <div style={{ flex:1, background:"#1A1A24", borderRadius:10, padding:"8px 12px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:12, fontWeight:700, color:c.color }}>{c.author}</span>
                        <span style={{ fontSize:10, color:"#444" }}>
                          {Math.floor((Date.now()-c.ts)/60000) < 60
                            ? `${Math.floor((Date.now()-c.ts)/60000)}분 전`
                            : `${Math.floor((Date.now()-c.ts)/3600000)}시간 전`}
                        </span>
                      </div>
                      <div style={{ fontSize:13, color:"#ccc", lineHeight:1.4 }}>{c.text}</div>
                    </div>
                  </div>
                ))}

                {/* comment input */}
                {isOpen && (
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginTop: cList.length > 0 ? 8:0 }}>
                    <Avatar name={myName} color={myColor} photo={myPhoto} size={28}/>
                    <div style={{ flex:1, display:"flex", gap:6 }}>
                      <input
                        className="txt-input"
                        placeholder="댓글 남기기..."
                        value={commentText}
                        onChange={e=>setCommentText(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter")submitComment(fk); }}
                        style={{ flex:1, fontSize:13, padding:"8px 12px", borderRadius:20 }}
                        autoFocus
                      />
                      <button className="btn" onClick={()=>submitComment(fk)}
                        disabled={!commentText.trim()}
                        style={{
                          padding:"8px 14px", background: commentText.trim()?"#FF4D6D":"#1A1A24",
                          color: commentText.trim()?"#0A0A0F":"#444",
                          borderRadius:20, fontSize:12,
                          fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
                          transition:"all 0.15s", flexShrink:0,
                        }}>전송</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══ Routine Tab ══ */
function RoutineTab({ routines, setRoutines, onStartLogWithRoutine }) {
  const [routineView, setRV]         = useState("list");
  const [selectedRoutine, setSel]    = useState(null);
  const [filterType, setFT]          = useState("all");

  const EMPTY = { name:"", groupTypes:{}, groups:[], exercises:[] };
  const [builder, setBuilder] = useState(EMPTY);
  const [addingEx, setAddEx]  = useState(false);
  const [newEx, setNewEx]     = useState({ groupId:"chest", name:"", sets:3, reps:10, weight:"" });

  const startCreate = () => { setBuilder(EMPTY); setAddEx(false); setNewEx({ groupId:"chest", name:"", sets:3, reps:10, weight:"" }); setRV("create"); };
  const startEdit   = (r)  => { setBuilder({ ...r, exercises:[...r.exercises], groups:[...r.groups], groupTypes:{...r.groupTypes} }); setAddEx(false); setRV("edit"); };

  const toggleBGroup = (id) => setBuilder(b => ({
    ...b,
    groups: b.groups.includes(id) ? b.groups.filter(g=>g!==id) : [...b.groups, id],
    groupTypes: b.groups.includes(id) ? Object.fromEntries(Object.entries(b.groupTypes).filter(([k])=>k!==id)) : { ...b.groupTypes, [id]:"bodybuilding" },
  }));

  const setGroupType = (gid, typeId) => setBuilder(b => ({ ...b, groupTypes:{ ...b.groupTypes, [gid]:typeId } }));

  const addBuilderEx = () => {
    if (!newEx.name.trim() || !newEx.weight) return;
    setBuilder(b => ({ ...b, exercises:[...b.exercises, { ...newEx, sets:Number(newEx.sets), reps:Number(newEx.reps), weight:Number(newEx.weight) }] }));
    setNewEx(n => ({ ...n, name:"", weight:"" }));
    setAddEx(false);
  };

  const saveRoutine = (isEdit) => {
    if (!builder.name.trim() || !builder.exercises.length) return;
    if (isEdit) setRoutines(r=>r.map(rt=>rt.id===builder.id?{...builder}:rt));
    else        setRoutines(r=>[{ ...builder, id:uid() }, ...r]);
    setRV("list");
  };

  const deleteRoutine = (id) => { setRoutines(r=>r.filter(rt=>rt.id!==id)); setRV("list"); };

  // Filter routines: a routine matches if ANY of its group types matches
  const filtered = filterType==="all" ? routines : routines.filter(r => Object.values(r.groupTypes||{}).includes(filterType));

  /* list */
  if (routineView==="list") return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 20px 40px" }}>
      <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", marginBottom:6 }}>ROUTINE</div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, fontWeight:700 }}>내 <span style={{ color:"#FF4D6D" }}>루틴</span></div>
        <button className="btn" onClick={startCreate} style={{ background:"#FF4D6D", color:"#0A0A0F", fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:13, padding:"9px 16px", borderRadius:10 }}>+ 새 루틴</button>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:18 }}>
        {[{id:"all",label:"전체",color:"#FF4D6D"}, ...WORKOUT_TYPES].map(t=>{
          const act=filterType===t.id;
          return <button key={t.id} className="btn" onClick={()=>setFT(t.id)} style={{ padding:"6px 14px", borderRadius:20, fontSize:11, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, background:act?t.color:"#111118", color:act?"#0A0A0F":"#666", border:`1px solid ${act?t.color:"#1E1E2A"}`, transition:"all 0.15s" }}>{t.label}</button>;
        })}
      </div>

      {filtered.length===0 && (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#444" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>◻</div>
          <div style={{ fontSize:14 }}>루틴이 없어요</div>
        </div>
      )}

      {filtered.map(r=>{
        const types = [...new Set(Object.values(r.groupTypes||{}))];
        return (
          <div key={r.id} className="lift" onClick={()=>{ setSel(r); setRV("detail"); }}
            style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"18px", marginBottom:10, position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, width:3, height:"100%", background:"#FF4D6D", borderRadius:"2px 0 0 2px" }}/>
            <div style={{ paddingLeft:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ display:"flex", gap:5, marginBottom:6, flexWrap:"wrap" }}>
                    {types.map(tid=><TypeBadge key={tid} typeId={tid}/>)}
                  </div>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700 }}>{r.name}</div>
                </div>
                <div style={{ fontSize:12, color:"#555" }}>{r.exercises.length}가지</div>
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                {r.groups.map(gid=>{ const m=getMeta(gid); return (
                  <div key={gid} style={{ display:"flex", alignItems:"center", gap:3 }}>
                    <span style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:10, padding:"2px 8px", fontWeight:600 }}>{m.icon} {m.label}</span>
                    <TypeBadge typeId={r.groupTypes?.[gid]} small/>
                  </div>
                );})}
              </div>
              <div style={{ borderTop:"1px solid #1A1A24", paddingTop:10 }}>
                {r.exercises.slice(0,3).map((ex,i)=>{ const wt=getType(r.groupTypes?.[ex.groupId]); return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"#777" }}>{ex.name}</span>
                    <span style={{ fontSize:11, color:wt?.color||"#888" }}>{ex.sets}×{ex.reps} / {ex.weight}kg</span>
                  </div>
                );})}
                {r.exercises.length>3 && <div style={{ fontSize:11, color:"#444", marginTop:4 }}>+{r.exercises.length-3}개 더</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* detail */
  if (routineView==="detail" && selectedRoutine) {
    const r = routines.find(rt=>rt.id===selectedRoutine.id) ?? selectedRoutine;
    return (
      <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button className="btn" onClick={()=>setRV("list")} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:5, marginBottom:6, flexWrap:"wrap" }}>
              {[...new Set(Object.values(r.groupTypes||{}))].map(tid=><TypeBadge key={tid} typeId={tid}/>)}
            </div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>{r.name}</div>
          </div>
        </div>

        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:18 }}>
          {r.groups.map(gid=>{ const m=getMeta(gid); return (
            <div key={gid} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:11, padding:"3px 10px", fontWeight:600 }}>{m.icon} {m.label}</span>
              <TypeBadge typeId={r.groupTypes?.[gid]}/>
            </div>
          );})}
        </div>

        {r.groups.map(gid=>{ const m=getMeta(gid); const wt=getType(r.groupTypes?.[gid]); const exs=r.exercises.filter(e=>e.groupId===gid); if(!exs.length)return null; return (
          <div key={gid} style={{ background:"#111118", border:`1px solid ${m.color}28`, borderRadius:16, padding:"18px", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700, color:m.color }}>{m.icon} {m.label}</div>
              <TypeBadge typeId={r.groupTypes?.[gid]}/>
            </div>
            {exs.map((ex,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:i>0?"1px solid #1A1A24":"none", paddingTop:i>0?10:0, marginTop:i>0?10:0 }}>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:600 }}>{ex.name}</div>
                <div style={{ display:"flex", gap:6 }}>
                  <span style={{ background:wt?.bg||"#1A1A24", color:wt?.color||"#888", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:600 }}>{ex.sets}세트 × {ex.reps}회</span>
                  <span style={{ background:"#1A1A24", color:"#aaa", borderRadius:6, padding:"4px 10px", fontSize:12 }}>{ex.weight}kg</span>
                </div>
              </div>
            ))}
          </div>
        );})}

        <div style={{ display:"flex", gap:8, marginTop:20 }}>
          <button className="btn" onClick={()=>startEdit(r)} style={{ flex:1, padding:"14px", background:"#1A1A24", border:"1px solid #2A2A38", color:"#aaa", borderRadius:12, fontSize:13, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>✏️ 수정</button>
          <button className="btn" onClick={()=>onStartLogWithRoutine(r)} style={{ flex:2, padding:"14px", background:"#FF4D6D", color:"#0A0A0F", borderRadius:12, fontSize:14, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>이 루틴으로 시작 →</button>
        </div>
        <button className="btn" onClick={()=>deleteRoutine(r.id)} style={{ width:"100%", marginTop:10, padding:"12px", color:"#555", fontSize:12, border:"1px solid #1E1E2A", borderRadius:10 }}>루틴 삭제</button>
      </div>
    );
  }

  /* create / edit */
  const isEdit = routineView==="edit";
  return (
    <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px 20px 40px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button className="btn" onClick={()=>setRV(isEdit?"detail":"list")} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>{isEdit?"루틴 수정":"새 루틴 만들기"}</div>
      </div>

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:8 }}>루틴 이름</div>
        <input className="txt-input" placeholder="예: Push Day A" value={builder.name} onChange={e=>setBuilder(b=>({...b,name:e.target.value}))}/>
      </div>

      {/* group select + per-group type */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:10 }}>운동 부위 및 타입</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {MUSCLE_GROUPS.map(g=>{
            const sel = builder.groups.includes(g.id);
            return (
              <div key={g.id}
                style={{ background:sel?g.color+"10":"#111118", border:`1.5px solid ${sel?g.color:"#1E1E2A"}`, borderRadius:12, padding:"12px 14px", transition:"all 0.15s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div onClick={()=>toggleBGroup(g.id)} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", flex:1 }}>
                    <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${sel?g.color:"#333"}`, background:sel?g.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#0A0A0F", transition:"all 0.15s" }}>{sel?"✓":""}</div>
                    <span style={{ fontSize:14, color:sel?g.color:"#666", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>{g.icon} {g.label}</span>
                  </div>
                  {sel && <TypeToggle value={builder.groupTypes[g.id]||"bodybuilding"} onChange={(t)=>setGroupType(g.id,t)}/>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* exercises */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom:10 }}>운동 목록</div>
        {builder.exercises.length===0 && !addingEx && <div style={{ textAlign:"center", padding:"20px 0", color:"#333", fontSize:12 }}>운동을 추가해주세요</div>}

        {builder.groups.map(gid=>{ const m=getMeta(gid); const wt=getType(builder.groupTypes[gid]); const exs=builder.exercises.filter(e=>e.groupId===gid); if(!exs.length)return null; return (
          <div key={gid} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <div style={{ fontSize:10, color:m.color, letterSpacing:"0.1em", fontWeight:600 }}>{m.label}</div>
              <TypeBadge typeId={builder.groupTypes[gid]} small/>
            </div>
            {exs.map((ex,i)=>{ const ri=builder.exercises.findIndex(e=>e===ex); return (
              <div key={i} style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:10, padding:"12px 14px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:600, marginBottom:4 }}>{ex.name}</div>
                  <div style={{ fontSize:11, color:wt?.color||"#888" }}>{ex.sets}세트 × {ex.reps}회 / 목표 {ex.weight}kg</div>
                </div>
                <button className="btn" onClick={()=>setBuilder(b=>({...b,exercises:b.exercises.filter((_,idx)=>idx!==ri)}))} style={{ color:"#444", fontSize:18 }}>×</button>
              </div>
            );})}
          </div>
        );})}

        {addingEx ? (
          <div style={{ background:"#111118", border:"1px solid #FF4D6D50", borderRadius:12, padding:"16px", marginBottom:10 }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:6 }}>부위</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
              {(builder.groups.length>0?builder.groups:MUSCLE_GROUPS.map(g=>g.id)).map(gid=>{ const m=getMeta(gid); return (
                <button key={gid} className="btn" onClick={()=>setNewEx(n=>({...n,groupId:gid}))}
                  style={{ padding:"5px 12px", borderRadius:8, fontSize:11, background:newEx.groupId===gid?m.color+"22":"#1A1A24", color:newEx.groupId===gid?m.color:"#666", border:`1px solid ${newEx.groupId===gid?m.color+"60":"#2A2A38"}` }}>{m.label}</button>
              );})}
            </div>
            <div style={{ fontSize:10, color:"#555", marginBottom:6 }}>운동 이름</div>
            <input className="txt-input" placeholder="예: 벤치프레스" value={newEx.name} onChange={e=>setNewEx(n=>({...n,name:e.target.value}))} style={{ marginBottom:12 }}/>
            <div style={{ display:"flex", gap:8 }}>
              {[{key:"sets",label:"세트"},{key:"reps",label:"횟수"},{key:"weight",label:"목표kg"}].map(f=>(
                <div key={f.key} style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>{f.label}</div>
                  <input className="num-input" type="number" value={newEx[f.key]} onChange={e=>setNewEx(n=>({...n,[f.key]:e.target.value}))} style={{ width:"100%" }}/>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button className="btn" onClick={()=>setAddEx(false)} style={{ flex:1, padding:"10px", background:"#1A1A24", border:"1px solid #2A2A38", color:"#666", borderRadius:8, fontSize:13 }}>취소</button>
              <button className="btn" onClick={addBuilderEx} style={{ flex:2, padding:"10px", background:"#FF4D6D", color:"#0A0A0F", borderRadius:8, fontSize:13, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>추가</button>
            </div>
          </div>
        ) : (
          <button className="btn" onClick={()=>setAddEx(true)} style={{ width:"100%", padding:"14px", background:"#FF4D6D18", border:"1.5px dashed #FF4D6D80", color:"#FF4D6D", borderRadius:12, fontSize:14, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginBottom:4 }}>+ 운동 추가</button>
        )}
      </div>

      <button className="btn" onClick={()=>saveRoutine(isEdit)} disabled={!builder.name.trim()||!builder.exercises.length}
        style={{ width:"100%", padding:"16px", borderRadius:12, fontSize:15, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, background:builder.name.trim()&&builder.exercises.length?"#FF4D6D":"#1A1A24", color:builder.name.trim()&&builder.exercises.length?"#0A0A0F":"#444", transition:"all 0.2s" }}>
        {isEdit?"루틴 저장":"루틴 만들기"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN APP
══════════════════════════════════════ */
export default function WorkoutTracker({ session }) {
  const userId   = session?.user?.id ?? "";
  const userMeta = session?.user?.user_metadata ?? {};

  const [sessions,  setSessions]  = useState([]);
  const [routines,  setRoutines]  = useState(INITIAL_ROUTINES);
  const [exLibrary, setExLibrary] = useState(DEFAULT_LIBRARY);
  const [myName,    setMyName]    = useState(userMeta.name || userMeta.full_name || "운동러");
  const [myColor,   setMyColor]   = useState("#FF4D6D");
  const [myId]                    = [userId];
  const [sharedUsers, setSharedUsers] = useState([]);
  const [dataLoaded,  setDataLoaded]  = useState(false);

  // ── Load from Supabase on mount ──
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        // profile
        const { data: profile } = await supabase
          .from("profiles").select("*").eq("id", userId).single();
        if (profile) {
          setMyName(profile.name || myName);
          setMyColor(profile.color || "#FF4D6D");
          if (profile.routines)  setRoutines(JSON.parse(profile.routines));
          if (profile.ex_library) setExLibrary(JSON.parse(profile.ex_library));
        } else {
          await supabase.from("profiles").upsert({
            id: userId, name: myName, color: "#FF4D6D",
          });
        }
        // sessions
        const { data: rows } = await supabase
          .from("sessions").select("*").eq("user_id", userId).order("date", { ascending: false });
        if (rows?.length) setSessions(rows.map(r => ({ ...JSON.parse(r.data), date: r.date, id: r.id })));
        else setSessions(INITIAL_SESSIONS);

        // draft
        const { data: draft } = await supabase
          .from("drafts").select("data").eq("user_id", userId).single();
        if (draft?.data) {
          const d = JSON.parse(draft.data);
          if (d.logStep > 1 && d.logGroups?.length > 0) {
            setLogStep(d.logStep); setLogGroups(d.logGroups);
            setLogData(d.logData || {}); setActiveLog(d.activeLogGroup || "all");
            if (d.logCondition) setLogCondition(d.logCondition);
            if (d.logBodyWeight) setLogBodyWeight(d.logBodyWeight);
            setView("log");
          }
        }

        // other users for feed
        const { data: others } = await supabase
          .from("profiles").select("id, name, color").neq("id", userId).limit(20);
        if (others?.length) {
          const enriched = await Promise.all(others.map(async u => {
            const { data: rows } = await supabase
              .from("sessions").select("date, data").eq("user_id", u.id).order("date", { ascending: false }).limit(10);
            const userSessions = rows?.map(r => ({ ...JSON.parse(r.data), date: r.date })) ?? [];
            return { ...u, id: u.id, avatar: u.color || "#4ECDC4", sessions: userSessions };
          }));
          setSharedUsers(enriched);
        }
      } catch (e) { console.error("load error", e); setSessions(INITIAL_SESSIONS); }
      setDataLoaded(true);
    };
    load();
  }, [userId]);
  const [mainTab,   setMainTab]   = useState("home");
  const [view,      setView]      = useState("home");

  const [selectedGroupId, setSelGroup] = useState(null);
  const [cardIndex,       setCardIdx]  = useState(0);
  const [detailDate,      setDetailDate] = useState(null);

  // log state
  const [logStep,        setLogStep]    = useState(1);
  const [logGroups,      setLogGroups]  = useState([]);
  // logData: { [groupId]: { type, exercises } }
  const [logData,        setLogData]    = useState({});
  const [activeLogGroup, setActiveLog]  = useState(null);
  const [addingEx,       setAddingEx]   = useState(false);
  const [newEx,          setNewEx]      = useState({ name:"", sets:[{ weight:"", reps:"" }] });
  const [logCondition,   setLogCondition] = useState("중");
  const [logBodyWeight,  setLogBodyWeight] = useState("");

  // Auto-save draft to Supabase
  useEffect(() => {
    if (!userId || view !== "log" || logStep < 1) return;
    const draft = { logStep, logGroups, logData, logCondition, logBodyWeight, activeLogGroup };
    supabase.from("drafts").upsert({ user_id: userId, data: JSON.stringify(draft) }).then(() => {});
  }, [logData, logGroups, logStep, logCondition, logBodyWeight]);

  const dragX = useRef(null);

  const groupSessions = selectedGroupId ? getGroupSessions(sessions, selectedGroupId) : [];
  const group         = getMeta(selectedGroupId);
  const ci            = Math.min(cardIndex, Math.max(0, groupSessions.length-1));

  const getLastGroupSession = (gid) => getGroupSessions(sessions, gid)[0]?.groupData ?? null;

  // Find the most recent record for a specific exercise name across all sessions
  const getLastExerciseRecord = (exName) => {
    for (const s of sessions) {
      for (const g of s.groups) {
        const ex = g.exercises.find(e => e.name === exName);
        if (ex) return { sets: ex.sets, date: s.date, groupId: g.groupId };
      }
    }
    return null;
  };

  // Get previous sets for a specific exercise name within a group
  const getPrevSets = (gid, exName) => {
    const allGS = getGroupSessions(sessions, gid);
    for (const s of allGS) {
      const ex = s.groupData.exercises.find(e => e.name === exName);
      if (ex) return { sets: ex.sets, date: s.date };
    }
    return null;
  };

  const goHome    = () => { setView("home"); setSelGroup(null); setMainTab("home"); };
  const openGroup = (id) => { setSelGroup(id); setCardIdx(0); setView("group"); };
  const openDate  = (date) => { setDetailDate(date); setView("dateDetail"); };

  const startLog = (prefillRoutine = null) => {
    setLogStep(1); setAddingEx(false);
    setNewEx({ name:"", sets:[{ weight:"", reps:"" }] });
    setLogCondition("중"); setLogBodyWeight("");
    if (prefillRoutine) {
      const grps = [...new Set(prefillRoutine.exercises.map(e=>e.groupId))];
      const init = {};
      grps.forEach(gid => {
        init[gid] = {
          type: prefillRoutine.groupTypes?.[gid] || "bodybuilding",
          exercises: prefillRoutine.exercises.filter(e=>e.groupId===gid).map(e=>({
            name: e.name,
            sets: Array.from({ length:e.sets }, ()=>({ weight:e.weight, reps:e.reps })),
          })),
        };
      });
      setLogGroups(grps); setLogData(init); setActiveLog("all"); setLogStep(2);
    } else {
      setLogGroups([]); setLogData({}); setActiveLog(null);
    }
    setMainTab("home"); setView("log");
  };

  const toggleGroup = (id) => {
    setLogGroups(p => {
      const next = p.includes(id) ? p.filter(g=>g!==id) : [...p, id];
      return next;
    });
    setLogData(d => {
      if (d[id]) { const n={...d}; delete n[id]; return n; }
      return { ...d, [id]:{ type:"bodybuilding", exercises:[] } };
    });
  };

  const confirmGroups = () => { setActiveLog("all"); setLogStep(2); };

  const setGroupType = (gid, typeId) => setLogData(d => ({ ...d, [gid]:{ ...d[gid], type:typeId } }));

  const updateSet = (i,f,v) => setNewEx(e=>{ const s=[...e.sets]; s[i]={...s[i],[f]:v}; return {...e,sets:s}; });
  const addSet    = () => setNewEx(e=>({ ...e, sets:[...e.sets,{ weight:"", reps:"" }] }));
  const removeSet = (i) => setNewEx(e=>({ ...e, sets:e.sets.filter((_,idx)=>idx!==i) }));

  const addToLibrary    = (gid, name) => setExLibrary(l => ({ ...l, [gid]: [...(l[gid]||[]), name] }));
  const removeFromLib   = (gid, idx)  => setExLibrary(l => ({ ...l, [gid]: l[gid].filter((_,i)=>i!==idx) }));
  const renameInLib     = (gid, idx, name) => setExLibrary(l => ({ ...l, [gid]: l[gid].map((n,i)=>i===idx?name:n) }));

  // log step 2 add exercise panel state
  const [libEditMode, setLibEditMode] = useState(false);
  const [libNewName,  setLibNewName]  = useState("");
  const [libEditIdx,  setLibEditIdx]  = useState(null);
  const [libEditVal,  setLibEditVal]  = useState("");

  const addExercise = () => {
    if (!newEx.name.trim()) return;
    const valid = newEx.sets.filter(s=>s.weight!==""&&s.reps!=="");
    if (!valid.length) return;
    setLogData(d=>({ ...d, [activeLogGroup]:{ ...d[activeLogGroup], exercises:[...d[activeLogGroup].exercises, { name:newEx.name, sets:valid.map(s=>({ weight:Number(s.weight), reps:Number(s.reps) })) }] } }));
    setNewEx({ name:"", sets:[{ weight:"", reps:"" }] }); setAddingEx(false);
  };

  const removeExercise = (gid,idx) =>
    setLogData(d=>({ ...d, [gid]:{ ...d[gid], exercises:d[gid].exercises.filter((_,i)=>i!==idx) } }));

  // inline set editing within an already-added exercise
  const updateExSet = (gid, exIdx, setIdx, field, val) =>
    setLogData(d => {
      const exs = d[gid].exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        const sets = ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: val === "" ? "" : Number(val) } : s);
        return { ...ex, sets };
      });
      return { ...d, [gid]: { ...d[gid], exercises: exs } };
    });

  const addExSet = (gid, exIdx) =>
    setLogData(d => {
      const exs = d[gid].exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { weight: last?.weight ?? "", reps: last?.reps ?? "" }] };
      });
      return { ...d, [gid]: { ...d[gid], exercises: exs } };
    });

  const removeExSet = (gid, exIdx, setIdx) =>
    setLogData(d => {
      const exs = d[gid].exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) };
      });
      return { ...d, [gid]: { ...d[gid], exercises: exs } };
    });

  const saveLog = async () => {
    const today = new Date().toISOString().split("T")[0];
    const groups = logGroups.filter(id=>logData[id]?.exercises.length>0).map(id=>({
      groupId: id, type: logData[id].type, exercises: logData[id].exercises,
    }));
    if (!groups.length) return;
    const newSession = {
      date: today, groups,
      condition: logCondition,
      bodyWeight: logBodyWeight ? Number(logBodyWeight) : null,
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    try {
      await supabase.from("sessions").insert({
        user_id: userId, date: today,
        data: JSON.stringify(newSession),
      });
      await supabase.from("drafts").delete().eq("user_id", userId);
    } catch (e) { console.error("saveLog error", e); }
    setView("home"); setMainTab("home");
  };

  const onSaveProfile = async (name, color) => {
    setMyName(name); setMyColor(color);
    try {
      await supabase.from("profiles").upsert({ id: userId, name, color });
    } catch {}
  };

  const onResetData = async () => {
    setSessions([]);
    setRoutines(INITIAL_ROUTINES);
    setExLibrary(DEFAULT_LIBRARY);
    try {
      await supabase.from("sessions").delete().eq("user_id", userId);
      await supabase.from("drafts").delete().eq("user_id", userId);
    } catch {}
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const onDragStart = (x) => { dragX.current=x; };
  const onDragEnd   = (x, total) => {
    if (dragX.current===null) return;
    const dx = x-dragX.current;
    if (Math.abs(dx)>40) { if(dx<0&&ci<total-1)setCardIdx(ci+1); if(dx>0&&ci>0)setCardIdx(ci-1); }
    dragX.current=null;
  };

  const activeGroupMeta = getMeta(activeLogGroup);
  const isInnerView     = view==="group"||view==="dateDetail"||view==="log";

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0F", fontFamily:"'DM Mono','Courier New',monospace", color:"#E8E8E0", paddingBottom:isInnerView?0:72 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:#0A0A0F; } ::-webkit-scrollbar-thumb { background:#2A2A38; border-radius:2px; }
        input { outline:none; } input::-webkit-inner-spin-button { -webkit-appearance:none; }
        .btn { cursor:pointer; border:none; background:none; transition:all 0.15s; }
        .btn:active { transform:scale(0.97); }
        .lift { transition:transform 0.18s; cursor:pointer; } .lift:hover { transform:translateY(-2px); }
        .fade-in { animation:fadeIn 0.25s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);} }
        @keyframes cardIn { from{opacity:0;transform:translateX(18px);}to{opacity:1;transform:translateX(0);} }
        .card-in { animation:cardIn 0.2s cubic-bezier(0.25,0.46,0.45,0.94); }
        .num-input { background:#1A1A24;border:1px solid #2A2A38;color:#E8E8E0;font-family:'DM Mono',monospace;font-size:14px;padding:8px 10px;border-radius:6px;width:72px;text-align:center; }
        .num-input:focus { border-color:#4ECDC4; }
        .txt-input { background:#1A1A24;border:1px solid #2A2A38;color:#E8E8E0;font-family:'DM Mono',monospace;font-size:14px;padding:10px 14px;border-radius:8px;width:100%; }
        .txt-input:focus { border-color:#FF4D6D; }
      `}</style>

      {/* ── HOME ── */}
      {!isInnerView && mainTab==="home" && (
        <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"32px 20px 16px" }}>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:10, letterSpacing:"0.22em", color:"#444", marginBottom:6 }}>우중이의 WORKOUT TRACKER</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
              <h1 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1.2 }}>
                <span style={{ color:"#FF4D6D" }}>{myName}님!</span> 오늘은<br/><span style={{ color:"#FF4D6D" }}>어디</span> 할까요?
              </h1>
              <button onClick={()=>startLog()} className="btn lift" style={{ background:"#FF4D6D", color:"#0A0A0F", fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:13, padding:"10px 18px", borderRadius:10 }}>+ 기록</button>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:32 }}>
            {MUSCLE_GROUPS.map(g=>{ const gs=getGroupSessions(sessions,g.id); const last=gs[0]; return (
              <div key={g.id} className="lift" onClick={()=>openGroup(g.id)}
                style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"14px 12px", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:8, right:10, fontSize:16, color:g.color, opacity:0.4 }}>{g.icon}</div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, marginBottom:8 }}>{g.label}</div>
                {last ? <>
                  <div style={{ fontSize:10, color:"#555" }}>{getDaysAgo(last.date)}</div>
                  <div style={{ fontSize:10, color:g.color, marginTop:2 }}>{last.groupData.exercises.length}가지</div>
                  <TypeBadge typeId={last.groupData.type} small/>
                </> : <div style={{ fontSize:10, color:"#333" }}>기록 없음</div>}
              </div>
            );})}
          </div>

          <div style={{ fontSize:10, letterSpacing:"0.18em", color:"#444", marginBottom:14 }}>최근 운동 기록</div>
          {sessions.map((s,i)=>{
            const sTot=sessionSets(s);
            return (
              <div key={i} className="lift" onClick={()=>openDate(s.date)}
                style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"16px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700 }}>{getDaysAgo(s.date)}</span>
                    <span style={{ fontSize:11, color:"#555", marginLeft:8 }}>{fmtDate(s.date)}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {s.condition && (() => {
                      const map = { 상:{ emoji:"😤", color:"#4ECDC4" }, 중:{ emoji:"😊", color:"#FFE66D" }, 하:{ emoji:"😮‍💨", color:"#FF6B6B" } };
                      const c = map[s.condition];
                      return <span style={{ fontSize:11, background:c.color+"18", color:c.color, borderRadius:20, padding:"3px 9px", fontWeight:700 }}>{c.emoji} {s.condition}</span>;
                    })()}
                    {s.bodyWeight && <span style={{ fontSize:11, background:"#1A1A24", color:"#666", borderRadius:20, padding:"3px 9px" }}>{s.bodyWeight}kg</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:11, background:"#1A1A24", borderRadius:6, padding:"3px 10px", color:"#aaa" }}>총 {sTot}세트</span>
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                  {s.groups.map((g,gi)=>{ const m=getMeta(g.groupId); return (
                    <div key={gi} style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <span style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:10, padding:"3px 9px", fontWeight:600 }}>{m.icon} {m.label}</span>
                      <TypeBadge typeId={g.type} small/>
                    </div>
                  );})}
                </div>
                {s.groups.map((g,gi)=>{ const m=getMeta(g.groupId); return (
                  <div key={gi} style={{ marginBottom:gi<s.groups.length-1?10:0 }}>
                    <div style={{ fontSize:9, color:m.color, letterSpacing:"0.1em", marginBottom:5, fontWeight:600 }}>{m.label}</div>
                    {g.exercises.map((ex,ei)=>{ const maxW=Math.max(...ex.sets.map(s=>s.weight)); return (
                      <div key={ei} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"#777" }}>{ex.name}</span>
                        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                          <span style={{ fontSize:10, color:"#444" }}>{ex.sets.length}세트</span>
                          <span style={{ fontSize:11, background:"#1A1A24", borderRadius:4, padding:"2px 8px", color:m.color }}>최대 {maxW}kg</span>
                        </div>
                      </div>
                    );})}
                  </div>
                );})}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CALENDAR / ROUTINE / DATA / FEED TABS ── */}
      {!isInnerView && mainTab==="calendar" && <div className="fade-in"><CalendarTab sessions={sessions} onOpenDate={(date)=>{ setDetailDate(date); setView("dateDetail"); }} onSaveRoutine={(r)=>{ setRoutines(prev=>[{ ...r, id:uid() }, ...prev]); setMainTab("routine"); }}/></div>}
      {!isInnerView && mainTab==="routine"  && <div className="fade-in"><RoutineTab routines={routines} setRoutines={setRoutines} onStartLogWithRoutine={(r)=>startLog(r)}/></div>}
      {!isInnerView && mainTab==="data"     && <div className="fade-in"><DataTab sessions={sessions}/></div>}
      {!isInnerView && mainTab==="feed"     && <div className="fade-in"><FeedTab myName={myName} myColor={myColor} myId={myId} mySessions={sessions} sharedUsers={sharedUsers} onSaveProfile={onSaveProfile} onResetData={onResetData} onLogout={handleLogout}/></div>}

      {/* ── BOTTOM NAV ── */}
      {!isInnerView && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#0D0D14", borderTop:"1px solid #1A1A24", display:"flex", justifyContent:"center", zIndex:100 }}>
          {[
            { id:"home",     icon:"⊞", label:"홈" },
            { id:"feed",     icon:"◉", label:"피드" },
            { id:"calendar", icon:"◷", label:"캘린더" },
            { id:"routine",  icon:"◻", label:"루틴" },
            { id:"data",     icon:"△", label:"데이터" },
          ].map(tab=>{ const act=mainTab===tab.id; return (
            <button key={tab.id} className="btn" onClick={()=>{ setMainTab(tab.id); setView("home"); }}
              style={{ flex:1, maxWidth:96, padding:"12px 0 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:act?"#FF4D6D":"#444", transition:"color 0.15s" }}>
              <span style={{ fontSize:17 }}>{tab.icon}</span>
              <span style={{ fontSize:9, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, letterSpacing:"0.04em" }}>{tab.label}</span>
              {act && <div style={{ width:16, height:2, background:"#FF4D6D", borderRadius:1 }}/>}
            </button>
          );})}
        </div>
      )}

      {/* ── DATE DETAIL ── */}
      {view==="dateDetail" && (()=>{
        const s=sessions.find(s=>s.date===detailDate); if(!s) return null;
        return (
          <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
              <button className="btn" onClick={goHome} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
              <div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>{getDaysAgo(s.date)}</div>
                <div style={{ fontSize:11, color:"#555" }}>{fmtDate(s.date)}</div>
                {(s.condition || s.bodyWeight) && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, flexWrap:"wrap" }}>
                    {s.condition && (() => {
                      const map = { 상:{ emoji:"😤", color:"#4ECDC4" }, 중:{ emoji:"😊", color:"#FFE66D" }, 하:{ emoji:"😮‍💨", color:"#FF6B6B" } };
                      const c = map[s.condition];
                      return (
                        <span style={{ fontSize:13, background:c.color+"22", color:c.color, borderRadius:20, padding:"5px 14px", fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>
                          {c.emoji} 컨디션 {s.condition}
                        </span>
                      );
                    })()}
                    {s.bodyWeight && (
                      <span style={{ fontSize:13, background:"#1A1A24", color:"#74C0FC", borderRadius:20, padding:"5px 14px", fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>
                        ⚖️ {s.bodyWeight}kg
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ marginLeft:"auto" }}/>
            </div>
            {s.groups.map((g,gi)=>{ const m=getMeta(g.groupId); const gSets=groupSets(g); return (
              <div key={gi} style={{ background:"#111118", border:`1px solid ${m.color}30`, borderRadius:16, padding:"20px", marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18, fontWeight:700 }}><span style={{ color:m.color }}>{m.icon} </span>{m.label}</div>
                    <TypeBadge typeId={g.type}/>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <span style={{ fontSize:11, background:"#1A1A24", borderRadius:6, padding:"3px 9px", color:"#888" }}>{gSets}세트</span>
                  </div>
                </div>
                {g.exercises.map((ex,ei)=>(
                  <div key={ei} style={{ borderTop:"1px solid #1A1A24", paddingTop:14, marginTop:14 }}>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:600, marginBottom:10 }}>{ex.name}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(76px,1fr))", gap:6 }}>
                      {ex.sets.map((st,si)=>(
                        <div key={si} style={{ background:"#0A0A14", border:"1px solid #1E1E2A", borderRadius:8, padding:"8px 0", textAlign:"center" }}>
                          <div style={{ fontSize:9, color:"#444", marginBottom:3 }}>Set {si+1}</div>
                          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700, color:m.color }}>{st.weight}</div>
                          <div style={{ fontSize:10, color:"#555" }}>kg × {st.reps}회</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );})}
          </div>
        );
      })()}

      {/* ── GROUP DETAIL (carousel) ── */}
      {view==="group" && group && (
        <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
            <button className="btn" onClick={goHome} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
            <div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700 }}><span style={{ color:group.color }}>{group.icon} </span>{group.label}</div>
              <div style={{ fontSize:11, color:"#555" }}>{groupSessions.length}회 기록</div>
            </div>
          </div>

          {groupSessions.length===0 ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:"#444" }}>
              <div style={{ fontSize:38, marginBottom:10 }}>{group.icon}</div>
              <div style={{ fontSize:14 }}>아직 기록이 없어요</div>
            </div>
          ) : (()=>{
            const total=groupSessions.length, cur=groupSessions[ci], prev=groupSessions[ci+1];
            const wt=getType(cur.groupData.type);
            return (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:"0.12em" }}>히스토리</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button className="btn" onClick={()=>setCardIdx(Math.max(0,ci-1))} disabled={ci===0} style={{ background:ci===0?"#1A1A24":"#2A2A38", color:ci===0?"#333":"#aaa", borderRadius:6, width:28, height:28, fontSize:14 }}>‹</button>
                    <span style={{ fontSize:11, color:"#555", minWidth:36, textAlign:"center" }}>{ci+1} / {total}</span>
                    <button className="btn" onClick={()=>setCardIdx(Math.min(total-1,ci+1))} disabled={ci===total-1} style={{ background:ci===total-1?"#1A1A24":"#2A2A38", color:ci===total-1?"#333":"#aaa", borderRadius:6, width:28, height:28, fontSize:14 }}>›</button>
                  </div>
                </div>

                <div key={ci} className="card-in"
                  onMouseDown={e=>onDragStart(e.clientX)} onMouseUp={e=>onDragEnd(e.clientX,total)}
                  onTouchStart={e=>onDragStart(e.touches[0].clientX)} onTouchEnd={e=>onDragEnd(e.changedTouches[0].clientX,total)}
                  style={{ background:"#111118", border:`1px solid ${ci===0?group.color+"50":"#1E1E2A"}`, borderRadius:16, padding:"20px", userSelect:"none", cursor:"grab" }}>

                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
                    <div>
                      <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                        {ci===0 && <span style={{ background:group.color+"20", color:group.color, fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:600 }}>최근</span>}
                        <TypeBadge typeId={cur.groupData.type}/>
                      </div>
                      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>{getDaysAgo(cur.date)}</div>
                      <div style={{ fontSize:11, color:"#555" }}>{fmtDate(cur.date)}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>세트</div>
                      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:700, color:group.color }}>{cur.groupData.exercises.reduce((a,ex)=>a+ex.sets.length,0)}세트</div>
                    </div>
                  </div>

                  {cur.groupData.exercises.map((ex,ei)=>{
                    const prevEx=prev?.groupData.exercises.find(e=>e.name===ex.name);
                    const maxW=Math.max(...ex.sets.map(s=>s.weight));
                    const prevMax=prevEx?Math.max(...prevEx.sets.map(s=>s.weight)):null;
                    const diff=prevMax!==null?maxW-prevMax:null;
                    return (
                      <div key={ei} style={{ borderTop:`1px solid ${ei===0?group.color+"20":"#1A1A24"}`, paddingTop:14, marginTop:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:600 }}>{ex.name}</div>
                          {diff!==null && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, fontWeight:600, background:diff>0?"#1A3A2A":diff<0?"#3A1A1A":"#1E1E2A", color:diff>0?"#4ECDC4":diff<0?"#FF6B6B":"#555" }}>{diff>0?`▲ +${diff}`:diff<0?`▼ ${diff}`:"→"}</span>}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(76px,1fr))", gap:6 }}>
                          {ex.sets.map((st,si)=>(
                            <div key={si} style={{ background:"#0A0A14", border:"1px solid #1E1E2A", borderRadius:8, padding:"8px 0", textAlign:"center" }}>
                              <div style={{ fontSize:9, color:"#444", marginBottom:3 }}>Set {si+1}</div>
                              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700, color:group.color }}>{st.weight}</div>
                              <div style={{ fontSize:10, color:"#555" }}>kg × {st.reps}회</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {total>1 && (
                    <div style={{ marginTop:18, display:"flex", justifyContent:"center", gap:5 }}>
                      {groupSessions.map((_,i)=><div key={i} onClick={()=>setCardIdx(i)} style={{ width:i===ci?20:6, height:6, borderRadius:3, background:i===ci?group.color:"#2A2A38", transition:"all 0.2s", cursor:"pointer" }}/>)}
                    </div>
                  )}
                </div>
                {total>1 && <div style={{ textAlign:"center", fontSize:10, color:"#2A2A38", marginTop:8 }}>← 스와이프로 이동 →</div>}
              </>
            );
          })()}
        </div>
      )}

      {/* ── LOG STEP 1: 부위 선택 ── */}
      {view==="log" && logStep===1 && (
        <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px 20px 40px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
            <button className="btn" onClick={goHome} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
            <div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>오늘 운동 설정</div>
              <div style={{ fontSize:11, color:"#555" }}>루틴 또는 직접 설정</div>
            </div>
          </div>

          {/* ── 컨디션 + 몸무게 한 줄 ── */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, background:"#111118", border:"1px solid #1E1E2A", borderRadius:12, padding:"10px 14px" }}>
            <span style={{ fontSize:10, color:"#555", flexShrink:0 }}>컨디션</span>
            {[{ val:"상", emoji:"😤", color:"#4ECDC4" }, { val:"중", emoji:"😊", color:"#FFE66D" }, { val:"하", emoji:"😮‍💨", color:"#FF6B6B" }].map(c => (
              <button key={c.val} className="btn" onClick={()=>setLogCondition(c.val)}
                style={{ padding:"4px 10px", borderRadius:20, fontSize:11,
                  background: logCondition===c.val ? c.color+"22" : "transparent",
                  border: `1px solid ${logCondition===c.val ? c.color : "#2A2A38"}`,
                  color: logCondition===c.val ? c.color : "#555",
                  fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, transition:"all 0.15s" }}>
                {c.emoji} {c.val}
              </button>
            ))}
            <div style={{ flex:1 }}/>
            <span style={{ fontSize:10, color:"#555", flexShrink:0 }}>몸무게</span>
            <input className="num-input" type="number" placeholder="—" value={logBodyWeight}
              onChange={e=>setLogBodyWeight(e.target.value)}
              style={{ width:60, fontSize:14, padding:"5px 8px", fontWeight:700 }}/>
            <span style={{ fontSize:11, color:"#555" }}>kg</span>
          </div>

          {/* ── 루틴 빠른선택 ── */}
          {routines.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, letterSpacing:"0.14em", color:"#555", marginBottom:10 }}>루틴으로 바로 시작</div>
              <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:6, marginLeft:-20, marginRight:-20, paddingLeft:20, paddingRight:20 }}>
                {routines.map(r => {
                  const types = [...new Set(Object.values(r.groupTypes || {}))];
                  return (
                    <button key={r.id} className="btn" onClick={() => startLog(r)}
                      style={{ background:"#111118", border:"1px solid #1E1E2A", borderRadius:14, padding:"14px 15px", textAlign:"left", flexShrink:0, width:210, transition:"all 0.15s", cursor:"pointer" }}>
                      <div style={{ display:"flex", gap:4, marginBottom:8, flexWrap:"wrap" }}>
                        {types.map(tid => <TypeBadge key={tid} typeId={tid} small/>)}
                      </div>
                      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700, color:"#E8E8E0", marginBottom:8 }}>{r.name}</div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
                        {r.groups.map(gid => { const m = getMeta(gid); return (
                          <span key={gid} style={{ background:m.color+"18", color:m.color, borderRadius:20, fontSize:10, padding:"2px 7px", fontWeight:600 }}>{m.icon} {m.label}</span>
                        );})}
                      </div>
                      <div style={{ borderTop:"1px solid #1A1A24", paddingTop:8 }}>
                        {r.exercises.slice(0,4).map((ex, i) => {
                          const wt = getType(r.groupTypes?.[ex.groupId]);
                          return (
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                              <span style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:110 }}>{ex.name}</span>
                              <span style={{ fontSize:11, color:wt?.color||"#888", flexShrink:0, marginLeft:6 }}>{ex.sets}×{ex.reps}</span>
                            </div>
                          );
                        })}
                        {r.exercises.length > 4 && <div style={{ fontSize:10, color:"#444", marginTop:2 }}>+{r.exercises.length-4}개 더</div>}
                      </div>
                      <div style={{ marginTop:10, fontSize:12, color:"#FF4D6D", fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>바로 시작 →</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 직접 설정 ── */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ flex:1, height:1, background:"#1A1A24" }}/>
            <span style={{ fontSize:10, color:"#444", letterSpacing:"0.12em" }}>직접 설정</span>
            <div style={{ flex:1, height:1, background:"#1A1A24" }}/>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
            {MUSCLE_GROUPS.map(g=>{
              const sel = logGroups.includes(g.id);
              const lastS = getLastGroupSession(g.id);
              const lastDate = getGroupSessions(sessions, g.id)[0]?.date;
              return (
                <div key={g.id}
                  style={{ background:sel?g.color+"10":"#111118", border:`1.5px solid ${sel?g.color:"#1E1E2A"}`, borderRadius:14, padding:"14px 16px", transition:"all 0.15s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div onClick={()=>toggleGroup(g.id)} style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", flex:1, minWidth:0 }}>
                      <div style={{ width:22, height:22, borderRadius:7, border:`2px solid ${sel?g.color:"#333"}`, background:sel?g.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#0A0A0F", transition:"all 0.15s", flexShrink:0 }}>{sel?"✓":""}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700, color:sel?g.color:"#aaa" }}>{g.icon} {g.label}</div>
                        {lastS ? <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{getDaysAgo(lastDate)} · {lastS.exercises.length}가지</div>
                                : <div style={{ fontSize:10, color:"#333", marginTop:2 }}>기록 없음</div>}
                      </div>
                    </div>
                    {sel && <TypeToggle value={logData[g.id]?.type||"bodybuilding"} onChange={(t)=>setGroupType(g.id,t)}/>}
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn" onClick={confirmGroups} disabled={logGroups.length===0}
            style={{ width:"100%", padding:"15px", borderRadius:12, fontSize:15, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, background:logGroups.length>0?"#FF4D6D":"#1A1A24", color:logGroups.length>0?"#0A0A0F":"#444", transition:"all 0.2s" }}>
            {logGroups.length>0 ? `${logGroups.map(id=>getMeta(id).label).join(" + ")} 입력 →` : "부위를 선택해주세요"}
          </button>
        </div>
      )}

      {/* ── LOG STEP 2: 운동 입력 ── */}
      {view==="log" && logStep===2 && activeLogGroup && (
        <div className="fade-in" style={{ maxWidth:480, margin:"0 auto", padding:"20px 20px 40px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
            <button className="btn" onClick={()=>setLogStep(1)} style={{ background:"#1A1A24", color:"#888", borderRadius:8, width:36, height:36, fontSize:16 }}>←</button>
            <div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>운동 입력</div>
              <div style={{ fontSize:11, color:"#555" }}>{logGroups.map(id=>getMeta(id).label).join(" + ")}</div>
            </div>
          </div>

          {/* group tabs — 전체 포함 */}
          <div style={{ display:"flex", gap:8, marginBottom:18, overflowX:"auto", paddingBottom:4 }}>
            {/* 전체 탭 */}
            <button className="btn" onClick={()=>{ setActiveLog("all"); setAddingEx(false); setNewEx({ name:"", sets:[{ weight:"", reps:"" }] }); }}
              style={{ padding:"7px 15px", borderRadius:20, fontSize:12, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600,
                background: activeLogGroup==="all" ? "#E8E8E0" : "#111118",
                color:      activeLogGroup==="all" ? "#0A0A0F" : "#666",
                border:`1px solid ${activeLogGroup==="all" ? "#E8E8E0" : "#1E1E2A"}`,
                whiteSpace:"nowrap", flexShrink:0, transition:"all 0.15s" }}>
              ⊞ 전체
            </button>
            {logGroups.map(id=>{ const m=getMeta(id); const act=activeLogGroup===id; const cnt=logData[id]?.exercises.length??0; const wt=getType(logData[id]?.type||"bodybuilding"); return (
              <button key={id} className="btn" onClick={()=>{ setActiveLog(id); setAddingEx(false); setNewEx({ name:"", sets:[{ weight:"", reps:"" }] }); }}
                style={{ padding:"7px 15px", borderRadius:20, fontSize:12, fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, background:act?m.color:"#111118", color:act?"#0A0A0F":"#666", border:`1px solid ${act?m.color:"#1E1E2A"}`, whiteSpace:"nowrap", flexShrink:0, transition:"all 0.15s" }}>
                {m.icon} {m.label}{cnt>0?` (${cnt})`:""} <span style={{ fontSize:9, opacity:0.7 }}>{wt?.icon}</span>
              </button>
            );})}
          </div>

          {/* ── 전체 보기 모드 ── */}
          {activeLogGroup === "all" && (
            <div>
              {logGroups.map(gid => {
                const m   = getMeta(gid);
                const wt  = getType(logData[gid]?.type || "bodybuilding");
                const exs = logData[gid]?.exercises || [];
                return (
                  <div key={gid} style={{ marginBottom:20 }}>
                    {/* 부위 헤더 */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, fontWeight:700, color:m.color }}>{m.icon} {m.label}</span>
                        <TypeBadge typeId={logData[gid]?.type} small/>
                      </div>
                      <button className="btn" onClick={()=>{ setActiveLog(gid); setAddingEx(true); setNewEx({ name:"", sets:[{ weight:"", reps:"" }] }); }}
                        style={{ fontSize:11, color:m.color, background:m.color+"12", border:`1px dashed ${m.color}40`, borderRadius:7, padding:"4px 12px" }}>
                        + 추가
                      </button>
                    </div>

                    {/* 지난번 참고 */}
                    {(() => {
                      const allGS = getGroupSessions(sessions, gid);
                      const refs = {};
                      for (const s of allGS) {
                        const t = s.groupData.type;
                        if (!refs[t]) refs[t] = { groupData: s.groupData, date: s.date };
                      }
                      if (!Object.keys(refs).length) return null;
                      return (
                        <div style={{ background:"#0E0E18", border:`1px dashed ${m.color}30`, borderRadius:10, padding:"10px 13px", marginBottom:10 }}>
                          <div style={{ fontSize:9, color:"#555", letterSpacing:"0.1em", marginBottom:8 }}>지난번 참고</div>
                          {WORKOUT_TYPES.map(wt => {
                            const r = refs[wt.id]; if (!r) return null;
                            return (
                              <div key={wt.id} style={{ marginBottom:6 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                                  <TypeBadge typeId={wt.id} small/>
                                  <span style={{ fontSize:9, color:"#555" }}>{getDaysAgo(r.date)}</span>
                                </div>
                                {r.groupData.exercises.map((ex, i) => (
                                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                                    <span style={{ fontSize:11, color:"#777" }}>{ex.name}</span>
                                    <div style={{ display:"flex", gap:3 }}>
                                      {ex.sets.map((st, si) => (
                                        <span key={si} style={{ fontSize:10, background:"#1A1A24", borderRadius:4, padding:"2px 6px", color:wt.color }}>
                                          {st.weight}×{st.reps}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* exercises for this group */}
                    {exs.map((ex, exIdx) => {
                      const prev = getPrevSets(gid, ex.name);
                      return (
                      <div key={exIdx} style={{ background:"#111118", border:`1px solid ${m.color}35`, borderRadius:14, padding:"13px 14px", marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: prev ? 6 : 10 }}>
                          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:13 }}>{ex.name}</div>
                          <button className="btn" onClick={()=>removeExercise(gid, exIdx)} style={{ color:"#444", fontSize:16 }}>×</button>
                        </div>
                        {prev && (
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
                            <span style={{ fontSize:9, color:"#555", marginRight:2, alignSelf:"center" }}>이전</span>
                            {prev.sets.map((st,si) => (
                              <span key={si} style={{ fontSize:10, background:"#1A1A24", borderRadius:4, padding:"2px 7px", color:m.color+"bb" }}>
                                {st.weight}×{st.reps}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:6 }}>
                          {ex.sets.map((s, si) => (
                            <div key={si} style={{ display:"flex", gap:7, alignItems:"center" }}>
                              <span style={{ fontSize:10, color:"#555", background:"#1A1A24", borderRadius:4, padding:"2px 6px", width:28, textAlign:"center", flexShrink:0 }}>S{si+1}</span>
                              <input className="num-input" type="number" placeholder="kg" value={s.weight} onChange={e=>updateExSet(gid,exIdx,si,"weight",e.target.value)} style={{ width:62 }}/>
                              <span style={{ color:"#444", fontSize:11 }}>kg ×</span>
                              <input className="num-input" type="number" placeholder="회" value={s.reps}   onChange={e=>updateExSet(gid,exIdx,si,"reps",e.target.value)}   style={{ width:56 }}/>
                              <span style={{ color:"#444", fontSize:11 }}>회</span>
                              {ex.sets.length > 1 && <button className="btn" onClick={()=>removeExSet(gid,exIdx,si)} style={{ color:"#3A3A48", fontSize:15, marginLeft:"auto", padding:"0 2px" }}>−</button>}
                            </div>
                          ))}
                        </div>
                        <button className="btn" onClick={()=>addExSet(gid, exIdx)}
                          style={{ fontSize:11, color:m.color, background:m.color+"12", border:`1px dashed ${m.color}40`, borderRadius:7, padding:"4px 14px", width:"100%" }}>
                          + 세트 추가
                        </button>
                      </div>
                      );
                    })}

                    {exs.length === 0 && (
                      <div style={{ fontSize:12, color:"#333", textAlign:"center", padding:"12px 0", background:"#111118", borderRadius:10, border:"1px dashed #1E1E2A" }}>
                        아직 {m.label} 운동이 없어요
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 부위별 보기 모드 ── */}
          {activeLogGroup !== "all" && (<>

          {/* active group type badge */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <span style={{ fontSize:12, color:activeGroupMeta?.color, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700 }}>{activeGroupMeta?.label}</span>
            <TypeBadge typeId={logData[activeLogGroup]?.type}/>
          </div>

          {/* last ref — split by type */}
          {(()=>{
            const m = getMeta(activeLogGroup);
            const allGS = getGroupSessions(sessions, activeLogGroup);
            // find most recent session per type
            const refs = {};
            for (const s of allGS) {
              const t = s.groupData.type;
              if (!refs[t]) refs[t] = { groupData: s.groupData, date: s.date };
            }
            if (!Object.keys(refs).length) return null;
            return (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                {WORKOUT_TYPES.map(wt => {
                  const r = refs[wt.id];
                  if (!r) return null;
                  return (
                    <div key={wt.id} style={{ background:"#0E0E18", border:`1px dashed ${wt.color}40`, borderRadius:12, padding:"13px 15px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <TypeBadge typeId={wt.id}/>
                        <span style={{ fontSize:10, color:"#555" }}>지난번 · {getDaysAgo(r.date)}</span>
                      </div>
                      {r.groupData.exercises.map((ex, i) => {
                        const maxW = Math.max(...ex.sets.map(s => s.weight));
                        const totalSets = ex.sets.length;
                        return (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: i < r.groupData.exercises.length - 1 ? 6 : 0 }}>
                            <span style={{ fontSize:12, color:"#888" }}>{ex.name}</span>
                            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                              <span style={{ fontSize:10, color:"#555" }}>{totalSets}세트</span>
                              <div style={{ display:"flex", gap:3 }}>
                                {ex.sets.map((st, si) => (
                                  <span key={si} style={{ fontSize:10, background:"#1A1A24", borderRadius:4, padding:"2px 7px", color:wt.color }}>
                                    {st.weight}×{st.reps}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* entered exercises — editable */}
          {logData[activeLogGroup]?.exercises.map((ex, exIdx) => {
            const m    = getMeta(activeLogGroup);
            const prev = getPrevSets(activeLogGroup, ex.name);
            return (
              <div key={exIdx} style={{ background:"#111118", border:`1px solid ${m.color}35`, borderRadius:14, padding:"14px 15px", marginBottom:10 }}>
                {/* header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: prev ? 6 : 12 }}>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:14, color:"#E8E8E0" }}>{ex.name}</div>
                  <button className="btn" onClick={()=>removeExercise(activeLogGroup, exIdx)} style={{ color:"#444", fontSize:16 }}>×</button>
                </div>
                {prev && (
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
                    <span style={{ fontSize:9, color:"#555" }}>이전</span>
                    {prev.sets.map((st,si) => (
                      <span key={si} style={{ fontSize:10, background:"#1A1A24", borderRadius:4, padding:"2px 7px", color:m.color+"bb" }}>
                        {st.weight}×{st.reps}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:8 }}>
                  {ex.sets.map((s, si) => (
                    <div key={si} style={{ display:"flex", gap:7, alignItems:"center" }}>
                      <div style={{ fontSize:10, color:"#555", width:28, flexShrink:0 }}>
                        <span style={{ background:"#1A1A24", borderRadius:4, padding:"2px 6px" }}>S{si+1}</span>
                      </div>
                      <input
                        className="num-input"
                        type="number"
                        placeholder="kg"
                        value={s.weight}
                        onChange={e => updateExSet(activeLogGroup, exIdx, si, "weight", e.target.value)}
                        style={{ width:64 }}
                      />
                      <span style={{ color:"#444", fontSize:11 }}>kg</span>
                      <span style={{ color:"#333", fontSize:11 }}>×</span>
                      <input
                        className="num-input"
                        type="number"
                        placeholder="회"
                        value={s.reps}
                        onChange={e => updateExSet(activeLogGroup, exIdx, si, "reps", e.target.value)}
                        style={{ width:56 }}
                      />
                      <span style={{ color:"#444", fontSize:11 }}>회</span>
                      {ex.sets.length > 1 && (
                        <button className="btn" onClick={() => removeExSet(activeLogGroup, exIdx, si)}
                          style={{ color:"#3A3A48", fontSize:15, marginLeft:"auto", padding:"0 2px" }}>−</button>
                      )}
                    </div>
                  ))}
                </div>

                {/* add set */}
                <button className="btn" onClick={() => addExSet(activeLogGroup, exIdx)}
                  style={{ fontSize:11, color:m.color, background:m.color+"12", border:`1px dashed ${m.color}40`, borderRadius:7, padding:"5px 14px", width:"100%" }}>
                  + 세트 추가
                </button>
              </div>
            );
          })}

          {/* ── 운동 추가: 토글 선택 + 관리 ── */}
          {addingEx ? (
            <div style={{ background:"#111118", border:`1px solid ${activeGroupMeta?.color}40`, borderRadius:14, padding:"16px", marginBottom:10 }}>

              {/* header row */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:12, color:"#aaa", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
                  {libEditMode ? "종목 관리" : "종목 선택"}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button className="btn" onClick={()=>{ setLibEditMode(m=>!m); setLibEditIdx(null); setLibNewName(""); setLibEditVal(""); }}
                    style={{ fontSize:11, color:libEditMode?activeGroupMeta?.color:"#666", background:libEditMode?activeGroupMeta?.color+"18":"#1A1A24", border:`1px solid ${libEditMode?activeGroupMeta?.color+"40":"#2A2A38"}`, borderRadius:7, padding:"4px 11px" }}>
                    {libEditMode ? "완료" : "✏️ 편집"}
                  </button>
                  <button className="btn" onClick={()=>{ setAddingEx(false); setLibEditMode(false); setLibEditIdx(null); setLibNewName(""); setLibEditVal(""); }}
                    style={{ fontSize:18, color:"#555", lineHeight:1 }}>×</button>
                </div>
              </div>

              {/* ── NORMAL MODE: chip grid ── */}
              {!libEditMode && (
                <>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:14 }}>
                    {(exLibrary[activeLogGroup]||[]).map((name, i) => {
                      const alreadyAdded = logData[activeLogGroup]?.exercises.some(e=>e.name===name);
                      const m = activeGroupMeta;
                      return (
                        <button key={i} className="btn" onClick={()=>{
                          if (alreadyAdded) return;
                          setLogData(d=>({ ...d, [activeLogGroup]:{ ...d[activeLogGroup], exercises:[...d[activeLogGroup].exercises,
                            { name, sets:[{ weight:"", reps:"" }] }
                          ]}}));
                        }}
                          style={{
                            padding:"7px 14px", borderRadius:20, fontSize:12,
                            fontFamily:"'DM Mono',monospace",
                            background: alreadyAdded ? m?.color+"22" : "#1A1A24",
                            color:      alreadyAdded ? m?.color       : "#888",
                            border:     `1px solid ${alreadyAdded ? m?.color+"60" : "#2A2A38"}`,
                            opacity:    alreadyAdded ? 0.5 : 1,
                            cursor:     alreadyAdded ? "default" : "pointer",
                            transition: "all 0.12s",
                          }}>
                          {alreadyAdded ? "✓ " : ""}{name}
                        </button>
                      );
                    })}
                  </div>

                  {/* custom name fallback */}
                  <div style={{ borderTop:"1px solid #1A1A24", paddingTop:12 }}>
                    <div style={{ fontSize:10, color:"#444", marginBottom:8 }}>직접 입력</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <input className="txt-input" placeholder="운동 이름" value={newEx.name}
                        onChange={e=>setNewEx(ex=>({...ex,name:e.target.value}))}
                        style={{ flex:1, fontSize:13, padding:"8px 12px" }}/>
                      <button className="btn" onClick={()=>{
                        if (!newEx.name.trim()) return;
                        setLogData(d=>({ ...d, [activeLogGroup]:{ ...d[activeLogGroup], exercises:[...d[activeLogGroup].exercises, { name:newEx.name.trim(), sets:[{ weight:"", reps:"" }] }]}}));
                        setNewEx(ex=>({...ex,name:""}));
                      }}
                        style={{ padding:"8px 16px", background:activeGroupMeta?.color, color:"#0A0A0F", borderRadius:8, fontSize:13, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, flexShrink:0 }}>
                        추가
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ── EDIT MODE: manage list ── */}
              {libEditMode && (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
                    {(exLibrary[activeLogGroup]||[]).map((name, i) => (
                      <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                        {libEditIdx === i ? (
                          <>
                            <input className="txt-input" value={libEditVal}
                              onChange={e=>setLibEditVal(e.target.value)}
                              style={{ flex:1, fontSize:13, padding:"7px 12px" }}
                              autoFocus/>
                            <button className="btn" onClick={()=>{ if(libEditVal.trim()){ renameInLib(activeLogGroup,i,libEditVal.trim()); } setLibEditIdx(null); setLibEditVal(""); }}
                              style={{ padding:"7px 13px", background:activeGroupMeta?.color, color:"#0A0A0F", borderRadius:8, fontSize:12, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, flexShrink:0 }}>저장</button>
                            <button className="btn" onClick={()=>{ setLibEditIdx(null); setLibEditVal(""); }}
                              style={{ padding:"7px 11px", background:"#1A1A24", border:"1px solid #2A2A38", color:"#666", borderRadius:8, fontSize:12, flexShrink:0 }}>취소</button>
                          </>
                        ) : (
                          <>
                            <div style={{ flex:1, fontSize:13, color:"#bbb", padding:"7px 12px", background:"#1A1A24", borderRadius:8, fontFamily:"'DM Mono',monospace" }}>{name}</div>
                            <button className="btn" onClick={()=>{ setLibEditIdx(i); setLibEditVal(name); }}
                              style={{ padding:"7px 11px", background:"#1A1A24", border:"1px solid #2A2A38", color:"#888", borderRadius:8, fontSize:12, flexShrink:0 }}>✏️</button>
                            <button className="btn" onClick={()=>removeFromLib(activeLogGroup,i)}
                              style={{ padding:"7px 11px", background:"#3A1A1A", border:"1px solid #FF6B6B30", color:"#FF6B6B", borderRadius:8, fontSize:12, flexShrink:0 }}>삭제</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* add new to library */}
                  <div style={{ borderTop:"1px solid #1A1A24", paddingTop:12 }}>
                    <div style={{ fontSize:10, color:"#444", marginBottom:8 }}>새 종목 추가</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <input className="txt-input" placeholder="종목 이름" value={libNewName}
                        onChange={e=>setLibNewName(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter"&&libNewName.trim()){ addToLibrary(activeLogGroup,libNewName.trim()); setLibNewName(""); }}}
                        style={{ flex:1, fontSize:13, padding:"8px 12px" }}/>
                      <button className="btn" onClick={()=>{ if(!libNewName.trim()) return; addToLibrary(activeLogGroup,libNewName.trim()); setLibNewName(""); }}
                        style={{ padding:"8px 16px", background:activeGroupMeta?.color, color:"#0A0A0F", borderRadius:8, fontSize:13, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, flexShrink:0 }}>
                        + 추가
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="btn" onClick={()=>{ setAddingEx(true); setLibEditMode(false); setNewEx({name:"",sets:[{weight:"",reps:""}]}); }}
              style={{ width:"100%", padding:"13px", background:"#111118", border:"1px dashed #2A2A38", color:"#666", borderRadius:12, fontSize:14, marginBottom:10 }}>+ 운동 추가</button>
          )}

          </>)} {/* end 부위별 보기 */}

          {logGroups.reduce((a,id)=>a+(logData[id]?.exercises.length??0),0)>0 && (
            <button className="btn" onClick={saveLog} style={{ width:"100%", padding:"15px", background:"#FF4D6D", color:"#0A0A0F", borderRadius:12, fontSize:15, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginTop:4 }}>
              💪 오늘 운동 저장
            </button>
          )}
        </div>
      )}
    </div>
  );
}
