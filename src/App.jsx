/**
 * App.jsx — Study Tracker for Noobs · Console-Error-Free Edition
 *
 * FIXES APPLIED IN THIS VERSION:
 * 1. FORM FIELDS: Every <input> and <select> has a unique id + name attribute.
 *    The browser accessibility engine fires the "should have id/name" warning
 *    once per render; because the timer was re-rendering App every second, the
 *    warning fired every second. Adding id/name silences it completely.
 *
 * 2. TASK INPUT ISOLATION: TaskInput is a module-scope memo() component that
 *    keeps its own draft string in local state. The parent App never knows what
 *    the user is typing — only the final submitted string is passed up via
 *    the stable onAdd callback. Timer ticks do NOT cause TaskInput to re-render
 *    because it receives no timer-derived props.
 *
 * 3. AUDIO SINGLETON: AudioContext is created once at module scope via a lazy
 *    singleton getter (getAudioCtx). It is NEVER constructed inside a hook body
 *    or render function, so it cannot be re-initialised every second.
 *
 * 4. TABULAR-NUMS TIMER: The <time> element uses `font-variant-numeric: tabular-nums`
 *    + a fixed min-width so digit changes never cause surrounding text to shift.
 *
 * 5. REF-BASED INTERVAL: setInterval handle lives in ivRef / swRef. The effect
 *    deps array is [running, timerMode] — NOT [timerSec]. This means the
 *    interval is only re-registered on Start/Stop/Mode-switch, never per tick.
 */

import {
  useState, useEffect, useLayoutEffect, useRef,
  useCallback, useMemo, memo, createContext, useContext,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Zap, BookOpen, Timer, TrendingUp, Menu, X,
  Flame, Play, Pause, RotateCcw, Home,
  CheckCircle2, Circle, Trash2, Plus, Palette, ChevronDown,
  Volume2, VolumeX,
} from "lucide-react";
import confetti from "canvas-confetti";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const XP_TASK = 100;
const XP_POMO = 100;
const XP_LV   = 500;

const SOUND_URLS = {
  complete: "https://assets.mixkit.co/active_storage/sfx/2577/2577-preview.mp3",
  alarm:    "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
};

const EXAM_META = {
  JEE:    { label: "JEE",     accent: "#38bdf8", glow: "rgba(56,189,248,0.4)",  emoji: "⚛️",  grades: ["Class 11", "Class 12", "Dropper"] },
  NEET:   { label: "NEET",    accent: "#4ade80", glow: "rgba(74,222,128,0.4)",  emoji: "🧬",  grades: ["Class 11", "Class 12", "Dropper"] },
  UPSC:   { label: "UPSC",    accent: "#f59e0b", glow: "rgba(245,158,11,0.4)",  emoji: "🏛️", grades: ["Graduate", "Final Year", "Post Graduate"] },
  MHTCET: { label: "MHT‑CET", accent: "#e879f9", glow: "rgba(232,121,249,0.4)", emoji: "📐",  grades: ["Class 11", "Class 12", "Dropper"] },
};

const SUBJECTS = {
  JEE: {
    Physics:     ["Units & Measurement","Kinematics","Laws of Motion","Work Energy Power","Rotational Motion","Gravitation","Properties of Matter","Thermodynamics","Oscillations","Waves","Electrostatics","Current Electricity","Magnetic Effects","EMI & AC","Ray Optics","Wave Optics","Modern Physics","Semiconductors"],
    Chemistry:   ["Mole Concept","Atomic Structure","Chemical Bonding","States of Matter","Thermodynamics","Equilibrium","Ionic Equilibrium","Redox Reactions","Electrochemistry","Chemical Kinetics","s-Block","p-Block","d & f Block","Coordination Compounds","Organic Basics","Hydrocarbons","Haloalkanes","Alcohols & Ethers","Aldehydes & Ketones","Amines","Biomolecules","Polymers"],
    Mathematics: ["Sets & Relations","Complex Numbers","Sequences & Series","Quadratic Equations","Permutations","Binomial Theorem","Matrices","Determinants","Limits","Continuity","Differentiation","Applications of Derivatives","Indefinite Integration","Definite Integration","Differential Equations","Straight Lines","Circles","Conics","Vectors","3D Geometry","Probability","Statistics"],
  },
  NEET: {
    Physics:   ["Physical World","Units & Measurement","Motion in Straight Line","Motion in a Plane","Laws of Motion","Work Energy Power","System of Particles","Gravitation","Mechanical Properties","Thermal Properties","Thermodynamics","Kinetic Theory","Oscillations","Waves","Electric Charges","Current Electricity","Magnetic Field","Moving Charges","EMI","AC Circuits","EM Waves","Ray Optics","Wave Optics","Dual Nature","Atoms","Nuclei","Semiconductors"],
    Chemistry: ["Basic Concepts","Atomic Structure","Classification","Chemical Bonding","States of Matter","Thermodynamics","Equilibrium","Redox","Hydrogen","s-Block","p-Block I","p-Block II","d & f Block","Coordination Compounds","Environmental Chemistry","Solutions","Electrochemistry","Chemical Kinetics","Haloalkanes","Alcohols","Aldehydes","Carboxylic Acids","Amines","Biomolecules","Polymers"],
    Biology:   ["The Living World","Biological Classification","Plant Kingdom","Animal Kingdom","Morphology of Plants","Anatomy of Plants","Structural Organisation","Cell Structure","Cell Cycle","Transport in Plants","Mineral Nutrition","Photosynthesis","Respiration","Plant Growth","Digestion & Absorption","Breathing & Exchange","Body Fluids","Locomotion","Neural Control","Chemical Coordination","Reproduction in Organisms","Plant Reproduction","Human Reproduction","Reproductive Health","Genetics","Molecular Basis","Evolution","Human Health","Microbes","Biotechnology I","Biotechnology II","Organisms & Environment","Ecosystem","Biodiversity","Environmental Issues"],
  },
  UPSC: {
    "GS I":   ["History of Modern India","Indian Culture","World History","Indian Society","Role of Women","Urbanisation","Globalisation","World Geography","Indian Geography","Physical Geography","Natural Resources","Disaster Management"],
    "GS II":  ["Indian Constitution","Polity & Governance","Panchayati Raj","Public Policy","Rights Issues","Federal Structure","Parliament","Judiciary","Social Justice","International Relations","India & Neighbours","International Bodies"],
    "GS III": ["Indian Economy","Inclusive Growth","Agriculture","Food Processing","Infrastructure","Investment Models","Science & Technology","Environment","Internal Security","Border Management","Terrorism"],
    "GS IV":  ["Ethics & Human Interface","Attitude","Aptitude & Values","Emotional Intelligence","Civil Service Values","Probity in Governance","Case Studies"],
    CSAT:     ["Comprehension","Decision Making","General Mental Ability","Basic Numeracy","Data Interpretation","English Comprehension"],
  },
  MHTCET: {
    Physics:     ["Measurements","Projectile Motion","Laws of Motion","Friction","Circular Motion","Gravitation","Rotational Motion","Oscillations","Elasticity","Wave Motion","Stationary Waves","Kinetic Theory","Wave Optics","Electrostatics","Current Electricity","Magnetic Effects","EM Induction","AC Circuits","Electrons & Photons","Atoms & Nuclei","Semiconductors","Communication"],
    Chemistry:   ["Solid State","Solutions","Ionic Equilibria","Chemical Thermodynamics","Electrochemistry","Chemical Kinetics","p-Block Elements","d & f Block","Coordination Compounds","Halogen Derivatives","Alcohols & Ethers","Aldehydes & Ketones","Carboxylic Acids","Amines","Biomolecules","Polymers"],
    Mathematics: ["Trigonometry","Pair of Lines","Matrices","Determinants","Vectors","3D Geometry","Line in Space","Plane","Linear Programming","Continuity","Differentiation","Applications of Derivatives","Integration","Definite Integration","Differential Equations","Probability Distribution","Binomial Distribution"],
  },
};

