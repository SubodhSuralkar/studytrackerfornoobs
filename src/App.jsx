// App.jsx — optimized for mobile, no flicker, background Pomodoro
import {
  useState, useEffect, useLayoutEffect,
  useRef, useCallback, useMemo, memo,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Zap, BookOpen, Timer, TrendingUp, Menu, X,
  Flame, Play, Pause, RotateCcw,
  CheckCircle2, Circle, Trash2, Plus,
  Palette, ChevronDown, Home,
} from "lucide-react";
import confetti from "canvas-confetti";

// ─── PERSISTENCE — non-blocking via requestIdleCallback ──────────────────────
const lsGet = (k, d) => {
  try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; }
  catch { return d; }
};
const lsSet = (k, v) => {
  const write = () => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  typeof requestIdleCallback !== "undefined"
    ? requestIdleCallback(write, { timeout: 2000 })
    : setTimeout(write, 0);
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const XP_PER_TASK  = 100;
const XP_PER_POMO  = 100;
const XP_PER_LEVEL = 500;

const EXAM_META = {
  JEE:    { label:"JEE",     accent:"#38bdf8", glow:"rgba(56,189,248,0.45)",  emoji:"⚛️",  grades:["Class 11","Class 12","Dropper"] },
  NEET:   { label:"NEET",    accent:"#4ade80", glow:"rgba(74,222,128,0.45)",  emoji:"🧬",  grades:["Class 11","Class 12","Dropper"] },
  UPSC:   { label:"UPSC",    accent:"#f59e0b", glow:"rgba(245,158,11,0.45)",  emoji:"🏛️", grades:["Graduate","Final Year","Post Graduate"] },
  MHTCET: { label:"MHT‑CET", accent:"#e879f9", glow:"rgba(232,121,249,0.45)",emoji:"📐",  grades:["Class 11","Class 12","Dropper"] },
};

const SUBJECTS = {
  JEE: {
    Physics:     ["Units & Measurement","Kinematics","Laws of Motion","Work, Energy & Power","Rotational Motion","Gravitation","Properties of Matter","Thermodynamics","Oscillations","Waves","Electrostatics","Current Electricity","Magnetic Effects","EMI & AC","Ray Optics","Wave Optics","Modern Physics","Semiconductors"],
    Chemistry:   ["Mole Concept","Atomic Structure","Chemical Bonding","States of Matter","Thermodynamics","Equilibrium","Ionic Equilibrium","Redox Reactions","Electrochemistry","Chemical Kinetics","s-Block Elements","p-Block Elements","d & f Block","Coordination Compounds","Organic Basics","Hydrocarbons","Haloalkanes","Alcohols & Ethers","Aldehydes & Ketones","Amines","Biomolecules","Polymers"],
    Mathematics: ["Sets & Relations","Complex Numbers","Sequences & Series","Quadratic Equations","Permutations","Binomial Theorem","Matrices","Determinants","Limits","Continuity","Differentiation","Application of Derivatives","Indefinite Integration","Definite Integration","Differential Equations","Straight Lines","Circles","Conics","Vectors","3D Geometry","Probability","Statistics"],
  },
  NEET: {
    Physics:   ["Physical World","Units & Measurement","Motion in Straight Line","Motion in a Plane","Laws of Motion","Work, Energy & Power","System of Particles","Gravitation","Mechanical Properties","Thermal Properties","Thermodynamics","Kinetic Theory","Oscillations","Waves","Electric Charges","Current Electricity","Magnetic Field","Moving Charges","EMI","AC Circuits","EM Waves","Ray Optics","Wave Optics","Dual Nature","Atoms","Nuclei","Semiconductors"],
    Chemistry: ["Basic Concepts","Atomic Structure","Classification","Chemical Bonding","States of Matter","Thermodynamics","Equilibrium","Redox","Hydrogen","s-Block","p-Block I","p-Block II","d & f Block","Coordination Compounds","Environmental Chemistry","Solutions","Electrochemistry","Chemical Kinetics","Haloalkanes","Alcohols","Aldehydes","Carboxylic Acids","Amines","Biomolecules","Polymers"],
    Biology:   ["The Living World","Biological Classification","Plant Kingdom","Animal Kingdom","Morphology of Plants","Anatomy of Plants","Structural Organisation (Animals)","Cell Structure","Cell Cycle","Transport in Plants","Mineral Nutrition","Photosynthesis","Respiration in Plants","Plant Growth","Digestion & Absorption","Breathing & Exchange","Body Fluids","Locomotion","Neural Control","Chemical Coordination","Reproduction in Organisms","Plant Reproduction","Human Reproduction","Reproductive Health","Genetics","Molecular Basis of Inheritance","Evolution","Human Health","Microbes in Human Welfare","Biotechnology: Principles","Biotechnology: Applications","Organisms & Environment","Ecosystem","Biodiversity","Environmental Issues"],
  },
  UPSC: {
    "GS Paper I":   ["History of Modern India","Indian Culture & Heritage","World History","Indian Society","Role of Women","Urbanisation","Globalisation","World Geography","Indian Geography","Physical Geography","Natural Resources","Disaster Management"],
    "GS Paper II":  ["Indian Constitution","Polity & Governance","Panchayati Raj","Public Policy","Rights Issues","Federal Structure","Parliament","Judiciary","Social Justice","International Relations","India & Neighbours","Bilateral Relations","International Bodies"],
    "GS Paper III": ["Indian Economy","Planning & Growth","Inclusive Growth","Agriculture","Animal Husbandry","Food Processing","Land Reforms","Infrastructure","Investment Models","Science & Technology","Environment","Disaster Management","Internal Security","Border Management","Terrorism"],
    "GS Paper IV":  ["Ethics & Human Interface","Attitude","Aptitude & Values","Emotional Intelligence","Moral Thinkers","Civil Service Values","Probity in Governance","Case Studies"],
    CSAT:           ["Comprehension","Interpersonal Skills","Decision Making","General Mental Ability","Basic Numeracy","Data Interpretation","English Language Comprehension"],
  },
  MHTCET: {
    Physics:     ["Measurements","Projectile Motion","Laws of Motion","Friction","Circular Motion","Gravitation","Rotational Motion","Oscillations","Elasticity","Wave Motion","Stationary Waves","Kinetic Theory","Wave Optics","Electrostatics","Current Electricity","Magnetic Effects","Electromagnetic Induction","AC Circuits","Electrons & Photons","Atoms & Nuclei","Semiconductors","Communication Systems"],
    Chemistry:   ["Solid State","Solutions","Ionic Equilibria","Chemical Thermodynamics","Electrochemistry","Chemical Kinetics","p-Block Elements","d & f Block","Coordination Compounds","Halogen Derivatives","Alcohols & Ethers","Aldehydes & Ketones","Carboxylic Acids","Amines","Biomolecules","Polymers","Chemistry in Daily Life"],
    Mathematics: ["Trigonometry","Pair of Lines","Matrices","Determinants","Vectors","3D Geometry","Line in Space","Plane","Linear Programming","Continuity","Differentiation","Applications of Derivatives","Indefinite Integration","Definite Integration","Application of Integrals","Differential Equations","Probability Distribution","Binomial Distribution"],
  },
};

// ─── THEME TOKENS ─────────────────────────────────────────────────────────────
// Colors live in index.css as CSS custom properties per theme class.
// We only carry Tailwind utility classes and JS-only values here.
const THEMES = {
  dark: {
    id:"dark", bodyClass:"theme-dark",
    text:"text-zinc-100", textSub:"text-zinc-400", textMuted:"text-zinc-500",
    trackBg:"bg-zinc-800", badgeBg:"bg-zinc-800", modalBg:"bg-zinc-900",
    selectBg:"#27272a", selectText:"#f4f4f5", selectBdr:"#3f3f46", optBg:"#18181b",
    isLight:false,
  },
  light: {
    id:"light", bodyClass:"theme-light",
    text:"text-slate-900", textSub:"text-slate-500", textMuted:"text-slate-400",
    trackBg:"bg-slate-200", badgeBg:"bg-slate-100", modalBg:"bg-white",
    selectBg:"#f1f5f9", selectText:"#0f172a", selectBdr:"#cbd5e1", optBg:"#fff",
    isLight:true,
  },
  neon: {
    id:"neon", bodyClass:"theme-neon",
    text:"text-cyan-50", textSub:"text-cyan-600", textMuted:"text-cyan-800",
    trackBg:"bg-zinc-900", badgeBg:"bg-zinc-900", modalBg:"bg-zinc-950",
    selectBg:"#09090b", selectText:"#ecfeff", selectBdr:"#3f3f46", optBg:"#09090b",
    isLight:false,
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pad      = n => String(n).padStart(2,"0");
const fmtTime  = s => `${pad(Math.floor(s/60))}:${pad(s%60)}`;
const todayStr = () => new Date().toDateString();
// Shared spring tap used on every button — eliminates per-button boilerplate
const tapProp  = { whileTap:{ scale:0.95 }, transition:{ type:"spring", stiffness:400, damping:20 } };

function fireConfetti(color) {
  confetti({ particleCount:120, spread:80, origin:{ y:0.5 }, colors:[color,"#ffffff","#facc15","#f472b6"] });
  setTimeout(() => confetti({ particleCount:60, spread:120, origin:{ y:0.3 }, colors:[color,"#818cf8"] }), 260);
}

// ─── TASK INPUT — module scope memo: never re-mounts, no focus loss ───────────
const TaskInput = memo(function TaskInput({ onAdd, accent, isLight }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim()); setVal("");
    requestAnimationFrame(() => ref.current?.focus());
  };
  return (
    <div className="flex gap-2">
      <input ref={ref} value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key==="Enter" && submit()}
        placeholder="Type a task and press Enter…"
        className={`flex-1 rounded-xl px-4 text-sm border outline-none transition-colors duration-200 ${isLight ? "bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400" : "bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500"}`}
        style={{ minHeight:48, fontFamily:"Syne,sans-serif" }}
      />
      <motion.button {...tapProp} onClick={submit}
        className="flex items-center gap-1.5 px-5 rounded-xl text-sm font-bold text-black cursor-pointer flex-shrink-0"
        style={{ minHeight:48, background:`linear-gradient(135deg,${accent},${accent}cc)`, boxShadow:`0 4px 18px ${accent}55`, border:"none", fontFamily:"Syne,sans-serif" }}>
        <Plus size={16}/> Add
      </motion.button>
    </div>
  );
});

