import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, BookOpen, Timer, TrendingUp, Menu, X,
  Flame, Star, Play, Pause, RotateCcw,
  CheckCircle2, Circle, Trash2, Plus,
  Sun, Moon, Palette, ChevronDown,
} from "lucide-react";
import confetti from "canvas-confetti";

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const XP_PER_TASK   = 100;
const XP_PER_POMO   = 100;
const XP_PER_LEVEL  = 500;

const EXAM_META = {
  JEE:    { label: "JEE",     accent: "#38bdf8", glow: "rgba(56,189,248,0.45)",   emoji: "⚛️",  grades: ["Class 11","Class 12","Dropper"] },
  NEET:   { label: "NEET",    accent: "#4ade80", glow: "rgba(74,222,128,0.45)",   emoji: "🧬",  grades: ["Class 11","Class 12","Dropper"] },
  UPSC:   { label: "UPSC",    accent: "#f59e0b", glow: "rgba(245,158,11,0.45)",   emoji: "🏛️", grades: ["Graduate","Final Year","Post Graduate"] },
  MHTCET: { label: "MHT‑CET", accent: "#e879f9", glow: "rgba(232,121,249,0.45)", emoji: "📐",  grades: ["Class 11","Class 12","Dropper"] },
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

// ─── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    id: "dark",
    bg:         "bg-zinc-950",
    surface:    "bg-zinc-900",
    card:       "bg-zinc-900/80 border-zinc-800",
    topbar:     "bg-zinc-950/90 border-zinc-800/80",
    sidebar:    "bg-zinc-950/95 border-zinc-800",
    input:      "bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500",
    text:       "text-zinc-100",
    textSub:    "text-zinc-400",
    textMuted:  "text-zinc-600",
    rowBase:    "bg-zinc-800/50 border-zinc-700/50",
    rowDone:    "border-zinc-700/30",
    selectBg:   "#27272a",
    selectText: "#f4f4f5",
    selectBdr:  "#3f3f46",
    optBg:      "#18181b",
    divider:    "border-zinc-800",
    modalBg:    "bg-zinc-900",
    badgeBg:    "bg-zinc-800",
    trackBg:    "bg-zinc-800",
    hoverCard:  "hover:bg-zinc-800",
  },
  light: {
    id: "light",
    bg:         "bg-slate-100",
    surface:    "bg-white",
    card:       "bg-white/90 border-slate-200",
    topbar:     "bg-slate-100/90 border-slate-200",
    sidebar:    "bg-white/95 border-slate-200",
    input:      "bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400",
    text:       "text-slate-900",
    textSub:    "text-slate-500",
    textMuted:  "text-slate-400",
    rowBase:    "bg-slate-50 border-slate-200",
    rowDone:    "border-slate-200",
    selectBg:   "#f1f5f9",
    selectText: "#0f172a",
    selectBdr:  "#cbd5e1",
    optBg:      "#ffffff",
    divider:    "border-slate-200",
    modalBg:    "bg-white",
    badgeBg:    "bg-slate-100",
    trackBg:    "bg-slate-200",
    hoverCard:  "hover:bg-slate-50",
  },
  neon: {
    id: "neon",
    bg:         "bg-black",
    surface:    "bg-zinc-950",
    card:       "bg-zinc-950/90 border-cyan-500/20",
    topbar:     "bg-black/90 border-cyan-500/20",
    sidebar:    "bg-black/95 border-cyan-500/20",
    input:      "bg-zinc-900 border-zinc-700 text-cyan-50 placeholder-zinc-600",
    text:       "text-cyan-50",
    textSub:    "text-cyan-700",
    textMuted:  "text-cyan-900",
    rowBase:    "bg-zinc-900 border-zinc-800",
    rowDone:    "border-zinc-800",
    selectBg:   "#09090b",
    selectText: "#ecfeff",
    selectBdr:  "#3f3f46",
    optBg:      "#09090b",
    divider:    "border-zinc-900",
    modalBg:    "bg-zinc-950",
    badgeBg:    "bg-zinc-900",
    trackBg:    "bg-zinc-900",
    hoverCard:  "hover:bg-zinc-900",
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, "0");
const fmtTime = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const todayStr = () => new Date().toDateString();

function fireConfetti(color) {
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: [color, "#ffffff", "#facc15", "#f472b6"] });
  setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.3 }, colors: [color, "#818cf8"] }), 250);
}