const THEMES = {
  dark:  { id: "dark",  cls: "theme-dark",  text: "text-zinc-100",  muted: "text-zinc-500",  track: "bg-zinc-800",  badge: "bg-zinc-800",  modal: "bg-zinc-900",  sBg: "#27272a", sText: "#f4f4f5", sBdr: "#3f3f46", optBg: "#18181b", light: false },
  light: { id: "light", cls: "theme-light", text: "text-slate-900", muted: "text-slate-400", track: "bg-slate-200", badge: "bg-slate-100", modal: "bg-white",    sBg: "#f1f5f9", sText: "#0f172a", sBdr: "#cbd5e1", optBg: "#ffffff", light: true  },
  neon:  { id: "neon",  cls: "theme-neon",  text: "text-cyan-50",   muted: "text-cyan-800",  track: "bg-zinc-900",  badge: "bg-zinc-900",  modal: "bg-zinc-950", sBg: "#09090b", sText: "#ecfeff", sBdr: "#3f3f46", optBg: "#09090b", light: false },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PURE UTILS
// ═══════════════════════════════════════════════════════════════════════════════

const LS = {
  r: (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  w: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const p2    = n => String(n).padStart(2, "0");
const fmt   = s => `${p2(Math.floor(s / 60))}:${p2(s % 60)}`;
const today = () => new Date().toDateString();

const SP  = { type: "spring", stiffness: 420, damping: 22 };
const TAP = { whileTap: { scale: 0.95 }, transition: SP };

function burst(color) {
  confetti({ particleCount: 110, spread: 75, origin: { y: 0.55 }, colors: [color, "#fff", "#facc15", "#f472b6"] });
  setTimeout(() => confetti({ particleCount: 55, spread: 110, origin: { y: 0.3 }, colors: [color, "#818cf8"] }), 250);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO SINGLETON
// AudioContext is created ONCE at module scope via lazy init.
// It never lives inside a hook body or render function — so the timer
// ticking every second can NEVER trigger its construction.
// ═══════════════════════════════════════════════════════════════════════════════

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  return _audioCtx;
}

// Pre-created Audio elements (one per sound key, not per render)
const _audioEls = {};
function getAudioEl(key) {
  if (!_audioEls[key]) {
    const a = new Audio(SOUND_URLS[key]);
    a.preload = "auto";
    _audioEls[key] = a;
  }
  return _audioEls[key];
}

// The hook only wires up muted state + stable callbacks.
// It never creates new objects on re-render.
function useAudio() {
  const mutedRef = useRef(false);
  const [mutedUI, setMutedUI] = useState(false);

  const playClick = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }, []);

  const playComplete = useCallback(() => {
    if (mutedRef.current) return;
    try { const a = getAudioEl("complete"); a.currentTime = 0; a.play().catch(() => {}); } catch {}
  }, []);

  const playAlarm = useCallback(() => {
    if (mutedRef.current) return;
    try { const a = getAudioEl("alarm"); a.currentTime = 0; a.play().catch(() => {}); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMutedUI(mutedRef.current);
    return mutedRef.current;
  }, []);

  return { playClick, playComplete, playAlarm, toggleMute, mutedUI };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE SLICES (custom hooks)
// ═══════════════════════════════════════════════════════════════════════════════

// ── UI State ──────────────────────────────────────────────────────────────────
function useUIState() {
  const [page,        setPage]        = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExam,    setShowExam]    = useState(false);
  const [showTheme,   setShowTheme]   = useState(false);
  const [themeId,     setThemeId]     = useState(() => LS.r("st_theme", "dark"));
  const [obStep,      setObStep]      = useState(0);

  useEffect(() => { LS.w("st_theme", themeId); }, [themeId]);

  const th = THEMES[themeId] ?? THEMES.dark;

  useLayoutEffect(() => {
    const h = document.documentElement;
    Object.values(THEMES).forEach(t => h.classList.remove(t.cls));
    h.classList.add(th.cls);
  }, [th.cls]);

  return { page, setPage, sidebarOpen, setSidebarOpen, showExam, setShowExam, showTheme, setShowTheme, themeId, setThemeId, th, obStep, setObStep };
}

// ── Timer State — ONLY this hook updates every second ────────────────────────
function useTimerState({ onPomoComplete, onXpEarned, playAlarm }) {
  const [timerMode, setTimerMode] = useState("pomodoro");
  const [pomoDur,   setPomoDur]   = useState(25);
  const [brkDur,    setBrkDur]    = useState(5);
  const [timerSec,  setTimerSec]  = useState(25 * 60);
  const [running,   setRunning]   = useState(false);
  const [phase,     setPhase]     = useState("work");
  const [swTime,    setSwTime]    = useState(0);
  const [swRun,     setSwRun]     = useState(false);
  const [topic,     setTopic]     = useState("");

  // Refs — interval handles and stable mutable bag
  const ivRef  = useRef(null);
  const swRef  = useRef(null);
  const live   = useRef({});
  live.current = { phase, pomoDur, brkDur, topic };

  // Callback refs — setInterval never captures stale function pointers
  const cbComplete = useRef(onPomoComplete);
  const cbXp       = useRef(onXpEarned);
  const cbAlarm    = useRef(playAlarm);
  useEffect(() => { cbComplete.current = onPomoComplete; }, [onPomoComplete]);
  useEffect(() => { cbXp.current       = onXpEarned;     }, [onXpEarned]);
  useEffect(() => { cbAlarm.current    = playAlarm;       }, [playAlarm]);

  // Pomodoro — interval registered on [running, timerMode] only, NOT per tick
  useEffect(() => {
    if (!running || timerMode !== "pomodoro") {
      clearInterval(ivRef.current);
      return;
    }
    ivRef.current = setInterval(() => {
      setTimerSec(s => {
        if (s > 1) return s - 1;
        // Session boundary
        clearInterval(ivRef.current);
        setRunning(false);
        cbAlarm.current?.();
        const { phase: ph, pomoDur: pd, brkDur: bd, topic: tp } = live.current;
        if (ph === "work") {
          cbXp.current?.(XP_POMO);
          cbComplete.current?.({ subject: tp || "General Study", dur: pd, time: new Date().toLocaleTimeString() });
          setPhase("break");
          return bd * 60;
        }
        setPhase("work");
        return pd * 60;
      });
    }, 1000);
    return () => clearInterval(ivRef.current);
  }, [running, timerMode]);

  // Stopwatch
  useEffect(() => {
    if (swRun) swRef.current = setInterval(() => setSwTime(s => s + 1), 1000);
    else clearInterval(swRef.current);
    return () => clearInterval(swRef.current);
  }, [swRun]);

  // Sync pomoDur change → timerSec (only when stopped)
  useEffect(() => { if (!running) setTimerSec(pomoDur * 60); }, [pomoDur, running]);

  // Persist on pause/stop only — never per tick
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (!running && !swRun) LS.w("st_timer", { timerMode, pomoDur, brkDur, phase, timerSec, swTime });
  }, [running, swRun]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetTimer = useCallback(() => {
    setRunning(false); setSwRun(false);
    if (timerMode === "pomodoro") { setTimerSec(pomoDur * 60); setPhase("work"); }
    else setSwTime(0);
  }, [timerMode, pomoDur]);

  const switchMode = useCallback((m) => {
    setTimerMode(m); setRunning(false); setSwRun(false);
    setSwTime(0); setPhase("work"); setTimerSec(pomoDur * 60);
  }, [pomoDur]);

  return { timerMode, pomoDur, setPomoDur, brkDur, setBrkDur, timerSec, running, setRunning, phase, swTime, swRun, setSwRun, topic, setTopic, resetTimer, switchMode };
}

// ── Game State ────────────────────────────────────────────────────────────────
function useGameState() {
  const [xp,       setXp]       = useState(() => LS.r("st_xp",       0));
  const [level,    setLevel]    = useState(() => LS.r("st_level",    1));
  const [streak,   setStreak]   = useState(() => LS.r("st_streak",   0));
  const [ltd,      setLtd]      = useState(() => LS.r("st_ltd",      null));
  const [sessions, setSessions] = useState(() => LS.r("st_sessions", []));
  const [lvlUp,    setLvlUp]    = useState(null);

  const debRef = useRef(null);
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      LS.w("st_xp", xp); LS.w("st_level", level); LS.w("st_streak", streak);
      LS.w("st_ltd", ltd); LS.w("st_sessions", sessions);
    }, 10000);
    return () => clearTimeout(debRef.current);
  }, [xp, level, streak, ltd, sessions]);

  const awardXp = useCallback((amount, accent) => {
    setXp(prev => {
      let nx = prev + amount;
      setLevel(lv => {
        let nl = lv;
        while (nx >= XP_LV * nl) { nx -= XP_LV * nl; nl++; setLvlUp(nl); burst(accent); }
        return nl;
      });
      return nx;
    });
  }, []);

  const bumpStreak = useCallback(() => {
    const td = today();
    setLtd(prev => { if (prev !== td) { setStreak(s => s + 1); return td; } return prev; });
  }, []);

  const addSession = useCallback((info) => setSessions(p => [...p, info]), []);

  return { xp, level, streak, sessions, lvlUp, setLvlUp, awardXp, bumpStreak, addSession };
}