// ─── CIRCULAR TIMER ───────────────────────────────────────────────────────────
function CircularTimer({ progress, accent, size=220, children }) {
  const r = (size-20)/2, circ = 2*Math.PI*r;
  return (
    <div className="relative" style={{ width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}/>
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={accent}
          strokeWidth={8} strokeLinecap="round" strokeDasharray={circ}
          animate={{ strokeDashoffset: circ*(1-progress) }}
          transition={{ duration:0.55, ease:"easeOut" }}
          style={{ filter:`drop-shadow(0 0 10px ${accent})` }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// ─── LEVEL-UP TOAST ───────────────────────────────────────────────────────────
function LevelUpToast({ level, accent, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="levelup-toast fixed z-[9999] text-center rounded-2xl px-10 py-5 glass"
      style={{ bottom:80, left:"50%", border:`2px solid ${accent}`, background:"rgba(9,9,11,0.97)", boxShadow:`0 0 50px ${accent}99`, minWidth:260 }}>
      <motion.div animate={{ rotate:[0,15,-15,10,-10,0], scale:[1,1.4,1] }} transition={{ duration:0.9 }}>
        <span style={{ fontSize:44 }}>⚡</span>
      </motion.div>
      <p className="font-rajdhani font-bold tracking-widest mt-1" style={{ fontSize:30, color:accent }}>LEVEL UP!</p>
      <p className="text-sm text-zinc-400 mt-1">You reached <strong className="text-white">Level {level}</strong></p>
    </div>
  );
}

// ─── EXAM MODAL ───────────────────────────────────────────────────────────────
function ExamModal({ currentExam, onSelect, onClose, th }) {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 z-[8000] flex items-center justify-center p-4"
        style={{ background:"rgba(0,0,0,0.82)" }} onClick={onClose}>
        <motion.div initial={{ scale:0.88,y:28 }} animate={{ scale:1,y:0 }} exit={{ scale:0.88,y:28 }}
          transition={{ type:"spring", stiffness:380, damping:28 }}
          className={`${th.modalBg} glass rounded-3xl p-6 w-full max-w-md`}
          style={{ border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 30px 80px rgba(0,0,0,.7)" }}
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`font-rajdhani font-bold tracking-widest text-2xl ${th.text}`}>SWITCH EXAM</h2>
            <motion.button {...tapProp} onClick={onClose}
              className={`${th.textMuted} leading-none cursor-pointer flex items-center justify-center`}
              style={{ background:"none", border:"none", minWidth:44, minHeight:44, fontSize:20 }}>✕</motion.button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(EXAM_META).map(([key,meta]) => (
              <motion.button key={key} whileHover={{ scale:1.04,y:-2 }} {...tapProp}
                onClick={() => { onSelect(key); onClose(); }}
                className="rounded-2xl flex flex-col items-center gap-2 cursor-pointer transition-all"
                style={{ minHeight:92, padding:"18px 12px", background:currentExam===key?`${meta.accent}20`:"rgba(255,255,255,0.03)", border:`1.5px solid ${currentExam===key?meta.accent+"88":"rgba(255,255,255,0.07)"}`, boxShadow:currentExam===key?`0 0 20px ${meta.glow}`:"none", fontFamily:"Syne,sans-serif" }}>
                <span style={{ fontSize:30 }}>{meta.emoji}</span>
                <span className="font-rajdhani font-bold tracking-wider" style={{ fontSize:18, color:currentExam===key?meta.accent:"#a1a1aa" }}>{meta.label}</span>
                {currentExam===key && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:`${meta.accent}22`, color:meta.accent, border:`1px solid ${meta.accent}44` }}>Active</span>}
              </motion.button>
            ))}
          </div>
          <p className="text-center mt-4 text-xs text-zinc-600">Switching exam resets chapters & tasks</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── SIDEBAR — module-scope memo so nav clicks in main content never re-mount it
const Sidebar = memo(function Sidebar({ th, page, setPage, sidebarOpen, setSidebarOpen, accent, glow, xp, level }) {
  const xpPct = Math.min(100, xp/(XP_PER_LEVEL*level)*100);
  const navItems = [
    { id:"dashboard", icon:<BookOpen size={18}/>, label:"Dashboard" },
    { id:"timer",     icon:<Timer size={18}/>,    label:"Focus Timer" },
    { id:"progress",  icon:<TrendingUp size={18}/>, label:"Progress" },
  ];
  return (
    <motion.div initial={false} animate={{ width: sidebarOpen ? 220 : 62 }}
      className="st-sidebar glass fixed left-0 top-0 z-[100] flex-col border-r overflow-hidden hidden md:flex"
      style={{ height:"100dvh", boxShadow:`4px 0 30px rgba(0,0,0,${th.isLight?.1:.4})` }}>

      {/* ⚡ Electric Home */}
      <div className="px-3 pt-3 pb-3 st-divider-b">
        <motion.button whileHover={{ rotate:180, scale:1.08 }} {...tapProp}
          transition={{ type:"spring", stiffness:320, damping:22 }}
          onClick={() => { setPage("dashboard"); setSidebarOpen(false); }}
          className="zap-pulse w-full flex items-center gap-3 rounded-xl cursor-pointer"
          style={{ padding:"9px 10px", minHeight:48, background:`linear-gradient(135deg,${accent}30,${accent}10)`, border:`1.5px solid ${accent}66`, fontFamily:"Syne,sans-serif", justifyContent:sidebarOpen?"flex-start":"center" }}>
          <motion.span
            animate={{ textShadow:[`0 0 8px ${accent}`,`0 0 22px ${accent}`,`0 0 8px ${accent}`] }}
            transition={{ repeat:Infinity, duration:1.8 }}
            style={{ fontSize:20, lineHeight:1, flexShrink:0 }}>⚡</motion.span>
          {sidebarOpen && <span className="font-rajdhani font-bold tracking-widest whitespace-nowrap" style={{ color:accent, fontSize:14 }}>HOME</span>}
        </motion.button>
      </div>

      <div className="flex-1 flex flex-col gap-1 px-2 pt-3">
        {navItems.map(item => (
          <motion.button key={item.id} whileHover={{ x:2 }} {...tapProp}
            onClick={() => { setPage(item.id); setSidebarOpen(false); }}
            className="flex items-center gap-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            style={{ padding:"9px 10px", minHeight:48, background:page===item.id?`${accent}22`:"transparent", border:`1px solid ${page===item.id?accent+"55":"transparent"}`, color:page===item.id?accent:(th.isLight?"#64748b":"#71717a"), fontWeight:page===item.id?700:500, fontFamily:"Syne,sans-serif", fontSize:13, justifyContent:sidebarOpen?"flex-start":"center" }}>
            {item.icon}
            {sidebarOpen && item.label}
          </motion.button>
        ))}
      </div>

      <div className="px-3 py-3 st-divider-t">
        {sidebarOpen ? (
          <>
            <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily:"DM Mono,monospace" }}>
              <span className="font-bold" style={{ color:accent }}>LV {level}</span>
              <span className={th.textMuted}>{xp}/{XP_PER_LEVEL*level}</span>
            </div>
            <div className={`h-1 rounded-full ${th.trackBg} overflow-hidden`}>
              <motion.div className="h-full rounded-full xp-shimmer"
                animate={{ width:`${xpPct}%` }} transition={{ duration:.55 }}
                style={{ background:`linear-gradient(90deg,${accent},#818cf8,${accent})` }}/>
            </div>
          </>
        ) : (
          <div className="flex justify-center font-rajdhani font-bold text-sm" style={{ color:accent }}>{level}</div>
        )}
      </div>

      <motion.button {...tapProp} onClick={() => setSidebarOpen(o => !o)}
        className="mx-2 mb-2 flex justify-center items-center rounded-xl cursor-pointer st-btn-subtle"
        style={{ minHeight:40, border:"1px solid" }}>
        {sidebarOpen ? <X size={14}/> : <Menu size={14}/>}
      </motion.button>
    </motion.div>
  );
});

// ─── BOTTOM NAV (mobile) ──────────────────────────────────────────────────────
const BottomNav = memo(function BottomNav({ page, setPage, accent }) {
  const items = [
    { id:"dashboard", icon:<Home size={22}/>,       label:"Home" },
    { id:"timer",     icon:<Timer size={22}/>,      label:"Focus" },
    { id:"progress",  icon:<TrendingUp size={22}/>, label:"Stats" },
  ];
  return (
    <nav className="st-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-[100] flex items-stretch justify-around"
      style={{ height:"calc(60px + env(safe-area-inset-bottom))", paddingBottom:"env(safe-area-inset-bottom)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)" }}>
      {items.map(item => (
        <motion.button key={item.id} {...tapProp}
          onClick={() => setPage(item.id)}
          className="relative flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          style={{ background:"none", border:"none", color:page===item.id?accent:"#71717a", fontFamily:"Syne,sans-serif", fontSize:10, fontWeight:page===item.id?700:400, transition:"color .2s", minHeight:60 }}>
          <motion.span animate={{ scale: page===item.id?1.18:1 }} transition={{ type:"spring",stiffness:400,damping:20 }}>
            {item.icon}
          </motion.span>
          <span>{item.label}</span>
          {page===item.id && (
            <motion.div layoutId="bnIndicator" className="absolute bottom-0 h-[3px] rounded-full"
              style={{ width:28, background:accent, boxShadow:`0 0 8px ${accent}` }}/>
          )}
        </motion.button>
      ))}
    </nav>
  );
});

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Persisted
  const [exam,        setExamState]    = useState(() => lsGet("st_exam",     null));
  const [grade,       setGrade]        = useState(() => lsGet("st_grade",    null));
  const [completedCh, setCompletedCh]  = useState(() => lsGet("st_chapters", {}));
  const [tasks,       setTasks]        = useState(() => lsGet("st_tasks",    []));
  const [xp,          setXp]           = useState(() => lsGet("st_xp",       0));
  const [level,       setLevel]        = useState(() => lsGet("st_level",    1));
  const [streak,      setStreak]       = useState(() => lsGet("st_streak",   0));
  const [lastTaskDay, setLastTaskDay]  = useState(() => lsGet("st_ltd",      null));
  const [sessions,    setSessions]     = useState(() => lsGet("st_sessions", []));
  const [themeId,     setThemeId]      = useState(() => lsGet("st_theme",    "dark"));

  // Ephemeral UI
  const [page,           setPage]          = useState("dashboard");
  const [sidebarOpen,    setSidebarOpen]   = useState(false);
  const [selectedSub,    setSelectedSub]   = useState(null);
  const [showExamModal,  setShowExamModal] = useState(false);
  const [showThemePanel, setShowThemePanel]= useState(false);
  const [onboardStep,    setOnboardStep]   = useState(0);
  const [levelUpData,    setLevelUpData]   = useState(null);

  // Timer — lives at App level so it survives page switches
  const [timerMode, setTimerMode] = useState("pomodoro");
  const [pomoDur,   setPomoDur]   = useState(25);
  const [brkDur,    setBrkDur]    = useState(5);
  const [timerSec,  setTimerSec]  = useState(25*60);
  const [running,   setRunning]   = useState(false);
  const [phase,     setPhase]     = useState("work");
  const [swTime,    setSwTime]    = useState(0);
  const [swRun,     setSwRun]     = useState(false);
  const [studyTopic,setStudyTopic]= useState("");

  const timerRef = useRef(null);
  const swRef    = useRef(null);

  // Derived
  const th       = THEMES[themeId] ?? THEMES.dark;
  const meta     = exam ? EXAM_META[exam] : null;
  const accent   = meta?.accent ?? "#22d3ee";
  const glow     = meta?.glow   ?? "rgba(34,211,238,0.45)";
  const subjects = exam ? SUBJECTS[exam] : {};
  const totalCh  = useMemo(() => Object.values(subjects).reduce((a,c)=>a+c.length,0), [subjects]);
  const doneCh   = useMemo(() => Object.keys(completedCh).filter(k=>completedCh[k]).length, [completedCh]);
  const overallPct = totalCh ? Math.round(doneCh/totalCh*100) : 0;
  const doneTasks  = useMemo(() => tasks.filter(t=>t.done).length, [tasks]);
  const totalDur   = phase==="work" ? pomoDur*60 : brkDur*60;
  const card = "st-card glass rounded-2xl border p-5";

  // useLayoutEffect for CSS vars — sync before paint, no colour flash
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--accent-color", accent);
    document.documentElement.style.setProperty("--accent-glow",  glow);
  }, [accent, glow]);

  // Apply theme class to <html> — CSS transitions on bg/color handle smoothness
  useLayoutEffect(() => {
    const html = document.documentElement;
    Object.values(THEMES).forEach(t => html.classList.remove(t.bodyClass));
    html.classList.add(th.bodyClass);
  }, [th.bodyClass]);

  // Non-blocking localStorage sync
  useEffect(() => lsSet("st_exam",     exam),        [exam]);
  useEffect(() => lsSet("st_grade",    grade),       [grade]);
  useEffect(() => lsSet("st_chapters", completedCh), [completedCh]);
  useEffect(() => lsSet("st_tasks",    tasks),       [tasks]);
  useEffect(() => lsSet("st_xp",       xp),          [xp]);
  useEffect(() => lsSet("st_level",    level),       [level]);
  useEffect(() => lsSet("st_streak",   streak),      [streak]);
  useEffect(() => lsSet("st_ltd",      lastTaskDay), [lastTaskDay]);
  useEffect(() => lsSet("st_sessions", sessions),    [sessions]);
  useEffect(() => lsSet("st_theme",    themeId),     [themeId]);

  const switchExam = useCallback((key) => {
    setExamState(key); setCompletedCh({}); setTasks([]); setSelectedSub(null);
  }, []);

  const addXp = useCallback((amount) => {
    setXp(prev => {
      let nx = prev + amount;
      setLevel(lv => {
        let nl = lv;
        while (nx >= XP_PER_LEVEL*nl) { nx -= XP_PER_LEVEL*nl; nl++; setLevelUpData(nl); fireConfetti(accent); }
        return nl;
      });
      return nx;
    });
  }, [accent]);

  const maybeIncrStreak = useCallback(() => {
    const td = todayStr();
    setLastTaskDay(prev => { if (prev!==td) { setStreak(s=>s+1); return td; } return prev; });
  }, []);

  const handleChapterClick = useCallback((sub, ch) => {
    const text = `${sub} — ${ch}`;
    setTasks(prev => prev.find(t=>t.text===text) ? prev : [...prev, { id:Date.now(), text, done:false, auto:true }]);
  }, []);

  const handleAddTask = useCallback((text) => {
    setTasks(prev => [...prev, { id:Date.now(), text, done:false }]);
  }, []);

  const toggleTask = useCallback((id) => {
    setTasks(prev => prev.map(t => {
      if (t.id!==id) return t;
      if (!t.done) {
        addXp(XP_PER_TASK); fireConfetti(accent); maybeIncrStreak();
        if (t.auto && t.text.includes(" — ")) {
          const [sub,ch] = t.text.split(" — ");
          setCompletedCh(p => ({ ...p, [`${sub}::${ch}`]:true }));
        }
      }
      return { ...t, done:!t.done };
    }));
  }, [addXp, accent, maybeIncrStreak]);

  const deleteTask = useCallback((id) => setTasks(p=>p.filter(t=>t.id!==id)), []);

  // Pomodoro — `page` is intentionally NOT a dependency so timer keeps running
  // when user switches from Focus Timer to Dashboard or Progress.
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimerSec(s => {
          if (s<=1) {
            clearInterval(timerRef.current); setRunning(false);
            if (phase==="work") {
              addXp(XP_PER_POMO); fireConfetti(accent);
              setSessions(p=>[...p,{ subject:studyTopic||"General Study", dur:pomoDur, time:new Date().toLocaleTimeString() }]);
              setPhase("break"); return brkDur*60;
            } else { setPhase("work"); return pomoDur*60; }
          }
          return s-1;
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running, phase, pomoDur, brkDur, accent, studyTopic, addXp]);

  useEffect(() => {
    if (swRun) swRef.current = setInterval(() => setSwTime(s=>s+1), 1000);
    else clearInterval(swRef.current);
    return () => clearInterval(swRef.current);
  }, [swRun]);

  useEffect(() => { if (!running) setTimerSec(pomoDur*60); }, [pomoDur]);

  const switchTimerMode = useCallback((mode) => {
    setTimerMode(mode); setRunning(false); setSwRun(false);
    setSwTime(0); setTimerSec(pomoDur*60); setPhase("work");
  }, [pomoDur]);

  // ─── ONBOARDING ──────────────────────────────────────────────────────────────
  if (!exam || !grade) {
    const obMeta   = exam ? EXAM_META[exam] : null;
    const obAccent = obMeta?.accent ?? "#38bdf8";
    return (
      <div className="min-h-screen flex items-center justify-center p-5"
        style={{ background: exam ? `radial-gradient(ellipse at 60% 20%,${obAccent}18,#09090b)` : "radial-gradient(ellipse at 50% 30%,#0f172a,#09090b)" }}>
        <AnimatePresence mode="wait">
          {onboardStep===0 ? (
            <motion.div key="ob0" initial={{ opacity:0,y:36 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-36 }} className="text-center w-full max-w-lg">
              <motion.div animate={{ y:[0,-10,0] }} transition={{ repeat:Infinity, duration:3 }} style={{ fontSize:64, marginBottom:16 }}>🎯</motion.div>
              <h1 className="font-rajdhani font-bold tracking-widest mb-2"
                style={{ fontSize:"clamp(36px,8vw,52px)", background:"linear-gradient(135deg,#38bdf8,#818cf8,#e879f9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                STUDY TRACKER
              </h1>
              <p className="text-zinc-600 text-sm tracking-[.25em] uppercase mb-10">For Noobs → Becoming Legends</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(EXAM_META).map(([key,m]) => (
                  <motion.button key={key} whileHover={{ scale:1.04,y:-2 }} {...tapProp}
                    onClick={() => { setExamState(key); setOnboardStep(1); }}
                    className="rounded-2xl flex flex-col items-center gap-2 cursor-pointer"
                    style={{ padding:"20px 12px", minHeight:100, border:`1.5px solid ${m.accent}55`, background:`linear-gradient(135deg,${m.accent}18,${m.accent}06)`, boxShadow:`0 0 28px ${m.glow}`, fontFamily:"Syne,sans-serif" }}>
                    <span style={{ fontSize:36 }}>{m.emoji}</span>
                    <span className="font-rajdhani font-bold tracking-wider" style={{ fontSize:22, color:m.accent }}>{m.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="ob1" initial={{ opacity:0,y:36 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-36 }} className="text-center w-full max-w-sm">
              <div style={{ fontSize:52, marginBottom:12 }}>🎓</div>
              <h2 className="font-rajdhani font-bold tracking-widest text-3xl mb-2" style={{ color:obAccent }}>SELECT GRADE</h2>
              <p className="text-zinc-600 text-sm mb-7">We'll personalise your syllabus</p>
              <div className="flex flex-col gap-3">
                {(EXAM_META[exam]?.grades ?? ["Class 11","Class 12","Dropper"]).map(g => (
                  <motion.button key={g} whileHover={{ scale:1.02,x:4 }} {...tapProp}
                    onClick={() => setGrade(g)}
                    className="w-full rounded-xl px-5 text-left text-base font-semibold text-zinc-200 cursor-pointer"
                    style={{ minHeight:52, border:`1px solid ${obAccent}44`, background:`${obAccent}11`, fontFamily:"Syne,sans-serif" }}>
                    {g}
                  </motion.button>
                ))}
              </div>
              <button onClick={() => setOnboardStep(0)} className="mt-5 text-zinc-600 text-sm hover:text-zinc-400 transition-colors"
                style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"Syne,sans-serif" }}>
                ← Change Exam
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  function DashboardPage() {
    return (
      <div className="flex flex-col gap-4">
        {/* Hero */}
        <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} className={card}
          style={{ border:`1px solid ${accent}44`, boxShadow:`0 8px 50px ${glow}`, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-60,right:-60,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${glow},transparent 68%)`,pointerEvents:"none" }}/>
          <div className="flex flex-wrap gap-3 justify-between items-start mb-4 relative">
            <div>
              <p className={`text-[10px] tracking-[.2em] uppercase mb-1 ${th.textMuted}`}>OVERALL PROGRESS</p>
              <h2 className={`font-rajdhani font-bold ${th.text}`} style={{ fontSize:"clamp(24px,5vw,34px)" }}>
                {overallPct}% <span style={{ color:accent, fontSize:"clamp(14px,3vw,20px)" }}>Complete</span>
              </h2>
            </div>
            <div className="flex gap-2">
              {[{ico:"🔥",val:streak,label:"Streak",color:"#f59e0b"},{ico:"⭐",val:`Lv.${level}`,label:"Level",color:accent},{ico:"⚡",val:xp,label:"XP",color:accent}].map((s,i)=>(
                <div key={i} className={`text-center rounded-xl px-2.5 py-2 ${th.badgeBg}`} style={{ border:`1px solid ${th.isLight?"#e2e8f0":"rgba(255,255,255,0.08)"}` }}>
                  <div className="text-sm text-center mb-0.5">{s.ico}</div>
                  <div className="font-rajdhani font-bold" style={{ fontSize:14, color:s.color }}>{s.val}</div>
                  <div className={`text-[9px] tracking-widest ${th.textMuted}`}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${th.trackBg}`}>
            <motion.div initial={{ width:0 }} animate={{ width:`${overallPct}%` }} transition={{ duration:1.3,ease:"easeOut" }}
              className="h-full rounded-full" style={{ background:`linear-gradient(90deg,${accent},${accent}88)`, boxShadow:`0 0 16px ${glow}` }}/>
          </div>
          <div className="flex justify-between mt-2">
            <span className={`text-[11px] ${th.textMuted}`}>{doneCh}/{totalCh} chapters</span>
            <span className="text-[11px] font-semibold" style={{ color:accent }}>{meta?.label} · {grade}</span>
          </div>
        </motion.div>

        {/* Subject + Chapters — single column on mobile, 2-col on md+ */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-[1fr_1.7fr]">
          <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} transition={{ delay:.08 }} className={card}>
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>📖 SUBJECTS</p>
            <div className="flex flex-col gap-2">
              {Object.keys(subjects).map(sub => {
                const chs=subjects[sub], done=chs.filter(c=>completedCh[`${sub}::${c}`]).length;
                const pct=Math.round(done/chs.length*100), sel=selectedSub===sub;
                return (
                  <motion.button key={sub} whileHover={{ x:2 }} {...tapProp}
                    onClick={() => setSelectedSub(sel?null:sub)}
                    className="text-left rounded-xl px-3 cursor-pointer transition-all"
                    style={{ minHeight:52, paddingTop:10, paddingBottom:10, background:sel?`${accent}1c`:(th.isLight?"rgba(0,0,0,0.03)":"rgba(255,255,255,0.03)"), border:`1px solid ${sel?accent+"55":(th.isLight?"#e2e8f0":"rgba(255,255,255,0.07)")}`, color:sel?accent:(th.isLight?"#1e293b":"#d4d4d8"), fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:sel?700:500 }}>
                    <div className="flex justify-between mb-1.5">
                      <span>{sub}</span>
                      <span style={{ fontFamily:"DM Mono,monospace",fontSize:11,opacity:.7 }}>{pct}%</span>
                    </div>
                    <div className={`h-[3px] rounded-full ${th.trackBg}`}>
                      <motion.div animate={{ width:`${pct}%` }} transition={{ duration:.6 }} className="h-full rounded-full" style={{ background:accent }}/>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} transition={{ delay:.12 }}
            className={card} style={{ maxHeight:380, overflowY:"auto" }}>
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 sticky top-0 pb-1 z-10 ${th.textMuted} st-card-sticky`}>
              📋 {selectedSub ? `CHAPTERS — ${selectedSub.toUpperCase()}` : "CHAPTERS (SELECT SUBJECT)"}
            </p>
            {!selectedSub ? (
              <div className={`text-center py-10 text-sm ${th.textMuted}`}>← Select a subject to load chapters</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {subjects[selectedSub].map((ch,i) => {
                  const inTask  = tasks.some(t=>t.text===`${selectedSub} — ${ch}`);
                  const taskDone= tasks.find(t=>t.text===`${selectedSub} — ${ch}` && t.done);
                  return (
                    <motion.button key={ch}
                      initial={{ opacity:0,x:-8 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*.012 }}
                      whileHover={{ x:2 }} {...tapProp}
                      onClick={() => handleChapterClick(selectedSub,ch)}
                      className="flex items-center gap-2.5 rounded-lg px-3 text-left cursor-pointer transition-all"
                      style={{ minHeight:40, background:taskDone?`${accent}16`:inTask?`${accent}09`:(th.isLight?"rgba(0,0,0,0.02)":"rgba(255,255,255,0.02)"), border:`1px solid ${taskDone?accent+"44":inTask?accent+"22":(th.isLight?"#e2e8f0":"rgba(255,255,255,0.05)")}`, color:taskDone?accent:(th.isLight?"#334155":"#d4d4d8"), fontFamily:"Syne,sans-serif", fontSize:12 }}>
                      <span style={{ fontSize:13, flexShrink:0 }}>{taskDone?"✅":inTask?"🔵":"○"}</span>
                      <span style={{ textDecoration:taskDone?"line-through":"none",opacity:taskDone?.5:1 }}>{ch}</span>
                      {!inTask && <span className="ml-auto text-[9px] font-bold whitespace-nowrap" style={{ color:accent,opacity:.6 }}>+quest</span>}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Tasks */}
        <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} transition={{ delay:.16 }} className={card}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className={`text-[10px] tracking-[.2em] uppercase ${th.textMuted}`}>⚔️ DAILY TASKS / QUESTS</p>
              <p className={`text-[11px] mt-1 ${th.textMuted}`}>{doneTasks}/{tasks.length} done · +{XP_PER_TASK} XP each · 🔥 {streak}-day streak</p>
            </div>
            {tasks.length>0 && (
              <span className="font-rajdhani font-bold text-sm" style={{ color:doneTasks===tasks.length?accent:(th.isLight?"#94a3b8":"#52525b") }}>
                {Math.round(doneTasks/tasks.length*100)}%
              </span>
            )}
          </div>
          <div className="mb-3">
            <TaskInput onAdd={handleAddTask} accent={accent} isLight={th.isLight}/>
          </div>
          {/* LayoutGroup scopes layout animations to the list only */}
          <LayoutGroup>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {tasks.length===0 && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className={`text-center py-5 text-sm ${th.textMuted}`}>
                    No quests yet — add one above, or click a chapter 🗡️
                  </motion.div>
                )}
                {tasks.map(t => (
                  <motion.div key={t.id} layout="position"
                    initial={{ opacity:0,x:-16 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:20 }}
                    transition={{ layout:{ duration:.22 } }}
                    className="flex items-center gap-2 rounded-xl px-2"
                    style={{ minHeight:52, background:t.done?`${accent}0e`:(th.isLight?"rgba(0,0,0,0.02)":"rgba(255,255,255,0.02)"), border:`1px solid ${t.done?accent+"33":(th.isLight?"#e2e8f0":"rgba(255,255,255,0.06)")}` }}>
                    <motion.button {...tapProp} onClick={() => toggleTask(t.id)}
                      className="flex-shrink-0 cursor-pointer flex items-center justify-center"
                      style={{ background:"none", border:"none", color:t.done?accent:(th.isLight?"#cbd5e1":"#3f3f46"), minWidth:48, minHeight:52 }}>
                      {t.done ? <CheckCircle2 size={22}/> : <Circle size={22}/>}
                    </motion.button>
                    <span className="flex-1 text-xs break-words" style={{ fontFamily:"Syne,sans-serif", color:t.done?(th.isLight?"#94a3b8":"#52525b"):(th.isLight?"#1e293b":"#e4e4e7"), textDecoration:t.done?"line-through":"none" }}>{t.text}</span>
                    {t.auto && !t.done && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color:accent,background:`${accent}18`,border:`1px solid ${accent}33` }}>syllabus</span>}
                    {t.done && <motion.span initial={{ scale:0 }} animate={{ scale:1 }} className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ color:accent,background:`${accent}18` }}>+{XP_PER_TASK} XP</motion.span>}
                    <motion.button {...tapProp} onClick={() => deleteTask(t.id)}
                      className="flex-shrink-0 cursor-pointer opacity-40 flex items-center justify-center"
                      style={{ background:"none", border:"none", color:th.isLight?"#94a3b8":"#71717a", minWidth:44, minHeight:52 }}>
                      <Trash2 size={15}/>
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </motion.div>
      </div>
    );
  }

  // ─── TIMER PAGE ───────────────────────────────────────────────────────────────
  function TimerPage() {
    const phaseColor = phase==="break" ? "#4ade80" : accent;
    const progress   = timerMode==="pomodoro" ? timerSec/totalDur : (swTime%3600)/3600;
    const timerSize  = typeof window!=="undefined" && window.innerWidth<420 ? 180 : 220;
    return (
      <div className="flex flex-col gap-4">
        <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} className={card}>
          <div className={`flex p-1 rounded-xl mb-6 max-w-xs mx-auto ${th.trackBg}`}>
            {["pomodoro","stopwatch"].map(m => (
              <motion.button key={m} {...tapProp} onClick={() => switchTimerMode(m)}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{ minHeight:44, background:timerMode===m?`${accent}28`:"transparent", border:`1px solid ${timerMode===m?accent+"55":"transparent"}`, color:timerMode===m?accent:(th.isLight?"#64748b":"#71717a"), fontFamily:"Syne,sans-serif" }}>
                {m==="pomodoro"?"🍅 Pomodoro":"⏱ Stopwatch"}
              </motion.button>
            ))}
          </div>
          <div className="flex justify-center mb-6">
            <CircularTimer progress={progress} accent={phaseColor} size={timerSize}>
              <p className="text-[10px] tracking-[.2em] uppercase mb-1" style={{ color:phaseColor }}>
                {timerMode==="pomodoro" ? (phase==="work"?"FOCUS":"BREAK") : "ELAPSED"}
              </p>
              <p className="font-rajdhani font-bold tracking-widest" style={{ fontSize:"clamp(36px,10vw,52px)", color:th.isLight?"#0f172a":"#f4f4f5" }}>
                {timerMode==="pomodoro" ? fmtTime(timerSec) : fmtTime(swTime)}
              </p>
              {timerMode==="pomodoro" && <p className={`text-[10px] mt-1 ${th.textMuted}`}>+{XP_PER_POMO} XP</p>}
            </CircularTimer>
          </div>
          <div className="flex justify-center gap-4 mb-5">
            <motion.button whileHover={{ scale:1.06 }} {...tapProp}
              onClick={() => timerMode==="pomodoro" ? setRunning(r=>!r) : setSwRun(r=>!r)}
              className="flex items-center gap-2 rounded-full font-bold text-black cursor-pointer"
              style={{ minHeight:52, paddingLeft:36, paddingRight:36, background:`linear-gradient(135deg,${accent},${accent}cc)`, boxShadow:`0 4px 28px ${glow}`, border:"none", fontFamily:"Syne,sans-serif", fontSize:15 }}>
              {(timerMode==="pomodoro"?running:swRun) ? <><Pause size={18}/> Pause</> : <><Play size={18}/> Start</>}
            </motion.button>
            <motion.button {...tapProp} whileTap={{ scale:0.95, rotate:-30 }}
              onClick={() => { setRunning(false); setSwRun(false); timerMode==="pomodoro"?(setTimerSec(pomoDur*60),setPhase("work")):setSwTime(0); }}
              className="flex items-center justify-center rounded-full cursor-pointer transition-colors st-btn-subtle"
              style={{ minWidth:52, minHeight:52, border:`1px solid ${th.isLight?"#e2e8f0":"rgba(255,255,255,0.1)"}`, background:"transparent" }}>
              <RotateCcw size={18}/>
            </motion.button>
          </div>
          {timerMode==="pomodoro" && (
            <div className="flex gap-8 justify-center flex-wrap">
              {[{label:"Focus (min)",val:pomoDur,set:v=>{setPomoDur(v);if(!running)setTimerSec(v*60);}},{label:"Break (min)",val:brkDur,set:setBrkDur}].map(({label,val,set})=>(
                <div key={label} className="text-center">
                  <p className={`text-[10px] tracking-widest mb-2 ${th.textMuted}`}>{label.toUpperCase()}</p>
                  <div className="flex items-center gap-2">
                    {[{s:"−",fn:()=>set(v=>Math.max(1,v-5))},null,{s:"+",fn:()=>set(v=>Math.min(90,v+5))}].map((b,i) =>
                      b ? (
                        <motion.button key={b.s} {...tapProp} onClick={b.fn}
                          className="rounded-lg cursor-pointer flex items-center justify-center st-btn-subtle"
                          style={{ minWidth:48, minHeight:48, border:`1px solid ${th.isLight?"#e2e8f0":"rgba(255,255,255,0.1)"}`, background:"transparent", color:th.isLight?"#0f172a":"#f4f4f5", fontSize:20 }}>
                          {b.s}
                        </motion.button>
                      ) : (
                        <span key="v" className="font-rajdhani font-bold text-2xl min-w-[32px] text-center" style={{ color:accent }}>{val}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
        <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.1 }} className={card}>
          <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>🎯 CURRENTLY STUDYING</p>
          <select value={studyTopic} onChange={e=>setStudyTopic(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none cursor-pointer"
            style={{ background:th.selectBg, border:`1px solid ${th.selectBdr}`, color:th.selectText, fontFamily:"Syne,sans-serif", minHeight:48 }}>
            <option value="">— Select topic —</option>
            {Object.entries(subjects).map(([sub,chs])=>(
              <optgroup key={sub} label={sub} style={{ background:th.optBg }}>
                {chs.map(ch=><option key={ch} value={`${sub} — ${ch}`} style={{ background:th.optBg }}>{ch}</option>)}
              </optgroup>
            ))}
          </select>
        </motion.div>
        {sessions.length>0 && (
          <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.15 }} className={card}>
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>🏆 SESSION LOG</p>
            <div className="flex flex-col gap-2">
              {sessions.slice(-5).reverse().map((s,i)=>(
                <div key={i} className="flex justify-between items-center rounded-xl px-3 py-2.5"
                  style={{ background:th.isLight?"rgba(0,0,0,0.02)":"rgba(255,255,255,0.02)", border:`1px solid ${th.isLight?"#e2e8f0":"rgba(255,255,255,0.05)"}` }}>
                  <div><p className={`text-xs ${th.text}`}>{s.subject}</p><p className={`text-[10px] font-mono ${th.textMuted}`}>{s.time}</p></div>
                  <div className="text-right"><p className="font-rajdhani font-bold text-sm" style={{ color:accent }}>{s.dur}m</p><p className={`text-[10px] ${th.textMuted}`}>+{XP_PER_POMO} XP</p></div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // ─── PROGRESS PAGE ────────────────────────────────────────────────────────────
  function ProgressPage() {
    const barColors = [accent,"#f59e0b","#e879f9","#4ade80","#f87171"];
    return (
      <div className="flex flex-col gap-4">
        <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} className="st-card glass rounded-2xl border p-6 text-center"
          style={{ background:`linear-gradient(135deg,${accent}18,transparent)`, border:`1px solid ${accent}44`, boxShadow:`0 0 50px ${glow}` }}>
          <motion.div animate={{ rotate:[0,6,-6,0] }} transition={{ repeat:Infinity,duration:4 }} style={{ fontSize:50,marginBottom:6 }}>🏆</motion.div>
          <p className="font-rajdhani font-bold" style={{ fontSize:"clamp(38px,10vw,50px)", color:accent }}>{level}</p>
          <p className={`text-sm mb-4 ${th.textMuted}`}>Current Level</p>
          <div className={`h-2 rounded-full overflow-hidden max-w-xs mx-auto ${th.trackBg}`}>
            <motion.div initial={{ width:0 }} animate={{ width:`${Math.min(100,xp/(XP_PER_LEVEL*level)*100)}%` }} transition={{ duration:1.5,ease:"easeOut" }}
              className="h-full rounded-full xp-shimmer" style={{ background:`linear-gradient(90deg,${accent},#818cf8,${accent})` }}/>
          </div>
          <p className={`text-xs mt-2 font-mono ${th.textMuted}`}>{xp} / {XP_PER_LEVEL*level} XP → Level {level+1}</p>
        </motion.div>
        <div className="grid grid-cols-3 gap-3">
          {[{ico:"📚",val:doneCh,label:"Chapters"},{ico:"⚔️",val:doneTasks,label:"Tasks"},{ico:"🍅",val:sessions.length,label:"Sessions"}].map((s,i)=>(
            <motion.div key={i} initial={{ opacity:0,scale:.9 }} animate={{ opacity:1,scale:1 }} transition={{ delay:i*.08 }} className={card+" text-center"}>
              <div style={{ fontSize:24,marginBottom:4 }}>{s.ico}</div>
              <p className="font-rajdhani font-bold" style={{ fontSize:28,color:accent }}>{s.val}</p>
              <p className={`text-[10px] tracking-widest ${th.textMuted}`}>{s.label}</p>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.15 }} className={card}>
          <p className={`text-[10px] tracking-[.2em] uppercase mb-4 ${th.textMuted}`}>📊 SUBJECT BREAKDOWN</p>
          <div className="flex flex-col gap-4">
            {Object.entries(subjects).map(([sub,chs],i)=>{
              const d=chs.filter(c=>completedCh[`${sub}::${c}`]).length, pct=Math.round(d/chs.length*100), bc=barColors[i%barColors.length];
              return (
                <motion.div key={sub} initial={{ opacity:0,x:-16 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*.07 }}>
                  <div className="flex justify-between mb-2">
                    <span className={`text-sm font-semibold ${th.text}`}>{sub}</span>
                    <span className="font-bold text-xs" style={{ color:bc,fontFamily:"DM Mono,monospace" }}>{d}/{chs.length} · {pct}%</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${th.trackBg}`}>
                    <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:1,delay:i*.1,ease:"easeOut" }}
                      className="h-full rounded-full" style={{ background:`linear-gradient(90deg,${bc},${bc}99)`, boxShadow:`0 0 10px ${bc}55` }}/>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
        <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.22 }} className={card}>
          <p className={`text-[10px] tracking-[.2em] uppercase mb-4 ${th.textMuted}`}>🏅 ACHIEVEMENTS</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[{ico:"🔥",label:"First Blood",desc:"Complete 1 chapter",ok:doneCh>=1},{ico:"⚡",label:"On Fire",desc:"5 chapters done",ok:doneCh>=5},{ico:"🎯",label:"Quest Master",desc:"Finish 5 tasks",ok:doneTasks>=5},{ico:"🍅",label:"Pomo Pro",desc:"Log 3 sessions",ok:sessions.length>=3},{ico:"⭐",label:"Rising Star",desc:"Reach Level 2",ok:level>=2},{ico:"💎",label:"Diamond Mind",desc:"50% syllabus done",ok:overallPct>=50}].map((a,i)=>(
              <motion.div key={i} initial={{ opacity:0,scale:.9 }} animate={{ opacity:1,scale:1 }} transition={{ delay:i*.05 }}
                className="rounded-xl p-3" style={{ background:a.ok?`${accent}12`:(th.isLight?"rgba(0,0,0,0.02)":"rgba(255,255,255,0.02)"), border:`1px solid ${a.ok?accent+"33":(th.isLight?"#e2e8f0":"rgba(255,255,255,0.05)")}`, opacity:a.ok?1:.42 }}>
                <div style={{ fontSize:22,marginBottom:3 }}>{a.ok?a.ico:"🔒"}</div>
                <p className={`text-xs font-semibold ${th.text}`}>{a.label}</p>
                <p className={`text-[10px] ${th.textMuted}`}>{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── THEME PANEL ──────────────────────────────────────────────────────────────
  function ThemePanel() {
    return (
      <motion.div initial={{ opacity:0,y:8,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:8,scale:.96 }}
        className={`absolute right-0 top-12 z-[200] ${th.modalBg} glass rounded-2xl p-5 w-52`}
        style={{ border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 12px 50px rgba(0,0,0,.6)" }}>
        <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>🎨 THEME ENGINE</p>
        <div className="flex gap-1.5 mb-4">
          {Object.values(THEMES).map(t=>(
            <motion.button key={t.id} {...tapProp} onClick={()=>setThemeId(t.id)}
              className="flex-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ minHeight:40, background:themeId===t.id?`${accent}22`:"transparent", border:`1px solid ${themeId===t.id?accent+"55":"rgba(255,255,255,0.08)"}`, color:themeId===t.id?accent:"#71717a", fontFamily:"Syne,sans-serif", transition:"background-color .3s,border-color .3s,color .2s" }}>
              {t.id==="dark"?"🌙":t.id==="light"?"☀️":"⚡"}
            </motion.button>
          ))}
        </div>
        <p className={`text-[10px] tracking-widest mb-2 ${th.textMuted}`}>SWITCH EXAM / ACCENT</p>
        {Object.entries(EXAM_META).map(([key,m])=>(
          <motion.button key={key} {...tapProp} onClick={()=>{ switchExam(key); setShowThemePanel(false); }}
            className="w-full flex items-center gap-2.5 px-2.5 rounded-lg mb-1 cursor-pointer"
            style={{ minHeight:44, background:exam===key?`${m.accent}18`:"transparent", border:`1px solid ${exam===key?m.accent+"44":"rgba(255,255,255,0.06)"}`, color:exam===key?m.accent:"#71717a", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:exam===key?700:400, transition:"background-color .25s,border-color .25s" }}>
            <span style={{ width:11,height:11,borderRadius:"50%",background:m.accent,flexShrink:0,boxShadow:`0 0 8px ${m.accent}` }}/>
            {m.label}
            {exam===key && <CheckCircle2 size={12} style={{ marginLeft:"auto",color:m.accent }}/>}
          </motion.button>
        ))}
      </motion.div>
    );
  }

  // ─── ROOT RENDER ──────────────────────────────────────────────────────────────
  const titleMap = { dashboard:"Dashboard", timer:"Focus Timer", progress:"Progress" };

  return (
    <div className="app-root" style={{ minHeight:"100dvh" }}>
      {/* Desktop sidebar — memo'd, won't re-render on task toggle etc. */}
      <Sidebar th={th} page={page} setPage={setPage}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        accent={accent} glow={glow} xp={xp} level={level}/>

      {/* Mobile bottom nav */}
      <BottomNav page={page} setPage={setPage} accent={accent}/>

      <main className="st-main" style={{ minHeight:"100dvh" }}>
        {/* Topbar */}
        <header className="st-topbar glass sticky top-0 z-50 border-b px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className={`font-rajdhani font-bold tracking-wide ${th.text}`}
              style={{ fontSize:"clamp(16px,4vw,20px)" }}>{titleMap[page]}</h1>
            <motion.button whileHover={{ scale:1.06 }} {...tapProp}
              onClick={()=>setShowExamModal(true)}
              className="flex items-center gap-1 font-bold px-3 rounded-full cursor-pointer"
              style={{ minHeight:32, color:accent, background:`${accent}18`, border:`1px solid ${accent}44`, fontFamily:"Syne,sans-serif", fontSize:11, letterSpacing:1 }}>
              {meta?.label} <ChevronDown size={11}/>
            </motion.button>
          </div>
          <div className="flex items-center gap-2 relative">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background:th.isLight?"rgba(0,0,0,0.04)":"rgba(255,255,255,0.05)", border:`1px solid ${th.isLight?"#e2e8f0":"rgba(255,255,255,0.08)"}` }}>
              <Flame size={13} color="#f59e0b"/><span className="font-rajdhani font-bold text-xs" style={{ color:"#f59e0b" }}>{streak}d</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background:`${accent}18`, border:`1px solid ${accent}44` }}>
              <Zap size={13} color={accent}/><span className="font-rajdhani font-bold text-xs" style={{ color:accent }}>{xp} XP</span>
            </div>
            <motion.button whileHover={{ scale:1.08,rotate:30 }} {...tapProp}
              onClick={()=>setShowThemePanel(o=>!o)}
              className="flex items-center justify-center rounded-xl cursor-pointer"
              style={{ minWidth:44, minHeight:44, background:showThemePanel?`${accent}22`:(th.isLight?"rgba(0,0,0,0.05)":"rgba(255,255,255,0.06)"), border:`1px solid ${showThemePanel?accent+"55":(th.isLight?"#e2e8f0":"rgba(255,255,255,0.08)")}`, color:showThemePanel?accent:(th.isLight?"#64748b":"#71717a") }}>
              <Palette size={15}/>
            </motion.button>
            <AnimatePresence>{showThemePanel && <ThemePanel/>}</AnimatePresence>
          </div>
        </header>

        {showThemePanel && <div className="fixed inset-0 z-[49]" onClick={()=>setShowThemePanel(false)}/>}

        {/* Scrollable content — pb-20 leaves room for mobile bottom nav */}
        <div className="px-4 md:px-6 pt-4 pb-24 md:pb-6 max-w-[900px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-14 }} transition={{ duration:.18 }}>
              {page==="dashboard" && <DashboardPage/>}
              {page==="timer"     && <TimerPage/>}
              {page==="progress"  && <ProgressPage/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {showExamModal && <ExamModal currentExam={exam} onSelect={switchExam} onClose={()=>setShowExamModal(false)} th={th}/>}
      {levelUpData && <LevelUpToast level={levelUpData} accent={accent} onDone={()=>setLevelUpData(null)}/>}
    </div>
  );
}