// ─── MEMOISED TASK INPUT — module-scope prevents re-mount on parent re-render ──
const TaskInput = memo(function TaskInput({ onAdd, accent, th }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);

  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal("");
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="flex gap-2">
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="Type a task and press Enter…"
        className={`flex-1 rounded-xl px-4 py-2.5 text-sm border transition-all duration-200 outline-none ${th.input}`}
        style={{ fontFamily: "Syne, sans-serif" }}
      />
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
        onClick={submit}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-black cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 18px ${accent}55`, fontFamily: "Syne, sans-serif" }}
      >
        <Plus size={15} /> Add
      </motion.button>
    </div>
  );
});

// ─── CIRCULAR TIMER ───────────────────────────────────────────────────────────
function CircularTimer({ progress, accent, size = 230, children }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={accent} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - progress) }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 10px ${accent})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ─── LEVEL-UP TOAST ───────────────────────────────────────────────────────────
function LevelUpToast({ level, accent, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div
      className="levelup-toast fixed z-[9999] text-center rounded-2xl px-10 py-5 glass"
      style={{
        bottom: 32, left: "50%",
        border: `2px solid ${accent}`,
        background: "rgba(9,9,11,0.97)",
        boxShadow: `0 0 50px ${accent}99`,
        minWidth: 260,
      }}
    >
      <motion.div animate={{ rotate: [0, 15, -15, 10, -10, 0], scale: [1, 1.4, 1] }} transition={{ duration: 0.9 }}>
        <span style={{ fontSize: 44 }}>⚡</span>
      </motion.div>
      <p className="font-rajdhani font-bold tracking-widest mt-1" style={{ fontSize: 30, color: accent }}>LEVEL UP!</p>
      <p className="text-sm text-zinc-400 mt-1">You reached <strong className="text-white">Level {level}</strong></p>
    </div>
  );
}

// ─── EXAM SWITCHER MODAL ──────────────────────────────────────────────────────
function ExamModal({ currentExam, onSelect, onClose, th }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[8000] flex items-center justify-center p-6"
        style={{ background: "rgba(0,0,0,0.78)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.86, y: 28 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.86, y: 28 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className={`${th.modalBg} glass rounded-3xl p-8 w-full max-w-md`}
          style={{ border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,.7)" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className={`font-rajdhani font-bold tracking-widest text-2xl ${th.text}`}>SWITCH EXAM</h2>
            <button onClick={onClose} className={`${th.textMuted} text-xl leading-none hover:opacity-70 transition-opacity`} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(EXAM_META).map(([key, meta]) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
                onClick={() => { onSelect(key); onClose(); }}
                className="rounded-2xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all"
                style={{
                  background: currentExam === key ? `${meta.accent}20` : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${currentExam === key ? meta.accent + "88" : "rgba(255,255,255,0.07)"}`,
                  boxShadow: currentExam === key ? `0 0 20px ${meta.glow}` : "none",
                  fontFamily: "Syne, sans-serif",
                }}
              >
                <span style={{ fontSize: 34 }}>{meta.emoji}</span>
                <span className="font-rajdhani font-bold tracking-wider" style={{ fontSize: 20, color: currentExam === key ? meta.accent : "#a1a1aa" }}>
                  {meta.label}
                </span>
                {currentExam === key && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.accent}22`, color: meta.accent, border: `1px solid ${meta.accent}44` }}>
                    Active
                  </span>
                )}
              </motion.button>
            ))}
          </div>
          <p className="text-center mt-4 text-xs" style={{ color: "#52525b" }}>Switching exam resets chapters & tasks</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Persisted state ─────────────────────────────────────────────────────────
  const [exam,         setExamState]   = useState(() => ls.get("st_exam",      null));
  const [grade,        setGrade]       = useState(() => ls.get("st_grade",     null));
  const [completedCh,  setCompletedCh] = useState(() => ls.get("st_chapters",  {}));
  const [tasks,        setTasks]       = useState(() => ls.get("st_tasks",     []));
  const [xp,           setXp]          = useState(() => ls.get("st_xp",        0));
  const [level,        setLevel]       = useState(() => ls.get("st_level",     1));
  const [streak,       setStreak]      = useState(() => ls.get("st_streak",    0));
  const [lastTaskDay,  setLastTaskDay] = useState(() => ls.get("st_ltd",       null));
  const [sessions,     setSessions]    = useState(() => ls.get("st_sessions",  []));
  const [themeId,      setThemeId]     = useState(() => ls.get("st_theme",     "dark"));

  // ── Ephemeral state ─────────────────────────────────────────────────────────
  const [page,         setPage]        = useState("dashboard");
  const [sidebarOpen,  setSidebarOpen] = useState(false);
  const [selectedSub,  setSelectedSub] = useState(null);
  const [showExamModal,setShowExamModal] = useState(false);
  const [showThemePanel,setShowThemePanel] = useState(false);
  const [onboardStep,  setOnboardStep] = useState(0);
  const [timerMode,    setTimerMode]   = useState("pomodoro");
  const [pomoDur,      setPomoDur]     = useState(25);
  const [brkDur,       setBrkDur]      = useState(5);
  const [timerSec,     setTimerSec]    = useState(25 * 60);
  const [running,      setRunning]     = useState(false);
  const [phase,        setPhase]       = useState("work");
  const [swTime,       setSwTime]      = useState(0);
  const [swRun,        setSwRun]       = useState(false);
  const [studyTopic,   setStudyTopic]  = useState("");
  const [levelUpData,  setLevelUpData] = useState(null);

  const timerRef = useRef(null);
  const swRef    = useRef(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const th       = THEMES[themeId] ?? THEMES.dark;
  const meta     = exam ? EXAM_META[exam] : null;
  const accent   = meta?.accent ?? "#22d3ee";
  const glow     = meta?.glow   ?? "rgba(34,211,238,0.45)";
  const subjects = exam ? SUBJECTS[exam] : {};
  const totalCh  = Object.values(subjects).reduce((a, c) => a + c.length, 0);
  const doneCh   = Object.keys(completedCh).filter(k => completedCh[k]).length;
  const overallPct = totalCh ? Math.round(doneCh / totalCh * 100) : 0;
  const doneTasks  = tasks.filter(t => t.done).length;
  const totalDur   = phase === "work" ? pomoDur * 60 : brkDur * 60;

  // ── CSS variable injection for glow animations ───────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", accent);
    document.documentElement.style.setProperty("--accent-glow", glow);
  }, [accent, glow]);

  // ── localStorage sync ───────────────────────────────────────────────────────
  useEffect(() => ls.set("st_exam",     exam),        [exam]);
  useEffect(() => ls.set("st_grade",    grade),       [grade]);
  useEffect(() => ls.set("st_chapters", completedCh), [completedCh]);
  useEffect(() => ls.set("st_tasks",    tasks),       [tasks]);
  useEffect(() => ls.set("st_xp",       xp),          [xp]);
  useEffect(() => ls.set("st_level",    level),       [level]);
  useEffect(() => ls.set("st_streak",   streak),      [streak]);
  useEffect(() => ls.set("st_ltd",      lastTaskDay), [lastTaskDay]);
  useEffect(() => ls.set("st_sessions", sessions),    [sessions]);
  useEffect(() => ls.set("st_theme",    themeId),     [themeId]);

  // ── Switch exam: reset chapter/task data, keep XP/streak ────────────────────
  const switchExam = useCallback((key) => {
    setExamState(key);
    setCompletedCh({});
    setTasks([]);
    setSelectedSub(null);
  }, []);

  // ── XP + level-up logic ─────────────────────────────────────────────────────
  const addXp = useCallback((amount) => {
    setXp(prev => {
      let nx = prev + amount;
      setLevel(lv => {
        let nl = lv;
        while (nx >= XP_PER_LEVEL * nl) { nx -= XP_PER_LEVEL * nl; nl++; setLevelUpData(nl); fireConfetti(accent); }
        return nl;
      });
      return nx;
    });
  }, [accent]);

  // ── Streak: +1 once per calendar day on first completed task ─────────────────
  const maybeIncrStreak = useCallback(() => {
    const td = todayStr();
    setLastTaskDay(prev => { if (prev !== td) { setStreak(s => s + 1); return td; } return prev; });
  }, []);

  // ── Chapter click: add task (doesn't mark chapter complete—task tick does that) ─
  const handleChapterClick = useCallback((sub, ch) => {
    const text = `${sub} — ${ch}`;
    setTasks(prev => prev.find(t => t.text === text) ? prev : [...prev, { id: Date.now(), text, done: false, auto: true }]);
  }, []);

  // ── Task handlers ────────────────────────────────────────────────────────────
  const handleAddTask = useCallback((text) => {
    setTasks(prev => [...prev, { id: Date.now(), text, done: false }]);
  }, []);

  const toggleTask = useCallback((id) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (!t.done) {
        addXp(XP_PER_TASK);
        fireConfetti(accent);
        maybeIncrStreak();
        // If the task corresponds to a chapter, mark it complete
        if (t.auto && t.text.includes(" — ")) {
          const [sub, ch] = t.text.split(" — ");
          setCompletedCh(prev => ({ ...prev, [`${sub}::${ch}`]: true }));
        }
      }
      return { ...t, done: !t.done };
    }));
  }, [addXp, accent, maybeIncrStreak]);

  const deleteTask = useCallback((id) => setTasks(prev => prev.filter(t => t.id !== id)), []);

  // ── Pomodoro ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimerSec(s => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            setRunning(false);
            if (phase === "work") {
              addXp(XP_PER_POMO);
              fireConfetti(accent);
              setSessions(p => [...p, { subject: studyTopic || "General Study", dur: pomoDur, time: new Date().toLocaleTimeString() }]);
              setPhase("break");
              return brkDur * 60;
            } else {
              setPhase("work");
              return pomoDur * 60;
            }
          }
          return s - 1;
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running, phase, pomoDur, brkDur, accent, studyTopic, addXp]);

  // ── Stopwatch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (swRun) swRef.current = setInterval(() => setSwTime(s => s + 1), 1000);
    else clearInterval(swRef.current);
    return () => clearInterval(swRef.current);
  }, [swRun]);

  useEffect(() => { setTimerSec(pomoDur * 60); }, [pomoDur]);

  // ── Reset timer when switching mode ─────────────────────────────────────────
  const switchTimerMode = (mode) => {
    setTimerMode(mode);
    setRunning(false);
    setSwRun(false);
    setSwTime(0);
    setTimerSec(pomoDur * 60);
    setPhase("work");
  };

  // ── Card style helper ────────────────────────────────────────────────────────
  const card = `${th.card} glass rounded-2xl border p-5`;

  // ─── ONBOARDING ──────────────────────────────────────────────────────────────
  if (!exam || !grade) {
    const obMeta = exam ? EXAM_META[exam] : null;
    const obAccent = obMeta?.accent ?? "#38bdf8";
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background: exam ? `radial-gradient(ellipse at 60% 20%, ${obAccent}18, #09090b)` : "radial-gradient(ellipse at 50% 30%, #0f172a, #09090b)" }}>
        <AnimatePresence mode="wait">
          {onboardStep === 0 ? (
            <motion.div key="ob0" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -36 }}
              className="text-center w-full max-w-lg">
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} style={{ fontSize: 68, marginBottom: 16 }}>🎯</motion.div>
              <h1 className="font-rajdhani font-bold tracking-widest mb-2"
                style={{ fontSize: 52, background: "linear-gradient(135deg, #38bdf8, #818cf8, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                STUDY TRACKER
              </h1>
              <p className="text-zinc-600 text-sm tracking-[.25em] uppercase mb-10">For Noobs → Becoming Legends</p>
              <p className="text-zinc-500 text-sm font-semibold mb-5 tracking-widest">SELECT YOUR EXAM</p>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(EXAM_META).map(([key, m]) => (
                  <motion.button key={key} whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.95 }}
                    onClick={() => { setExamState(key); setOnboardStep(1); }}
                    className="rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer"
                    style={{ border: `1.5px solid ${m.accent}55`, background: `linear-gradient(135deg, ${m.accent}18, ${m.accent}06)`, boxShadow: `0 0 28px ${m.glow}`, fontFamily: "Syne, sans-serif" }}>
                    <span style={{ fontSize: 40 }}>{m.emoji}</span>
                    <span className="font-rajdhani font-bold tracking-wider" style={{ fontSize: 24, color: m.accent }}>{m.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="ob1" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -36 }}
              className="text-center w-full max-w-sm">
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎓</div>
              <h2 className="font-rajdhani font-bold tracking-widest text-3xl mb-2" style={{ color: obAccent }}>SELECT GRADE</h2>
              <p className="text-zinc-600 text-sm mb-7">We'll personalize your syllabus</p>
              <div className="flex flex-col gap-3">
                {(EXAM_META[exam]?.grades ?? ["Class 11","Class 12","Dropper"]).map(g => (
                  <motion.button key={g} whileHover={{ scale: 1.03, x: 4 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setGrade(g)}
                    className="w-full rounded-xl py-4 px-5 text-left text-base font-semibold text-zinc-200 cursor-pointer transition-all"
                    style={{ border: `1px solid ${obAccent}44`, background: `${obAccent}11`, fontFamily: "Syne, sans-serif" }}>
                    {g}
                  </motion.button>
                ))}
              </div>
              <button onClick={() => setOnboardStep(0)} className="mt-5 text-zinc-600 text-sm hover:text-zinc-400 transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                ← Change Exam
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── SIDEBAR ─────────────────────────────────────────────────────────────────
  const navItems = [
    { id: "dashboard", icon: <BookOpen size={18} />, label: "Dashboard" },
    { id: "timer",     icon: <Timer size={18} />,    label: "Focus Timer" },
    { id: "progress",  icon: <TrendingUp size={18} />, label: "Progress" },
  ];

  function Sidebar() {
    const xpPct = Math.min(100, (xp / (XP_PER_LEVEL * level)) * 100);
    return (
      <motion.div initial={false} animate={{ width: sidebarOpen ? 220 : 62 }}
        className={`${th.sidebar} glass fixed left-0 top-0 h-screen z-[100] flex flex-col border-r overflow-hidden`}
        style={{ boxShadow: `4px 0 30px rgba(0,0,0,${th.id === "light" ? .1 : .4})` }}>

        {/* ⚡ Electric Home Button */}
        <div className={`px-3 pt-3 pb-3 border-b ${th.divider}`}>
          <motion.button
            whileHover={{ rotate: 180, scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={() => { setPage("dashboard"); setSidebarOpen(false); }}
            className={`zap-pulse w-full flex items-center gap-3 rounded-xl cursor-pointer`}
            style={{
              padding: "9px 10px",
              background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
              border: `1.5px solid ${accent}66`,
              fontFamily: "Syne, sans-serif",
              justifyContent: sidebarOpen ? "flex-start" : "center",
            }}
            title="Go to Dashboard"
          >
            <motion.span
              animate={{ textShadow: [`0 0 8px ${accent}`, `0 0 22px ${accent}`, `0 0 8px ${accent}`] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}
            >
              ⚡
            </motion.span>
            {sidebarOpen && (
              <span className="font-rajdhani font-bold tracking-widest whitespace-nowrap" style={{ color: accent, fontSize: 14 }}>HOME</span>
            )}
          </motion.button>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-1 px-2 pt-3">
          {navItems.map(item => (
            <motion.button key={item.id} whileHover={{ x: 2 }} whileTap={{ scale: 0.96 }}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              className={`flex items-center gap-3 rounded-xl cursor-pointer transition-all whitespace-nowrap`}
              style={{
                padding: "9px 10px",
                background:   page === item.id ? `${accent}22` : "transparent",
                border:       `1px solid ${page === item.id ? accent + "55" : "transparent"}`,
                color:        page === item.id ? accent : (th.id === "light" ? "#64748b" : "#71717a"),
                fontWeight:   page === item.id ? 700 : 500,
                fontFamily:   "Syne, sans-serif",
                fontSize:     13,
                justifyContent: sidebarOpen ? "flex-start" : "center",
              }}
            >
              {item.icon}
              {sidebarOpen && item.label}
            </motion.button>
          ))}
        </div>

        {/* XP indicator */}
        <div className={`px-3 py-3 border-t ${th.divider}`}>
          {sidebarOpen ? (
            <>
              <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: "DM Mono, monospace" }}>
                <span className="font-bold" style={{ color: accent }}>LV {level}</span>
                <span className={th.textMuted}>{xp}/{XP_PER_LEVEL * level}</span>
              </div>
              <div className={`h-1 rounded-full ${th.trackBg} overflow-hidden`}>
                <motion.div
                  className="h-full rounded-full xp-shimmer"
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.55 }}
                  style={{ background: `linear-gradient(90deg, ${accent}, #818cf8, ${accent})` }}
                />
              </div>
            </>
          ) : (
            <div className="flex justify-center font-rajdhani font-bold text-sm" style={{ color: accent }}>{level}</div>
          )}
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setSidebarOpen(o => !o)}
          className={`mx-2 mb-2 p-2 rounded-xl flex justify-center transition-colors cursor-pointer ${th.hoverCard}`}
          style={{ border: `1px solid ${th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.07)"}`, background: "transparent", color: th.id === "light" ? "#64748b" : "#52525b" }}>
          {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
        </button>
      </motion.div>
    );
  }

  // ─── DASHBOARD PAGE ──────────────────────────────────────────────────────────
  function DashboardPage() {
    const taskPct = tasks.length ? Math.round(doneTasks / tasks.length * 100) : 0;

    return (
      <div className="flex flex-col gap-5">

        {/* Hero progress card */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          className={card}
          style={{ border: `1px solid ${accent}44`, boxShadow: `0 8px 50px ${glow}`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${glow}, transparent 68%)`, pointerEvents: "none" }} />
          <div className="flex flex-wrap gap-4 justify-between items-start mb-4 relative">
            <div>
              <p className={`text-[10px] tracking-[.2em] uppercase mb-1 ${th.textMuted}`}>OVERALL PROGRESS</p>
              <h2 className={`font-rajdhani font-bold ${th.text}`} style={{ fontSize: 34 }}>
                {overallPct}% <span style={{ color: accent, fontSize: 20 }}>Complete</span>
              </h2>
            </div>
            <div className="flex gap-2.5">
              {[
                { ico: "🔥", val: streak,     label: "Streak", color: "#f59e0b" },
                { ico: "⭐", val: `Lv.${level}`, label: "Level", color: accent },
                { ico: "⚡", val: xp,         label: "XP",     color: accent },
              ].map((s, i) => (
                <div key={i} className={`text-center rounded-xl px-3 py-2.5 ${th.badgeBg}`}
                  style={{ border: `1px solid ${th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.08)"}` }}>
                  <div className="text-sm text-center mb-0.5">{s.ico}</div>
                  <div className="font-rajdhani font-bold" style={{ fontSize: 16, color: s.color }}>{s.val}</div>
                  <div className={`text-[9px] tracking-widest ${th.textMuted}`}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${th.trackBg}`}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${overallPct}%` }} transition={{ duration: 1.3, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)`, boxShadow: `0 0 16px ${glow}` }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className={`text-[11px] ${th.textMuted}`}>{doneCh}/{totalCh} chapters tracked</span>
            <span className="text-[11px] font-semibold" style={{ color: accent }}>{meta?.label} · {grade}</span>
          </div>
        </motion.div>

        {/* Subject + Chapter grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.7fr" }}>

          {/* Subjects */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={card}>
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>📖 SUBJECTS</p>
            <div className="flex flex-col gap-2">
              {Object.keys(subjects).map(sub => {
                const chs = subjects[sub];
                const done = chs.filter(c => completedCh[`${sub}::${c}`]).length;
                const pct = Math.round(done / chs.length * 100);
                const selected = selectedSub === sub;
                return (
                  <motion.button key={sub} whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedSub(selected ? null : sub)}
                    className="text-left rounded-xl px-3 py-2.5 cursor-pointer transition-all"
                    style={{
                      background: selected ? `${accent}1c` : (th.id === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"),
                      border: `1px solid ${selected ? accent + "55" : (th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.07)")}`,
                      color: selected ? accent : (th.id === "light" ? "#1e293b" : "#d4d4d8"),
                      fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: selected ? 700 : 500,
                    }}>
                    <div className="flex justify-between mb-1.5">
                      <span>{sub}</span>
                      <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, opacity: 0.7 }}>{pct}%</span>
                    </div>
                    <div className={`h-[3px] rounded-full ${th.trackBg}`}>
                      <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                        className="h-full rounded-full" style={{ background: accent }} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Chapters */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className={card} style={{ maxHeight: 390, overflowY: "auto" }}>
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 sticky top-0 pb-1 ${th.textMuted} ${th.surface}`} style={{ zIndex: 1 }}>
              📋 {selectedSub ? `CHAPTERS — ${selectedSub.toUpperCase()}` : "CHAPTERS (SELECT SUBJECT)"}
            </p>
            {!selectedSub ? (
              <div className={`text-center py-10 text-sm ${th.textMuted}`}>← Select a subject to load chapters</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {subjects[selectedSub].map((ch, i) => {
                  const key = `${selectedSub}::${ch}`;
                  const inTask = tasks.some(t => t.text === `${selectedSub} — ${ch}`);
                  const taskDone = tasks.find(t => t.text === `${selectedSub} — ${ch}` && t.done);
                  return (
                    <motion.button key={ch}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
                      whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
                      onClick={() => handleChapterClick(selectedSub, ch)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left cursor-pointer transition-all"
                      style={{
                        background: taskDone ? `${accent}16` : inTask ? `${accent}09` : (th.id === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)"),
                        border: `1px solid ${taskDone ? accent + "44" : inTask ? accent + "22" : (th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.05)")}`,
                        color: taskDone ? accent : (th.id === "light" ? "#334155" : "#d4d4d8"),
                        fontFamily: "Syne, sans-serif", fontSize: 12,
                      }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>
                        {taskDone ? "✅" : inTask ? "🔵" : "○"}
                      </span>
                      <span style={{ textDecoration: taskDone ? "line-through" : "none", opacity: taskDone ? 0.5 : 1 }}>{ch}</span>
                      {!inTask && (
                        <span className="ml-auto text-[9px] font-bold whitespace-nowrap" style={{ color: accent, opacity: 0.6 }}>+quest</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Daily Tasks / Quests */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={card}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className={`text-[10px] tracking-[.2em] uppercase ${th.textMuted}`}>⚔️ DAILY TASKS / QUESTS</p>
              <p className={`text-[11px] mt-1 ${th.textMuted}`}>
                {doneTasks}/{tasks.length} done · +{XP_PER_TASK} XP each · 🔥 {streak}-day streak
              </p>
            </div>
            {tasks.length > 0 && (
              <span className="font-rajdhani font-bold text-sm" style={{ color: doneTasks === tasks.length ? accent : (th.id === "light" ? "#94a3b8" : "#52525b") }}>
                {tasks.length ? Math.round(doneTasks / tasks.length * 100) : 0}%
              </span>
            )}
          </div>

          {/* TaskInput is memo'd at module scope — input focus is stable */}
          <div className="mb-3">
            <TaskInput onAdd={handleAddTask} accent={accent} th={th} />
          </div>

          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {tasks.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className={`text-center py-5 text-sm ${th.textMuted}`}>
                  No quests yet — add one above, or click a chapter to auto-insert 🗡️
                </motion.div>
              )}
              {tasks.map(t => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}
                  layout
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                  style={{
                    background: t.done ? `${accent}0e` : (th.id === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)"),
                    border: `1px solid ${t.done ? accent + "33" : (th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.06)")}`,
                  }}>
                  <motion.button whileTap={{ scale: 0.75 }} onClick={() => toggleTask(t.id)}
                    className="flex-shrink-0 cursor-pointer"
                    style={{ background: "none", border: "none", color: t.done ? accent : (th.id === "light" ? "#cbd5e1" : "#3f3f46"), padding: 0 }}>
                    {t.done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                  </motion.button>
                  <span className="flex-1 text-xs break-words"
                    style={{ fontFamily: "Syne, sans-serif", color: t.done ? (th.id === "light" ? "#94a3b8" : "#52525b") : (th.id === "light" ? "#1e293b" : "#e4e4e7"), textDecoration: t.done ? "line-through" : "none" }}>
                    {t.text}
                  </span>
                  {t.auto && !t.done && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}33` }}>syllabus</span>
                  )}
                  {t.done && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ color: accent, background: `${accent}18` }}>
                      +{XP_PER_TASK} XP
                    </motion.span>
                  )}
                  <button onClick={() => deleteTask(t.id)} className="flex-shrink-0 cursor-pointer opacity-40 hover:opacity-70 transition-opacity"
                    style={{ background: "none", border: "none", color: th.id === "light" ? "#94a3b8" : "#71717a", padding: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── TIMER PAGE ───────────────────────────────────────────────────────────────
  function TimerPage() {
    const phaseColor = phase === "break" ? "#4ade80" : accent;
    const progress = timerMode === "pomodoro" ? timerSec / totalDur : (swTime % 3600) / 3600;

    return (
      <div className="flex flex-col gap-5">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={card}>

          {/* Mode toggle */}
          <div className={`flex p-1 rounded-xl mb-7 max-w-xs mx-auto ${th.trackBg}`}>
            {["pomodoro", "stopwatch"].map(m => (
              <button key={m} onClick={() => switchTimerMode(m)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{
                  background: timerMode === m ? `${accent}28` : "transparent",
                  border: `1px solid ${timerMode === m ? accent + "55" : "transparent"}`,
                  color: timerMode === m ? accent : (th.id === "light" ? "#64748b" : "#71717a"),
                  fontFamily: "Syne, sans-serif",
                }}>
                {m === "pomodoro" ? "🍅 Pomodoro" : "⏱ Stopwatch"}
              </button>
            ))}
          </div>

          {/* Circle */}
          <div className="flex justify-center mb-6">
            <CircularTimer progress={progress} accent={phaseColor} size={240}>
              <p className="text-[10px] tracking-[.2em] uppercase mb-1" style={{ color: phaseColor }}>
                {timerMode === "pomodoro" ? (phase === "work" ? "FOCUS" : "BREAK") : "ELAPSED"}
              </p>
              <p className="font-rajdhani font-bold tracking-widest" style={{ fontSize: 54, color: th.id === "light" ? "#0f172a" : "#f4f4f5" }}>
                {timerMode === "pomodoro" ? fmtTime(timerSec) : fmtTime(swTime)}
              </p>
              {timerMode === "pomodoro" && (
                <p className={`text-[10px] mt-1 ${th.textMuted}`}>+{XP_PER_POMO} XP on complete</p>
              )}
            </CircularTimer>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-6">
            <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
              onClick={() => timerMode === "pomodoro" ? setRunning(r => !r) : setSwRun(r => !r)}
              className="flex items-center gap-2 px-10 py-3.5 rounded-full font-bold text-black cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 28px ${glow}`, fontFamily: "Syne, sans-serif", fontSize: 15 }}>
              {(timerMode === "pomodoro" ? running : swRun) ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93, rotate: -30 }}
              onClick={() => { setRunning(false); setSwRun(false); timerMode === "pomodoro" ? (setTimerSec(pomoDur * 60), setPhase("work")) : setSwTime(0); }}
              className={`flex items-center px-4 py-3.5 rounded-full cursor-pointer transition-colors ${th.hoverCard}`}
              style={{ border: `1px solid ${th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.1)"}`, background: "transparent", color: th.id === "light" ? "#64748b" : "#71717a" }}>
              <RotateCcw size={17} />
            </motion.button>
          </div>

          {/* Duration controls */}
          {timerMode === "pomodoro" && (
            <div className="flex gap-8 justify-center flex-wrap">
              {[{ label: "Focus (min)", val: pomoDur, set: v => { setPomoDur(v); if (!running) setTimerSec(v * 60); } },
                { label: "Break (min)", val: brkDur, set: setBrkDur }].map(({ label, val, set }) => (
                <div key={label} className="text-center">
                  <p className={`text-[10px] tracking-widest mb-2 ${th.textMuted}`}>{label.toUpperCase()}</p>
                  <div className="flex items-center gap-2">
                    {[{ sign: "−", fn: () => set(v => Math.max(1, v - 5)) }, null, { sign: "+", fn: () => set(v => Math.min(90, v + 5)) }].map((btn, i) =>
                      btn ? (
                        <button key={btn.sign} onClick={btn.fn}
                          className={`w-7 h-7 rounded-lg cursor-pointer transition-colors ${th.hoverCard}`}
                          style={{ border: `1px solid ${th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.1)"}`, background: "transparent", color: th.id === "light" ? "#0f172a" : "#f4f4f5", fontSize: 16 }}>
                          {btn.sign}
                        </button>
                      ) : (
                        <span key="val" className="font-rajdhani font-bold text-2xl min-w-[32px] text-center" style={{ color: accent }}>{val}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Study topic */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={card}>
          <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>🎯 CURRENTLY STUDYING</p>
          <select value={studyTopic} onChange={e => setStudyTopic(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all cursor-pointer"
            style={{ background: th.selectBg, border: `1px solid ${th.selectBdr}`, color: th.selectText, fontFamily: "Syne, sans-serif" }}>
            <option value="">— Select topic —</option>
            {Object.entries(subjects).map(([sub, chs]) => (
              <optgroup key={sub} label={sub} style={{ background: th.optBg }}>
                {chs.map(ch => <option key={ch} value={`${sub} — ${ch}`} style={{ background: th.optBg }}>{ch}</option>)}
              </optgroup>
            ))}
          </select>
        </motion.div>

        {/* Session log */}
        {sessions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={card}>
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>🏆 SESSION LOG</p>
            <div className="flex flex-col gap-2">
              {sessions.slice(-5).reverse().map((s, i) => (
                <div key={i} className="flex justify-between items-center rounded-xl px-3 py-2"
                  style={{ background: th.id === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)", border: `1px solid ${th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.05)"}` }}>
                  <div>
                    <p className={`text-xs ${th.text}`}>{s.subject}</p>
                    <p className={`text-[10px] font-mono ${th.textMuted}`}>{s.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-rajdhani font-bold text-sm" style={{ color: accent }}>{s.dur}m</p>
                    <p className={`text-[10px] ${th.textMuted}`}>+{XP_PER_POMO} XP</p>
                  </div>
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
    const barColors = [accent, "#f59e0b", "#e879f9", "#4ade80", "#f87171"];
    return (
      <div className="flex flex-col gap-5">

        {/* Level card */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          className={`${th.card} glass rounded-2xl border p-6 text-center`}
          style={{ background: `linear-gradient(135deg, ${accent}18, transparent)`, border: `1px solid ${accent}44`, boxShadow: `0 0 50px ${glow}` }}>
          <motion.div animate={{ rotate: [0, 6, -6, 0] }} transition={{ repeat: Infinity, duration: 4 }} style={{ fontSize: 52, marginBottom: 6 }}>🏆</motion.div>
          <p className="font-rajdhani font-bold" style={{ fontSize: 50, color: accent }}>{level}</p>
          <p className={`text-sm mb-4 ${th.textMuted}`}>Current Level</p>
          <div className={`h-2 rounded-full overflow-hidden max-w-xs mx-auto ${th.trackBg}`}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, xp / (XP_PER_LEVEL * level) * 100)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full rounded-full xp-shimmer"
              style={{ background: `linear-gradient(90deg, ${accent}, #818cf8, ${accent})` }} />
          </div>
          <p className={`text-xs mt-2 font-mono ${th.textMuted}`}>{xp} / {XP_PER_LEVEL * level} XP → Level {level + 1}</p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[{ ico: "📚", val: doneCh, label: "Chapters" }, { ico: "⚔️", val: doneTasks, label: "Tasks Done" }, { ico: "🍅", val: sessions.length, label: "Sessions" }].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className={`${card} text-center`}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.ico}</div>
              <p className="font-rajdhani font-bold" style={{ fontSize: 30, color: accent }}>{s.val}</p>
              <p className={`text-[10px] tracking-widest ${th.textMuted}`}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Subject breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={card}>
          <p className={`text-[10px] tracking-[.2em] uppercase mb-4 ${th.textMuted}`}>📊 SUBJECT BREAKDOWN</p>
          <div className="flex flex-col gap-4">
            {Object.entries(subjects).map(([sub, chs], i) => {
              const d = chs.filter(c => completedCh[`${sub}::${c}`]).length;
              const pct = Math.round(d / chs.length * 100);
              const bc = barColors[i % barColors.length];
              return (
                <motion.div key={sub} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                  <div className="flex justify-between mb-2">
                    <span className={`text-sm font-semibold ${th.text}`}>{sub}</span>
                    <span className="font-rajdhani font-bold text-xs" style={{ color: bc, fontFamily: "DM Mono, monospace" }}>{d}/{chs.length} · {pct}%</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${th.trackBg}`}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                      className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${bc}, ${bc}99)`, boxShadow: `0 0 10px ${bc}55` }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className={card}>
          <p className={`text-[10px] tracking-[.2em] uppercase mb-4 ${th.textMuted}`}>🏅 ACHIEVEMENTS</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { ico: "🔥", label: "First Blood",   desc: "Complete 1 chapter",  ok: doneCh >= 1 },
              { ico: "⚡", label: "On Fire",        desc: "Complete 5 chapters", ok: doneCh >= 5 },
              { ico: "🎯", label: "Quest Master",   desc: "Finish 5 tasks",      ok: doneTasks >= 5 },
              { ico: "🍅", label: "Pomo Pro",       desc: "Log 3 sessions",      ok: sessions.length >= 3 },
              { ico: "⭐", label: "Rising Star",    desc: "Reach Level 2",       ok: level >= 2 },
              { ico: "💎", label: "Diamond Mind",   desc: "50% syllabus done",   ok: overallPct >= 50 },
            ].map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                className="rounded-xl p-3"
                style={{
                  background: a.ok ? `${accent}12` : (th.id === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)"),
                  border: `1px solid ${a.ok ? accent + "33" : (th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.05)")}`,
                  opacity: a.ok ? 1 : 0.42,
                }}>
                <div style={{ fontSize: 22, marginBottom: 3 }}>{a.ok ? a.ico : "🔒"}</div>
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
      <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
        className={`absolute right-0 top-12 z-[200] ${th.modalBg} glass rounded-2xl p-5 w-52`}
        style={{ border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 50px rgba(0,0,0,.6)" }}>
        <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.textMuted}`}>🎨 THEME ENGINE</p>

        {/* Dark / Light / Neon */}
        <div className="flex gap-1.5 mb-4">
          {Object.values(THEMES).map(t => (
            <button key={t.id} onClick={() => setThemeId(t.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: themeId === t.id ? `${accent}22` : "transparent",
                border: `1px solid ${themeId === t.id ? accent + "55" : "rgba(255,255,255,0.08)"}`,
                color: themeId === t.id ? accent : "#71717a",
                fontFamily: "Syne, sans-serif",
              }}>
              {t.id === "dark" ? "🌙" : t.id === "light" ? "☀️" : "⚡"}
            </button>
          ))}
        </div>

        {/* Per-exam accent switch */}
        <p className={`text-[10px] tracking-widest mb-2 ${th.textMuted}`}>SWITCH EXAM / ACCENT</p>
        {Object.entries(EXAM_META).map(([key, m]) => (
          <button key={key} onClick={() => { switchExam(key); setShowThemePanel(false); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-1 cursor-pointer transition-all"
            style={{
              background: exam === key ? `${m.accent}18` : "transparent",
              border: `1px solid ${exam === key ? m.accent + "44" : "rgba(255,255,255,0.06)"}`,
              color: exam === key ? m.accent : "#71717a",
              fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: exam === key ? 700 : 400,
            }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: m.accent, flexShrink: 0, boxShadow: `0 0 8px ${m.accent}` }} />
            {m.label}
            {exam === key && <CheckCircle2 size={12} style={{ marginLeft: "auto", color: m.accent }} />}
          </button>
        ))}
      </motion.div>
    );
  }

  // ─── ROOT LAYOUT ─────────────────────────────────────────────────────────────
  const pageMap = { dashboard: <DashboardPage />, timer: <TimerPage />, progress: <ProgressPage /> };
  const titleMap = { dashboard: "Dashboard", timer: "Focus Timer", progress: "Progress" };

  return (
    <div className={`${th.bg} min-h-screen transition-colors duration-300`}
      style={{ background: th.id === "neon" ? `radial-gradient(ellipse at 70% 0%, ${glow}, #000 55%)` : undefined }}>

      <Sidebar />

      <main style={{ marginLeft: 62, minHeight: "100vh" }}>

        {/* Top bar */}
        <div className={`${th.topbar} glass sticky top-0 z-50 border-b px-6 py-3.5 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <h1 className={`font-rajdhani font-bold tracking-wide text-xl ${th.text}`}>{titleMap[page]}</h1>

            {/* Exam name badge — click to open exam switcher modal */}
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => setShowExamModal(true)}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full cursor-pointer"
              style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}44`, fontFamily: "Syne, sans-serif", letterSpacing: 1 }}>
              {meta?.label}
              <ChevronDown size={11} />
            </motion.button>
          </div>

          <div className="flex items-center gap-2.5 relative">
            {/* Streak */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: th.id === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)", border: `1px solid ${th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.08)"}` }}>
              <Flame size={13} color="#f59e0b" />
              <span className="font-rajdhani font-bold text-xs" style={{ color: "#f59e0b" }}>{streak}d</span>
            </div>
            {/* XP */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: `${accent}18`, border: `1px solid ${accent}44` }}>
              <Zap size={13} color={accent} />
              <span className="font-rajdhani font-bold text-xs" style={{ color: accent }}>{xp} XP</span>
            </div>
            {/* Theme toggle */}
            <motion.button whileHover={{ scale: 1.08, rotate: 30 }} whileTap={{ scale: 0.93 }}
              onClick={() => setShowThemePanel(o => !o)}
              className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              style={{
                background: showThemePanel ? `${accent}22` : (th.id === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"),
                border: `1px solid ${showThemePanel ? accent + "55" : (th.id === "light" ? "#e2e8f0" : "rgba(255,255,255,0.08)")}`,
                color: showThemePanel ? accent : (th.id === "light" ? "#64748b" : "#71717a"),
              }}>
              <Palette size={15} />
            </motion.button>

            <AnimatePresence>{showThemePanel && <ThemePanel />}</AnimatePresence>
          </div>
        </div>

        {/* Click-away overlay for theme panel */}
        {showThemePanel && <div className="fixed inset-0 z-[49]" onClick={() => setShowThemePanel(false)} />}

        {/* Page content */}
        <div className="p-6 max-w-[900px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.22 }}>
              {pageMap[page]}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Exam switcher modal */}
      {showExamModal && <ExamModal currentExam={exam} onSelect={switchExam} onClose={() => setShowExamModal(false)} th={th} />}

      {/* Level-up toast */}
      {levelUpData && <LevelUpToast level={levelUpData} accent={accent} onDone={() => setLevelUpData(null)} />}
    </div>
  );
}