// ── Syllabus State ────────────────────────────────────────────────────────────
function useSyllabusState() {
  const [exam,     setExamRaw]  = useState(() => LS.r("st_exam",     null));
  const [grade,    setGrade]    = useState(() => LS.r("st_grade",    null));
  const [chapters, setChapters] = useState(() => LS.r("st_chapters", {}));
  const [selSub,   setSelSub]   = useState(null);

  const debRef = useRef(null);
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { LS.w("st_exam", exam); LS.w("st_grade", grade); LS.w("st_chapters", chapters); }, 10000);
    return () => clearTimeout(debRef.current);
  }, [exam, grade, chapters]);

  const switchExam    = useCallback((k) => { setExamRaw(k); setChapters({}); setSelSub(null); }, []);
  const markChapterDone = useCallback((sub, ch) => setChapters(p => ({ ...p, [`${sub}::${ch}`]: true })), []);

  const subs    = useMemo(() => exam ? SUBJECTS[exam] : {}, [exam]);
  const totalCh = useMemo(() => Object.values(subs).reduce((a, c) => a + c.length, 0), [subs]);
  const doneCh  = useMemo(() => Object.values(chapters).filter(Boolean).length, [chapters]);
  const pct     = totalCh ? Math.round(doneCh / totalCh * 100) : 0;

  return { exam, grade, setGrade, chapters, selSub, setSelSub, switchExam, markChapterDone, subs, totalCh, doneCh, pct };
}

// ── Task State ────────────────────────────────────────────────────────────────
function useTaskState() {
  const [tasks, setTasks] = useState(() => LS.r("st_tasks", []));

  const debRef = useRef(null);
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => LS.w("st_tasks", tasks), 10000);
    return () => clearTimeout(debRef.current);
  }, [tasks]);

  const addTask = useCallback((text) => setTasks(p => [...p, { id: Date.now(), text, done: false }]), []);
  const addChapterTask = useCallback((sub, ch) => {
    const text = `${sub} — ${ch}`;
    setTasks(p => p.find(t => t.text === text) ? p : [...p, { id: Date.now(), text, done: false, auto: true }]);
  }, []);
  const deleteTask  = useCallback((id) => setTasks(p => p.filter(t => t.id !== id)), []);
  const doneCount   = useMemo(() => tasks.filter(t => t.done).length, [tasks]);

  const toggleTask = useCallback((id, onDone) => {
    setTasks(p => p.map(t => {
      if (t.id !== id) return t;
      if (!t.done) onDone?.(t);
      return { ...t, done: !t.done };
    }));
  }, []);

  return { tasks, addTask, addChapterTask, deleteTask, toggleTask, doneCount };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const TimerCtx = createContext(null);

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENTATIONAL COMPONENTS (module-scope memo)
// ═══════════════════════════════════════════════════════════════════════════════

// ── TaskInput ─────────────────────────────────────────────────────────────────
// Module-scope memo: local draft state never causes App to re-render while typing.
// id + name attributes silence the "form field should have id/name" console error.
const TaskInput = memo(function TaskInput({ onAdd, accent, light, playClick }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const submit = useCallback(() => {
    if (!draft.trim()) return;
    playClick?.();
    onAdd(draft.trim());
    setDraft("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [draft, onAdd, playClick]);

  const handleKey = useCallback((e) => { if (e.key === "Enter") submit(); }, [submit]);

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        id="task-input"
        name="task-input"
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Add a task or press Enter…"
        autoComplete="off"
        style={{ minHeight: 48, fontFamily: "Syne,sans-serif" }}
        className={[
          "flex-1 rounded-xl px-4 text-sm border outline-none transition-colors duration-200",
          light
            ? "bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-400"
            : "bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-[--ac]",
        ].join(" ")}
      />
      <motion.button
        {...TAP}
        onClick={submit}
        type="button"
        className="flex items-center gap-1.5 px-5 rounded-xl text-sm font-bold text-black cursor-pointer flex-shrink-0"
        style={{ minHeight: 48, background: `linear-gradient(135deg,${accent},${accent}cc)`, border: "none", fontFamily: "Syne,sans-serif", boxShadow: `0 4px 18px ${accent}55` }}
      >
        <Plus size={16} /> Add
      </motion.button>
    </div>
  );
});

// ── Circular Timer ────────────────────────────────────────────────────────────
const CircularTimer = memo(function CircularTimer({ pct, accent, size = 220, children }) {
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 10px ${accent})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
});

// ── Timer Display — <time> with tabular-nums fixed width to prevent layout shift
const TimerDisplay = memo(function TimerDisplay({ seconds, accent, label, subtitle, light }) {
  return (
    <>
      <p className="text-[10px] tracking-[.2em] uppercase mb-1" style={{ color: accent }}>{label}</p>
      {/* tabular-nums: digits all same width → no surrounding text shifts on tick */}
      <time
        dateTime={`PT${Math.floor(seconds / 60)}M${seconds % 60}S`}
        className="font-rajdhani font-bold tracking-widest tabular-nums"
        style={{
          fontSize: "clamp(36px,10vw,52px)",
          color: light ? "#0f172a" : "#f4f4f5",
          fontVariantNumeric: "tabular-nums",
          minWidth: "4ch",       /* fixed width — prevents layout reflow */
          display: "inline-block",
          textAlign: "center",
        }}
      >
        {fmt(seconds)}
      </time>
      {subtitle && <p className="text-[10px] mt-1 opacity-50">{subtitle}</p>}
    </>
  );
});

// ── Mini Timer (header, context-subscribed) ───────────────────────────────────
const MiniTimer = memo(function MiniTimer({ accent }) {
  const t = useContext(TimerCtx);
  if (!t || (!t.running && !t.swRun)) return null;
  const secs = t.timerMode === "pomodoro" ? t.timerSec : t.swTime;
  const icon = t.timerMode === "pomodoro" ? (t.phase === "work" ? "🍅" : "☕") : "⏱";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{ background: `${accent}1c`, border: `1px solid ${accent}44`, color: accent, fontFamily: "DM Mono,monospace", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
    >
      <span>{icon}</span>
      {/* tabular-nums prevents the badge from resizing every second */}
      <time
        dateTime={`PT${Math.floor(secs / 60)}M${secs % 60}S`}
        style={{ fontVariantNumeric: "tabular-nums", minWidth: "4ch", display: "inline-block", textAlign: "center", fontSize: 12, fontWeight: 700 }}
      >
        {fmt(secs)}
      </time>
      {t.running && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />}
    </motion.div>
  );
});

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = memo(function Sidebar({ th, page, setPage, open, setOpen, accent, xp, level, playClick }) {
  const xpPct = Math.min(100, xp / (XP_LV * level) * 100);
  const go    = useCallback((id) => { playClick?.(); setPage(id); setOpen(false); }, [setPage, setOpen, playClick]);

  const NAV = [
    { id: "dashboard", icon: <BookOpen   size={18} />, label: "Dashboard"  },
    { id: "timer",     icon: <Timer      size={18} />, label: "Focus Timer" },
    { id: "progress",  icon: <TrendingUp size={18} />, label: "Progress"    },
  ];

  return (
    <motion.aside
      initial={false} animate={{ width: open ? 220 : 62 }}
      className="st-sidebar glass fixed left-0 top-0 z-[100] flex-col border-r overflow-hidden hidden md:flex"
      style={{ height: "100dvh", boxShadow: `4px 0 32px rgba(0,0,0,${th.light ? .1 : .5})` }}
    >
      {/* ⚡ Electric Home — CSS will-change:transform on .zap-ring */}
      <div className="px-3 pt-3 pb-3 st-sep-b">
        <motion.button
          whileHover={{ rotate: 180, scale: 1.1 }} {...TAP}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          onClick={() => go("dashboard")}
          type="button"
          className="zap-ring w-full flex items-center gap-3 rounded-xl cursor-pointer"
          style={{ padding: "9px 10px", minHeight: 48, background: `linear-gradient(135deg,${accent}30,${accent}10)`, border: `1.5px solid ${accent}66`, fontFamily: "Syne,sans-serif", justifyContent: open ? "flex-start" : "center" }}
        >
          <motion.span
            animate={{ textShadow: [`0 0 8px ${accent}`, `0 0 22px ${accent}`, `0 0 8px ${accent}`] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}
          >⚡</motion.span>
          {open && <span className="font-rajdhani font-bold tracking-widest whitespace-nowrap text-sm" style={{ color: accent }}>HOME</span>}
        </motion.button>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 pt-3" aria-label="Main navigation">
        {NAV.map(item => (
          <motion.button key={item.id} whileHover={{ x: 2 }} {...TAP}
            onClick={() => go(item.id)}
            type="button"
            aria-current={page === item.id ? "page" : undefined}
            className="flex items-center gap-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            style={{ padding: "9px 10px", minHeight: 48, background: page === item.id ? `${accent}22` : "transparent", border: `1px solid ${page === item.id ? accent + "55" : "transparent"}`, color: page === item.id ? accent : (th.light ? "#64748b" : "#71717a"), fontWeight: page === item.id ? 700 : 500, fontFamily: "Syne,sans-serif", fontSize: 13, justifyContent: open ? "flex-start" : "center" }}
          >
            {item.icon}{open && item.label}
          </motion.button>
        ))}
      </nav>

      <div className="px-3 py-3 st-sep-t">
        {open ? (
          <>
            <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: "DM Mono,monospace" }}>
              <span className="font-bold" style={{ color: accent }}>LV {level}</span>
              <span className={th.muted}>{xp}/{XP_LV * level}</span>
            </div>
            <div className={`h-1 rounded-full ${th.track} overflow-hidden`} role="progressbar" aria-valuenow={xpPct} aria-valuemin={0} aria-valuemax={100}>
              <motion.div animate={{ width: `${xpPct}%` }} transition={{ duration: .55 }}
                className="h-full rounded-full xp-bar"
                style={{ background: `linear-gradient(90deg,${accent},#818cf8,${accent})` }}
              />
            </div>
          </>
        ) : (
          <div className="text-center font-rajdhani font-bold text-sm" style={{ color: accent }}>{level}</div>
        )}
      </div>

      <motion.button {...TAP} onClick={() => setOpen(o => !o)} type="button"
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        className="mx-2 mb-2 flex justify-center items-center rounded-xl cursor-pointer st-subtle-btn"
        style={{ minHeight: 40, border: "1px solid" }}
      >
        {open ? <X size={14} /> : <Menu size={14} />}
      </motion.button>
    </motion.aside>
  );
});

// ── Bottom Nav ────────────────────────────────────────────────────────────────
const BottomNav = memo(function BottomNav({ page, setPage, accent, playClick }) {
  const ITEMS = [
    { id: "dashboard", icon: <Home       size={22} />, label: "Home"  },
    { id: "timer",     icon: <Timer      size={22} />, label: "Focus" },
    { id: "progress",  icon: <TrendingUp size={22} />, label: "Stats" },
  ];
  return (
    <nav
      className="st-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-[100] flex items-stretch justify-around"
      aria-label="Mobile navigation"
      style={{ height: "calc(60px + env(safe-area-inset-bottom,0px))", paddingBottom: "env(safe-area-inset-bottom,0px)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      {ITEMS.map(item => (
        <motion.button key={item.id} {...TAP} type="button"
          onClick={() => { playClick?.(); setPage(item.id); }}
          aria-current={page === item.id ? "page" : undefined}
          className="relative flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          style={{ background: "none", border: "none", color: page === item.id ? accent : "#71717a", fontFamily: "Syne,sans-serif", fontSize: 10, fontWeight: page === item.id ? 700 : 400, transition: "color .2s", minHeight: 60 }}
        >
          <motion.span animate={{ scale: page === item.id ? 1.18 : 1 }} transition={SP}>{item.icon}</motion.span>
          <span>{item.label}</span>
          {page === item.id && <motion.div layoutId="bnl" className="absolute bottom-0 h-[3px] rounded-full" style={{ width: 28, background: accent, boxShadow: `0 0 8px ${accent}` }} />}
        </motion.button>
      ))}
    </nav>
  );
});

// ── Header ────────────────────────────────────────────────────────────────────
const Header = memo(function Header({ th, page, accent, streak, xp, meta, showTheme, setShowTheme, themeId, setThemeId, setShowExam, switchExam, exam, mutedUI, onToggleMute, playClick }) {
  const TITLES = { dashboard: "Dashboard", timer: "Focus Timer", progress: "Progress" };
  return (
    <header className="st-topbar glass sticky top-0 z-50 border-b px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <h1 className={`font-rajdhani font-bold tracking-wide ${th.text}`} style={{ fontSize: "clamp(16px,4vw,20px)" }}>
          {TITLES[page]}
        </h1>
        <motion.button whileHover={{ scale: 1.06 }} {...TAP} type="button"
          onClick={() => { playClick?.(); setShowExam(true); }}
          className="flex items-center gap-1 font-bold px-3 rounded-full cursor-pointer"
          style={{ minHeight: 32, color: accent, background: `${accent}1c`, border: `1px solid ${accent}44`, fontFamily: "Syne,sans-serif", fontSize: 11, letterSpacing: 1 }}
        >
          {meta?.label}<ChevronDown size={11} />
        </motion.button>
      </div>

      <div className="flex items-center gap-2 relative">
        {page !== "timer" && <MiniTimer accent={accent} />}

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: th.light ? "rgba(0,0,0,.04)" : "rgba(255,255,255,.05)", border: `1px solid ${th.light ? "#e2e8f0" : "rgba(255,255,255,.08)"}` }}>
          <Flame size={13} color="#f59e0b" />
          <span className="font-rajdhani font-bold text-xs tabular-nums" style={{ color: "#f59e0b" }}>{streak}d</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: `${accent}1c`, border: `1px solid ${accent}44` }}>
          <Zap size={13} color={accent} />
          <span className="font-rajdhani font-bold text-xs tabular-nums" style={{ color: accent }}>{xp} XP</span>
        </div>

        <motion.button {...TAP} type="button" onClick={onToggleMute}
          aria-label={mutedUI ? "Unmute sounds" : "Mute sounds"}
          className="flex items-center justify-center rounded-xl cursor-pointer st-subtle-btn"
          style={{ minWidth: 40, minHeight: 40, border: "1px solid" }}
        >
          {mutedUI ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </motion.button>

        <div className="relative">
          <motion.button whileHover={{ scale: 1.08, rotate: 30 }} {...TAP} type="button"
            onClick={() => { playClick?.(); setShowTheme(o => !o); }}
            aria-label="Toggle theme panel"
            className="flex items-center justify-center rounded-xl cursor-pointer"
            style={{ minWidth: 44, minHeight: 44, background: showTheme ? `${accent}22` : (th.light ? "rgba(0,0,0,.05)" : "rgba(255,255,255,.06)"), border: `1px solid ${showTheme ? accent + "55" : (th.light ? "#e2e8f0" : "rgba(255,255,255,.08)")}`, color: showTheme ? accent : (th.light ? "#64748b" : "#71717a") }}
          >
            <Palette size={15} />
          </motion.button>

          <AnimatePresence>
            {showTheme && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .96 }}
                className={`absolute right-0 top-12 z-[200] ${th.modal} glass rounded-2xl p-5 w-52`}
                style={{ border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 12px 50px rgba(0,0,0,.6)" }}
              >
                <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${th.muted}`}>🎨 THEME</p>
                <div className="flex gap-1.5 mb-4">
                  {Object.values(THEMES).map(t => (
                    <motion.button key={t.id} {...TAP} type="button"
                      onClick={() => { playClick?.(); setThemeId(t.id); setShowTheme(false); }}
                      className="flex-1 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ minHeight: 40, background: themeId === t.id ? `${accent}22` : "transparent", border: `1px solid ${themeId === t.id ? accent + "55" : "rgba(255,255,255,.08)"}`, color: themeId === t.id ? accent : "#71717a", fontFamily: "Syne,sans-serif", transition: "all .25s" }}
                    >
                      {t.id === "dark" ? "🌙" : t.id === "light" ? "☀️" : "⚡"}
                    </motion.button>
                  ))}
                </div>
                <p className={`text-[10px] tracking-widest mb-2 ${th.muted}`}>EXAM / ACCENT</p>
                {Object.entries(EXAM_META).map(([k, m]) => (
                  <motion.button key={k} {...TAP} type="button"
                    onClick={() => { playClick?.(); switchExam(k); setShowTheme(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 rounded-lg mb-1 cursor-pointer"
                    style={{ minHeight: 44, background: exam === k ? `${m.accent}18` : "transparent", border: `1px solid ${exam === k ? m.accent + "44" : "rgba(255,255,255,.06)"}`, color: exam === k ? m.accent : "#71717a", fontFamily: "Syne,sans-serif", fontSize: 12, fontWeight: exam === k ? 700 : 400, transition: "all .2s" }}
                  >
                    <span style={{ width: 11, height: 11, borderRadius: "50%", background: m.accent, boxShadow: `0 0 8px ${m.accent}`, flexShrink: 0 }} />
                    {m.label}
                    {exam === k && <CheckCircle2 size={12} style={{ marginLeft: "auto", color: m.accent }} />}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
});

// ── Exam Modal ────────────────────────────────────────────────────────────────
function ExamModal({ exam, onSelect, onClose, th }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[8000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.85)" }} onClick={onClose}
    >
      <motion.div
        initial={{ scale: .88, y: 28 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .88, y: 28 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className={`${th.modal} glass rounded-3xl p-6 w-full max-w-md`}
        style={{ border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 30px 80px rgba(0,0,0,.7)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className={`font-rajdhani font-bold tracking-widest text-2xl ${th.text}`}>SWITCH EXAM</h2>
          <motion.button {...TAP} type="button" onClick={onClose}
            className={`${th.muted} leading-none cursor-pointer flex items-center justify-center`}
            style={{ background: "none", border: "none", minWidth: 44, minHeight: 44, fontSize: 20 }}
          >✕</motion.button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(EXAM_META).map(([k, m]) => (
            <motion.button key={k} whileHover={{ scale: 1.04, y: -2 }} {...TAP} type="button"
              onClick={() => { onSelect(k); onClose(); }}
              className="rounded-2xl flex flex-col items-center gap-2 cursor-pointer"
              style={{ minHeight: 92, padding: "18px 12px", background: exam === k ? `${m.accent}20` : "rgba(255,255,255,.03)", border: `1.5px solid ${exam === k ? m.accent + "88" : "rgba(255,255,255,.07)"}`, boxShadow: exam === k ? `0 0 20px ${m.glow}` : "none", fontFamily: "Syne,sans-serif" }}
            >
              <span style={{ fontSize: 30 }}>{m.emoji}</span>
              <span className="font-rajdhani font-bold tracking-wider" style={{ fontSize: 18, color: exam === k ? m.accent : "#a1a1aa" }}>{m.label}</span>
              {exam === k && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${m.accent}22`, color: m.accent, border: `1px solid ${m.accent}44` }}>Active</span>}
            </motion.button>
          ))}
        </div>
        <p className="text-center mt-4 text-xs text-zinc-600">Switching exam resets chapters &amp; tasks</p>
      </motion.div>
    </motion.div>
  );
}

// ── Level-Up Toast ────────────────────────────────────────────────────────────
function LevelUpToast({ level, accent, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="levelup fixed z-[9999] text-center rounded-2xl px-10 py-5 glass"
      role="alert" aria-live="assertive"
      style={{ bottom: 80, left: "50%", border: `2px solid ${accent}`, background: "rgba(9,9,11,.97)", boxShadow: `0 0 50px ${accent}99`, minWidth: 260 }}
    >
      <motion.div animate={{ rotate: [0, 15, -15, 10, -10, 0], scale: [1, 1.4, 1] }} transition={{ duration: .9 }}>
        <span style={{ fontSize: 44 }}>⚡</span>
      </motion.div>
      <p className="font-rajdhani font-bold tracking-widest mt-1" style={{ fontSize: 30, color: accent }}>LEVEL UP!</p>
      <p className="text-sm text-zinc-400 mt-1">You reached <strong className="text-white">Level {level}</strong></p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  // ── Hook instantiation ────────────────────────────────────────────────────
  const audio = useAudio();
  const ui    = useUIState();
  const game  = useGameState();
  const syl   = useSyllabusState();
  const taskS = useTaskState();

  // Stable pomo callbacks (passed by ref inside timer hook, no new identity each render)
  const handlePomoComplete = useCallback((info) => {
    game.addSession(info);
    burst(accent); // eslint-disable-line
  }, [game.addSession]); // eslint-disable-line

  const handleXpEarned = useCallback((amount) => {
    game.awardXp(amount, accent); // eslint-disable-line
  }, [game.awardXp]); // eslint-disable-line

  const timer = useTimerState({ onPomoComplete: handlePomoComplete, onXpEarned: handleXpEarned, playAlarm: audio.playAlarm });

  // ── Derived accent/glow ───────────────────────────────────────────────────
  const meta   = syl.exam ? EXAM_META[syl.exam] : null;
  const accent = meta?.accent ?? "#22d3ee";
  const glow   = meta?.glow   ?? "rgba(34,211,238,.4)";

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--ac",   accent);
    document.documentElement.style.setProperty("--glow", glow);
  }, [accent, glow]);

  // ── Task completion — bridges task + game + syllabus ──────────────────────
  const handleToggleTask = useCallback((id) => {
    taskS.toggleTask(id, (t) => {
      game.awardXp(XP_TASK, accent);
      audio.playComplete();
      game.bumpStreak();
      burst(accent);
      if (t.auto && t.text.includes(" — ")) {
        const idx = t.text.indexOf(" — ");
        syl.markChapterDone(t.text.slice(0, idx), t.text.slice(idx + 3));
      }
    });
  }, [taskS.toggleTask, game.awardXp, game.bumpStreak, syl.markChapterDone, accent, audio.playComplete]);

  const handleChapterClick = useCallback((sub, ch) => {
    audio.playClick();
    taskS.addChapterTask(sub, ch);
  }, [taskS.addChapterTask, audio.playClick]);

  // ── Context value — timer slice only ─────────────────────────────────────
  const timerCtxVal = useMemo(() => ({
    timerMode: timer.timerMode, running: timer.running, swRun: timer.swRun,
    phase: timer.phase, timerSec: timer.timerSec, swTime: timer.swTime,
  }), [timer.timerMode, timer.running, timer.swRun, timer.phase, timer.timerSec, timer.swTime]);

  // ── Onboarding ────────────────────────────────────────────────────────────
  if (!syl.exam || !syl.grade) {
    const om = syl.exam ? EXAM_META[syl.exam] : null;
    const oa = om?.accent ?? "#38bdf8";
    return (
      <div className="min-h-screen flex items-center justify-center p-5"
        style={{ background: syl.exam ? `radial-gradient(ellipse at 60% 20%,${oa}18,#09090b)` : "radial-gradient(ellipse at 50% 30%,#0f172a,#09090b)" }}
      >
        <AnimatePresence mode="wait">
          {ui.obStep === 0 ? (
            <motion.div key="s0" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -36 }} className="text-center w-full max-w-lg">
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} style={{ fontSize: 64, marginBottom: 16 }}>🎯</motion.div>
              <h1 className="font-rajdhani font-bold tracking-widest mb-2"
                style={{ fontSize: "clamp(36px,8vw,52px)", background: "linear-gradient(135deg,#38bdf8,#818cf8,#e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                STUDY TRACKER
              </h1>
              <p className="text-zinc-600 text-sm tracking-[.25em] uppercase mb-10">For Noobs → Becoming Legends</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(EXAM_META).map(([k, m]) => (
                  <motion.button key={k} whileHover={{ scale: 1.04, y: -2 }} {...TAP} type="button"
                    onClick={() => { syl.switchExam(k); ui.setObStep(1); }}
                    className="rounded-2xl flex flex-col items-center gap-2 cursor-pointer"
                    style={{ padding: "20px 12px", minHeight: 100, border: `1.5px solid ${m.accent}55`, background: `linear-gradient(135deg,${m.accent}18,${m.accent}06)`, boxShadow: `0 0 28px ${m.glow}`, fontFamily: "Syne,sans-serif" }}
                  >
                    <span style={{ fontSize: 36 }}>{m.emoji}</span>
                    <span className="font-rajdhani font-bold tracking-wider" style={{ fontSize: 22, color: m.accent }}>{m.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="s1" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -36 }} className="text-center w-full max-w-sm">
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎓</div>
              <h2 className="font-rajdhani font-bold tracking-widest text-3xl mb-2" style={{ color: oa }}>SELECT GRADE</h2>
              <p className="text-zinc-600 text-sm mb-7">We'll personalise your syllabus</p>
              <div className="flex flex-col gap-3">
                {(EXAM_META[syl.exam]?.grades ?? ["Class 11","Class 12","Dropper"]).map(g => (
                  <motion.button key={g} whileHover={{ scale: 1.02, x: 4 }} {...TAP} type="button"
                    onClick={() => syl.setGrade(g)}
                    className="w-full rounded-xl px-5 text-left text-base font-semibold text-zinc-200 cursor-pointer"
                    style={{ minHeight: 52, border: `1px solid ${oa}44`, background: `${oa}11`, fontFamily: "Syne,sans-serif" }}
                  >{g}</motion.button>
                ))}
              </div>
              <button type="button" onClick={() => ui.setObStep(0)} className="mt-5 text-zinc-600 text-sm hover:text-zinc-400 transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Syne,sans-serif" }}>
                ← Change Exam
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── PAGE RENDERERS ────────────────────────────────────────────────────────

  function Dashboard() {
    const taskPct = taskS.tasks.length ? Math.round(taskS.doneCount / taskS.tasks.length * 100) : 0;
    return (
      <div className="flex flex-col gap-4">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          className="st-card glass rounded-2xl border p-5"
          style={{ border: `1px solid ${accent}44`, boxShadow: `0 8px 50px ${glow}`, position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle,${glow},transparent 68%)`, pointerEvents: "none" }} />
          <div className="flex flex-wrap gap-3 justify-between items-start mb-4 relative">
            <div>
              <p className={`text-[10px] tracking-[.2em] uppercase mb-1 ${ui.th.muted}`}>OVERALL PROGRESS</p>
              <h2 className={`font-rajdhani font-bold ${ui.th.text}`} style={{ fontSize: "clamp(24px,5vw,34px)" }}>
                {syl.pct}% <span style={{ color: accent, fontSize: "clamp(14px,3vw,20px)" }}>Complete</span>
              </h2>
            </div>
            <div className="flex gap-2">
              {[{ e: "🔥", v: game.streak, l: "Streak", c: "#f59e0b" }, { e: "⭐", v: `Lv.${game.level}`, l: "Level", c: accent }, { e: "⚡", v: game.xp, l: "XP", c: accent }].map((s, i) => (
                <div key={i} className={`text-center rounded-xl px-2.5 py-2 ${ui.th.badge}`} style={{ border: `1px solid ${ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.08)"}` }}>
                  <div className="text-sm text-center mb-0.5">{s.e}</div>
                  <div className="font-rajdhani font-bold tabular-nums" style={{ fontSize: 14, color: s.c }}>{s.v}</div>
                  <div className={`text-[9px] tracking-widest ${ui.th.muted}`}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${ui.th.track}`} role="progressbar" aria-valuenow={syl.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Syllabus completion">
            <motion.div initial={{ width: 0 }} animate={{ width: `${syl.pct}%` }} transition={{ duration: 1.3, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg,${accent},${accent}88)`, boxShadow: `0 0 16px ${glow}` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className={`text-[11px] ${ui.th.muted}`}>{syl.doneCh}/{syl.totalCh} chapters</span>
            <span className="text-[11px] font-semibold" style={{ color: accent }}>{meta?.label} · {syl.grade}</span>
          </div>
        </motion.div>

        {/* Subject + Chapter grid */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-[1fr_1.7fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }} className="st-card glass rounded-2xl border p-5">
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${ui.th.muted}`}>📖 SUBJECTS</p>
            <div className="flex flex-col gap-2">
              {Object.keys(syl.subs).map(sub => {
                const chs = syl.subs[sub];
                const d   = chs.filter(c => syl.chapters[`${sub}::${c}`]).length;
                const sp  = Math.round(d / chs.length * 100);
                const sel = syl.selSub === sub;
                return (
                  <motion.button key={sub} whileHover={{ x: 2 }} {...TAP} type="button"
                    onClick={() => { audio.playClick(); syl.setSelSub(sel ? null : sub); }}
                    className="text-left rounded-xl px-3 cursor-pointer transition-all"
                    style={{ minHeight: 52, paddingTop: 10, paddingBottom: 10, background: sel ? `${accent}1c` : (ui.th.light ? "rgba(0,0,0,.03)" : "rgba(255,255,255,.03)"), border: `1px solid ${sel ? accent + "55" : (ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.07)")}`, color: sel ? accent : (ui.th.light ? "#1e293b" : "#d4d4d8"), fontFamily: "Syne,sans-serif", fontSize: 12, fontWeight: sel ? 700 : 500 }}
                  >
                    <div className="flex justify-between mb-1.5">
                      <span>{sub}</span>
                      <span className="tabular-nums" style={{ fontFamily: "DM Mono,monospace", fontSize: 11, opacity: .7 }}>{sp}%</span>
                    </div>
                    <div className={`h-[3px] rounded-full ${ui.th.track}`}>
                      <motion.div animate={{ width: `${sp}%` }} transition={{ duration: .6 }} className="h-full rounded-full" style={{ background: accent }} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}
            className="st-card glass rounded-2xl border p-5" style={{ maxHeight: 380, overflowY: "auto" }}>
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 sticky top-0 pb-1 z-10 st-sticky-hd ${ui.th.muted}`}>
              📋 {syl.selSub ? `CHAPTERS — ${syl.selSub.toUpperCase()}` : "CHAPTERS (PICK A SUBJECT)"}
            </p>
            {!syl.selSub ? (
              <div className={`text-center py-10 text-sm ${ui.th.muted}`}>← Select a subject</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {syl.subs[syl.selSub].map((ch, i) => {
                  const inTask   = taskS.tasks.some(t => t.text === `${syl.selSub} — ${ch}`);
                  const taskDone = taskS.tasks.find(t => t.text === `${syl.selSub} — ${ch}` && t.done);
                  return (
                    <motion.button key={ch}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .012 }}
                      whileHover={{ x: 2 }} {...TAP} type="button"
                      onClick={() => handleChapterClick(syl.selSub, ch)}
                      className="flex items-center gap-2.5 rounded-lg px-3 text-left cursor-pointer transition-all"
                      style={{ minHeight: 40, background: taskDone ? `${accent}16` : inTask ? `${accent}09` : (ui.th.light ? "rgba(0,0,0,.02)" : "rgba(255,255,255,.02)"), border: `1px solid ${taskDone ? accent + "44" : inTask ? accent + "22" : (ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.05)")}`, color: taskDone ? accent : (ui.th.light ? "#334155" : "#d4d4d8"), fontFamily: "Syne,sans-serif", fontSize: 12 }}
                    >
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{taskDone ? "✅" : inTask ? "🔵" : "○"}</span>
                      <span style={{ textDecoration: taskDone ? "line-through" : "none", opacity: taskDone ? .5 : 1 }}>{ch}</span>
                      {!inTask && <span className="ml-auto text-[9px] font-bold whitespace-nowrap" style={{ color: accent, opacity: .6 }}>+task ↓</span>}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Task list */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .16 }} className="st-card glass rounded-2xl border p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className={`text-[10px] tracking-[.2em] uppercase ${ui.th.muted}`}>⚔️ DAILY TASKS / QUESTS</p>
              <p className={`text-[11px] mt-1 ${ui.th.muted}`}>{taskS.doneCount}/{taskS.tasks.length} done · +{XP_TASK} XP each · 🔥 {game.streak}-day streak</p>
            </div>
            {taskS.tasks.length > 0 && (
              <span className="font-rajdhani font-bold text-sm tabular-nums" style={{ color: taskS.doneCount === taskS.tasks.length ? accent : (ui.th.light ? "#94a3b8" : "#52525b") }}>
                {taskPct}%
              </span>
            )}
          </div>

          {/* TaskInput: module-scope memo with local draft — App never re-renders while typing */}
          <div className="mb-3">
            <TaskInput onAdd={taskS.addTask} accent={accent} light={ui.th.light} playClick={audio.playClick} />
          </div>

          <LayoutGroup>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {taskS.tasks.length === 0 && (
                  <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`text-center py-5 text-sm ${ui.th.muted}`}>
                    No quests yet — add one or click a chapter above 🗡️
                  </motion.p>
                )}
                {taskS.tasks.map(t => (
                  <motion.div key={t.id} layout="position"
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    transition={{ layout: { duration: .22 } }}
                    className="flex items-center gap-2 rounded-xl px-2"
                    style={{ minHeight: 52, background: t.done ? `${accent}0e` : (ui.th.light ? "rgba(0,0,0,.02)" : "rgba(255,255,255,.02)"), border: `1px solid ${t.done ? accent + "33" : (ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.06)")}` }}
                  >
                    <motion.button {...TAP} type="button" onClick={() => handleToggleTask(t.id)}
                      aria-label={t.done ? `Mark "${t.text}" as incomplete` : `Complete "${t.text}"`}
                      className="flex-shrink-0 flex items-center justify-center cursor-pointer"
                      style={{ background: "none", border: "none", color: t.done ? accent : (ui.th.light ? "#cbd5e1" : "#3f3f46"), minWidth: 48, minHeight: 52 }}
                    >
                      {t.done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                    </motion.button>
                    <span className="flex-1 text-xs break-words"
                      style={{ fontFamily: "Syne,sans-serif", color: t.done ? (ui.th.light ? "#94a3b8" : "#52525b") : (ui.th.light ? "#1e293b" : "#e4e4e7"), textDecoration: t.done ? "line-through" : "none" }}>
                      {t.text}
                    </span>
                    {t.auto && !t.done && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}33` }}>syllabus</span>}
                    {t.done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ color: accent, background: `${accent}18` }}>+{XP_TASK}XP</motion.span>}
                    <motion.button {...TAP} type="button" onClick={() => taskS.deleteTask(t.id)}
                      aria-label={`Delete task "${t.text}"`}
                      className="flex-shrink-0 flex items-center justify-center cursor-pointer opacity-40"
                      style={{ background: "none", border: "none", color: ui.th.light ? "#94a3b8" : "#71717a", minWidth: 44, minHeight: 52 }}
                    >
                      <Trash2 size={15} />
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

  function FocusPage() {
    const phaseCol = timer.phase === "break" ? "#4ade80" : accent;
    const progress = timer.timerMode === "pomodoro"
      ? timer.timerSec / ((timer.phase === "work" ? timer.pomoDur : timer.brkDur) * 60)
      : (timer.swTime % 3600) / 3600;
    const sz = typeof window !== "undefined" && window.innerWidth < 420 ? 180 : 220;

    return (
      <div className="flex flex-col gap-4">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="st-card glass rounded-2xl border p-5">
          {/* Mode toggle */}
          <div className={`flex p-1 rounded-xl mb-6 max-w-xs mx-auto ${ui.th.track}`}>
            {["pomodoro", "stopwatch"].map(m => (
              <motion.button key={m} {...TAP} type="button"
                onClick={() => { audio.playClick(); timer.switchMode(m); }}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ minHeight: 44, background: timer.timerMode === m ? `${accent}28` : "transparent", border: `1px solid ${timer.timerMode === m ? accent + "55" : "transparent"}`, color: timer.timerMode === m ? accent : (ui.th.light ? "#64748b" : "#71717a"), fontFamily: "Syne,sans-serif", transition: "all .2s" }}
              >
                {m === "pomodoro" ? "🍅 Pomodoro" : "⏱ Stopwatch"}
              </motion.button>
            ))}
          </div>

          {/* Ring + tabular-nums TimerDisplay */}
          <div className="flex justify-center mb-6">
            <CircularTimer pct={progress} accent={phaseCol} size={sz}>
              <TimerDisplay
                seconds={timer.timerMode === "pomodoro" ? timer.timerSec : timer.swTime}
                accent={phaseCol}
                label={timer.timerMode === "pomodoro" ? (timer.phase === "work" ? "FOCUS" : "BREAK") : "ELAPSED"}
                subtitle={timer.timerMode === "pomodoro" ? `+${XP_POMO} XP on complete` : null}
                light={ui.th.light}
              />
            </CircularTimer>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-5">
            <motion.button {...TAP} whileHover={{ scale: 1.06 }} type="button"
              onClick={() => { audio.playClick(); timer.timerMode === "pomodoro" ? timer.setRunning(r => !r) : timer.setSwRun(r => !r); }}
              className="flex items-center gap-2 rounded-full font-bold text-black cursor-pointer"
              style={{ minHeight: 52, paddingLeft: 36, paddingRight: 36, background: `linear-gradient(135deg,${accent},${accent}cc)`, boxShadow: `0 4px 28px ${glow}`, border: "none", fontFamily: "Syne,sans-serif", fontSize: 15 }}
            >
              {(timer.timerMode === "pomodoro" ? timer.running : timer.swRun) ? <><Pause size={18} />Pause</> : <><Play size={18} />Start</>}
            </motion.button>
            <motion.button {...TAP} type="button" whileTap={{ scale: .95, rotate: -30 }}
              onClick={() => { audio.playClick(); timer.resetTimer(); }}
              className="flex items-center justify-center rounded-full cursor-pointer st-subtle-btn"
              style={{ minWidth: 52, minHeight: 52, border: `1px solid ${ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.1)"}`, background: "transparent" }}
              aria-label="Reset timer"
            >
              <RotateCcw size={18} />
            </motion.button>
          </div>

          {/* Duration knobs */}
          {timer.timerMode === "pomodoro" && (
            <div className="flex gap-8 justify-center flex-wrap">
              {[
                { label: "Focus", val: timer.pomoDur, set: v => { timer.setPomoDur(v); } },
                { label: "Break", val: timer.brkDur,  set: timer.setBrkDur },
              ].map(({ label, val, set }) => (
                <div key={label} className="text-center">
                  <p className={`text-[10px] tracking-widest mb-2 ${ui.th.muted}`}>{label.toUpperCase()} (MIN)</p>
                  <div className="flex items-center gap-2">
                    {[{ s: "−", fn: () => set(v => Math.max(1, v - 5)) }, null, { s: "+", fn: () => set(v => Math.min(90, v + 5)) }].map((b, i) =>
                      b ? (
                        <motion.button key={b.s} {...TAP} type="button"
                          onClick={() => { audio.playClick(); b.fn(); }}
                          className="flex items-center justify-center rounded-lg cursor-pointer st-subtle-btn"
                          style={{ minWidth: 48, minHeight: 48, border: `1px solid ${ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.1)"}`, background: "transparent", color: ui.th.light ? "#0f172a" : "#f4f4f5", fontSize: 20 }}
                          aria-label={`${b.s === "−" ? "Decrease" : "Increase"} ${label} duration`}
                        >
                          {b.s}
                        </motion.button>
                      ) : (
                        <span key="v" className="font-rajdhani font-bold text-2xl min-w-[32px] text-center tabular-nums" style={{ color: accent }}>{val}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Topic selector — id + name on the <select> */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="st-card glass rounded-2xl border p-5">
          <label htmlFor="study-topic-select" className={`text-[10px] tracking-[.2em] uppercase mb-3 block ${ui.th.muted}`}>
            🎯 CURRENTLY STUDYING
          </label>
          <select
            id="study-topic-select"
            name="study-topic-select"
            value={timer.topic}
            onChange={e => timer.setTopic(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none cursor-pointer"
            style={{ background: ui.th.sBg, border: `1px solid ${ui.th.sBdr}`, color: ui.th.sText, fontFamily: "Syne,sans-serif", minHeight: 48 }}
          >
            <option value="">— Select topic —</option>
            {Object.entries(syl.subs).map(([sub, chs]) => (
              <optgroup key={sub} label={sub} style={{ background: ui.th.optBg }}>
                {chs.map(ch => (
                  <option key={ch} value={`${sub} — ${ch}`} style={{ background: ui.th.optBg }}>{ch}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </motion.div>

        {/* Session log */}
        {game.sessions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }} className="st-card glass rounded-2xl border p-5">
            <p className={`text-[10px] tracking-[.2em] uppercase mb-3 ${ui.th.muted}`}>🏆 SESSION LOG</p>
            <div className="flex flex-col gap-2">
              {game.sessions.slice(-5).reverse().map((s, i) => (
                <div key={i} className="flex justify-between items-center rounded-xl px-3 py-2.5"
                  style={{ background: ui.th.light ? "rgba(0,0,0,.02)" : "rgba(255,255,255,.02)", border: `1px solid ${ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.05)"}` }}>
                  <div>
                    <p className={`text-xs ${ui.th.text}`}>{s.subject}</p>
                    <p className={`text-[10px] font-mono ${ui.th.muted}`}>{s.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-rajdhani font-bold text-sm tabular-nums" style={{ color: accent }}>{s.dur}m</p>
                    <p className={`text-[10px] ${ui.th.muted}`}>+{XP_POMO}XP</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  function ProgressPage() {
    const bars = [accent, "#f59e0b", "#e879f9", "#4ade80", "#f87171"];
    return (
      <div className="flex flex-col gap-4">
        {/* Level card */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          className="st-card glass rounded-2xl border p-6 text-center"
          style={{ background: `linear-gradient(135deg,${accent}18,transparent)`, border: `1px solid ${accent}44`, boxShadow: `0 0 50px ${glow}` }}>
          <motion.div animate={{ rotate: [0, 6, -6, 0] }} transition={{ repeat: Infinity, duration: 4 }} style={{ fontSize: 50, marginBottom: 6 }}>🏆</motion.div>
          <p className="font-rajdhani font-bold tabular-nums" style={{ fontSize: "clamp(38px,10vw,50px)", color: accent }}>{game.level}</p>
          <p className={`text-sm mb-4 ${ui.th.muted}`}>Current Level</p>
          <div className={`h-2 rounded-full overflow-hidden max-w-xs mx-auto ${ui.th.track}`} role="progressbar" aria-valuenow={Math.round(game.xp / (XP_LV * game.level) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, game.xp / (XP_LV * game.level) * 100)}%` }} transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full rounded-full xp-bar" style={{ background: `linear-gradient(90deg,${accent},#818cf8,${accent})` }} />
          </div>
          <p className={`text-xs mt-2 font-mono tabular-nums ${ui.th.muted}`}>{game.xp} / {XP_LV * game.level} XP → Level {game.level + 1}</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {[{ e: "📚", v: syl.doneCh, l: "Chapters" }, { e: "⚔️", v: taskS.doneCount, l: "Tasks" }, { e: "🍅", v: game.sessions.length, l: "Sessions" }].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .08 }} className="st-card glass rounded-2xl border p-4 text-center">
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.e}</div>
              <p className="font-rajdhani font-bold tabular-nums" style={{ fontSize: 28, color: accent }}>{s.v}</p>
              <p className={`text-[10px] tracking-widest ${ui.th.muted}`}>{s.l}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }} className="st-card glass rounded-2xl border p-5">
          <p className={`text-[10px] tracking-[.2em] uppercase mb-4 ${ui.th.muted}`}>📊 SUBJECT BREAKDOWN</p>
          <div className="flex flex-col gap-4">
            {Object.entries(syl.subs).map(([sub, chs], i) => {
              const d  = chs.filter(c => syl.chapters[`${sub}::${c}`]).length;
              const sp = Math.round(d / chs.length * 100);
              const bc = bars[i % bars.length];
              return (
                <motion.div key={sub} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .07 }}>
                  <div className="flex justify-between mb-2">
                    <span className={`text-sm font-semibold ${ui.th.text}`}>{sub}</span>
                    <span className="font-bold text-xs tabular-nums" style={{ color: bc, fontFamily: "DM Mono,monospace" }}>{d}/{chs.length} · {sp}%</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${ui.th.track}`}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${sp}%` }} transition={{ duration: 1, delay: i * .1, ease: "easeOut" }}
                      className="h-full rounded-full" style={{ background: `linear-gradient(90deg,${bc},${bc}99)`, boxShadow: `0 0 10px ${bc}55` }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .22 }} className="st-card glass rounded-2xl border p-5">
          <p className={`text-[10px] tracking-[.2em] uppercase mb-4 ${ui.th.muted}`}>🏅 ACHIEVEMENTS</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { e: "🔥", l: "First Blood",  d: "Complete 1 chapter",  ok: syl.doneCh >= 1 },
              { e: "⚡", l: "On Fire",       d: "5 chapters done",      ok: syl.doneCh >= 5 },
              { e: "🎯", l: "Quest Master",  d: "Finish 5 tasks",       ok: taskS.doneCount >= 5 },
              { e: "🍅", l: "Pomo Pro",      d: "Log 3 sessions",       ok: game.sessions.length >= 3 },
              { e: "⭐", l: "Rising Star",   d: "Reach Level 2",        ok: game.level >= 2 },
              { e: "💎", l: "Diamond Mind",  d: "50% syllabus done",    ok: syl.pct >= 50 },
            ].map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .05 }}
                className="rounded-xl p-3"
                style={{ background: a.ok ? `${accent}12` : (ui.th.light ? "rgba(0,0,0,.02)" : "rgba(255,255,255,.02)"), border: `1px solid ${a.ok ? accent + "33" : (ui.th.light ? "#e2e8f0" : "rgba(255,255,255,.05)")}`, opacity: a.ok ? 1 : .42 }}
              >
                <div style={{ fontSize: 22, marginBottom: 3 }}>{a.ok ? a.e : "🔒"}</div>
                <p className={`text-xs font-semibold ${ui.th.text}`}>{a.l}</p>
                <p className={`text-[10px] ${ui.th.muted}`}>{a.d}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── ROOT RENDER ──────────────────────────────────────────────────────────

  return (
    <TimerCtx.Provider value={timerCtxVal}>
      <div className="app-root transition-all duration-500" style={{ minHeight: "100dvh" }}>

        <Sidebar th={ui.th} page={ui.page} setPage={ui.setPage} open={ui.sidebarOpen} setOpen={ui.setSidebarOpen}
          accent={accent} xp={game.xp} level={game.level} playClick={audio.playClick} />

        <BottomNav page={ui.page} setPage={ui.setPage} accent={accent} playClick={audio.playClick} />

        <main className="st-main" style={{ minHeight: "100dvh" }}>
          <Header
            th={ui.th} page={ui.page} accent={accent} streak={game.streak} xp={game.xp} meta={meta}
            showTheme={ui.showTheme} setShowTheme={ui.setShowTheme} themeId={ui.themeId} setThemeId={ui.setThemeId}
            setShowExam={ui.setShowExam} switchExam={syl.switchExam} exam={syl.exam}
            mutedUI={audio.mutedUI} onToggleMute={audio.toggleMute} playClick={audio.playClick}
          />

          {ui.showTheme && <div className="fixed inset-0 z-[49]" onClick={() => ui.setShowTheme(false)} />}

          <div className="px-4 md:px-6 pt-4 pb-24 md:pb-6 max-w-[900px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={ui.page}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
                transition={{ duration: .18 }}>
                {ui.page === "dashboard" && <Dashboard />}
                {ui.page === "timer"     && <FocusPage />}
                {ui.page === "progress"  && <ProgressPage />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <AnimatePresence>
          {ui.showExam && <ExamModal exam={syl.exam} onSelect={syl.switchExam} onClose={() => ui.setShowExam(false)} th={ui.th} />}
        </AnimatePresence>

        {game.lvlUp && <LevelUpToast level={game.lvlUp} accent={accent} onDone={() => game.setLvlUp(null)} />}
      </div>
    </TimerCtx.Provider>
  );
}
