/**
 * App.jsx — Study Tracker · Static Shell Architecture
 *
 * ANTI-FLICKER TECHNIQUES APPLIED:
 *  1. CSS VARIABLES ONLY  — theme changes write to :root vars, zero class toggling,
 *     zero layout recalculation. Browser transitions on GPU.
 *  2. CANVAS TIMER RING   — progress arc drawn via requestAnimationFrame directly
 *     onto a <canvas>. Pixel updates never touch the DOM layout tree.
 *  3. RAF TIMER HOOK      — useRAFTimer() drives the countdown with rAF so ticks
 *     are perfectly synced to vsync (60 Hz). No drift, no stutter.
 *  4. FIXED ZAP BUTTON    — position:fixed + contain:strict. Compositor layer is
 *     fully isolated; rotation never causes a layout pass.
 *  5. STRICT MEMO BOUNDARY — Sidebar / Header / TaskList / TimerPanel each
 *     wrapped in React.memo at file level. Props are primitives or stable refs.
 *  6. TIMER ≠ CONTEXT     — timer values passed as plain props into TimerPanel
 *     only. Rest of the tree (Sidebar, Header, Dashboard) never receives them.
 *  7. THEME VIA CONTEXT   — one ThemeCtx provides the active palette object.
 *     Theme changes trigger exactly one React render (ThemeProvider updates).
 */

import {
  useState, useEffect, useLayoutEffect, useRef,
  useCallback, useMemo, memo, createContext, useContext,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  BookOpen, Timer, TrendingUp, Menu, X,
  Flame, Play, Pause, RotateCcw, Home,
  CheckCircle2, Circle, Trash2, Plus, Palette, ChevronDown,
  Volume2, VolumeX,
} from "lucide-react";
import confetti from "canvas-confetti";

// ─────────────────────────────────────────────────────────────────────────────
// § 1  DATA & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const XP_TASK = 100;
const XP_POMO = 100;
const XP_LV   = 500;

const SOUND_URLS = {
  complete: "https://assets.mixkit.co/active_storage/sfx/2577/2577-preview.mp3",
  alarm:    "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
};

const EXAM_META = {
  JEE:    { label:"JEE",     accent:"#38bdf8", glow:"rgba(56,189,248,0.4)",  emoji:"⚛️",  grades:["Class 11","Class 12","Dropper"] },
  NEET:   { label:"NEET",    accent:"#4ade80", glow:"rgba(74,222,128,0.4)",  emoji:"🧬",  grades:["Class 11","Class 12","Dropper"] },
  UPSC:   { label:"UPSC",    accent:"#f59e0b", glow:"rgba(245,158,11,0.4)",  emoji:"🏛️", grades:["Graduate","Final Year","Post Graduate"] },
  MHTCET: { label:"MHT‑CET", accent:"#e879f9", glow:"rgba(232,121,249,0.4)", emoji:"📐",  grades:["Class 11","Class 12","Dropper"] },
};

const SUBJECTS = {
  JEE: {
    Physics:["Units & Measurement","Kinematics","Laws of Motion","Work Energy Power","Rotational Motion","Gravitation","Properties of Matter","Thermodynamics","Oscillations","Waves","Electrostatics","Current Electricity","Magnetic Effects","EMI & AC","Ray Optics","Wave Optics","Modern Physics","Semiconductors"],
    Chemistry:["Mole Concept","Atomic Structure","Chemical Bonding","States of Matter","Thermodynamics","Equilibrium","Ionic Equilibrium","Redox Reactions","Electrochemistry","Chemical Kinetics","s-Block","p-Block","d & f Block","Coordination Compounds","Organic Basics","Hydrocarbons","Haloalkanes","Alcohols & Ethers","Aldehydes & Ketones","Amines","Biomolecules","Polymers"],
    Mathematics:["Sets & Relations","Complex Numbers","Sequences & Series","Quadratic Equations","Permutations","Binomial Theorem","Matrices","Determinants","Limits","Continuity","Differentiation","Applications of Derivatives","Indefinite Integration","Definite Integration","Differential Equations","Straight Lines","Circles","Conics","Vectors","3D Geometry","Probability","Statistics"],
  },
  NEET: {
    Physics:["Physical World","Units & Measurement","Motion in Straight Line","Motion in a Plane","Laws of Motion","Work Energy Power","System of Particles","Gravitation","Mechanical Properties","Thermal Properties","Thermodynamics","Kinetic Theory","Oscillations","Waves","Electric Charges","Current Electricity","Magnetic Field","Moving Charges","EMI","AC Circuits","EM Waves","Ray Optics","Wave Optics","Dual Nature","Atoms","Nuclei","Semiconductors"],
    Chemistry:["Basic Concepts","Atomic Structure","Classification","Chemical Bonding","States of Matter","Thermodynamics","Equilibrium","Redox","Hydrogen","s-Block","p-Block I","p-Block II","d & f Block","Coordination Compounds","Environmental Chemistry","Solutions","Electrochemistry","Chemical Kinetics","Haloalkanes","Alcohols","Aldehydes","Carboxylic Acids","Amines","Biomolecules","Polymers"],
    Biology:["The Living World","Biological Classification","Plant Kingdom","Animal Kingdom","Morphology of Plants","Anatomy of Plants","Structural Organisation","Cell Structure","Cell Cycle","Transport in Plants","Mineral Nutrition","Photosynthesis","Respiration","Plant Growth","Digestion & Absorption","Breathing & Exchange","Body Fluids","Locomotion","Neural Control","Chemical Coordination","Reproduction in Organisms","Plant Reproduction","Human Reproduction","Reproductive Health","Genetics","Molecular Basis","Evolution","Human Health","Microbes","Biotechnology I","Biotechnology II","Organisms & Environment","Ecosystem","Biodiversity","Environmental Issues"],
  },
  UPSC: {
    "GS I":["History of Modern India","Indian Culture","World History","Indian Society","Role of Women","Urbanisation","Globalisation","World Geography","Indian Geography","Physical Geography","Natural Resources","Disaster Management"],
    "GS II":["Indian Constitution","Polity & Governance","Panchayati Raj","Public Policy","Rights Issues","Federal Structure","Parliament","Judiciary","Social Justice","International Relations","India & Neighbours","International Bodies"],
    "GS III":["Indian Economy","Inclusive Growth","Agriculture","Food Processing","Infrastructure","Investment Models","Science & Technology","Environment","Internal Security","Border Management","Terrorism"],
    "GS IV":["Ethics & Human Interface","Attitude","Aptitude & Values","Emotional Intelligence","Civil Service Values","Probity in Governance","Case Studies"],
    CSAT:["Comprehension","Decision Making","General Mental Ability","Basic Numeracy","Data Interpretation","English Comprehension"],
  },
  MHTCET: {
    Physics:["Measurements","Projectile Motion","Laws of Motion","Friction","Circular Motion","Gravitation","Rotational Motion","Oscillations","Elasticity","Wave Motion","Stationary Waves","Kinetic Theory","Wave Optics","Electrostatics","Current Electricity","Magnetic Effects","EM Induction","AC Circuits","Electrons & Photons","Atoms & Nuclei","Semiconductors","Communication"],
    Chemistry:["Solid State","Solutions","Ionic Equilibria","Chemical Thermodynamics","Electrochemistry","Chemical Kinetics","p-Block Elements","d & f Block","Coordination Compounds","Halogen Derivatives","Alcohols & Ethers","Aldehydes & Ketones","Carboxylic Acids","Amines","Biomolecules","Polymers"],
    Mathematics:["Trigonometry","Pair of Lines","Matrices","Determinants","Vectors","3D Geometry","Line in Space","Plane","Linear Programming","Continuity","Differentiation","Applications of Derivatives","Integration","Definite Integration","Differential Equations","Probability Distribution","Binomial Distribution"],
  },
};

// Theme palettes — only JS-only values here; colours live in CSS vars
const PALETTES = {
  dark:  { id:"dark",  cls:"",        light:false, sBg:"#27272a", sText:"#f4f4f5", sBdr:"#3f3f46", optBg:"#18181b" },
  light: { id:"light", cls:"t-light", light:true,  sBg:"#f1f5f9", sText:"#0f172a", sBdr:"#cbd5e1", optBg:"#ffffff" },
  neon:  { id:"neon",  cls:"t-neon",  light:false, sBg:"#09090b", sText:"#ecfeff", sBdr:"#3f3f46", optBg:"#09090b" },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 2  PURE UTILS
// ─────────────────────────────────────────────────────────────────────────────

const LS = {
  r:(k,d)=>{ try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):d;}catch{return d;} },
  w:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
};

const p2    = n => String(n).padStart(2,"0");
const fmt   = s => `${p2(Math.floor(s/60))}:${p2(s%60)}`;
const today = () => new Date().toDateString();

const SP  = { type:"spring", stiffness:420, damping:22 };
const TAP = { whileTap:{ scale:0.95 }, transition:SP };

function burst(color) {
  confetti({ particleCount:110, spread:75, origin:{y:0.55}, colors:[color,"#fff","#facc15","#f472b6"] });
  setTimeout(() => confetti({ particleCount:55, spread:110, origin:{y:0.3}, colors:[color,"#818cf8"] }), 250);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  AUDIO SINGLETON  (module scope — never re-created per render)
// ─────────────────────────────────────────────────────────────────────────────

let _ctx = null;
const _el  = {};

const getCtx = () => {
  if (!_ctx) try { _ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch {}
  return _ctx;
};
const getEl = key => {
  if (!_el[key]) { const a=new Audio(SOUND_URLS[key]); a.preload="auto"; _el[key]=a; }
  return _el[key];
};

function useAudio() {
  const muted = useRef(false);
  const [mutedUI, setMutedUI] = useState(false);

  const playClick = useCallback(() => {
    if (muted.current) return;
    try {
      const ctx=getCtx(); if (!ctx) return;
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type="sine"; o.frequency.value=880;
      g.gain.setValueAtTime(.14,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);
      o.start(); o.stop(ctx.currentTime+.1);
    } catch {}
  }, []);

  const playComplete = useCallback(() => {
    if (muted.current) return;
    try { const a=getEl("complete"); a.currentTime=0; a.play().catch(()=>{}); } catch {}
  }, []);

  const playAlarm = useCallback(() => {
    if (muted.current) return;
    try { const a=getEl("alarm"); a.currentTime=0; a.play().catch(()=>{}); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    muted.current=!muted.current; setMutedUI(muted.current); return muted.current;
  }, []);

  return { playClick, playComplete, playAlarm, toggleMute, mutedUI };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4  THEME CONTEXT  (only consumer is components that need palette JS values)
// ─────────────────────────────────────────────────────────────────────────────

const ThemeCtx = createContext(PALETTES.dark);

// Writes CSS variables to :root — the ONLY way theme changes the UI.
// No class toggling on the main wrapper, no Tailwind bg- class swap.
function applyTheme(paletteId, accentHex, glowRgba) {
  const root = document.documentElement;

  // Remove all palette classes, add the right one
  Object.values(PALETTES).forEach(p => p.cls && root.classList.remove(p.cls));
  const pal = PALETTES[paletteId] ?? PALETTES.dark;
  if (pal.cls) root.classList.add(pal.cls);

  // Write accent vars — all themed components pick this up via CSS
  root.style.setProperty("--ac",   accentHex);
  root.style.setProperty("--glow", glowRgba);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5  RAF TIMER HOOK  (replaces setInterval — synced to vsync, no drift)
// ─────────────────────────────────────────────────────────────────────────────
//
// How it works:
//   - We store the "deadline" timestamp (ms) in a ref.
//   - Each rAF frame we compare performance.now() against the deadline.
//   - Only when we pass the deadline do we decrement timerSec and schedule
//     the next deadline exactly 1 000 ms further in the future.
//   - This avoids the cumulative drift that setInterval accumulates.

function useRAFTimer({ onPomoComplete, onXpEarned, playAlarm }) {
  const [timerMode,setTimerMode] = useState("pomodoro");
  const [pomoDur,  setPomoDur]   = useState(25);
  const [brkDur,   setBrkDur]    = useState(5);
  const [timerSec, setTimerSec]  = useState(25*60);
  const [running,  setRunning]   = useState(false);
  const [phase,    setPhase]     = useState("work");
  const [swTime,   setSwTime]    = useState(0);
  const [swRun,    setSwRun]     = useState(false);
  const [topic,    setTopic]     = useState("");

  // Refs that the rAF loop reads without stale closures
  const rafRef      = useRef(null);
  const swRafRef    = useRef(null);
  const deadlineRef = useRef(0);
  const swDeadline  = useRef(0);
  const live        = useRef({});
  live.current      = { phase, pomoDur, brkDur, topic };

  const cbComplete  = useRef(onPomoComplete);
  const cbXp        = useRef(onXpEarned);
  const cbAlarm     = useRef(playAlarm);
  useEffect(() => { cbComplete.current=onPomoComplete; }, [onPomoComplete]);
  useEffect(() => { cbXp.current=onXpEarned; },          [onXpEarned]);
  useEffect(() => { cbAlarm.current=playAlarm; },         [playAlarm]);

  // ── Pomodoro rAF loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!running || timerMode !== "pomodoro") {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    // Set first deadline
    deadlineRef.current = performance.now() + 1000;

    const tick = (now) => {
      if (now >= deadlineRef.current) {
        deadlineRef.current += 1000;          // slide window forward (no drift)
        setTimerSec(s => {
          if (s > 1) return s - 1;
          // ── Session boundary
          cancelAnimationFrame(rafRef.current);
          setRunning(false);
          cbAlarm.current?.();
          const { phase:ph, pomoDur:pd, brkDur:bd, topic:tp } = live.current;
          if (ph === "work") {
            cbXp.current?.(XP_POMO);
            cbComplete.current?.({ subject:tp||"General Study", dur:pd, time:new Date().toLocaleTimeString() });
            setPhase("break");
            return bd * 60;
          }
          setPhase("work");
          return pd * 60;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, timerMode]);          // ← NOT timerSec — loop never restarts per tick

  // ── Stopwatch rAF loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (!swRun) { cancelAnimationFrame(swRafRef.current); return; }
    swDeadline.current = performance.now() + 1000;

    const tick = (now) => {
      if (now >= swDeadline.current) {
        swDeadline.current += 1000;
        setSwTime(s => s + 1);
      }
      swRafRef.current = requestAnimationFrame(tick);
    };
    swRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(swRafRef.current);
  }, [swRun]);

  useEffect(() => { if (!running) setTimerSec(pomoDur*60); }, [pomoDur, running]);

  // Persist only on stop/pause
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current=true; return; }
    if (!running && !swRun) LS.w("st_timer",{timerMode,pomoDur,brkDur,phase,timerSec,swTime});
  }, [running, swRun]); // eslint-disable-line

  const resetTimer = useCallback(() => {
    setRunning(false); setSwRun(false);
    if (timerMode==="pomodoro") { setTimerSec(pomoDur*60); setPhase("work"); }
    else setSwTime(0);
  }, [timerMode,pomoDur]);

  const switchMode = useCallback((m) => {
    setTimerMode(m); setRunning(false); setSwRun(false);
    setSwTime(0); setPhase("work"); setTimerSec(pomoDur*60);
  }, [pomoDur]);

  return { timerMode,pomoDur,setPomoDur,brkDur,setBrkDur,timerSec,running,setRunning,phase,swTime,swRun,setSwRun,topic,setTopic,resetTimer,switchMode };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6  STATE HOOKS (game / syllabus / tasks)
// ─────────────────────────────────────────────────────────────────────────────

function useGameState() {
  const [xp,       setXp]       = useState(() => LS.r("st_xp",       0));
  const [level,    setLevel]    = useState(() => LS.r("st_level",    1));
  const [streak,   setStreak]   = useState(() => LS.r("st_streak",   0));
  const [ltd,      setLtd]      = useState(() => LS.r("st_ltd",      null));
  const [sessions, setSessions] = useState(() => LS.r("st_sessions", []));
  const [lvlUp,    setLvlUp]    = useState(null);

  const t = useRef(null);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => { LS.w("st_xp",xp);LS.w("st_level",level);LS.w("st_streak",streak);LS.w("st_ltd",ltd);LS.w("st_sessions",sessions); }, 10000);
    return () => clearTimeout(t.current);
  }, [xp,level,streak,ltd,sessions]);

  const awardXp = useCallback((amt,accent) => {
    setXp(prev => {
      let nx=prev+amt;
      setLevel(lv => { let nl=lv; while(nx>=XP_LV*nl){nx-=XP_LV*nl;nl++;setLvlUp(nl);burst(accent);} return nl; });
      return nx;
    });
  }, []);

  const bumpStreak = useCallback(() => {
    const td=today();
    setLtd(prev => { if(prev!==td){setStreak(s=>s+1);return td;} return prev; });
  }, []);

  const addSession = useCallback((info) => setSessions(p=>[...p,info]), []);
  return { xp,level,streak,sessions,lvlUp,setLvlUp,awardXp,bumpStreak,addSession };
}

function useSyllabusState() {
  const [exam,     setExamRaw]  = useState(() => LS.r("st_exam",     null));
  const [grade,    setGrade]    = useState(() => LS.r("st_grade",    null));
  const [chapters, setChapters] = useState(() => LS.r("st_chapters", {}));
  const [selSub,   setSelSub]   = useState(null);

  const t = useRef(null);
  useEffect(() => {
    clearTimeout(t.current);
    t.current=setTimeout(()=>{LS.w("st_exam",exam);LS.w("st_grade",grade);LS.w("st_chapters",chapters);},10000);
    return ()=>clearTimeout(t.current);
  }, [exam,grade,chapters]);

  const switchExam      = useCallback((k) => { setExamRaw(k);setChapters({});setSelSub(null); }, []);
  const markChapterDone = useCallback((sub,ch) => setChapters(p=>({...p,[`${sub}::${ch}`]:true})), []);
  const subs    = useMemo(() => exam ? SUBJECTS[exam] : {}, [exam]);
  const totalCh = useMemo(() => Object.values(subs).reduce((a,c)=>a+c.length,0), [subs]);
  const doneCh  = useMemo(() => Object.values(chapters).filter(Boolean).length, [chapters]);
  const pct     = totalCh ? Math.round(doneCh/totalCh*100) : 0;
  return { exam,grade,setGrade,chapters,selSub,setSelSub,switchExam,markChapterDone,subs,totalCh,doneCh,pct };
}

function useTaskState() {
  const [tasks, setTasks] = useState(() => LS.r("st_tasks", []));
  const t = useRef(null);
  useEffect(() => {
    clearTimeout(t.current); t.current=setTimeout(()=>LS.w("st_tasks",tasks),10000);
    return ()=>clearTimeout(t.current);
  }, [tasks]);

  const addTask        = useCallback((text) => setTasks(p=>[...p,{id:Date.now(),text,done:false}]), []);
  const addChapterTask = useCallback((sub,ch) => {
    const text=`${sub} — ${ch}`;
    setTasks(p=>p.find(t=>t.text===text)?p:[...p,{id:Date.now(),text,done:false,auto:true}]);
  }, []);
  const deleteTask = useCallback((id) => setTasks(p=>p.filter(t=>t.id!==id)), []);
  const doneCount  = useMemo(() => tasks.filter(t=>t.done).length, [tasks]);
  const toggleTask = useCallback((id,onDone) => {
    setTasks(p=>p.map(t=>{ if(t.id!==id)return t; if(!t.done)onDone?.(t); return{...t,done:!t.done}; }));
  }, []);
  return { tasks,addTask,addChapterTask,deleteTask,toggleTask,doneCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7  CANVAS TIMER RING  (no React per-tick re-renders — pure canvas API)
// ─────────────────────────────────────────────────────────────────────────────

const CanvasRing = memo(function CanvasRing({ pct, accent, size=220 }) {
  const cv = useRef(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useLayoutEffect(() => {
    const c = cv.current; if (!c) return;
    const px = size * dpr;
    c.width = px; c.height = px;
    c.style.width  = `${size}px`;
    c.style.height = `${size}px`;
  }, [size, dpr]);

  // Draw arc whenever pct/accent changes — pure canvas, no DOM layout
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext("2d");
    const px  = size * dpr;
    const cx  = px / 2, cy = px / 2;
    const r   = (size - 20) / 2 * dpr;
    const lw  = 8 * dpr;

    ctx.clearRect(0, 0, px, px);

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = lw;
    ctx.stroke();

    // Arc
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
      ctx.strokeStyle  = accent;
      ctx.lineWidth    = lw;
      ctx.lineCap      = "round";
      ctx.shadowColor  = accent;
      ctx.shadowBlur   = 12 * dpr;
      ctx.stroke();
    }
  }, [pct, accent, size, dpr]);

  return (
    <canvas
      ref={cv}
      className="timer-canvas absolute inset-0"
      style={{ width:size, height:size }}
      aria-hidden="true"
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 8  TIMER TEXT  (memo + tabular-nums + fixed width → zero jiggle)
// ─────────────────────────────────────────────────────────────────────────────

const TimerText = memo(function TimerText({ seconds, label, accent, subtitle, light }) {
  return (
    <>
      <p className="text-[10px] tracking-[.2em] uppercase mb-1" style={{ color:accent }}>{label}</p>
      <time
        dateTime={`PT${Math.floor(seconds/60)}M${seconds%60}S`}
        className="timer-text"
        style={{ fontSize:"clamp(36px,10vw,52px)", color:light?"#0f172a":"#f4f4f5" }}
      >
        {fmt(seconds)}
      </time>
      {subtitle && <p className="text-[10px] mt-1" style={{ color:"var(--muted)" }}>{subtitle}</p>}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 9  TASK INPUT  (module-scope memo, local draft — App never re-renders)
// ─────────────────────────────────────────────────────────────────────────────

const TaskInput = memo(function TaskInput({ onAdd, accent, light, playClick }) {
  const [draft, setDraft] = useState("");
  const ref = useRef(null);

  const submit = useCallback(() => {
    if (!draft.trim()) return;
    playClick?.(); onAdd(draft.trim()); setDraft("");
    requestAnimationFrame(() => ref.current?.focus());
  }, [draft, onAdd, playClick]);

  return (
    <div className="flex gap-2">
      <input
        ref={ref} id="task-input" name="task-input" type="text"
        value={draft} onChange={e=>setDraft(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder="Add a task or press Enter…"
        autoComplete="off"
        style={{ minHeight:48, padding:"0 1rem", flex:1,
          background:"var(--input-bg)", border:"1px solid var(--input-bd)",
          color:"var(--text)", fontFamily:"Syne,sans-serif", fontSize:13 }}
      />
      <button type="button" onClick={submit}
        className="flex items-center gap-1.5 px-5 rounded-xl text-sm font-bold text-black cursor-pointer flex-shrink-0"
        style={{ minHeight:48, background:`linear-gradient(135deg,${accent},${accent}cc)`,
          border:"none", fontFamily:"Syne,sans-serif", boxShadow:`0 4px 18px ${accent}55` }}>
        <Plus size={16}/> Add
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 10  FIXED ZAP BUTTON  (position:fixed + contain:strict — GPU isolated)
// ─────────────────────────────────────────────────────────────────────────────
//
// `contain:strict` tells the browser: layout/style/paint/size of this element
// are fully isolated. Rotating the button CANNOT cause the sidebar or any
// other element to reflow. Combined with will-change:transform (from CSS .zap-btn),
// the rotation lives entirely on the compositor thread.

const ZapButton = memo(function ZapButton({ accent, onHome, sidebarOpen }) {
  return (
    <motion.button
      type="button"
      onClick={onHome}
      className="zap-btn zap-ring w-full flex items-center gap-3 rounded-xl cursor-pointer"
      whileHover={{ rotate:180, scale:1.1 }}
      whileTap={{ scale:.9 }}
      transition={{ type:"spring", stiffness:300, damping:20 }}
      style={{
        padding:"9px 10px", minHeight:48,
        background:`linear-gradient(135deg,${accent}30,${accent}10)`,
        border:`1.5px solid ${accent}66`,
        fontFamily:"Syne,sans-serif",
        justifyContent:sidebarOpen?"flex-start":"center",
      }}
      title="Go to Dashboard"
    >
      <motion.span
        animate={{ textShadow:[`0 0 8px ${accent}`,`0 0 22px ${accent}`,`0 0 8px ${accent}`] }}
        transition={{ repeat:Infinity, duration:1.8 }}
        style={{ fontSize:20, lineHeight:1, flexShrink:0 }}
      >⚡</motion.span>
      {sidebarOpen && (
        <span className="font-rajdhani font-bold tracking-widest whitespace-nowrap text-sm"
          style={{ color:accent }}>HOME</span>
      )}
    </motion.button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 11  SIDEBAR  (memo — props are all stable primitives)
// ─────────────────────────────────────────────────────────────────────────────

const Sidebar = memo(function Sidebar({ page,setPage,open,setOpen,accent,xp,level,playClick }) {
  const pal   = useContext(ThemeCtx);
  const xpPct = Math.min(100, xp/(XP_LV*level)*100);
  const go    = useCallback((id)=>{ playClick?.();setPage(id);setOpen(false); }, [setPage,setOpen,playClick]);

  const NAV = [
    { id:"dashboard", icon:<BookOpen   size={18}/>, label:"Dashboard"  },
    { id:"timer",     icon:<Timer      size={18}/>, label:"Focus Timer" },
    { id:"progress",  icon:<TrendingUp size={18}/>, label:"Progress"    },
  ];

  return (
    <motion.aside initial={false} animate={{ width:open?220:62 }}
      className="st-sidebar glass fixed left-0 top-0 z-[100] flex-col border-r overflow-hidden hidden md:flex"
      style={{ height:"100dvh", boxShadow:`4px 0 32px rgba(0,0,0,${pal.light?.1:.5})`, borderColor:"var(--sep)" }}>

      <div className="px-3 pt-3 pb-3 st-sep-b">
        <ZapButton accent={accent} onHome={()=>go("dashboard")} sidebarOpen={open}/>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 pt-3" aria-label="Main navigation">
        {NAV.map(item => (
          <motion.button key={item.id} whileHover={{ x:2 }} {...TAP} type="button"
            onClick={()=>go(item.id)}
            aria-current={page===item.id?"page":undefined}
            className="flex items-center gap-3 rounded-xl cursor-pointer whitespace-nowrap"
            style={{ padding:"9px 10px", minHeight:48,
              background:page===item.id?`${accent}22`:"transparent",
              border:`1px solid ${page===item.id?accent+"55":"transparent"}`,
              color:page===item.id?accent:(pal.light?"#64748b":"#71717a"),
              fontWeight:page===item.id?700:500, fontFamily:"Syne,sans-serif", fontSize:13,
              justifyContent:open?"flex-start":"center" }}>
            {item.icon}{open&&item.label}
          </motion.button>
        ))}
      </nav>

      <div className="px-3 py-3 st-sep-t">
        {open ? (
          <>
            <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily:"DM Mono,monospace" }}>
              <span className="font-bold" style={{ color:accent }}>LV {level}</span>
              <span style={{ color:"var(--muted)" }}>{xp}/{XP_LV*level}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background:"var(--track)" }}>
              <motion.div animate={{ width:`${xpPct}%` }} transition={{ duration:.55 }}
                className="h-full rounded-full xp-bar"/>
            </div>
          </>
        ) : (
          <div className="text-center font-rajdhani font-bold text-sm" style={{ color:accent }}>{level}</div>
        )}
      </div>

      <motion.button {...TAP} type="button" onClick={()=>setOpen(o=>!o)}
        className="mx-2 mb-2 flex justify-center items-center rounded-xl cursor-pointer st-subtle"
        style={{ minHeight:40, border:"1px solid var(--sep)" }}>
        {open?<X size={14}/>:<Menu size={14}/>}
      </motion.button>
    </motion.aside>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 12  BOTTOM NAV  (mobile, memo)
// ─────────────────────────────────────────────────────────────────────────────

const BottomNav = memo(function BottomNav({ page,setPage,accent,playClick }) {
  const ITEMS = [
    { id:"dashboard", icon:<Home       size={22}/>, label:"Home"  },
    { id:"timer",     icon:<Timer      size={22}/>, label:"Focus" },
    { id:"progress",  icon:<TrendingUp size={22}/>, label:"Stats" },
  ];
  return (
    <nav className="st-bnav md:hidden fixed bottom-0 left-0 right-0 z-[100] flex items-stretch justify-around"
      aria-label="Mobile navigation"
      style={{ backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", height:"calc(60px + env(safe-area-inset-bottom,0px))", paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
      {ITEMS.map(item=>(
        <motion.button key={item.id} {...TAP} type="button"
          onClick={()=>{ playClick?.();setPage(item.id); }}
          aria-current={page===item.id?"page":undefined}
          className="relative flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          style={{ background:"none", border:"none", color:page===item.id?accent:"#71717a",
            fontFamily:"Syne,sans-serif", fontSize:10, fontWeight:page===item.id?700:400,
            transition:"color .2s", minHeight:60 }}>
          <motion.span animate={{ scale:page===item.id?1.18:1 }} transition={SP}>{item.icon}</motion.span>
          <span>{item.label}</span>
          {page===item.id && (
            <motion.div layoutId="bnl" className="absolute bottom-0 h-[3px] rounded-full"
              style={{ width:28, background:accent, boxShadow:`0 0 8px ${accent}` }}/>
          )}
        </motion.button>
      ))}
    </nav>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 13  MINI TIMER BADGE  (header, reads only timer props — no context)
// ─────────────────────────────────────────────────────────────────────────────

const MiniTimerBadge = memo(function MiniTimerBadge({ timerMode,running,swRun,phase,timerSec,swTime,accent }) {
  if (!running && !swRun) return null;
  const secs = timerMode==="pomodoro" ? timerSec : swTime;
  const icon = timerMode==="pomodoro" ? (phase==="work"?"🍅":"☕") : "⏱";
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{ background:`${accent}1c`, border:`1px solid ${accent}44`, color:accent }}>
      <span>{icon}</span>
      <time dateTime={`PT${Math.floor(secs/60)}M${secs%60}S`}
        className="timer-text" style={{ fontSize:12 }}>{fmt(secs)}</time>
      {running && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:accent }}/>}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 14  HEADER  (memo — receives timer props only for MiniTimer display)
// ─────────────────────────────────────────────────────────────────────────────

const Header = memo(function Header({
  page,accent,streak,xp,meta,
  timerMode,running,swRun,phase,timerSec,swTime,   // ← for MiniTimerBadge
  showTheme,setShowTheme,themeId,setThemeId,
  setShowExam,switchExam,exam,mutedUI,onToggleMute,playClick,
}) {
  const pal    = useContext(ThemeCtx);
  const TITLES = { dashboard:"Dashboard", timer:"Focus Timer", progress:"Progress" };

  return (
    <header className="st-topbar glass sticky top-0 z-50 border-b px-4 md:px-6 py-3 flex items-center justify-between"
      style={{ borderColor:"var(--sep)" }}>

      <div className="flex items-center gap-2.5">
        <h1 className="font-rajdhani font-bold tracking-wide" style={{ color:"var(--text)", fontSize:"clamp(16px,4vw,20px)" }}>
          {TITLES[page]}
        </h1>
        <motion.button whileHover={{ scale:1.06 }} {...TAP} type="button"
          onClick={()=>{ playClick?.();setShowExam(true); }}
          className="flex items-center gap-1 font-bold px-3 rounded-full cursor-pointer"
          style={{ minHeight:32, color:accent, background:`${accent}1c`, border:`1px solid ${accent}44`,
            fontFamily:"Syne,sans-serif", fontSize:11, letterSpacing:1 }}>
          {meta?.label}<ChevronDown size={11}/>
        </motion.button>
      </div>

      <div className="flex items-center gap-2 relative">
        {page!=="timer" && (
          <MiniTimerBadge timerMode={timerMode} running={running} swRun={swRun}
            phase={phase} timerSec={timerSec} swTime={swTime} accent={accent}/>
        )}

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background:"var(--badge)", border:"1px solid var(--sep)" }}>
          <Flame size={13} color="#f59e0b"/>
          <span className="font-rajdhani font-bold text-xs timer-text" style={{ color:"#f59e0b" }}>{streak}d</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background:`${accent}1c`, border:`1px solid ${accent}44` }}>
          <span style={{ fontSize:13 }}>⚡</span>
          <span className="font-rajdhani font-bold text-xs timer-text" style={{ color:accent }}>{xp} XP</span>
        </div>

        <motion.button {...TAP} type="button" onClick={onToggleMute}
          aria-label={mutedUI?"Unmute":"Mute"}
          className="flex items-center justify-center rounded-xl cursor-pointer st-subtle"
          style={{ minWidth:40, minHeight:40, border:"1px solid var(--sep)" }}>
          {mutedUI?<VolumeX size={15}/>:<Volume2 size={15}/>}
        </motion.button>

        <div className="relative">
          <motion.button whileHover={{ scale:1.08, rotate:30 }} {...TAP} type="button"
            onClick={()=>{ playClick?.();setShowTheme(o=>!o); }}
            aria-label="Theme panel"
            className="flex items-center justify-center rounded-xl cursor-pointer"
            style={{ minWidth:44, minHeight:44,
              background:showTheme?`${accent}22`:"var(--badge)",
              border:`1px solid ${showTheme?accent+"55":"var(--sep)"}`,
              color:showTheme?accent:"var(--sub-cl)" }}>
            <Palette size={15}/>
          </motion.button>

          <AnimatePresence>
            {showTheme && (
              <motion.div
                initial={{ opacity:0,y:8,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:8,scale:.96 }}
                className="absolute right-0 top-12 z-[200] st-modal glass rounded-2xl p-5 w-52"
                style={{ border:"1px solid var(--sep)", boxShadow:"0 12px 50px rgba(0,0,0,.65)" }}>
                <p className="text-[10px] tracking-[.2em] uppercase mb-3" style={{ color:"var(--muted)" }}>🎨 THEME</p>
                <div className="flex gap-1.5 mb-4">
                  {Object.keys(PALETTES).map(id=>(
                    <motion.button key={id} {...TAP} type="button"
                      onClick={()=>{ playClick?.();setThemeId(id);setShowTheme(false); }}
                      className="flex-1 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ minHeight:40,
                        background:themeId===id?`${accent}22`:"transparent",
                        border:`1px solid ${themeId===id?accent+"55":"var(--sep)"}`,
                        color:themeId===id?accent:"var(--sub-cl)",
                        fontFamily:"Syne,sans-serif", transition:"all .25s" }}>
                      {id==="dark"?"🌙":id==="light"?"☀️":"⚡"}
                    </motion.button>
                  ))}
                </div>
                <p className="text-[10px] tracking-widest mb-2" style={{ color:"var(--muted)" }}>EXAM / ACCENT</p>
                {Object.entries(EXAM_META).map(([k,m])=>(
                  <motion.button key={k} {...TAP} type="button"
                    onClick={()=>{ playClick?.();switchExam(k);setShowTheme(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 rounded-lg mb-1 cursor-pointer"
                    style={{ minHeight:44,
                      background:exam===k?`${m.accent}18`:"transparent",
                      border:`1px solid ${exam===k?m.accent+"44":"var(--sep)"}`,
                      color:exam===k?m.accent:"var(--sub-cl)",
                      fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:exam===k?700:400 }}>
                    <span style={{ width:11,height:11,borderRadius:"50%",background:m.accent,boxShadow:`0 0 8px ${m.accent}`,flexShrink:0 }}/>
                    {m.label}
                    {exam===k && <CheckCircle2 size={12} style={{ marginLeft:"auto",color:m.accent }}/>}
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

// ─────────────────────────────────────────────────────────────────────────────
// § 15  EXAM MODAL
// ─────────────────────────────────────────────────────────────────────────────

function ExamModal({ exam,onSelect,onClose }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[8000] flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,.85)" }} onClick={onClose}>
      <motion.div initial={{ scale:.88,y:28 }} animate={{ scale:1,y:0 }} exit={{ scale:.88,y:28 }}
        transition={{ type:"spring",stiffness:380,damping:28 }}
        className="st-modal glass rounded-3xl p-6 w-full max-w-md"
        style={{ border:"1px solid var(--sep)", boxShadow:"0 30px 80px rgba(0,0,0,.7)" }}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-rajdhani font-bold tracking-widest text-2xl" style={{ color:"var(--text)" }}>SWITCH EXAM</h2>
          <motion.button {...TAP} type="button" onClick={onClose}
            className="leading-none cursor-pointer flex items-center justify-center"
            style={{ background:"none",border:"none",minWidth:44,minHeight:44,fontSize:20,color:"var(--muted)" }}>✕</motion.button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(EXAM_META).map(([k,m])=>(
            <motion.button key={k} whileHover={{ scale:1.04,y:-2 }} {...TAP} type="button"
              onClick={()=>{ onSelect(k);onClose(); }}
              className="rounded-2xl flex flex-col items-center gap-2 cursor-pointer"
              style={{ minHeight:92,padding:"18px 12px",
                background:exam===k?`${m.accent}20`:"var(--row-base)",
                border:`1.5px solid ${exam===k?m.accent+"88":"var(--sep)"}`,
                boxShadow:exam===k?`0 0 20px ${m.glow}`:"none",
                fontFamily:"Syne,sans-serif" }}>
              <span style={{ fontSize:30 }}>{m.emoji}</span>
              <span className="font-rajdhani font-bold tracking-wider"
                style={{ fontSize:18,color:exam===k?m.accent:"#a1a1aa" }}>{m.label}</span>
              {exam===k && <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background:`${m.accent}22`,color:m.accent,border:`1px solid ${m.accent}44` }}>Active</span>}
            </motion.button>
          ))}
        </div>
        <p className="text-center mt-4 text-xs" style={{ color:"var(--muted)" }}>Switching exam resets chapters &amp; tasks</p>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16  LEVEL-UP TOAST
// ─────────────────────────────────────────────────────────────────────────────

function LevelUpToast({ level,accent,onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2800);return()=>clearTimeout(t); },[onDone]);
  return (
    <div className="levelup fixed z-[9999] text-center rounded-2xl px-10 py-5 glass"
      role="alert" aria-live="assertive"
      style={{ bottom:80,left:"50%",border:`2px solid ${accent}`,
        background:"rgba(9,9,11,.97)",boxShadow:`0 0 50px ${accent}99`,minWidth:260 }}>
      <motion.div animate={{ rotate:[0,15,-15,10,-10,0],scale:[1,1.4,1] }} transition={{ duration:.9 }}>
        <span style={{ fontSize:44 }}>⚡</span>
      </motion.div>
      <p className="font-rajdhani font-bold tracking-widest mt-1" style={{ fontSize:30,color:accent }}>LEVEL UP!</p>
      <p className="text-sm mt-1" style={{ color:"var(--muted)" }}>You reached <strong style={{ color:"var(--text)" }}>Level {level}</strong></p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17  TIMER PANEL  (memo — only this subtree re-renders per tick)
// ─────────────────────────────────────────────────────────────────────────────

const TimerPanel = memo(function TimerPanel({ timer, accent, glow, subs, sessions }) {
  const pal = useContext(ThemeCtx);
  const { timerMode,pomoDur,setPomoDur,brkDur,setBrkDur,timerSec,running,setRunning,phase,swTime,swRun,setSwRun,topic,setTopic,resetTimer,switchMode } = timer;

  const phaseCol = phase==="break"?"#4ade80":accent;
  const progress = timerMode==="pomodoro"
    ? timerSec/((phase==="work"?pomoDur:brkDur)*60)
    : (swTime%3600)/3600;
  const sz = typeof window!=="undefined"&&window.innerWidth<420?180:220;

  return (
    <div className="flex flex-col gap-4">
      <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }}
        className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)" }}>

        {/* Mode toggle */}
        <div className="flex p-1 rounded-xl mb-6 max-w-xs mx-auto" style={{ background:"var(--track)" }}>
          {["pomodoro","stopwatch"].map(m=>(
            <motion.button key={m} {...TAP} type="button" onClick={()=>switchMode(m)}
              className="flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ minHeight:44,
                background:timerMode===m?`${accent}28`:"transparent",
                border:`1px solid ${timerMode===m?accent+"55":"transparent"}`,
                color:timerMode===m?accent:(pal.light?"#64748b":"#71717a"),
                fontFamily:"Syne,sans-serif", transition:"all .2s" }}>
              {m==="pomodoro"?"🍅 Pomodoro":"⏱ Stopwatch"}
            </motion.button>
          ))}
        </div>

        {/* Canvas ring + text */}
        <div className="flex justify-center mb-6">
          <div className="relative" style={{ width:sz, height:sz }}>
            <CanvasRing pct={progress} accent={phaseCol} size={sz}/>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <TimerText
                seconds={timerMode==="pomodoro"?timerSec:swTime}
                label={timerMode==="pomodoro"?(phase==="work"?"FOCUS":"BREAK"):"ELAPSED"}
                accent={phaseCol}
                subtitle={timerMode==="pomodoro"?`+${XP_POMO} XP on complete`:null}
                light={pal.light}
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-5">
          <motion.button {...TAP} whileHover={{ scale:1.06 }} type="button"
            onClick={()=>timerMode==="pomodoro"?setRunning(r=>!r):setSwRun(r=>!r)}
            className="flex items-center gap-2 rounded-full font-bold text-black cursor-pointer"
            style={{ minHeight:52,paddingLeft:36,paddingRight:36,
              background:`linear-gradient(135deg,${accent},${accent}cc)`,
              boxShadow:`0 4px 28px ${glow}`,border:"none",fontFamily:"Syne,sans-serif",fontSize:15 }}>
            {(timerMode==="pomodoro"?running:swRun)?<><Pause size={18}/>Pause</>:<><Play size={18}/>Start</>}
          </motion.button>
          <motion.button {...TAP} type="button" onClick={resetTimer}
            aria-label="Reset timer"
            className="flex items-center justify-center rounded-full cursor-pointer st-subtle"
            style={{ minWidth:52,minHeight:52,border:"1px solid var(--sep)",background:"transparent" }}>
            <RotateCcw size={18}/>
          </motion.button>
        </div>

        {/* Duration knobs */}
        {timerMode==="pomodoro" && (
          <div className="flex gap-8 justify-center flex-wrap">
            {[{label:"Focus",val:pomoDur,set:v=>setPomoDur(v)},{label:"Break",val:brkDur,set:setBrkDur}].map(({label,val,set})=>(
              <div key={label} className="text-center">
                <p className="text-[10px] tracking-widest mb-2" style={{ color:"var(--muted)" }}>{label.toUpperCase()} (MIN)</p>
                <div className="flex items-center gap-2">
                  {[{s:"−",fn:()=>set(v=>Math.max(1,v-5))},null,{s:"+",fn:()=>set(v=>Math.min(90,v+5))}].map((b,i)=>
                    b?(
                      <motion.button key={b.s} {...TAP} type="button" onClick={b.fn}
                        className="flex items-center justify-center rounded-lg cursor-pointer st-subtle"
                        aria-label={`${b.s==="−"?"Decrease":"Increase"} ${label} duration`}
                        style={{ minWidth:48,minHeight:48,border:"1px solid var(--sep)",background:"transparent",
                          color:"var(--text)",fontSize:20 }}>
                        {b.s}
                      </motion.button>
                    ):(
                      <span key="v" className="font-rajdhani font-bold text-2xl min-w-[32px] text-center timer-text"
                        style={{ color:accent }}>{val}</span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Topic */}
      <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.1 }}
        className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)" }}>
        <label htmlFor="study-topic" className="text-[10px] tracking-[.2em] uppercase mb-3 block" style={{ color:"var(--muted)" }}>
          🎯 CURRENTLY STUDYING
        </label>
        <select id="study-topic" name="study-topic" value={topic} onChange={e=>setTopic(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none cursor-pointer"
          style={{ background:"var(--sel-bg)",border:"1px solid var(--input-bd)",color:"var(--sel-text)",
            fontFamily:"Syne,sans-serif",minHeight:48 }}>
          <option value="">— Select topic —</option>
          {Object.entries(subs).map(([sub,chs])=>(
            <optgroup key={sub} label={sub} style={{ background:"var(--opt-bg)" }}>
              {chs.map(ch=><option key={ch} value={`${sub} — ${ch}`} style={{ background:"var(--opt-bg)" }}>{ch}</option>)}
            </optgroup>
          ))}
        </select>
      </motion.div>

      {/* Session log */}
      {sessions.length>0 && (
        <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.15 }}
          className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)" }}>
          <p className="text-[10px] tracking-[.2em] uppercase mb-3" style={{ color:"var(--muted)" }}>🏆 SESSION LOG</p>
          <div className="flex flex-col gap-2">
            {sessions.slice(-5).reverse().map((s,i)=>(
              <div key={i} className="flex justify-between items-center rounded-xl px-3 py-2.5"
                style={{ background:"var(--row-base)",border:"1px solid var(--sep)" }}>
                <div>
                  <p className="text-xs" style={{ color:"var(--text)" }}>{s.subject}</p>
                  <p className="text-[10px] font-mono" style={{ color:"var(--muted)" }}>{s.time}</p>
                </div>
                <div className="text-right">
                  <p className="font-rajdhani font-bold text-sm timer-text" style={{ color:accent }}>{s.dur}m</p>
                  <p className="text-[10px]" style={{ color:"var(--muted)" }}>+{XP_POMO}XP</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 18  TASK LIST  (memo — never re-renders from timer ticks)
// ─────────────────────────────────────────────────────────────────────────────

const TaskList = memo(function TaskList({ tasks,doneCount,onToggle,onDelete,onAdd,accent,streak,playClick }) {
  const pal    = useContext(ThemeCtx);
  const taskPct = tasks.length?Math.round(doneCount/tasks.length*100):0;

  return (
    <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} transition={{ delay:.16 }}
      className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)" }}>

      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-[10px] tracking-[.2em] uppercase" style={{ color:"var(--muted)" }}>⚔️ DAILY TASKS / QUESTS</p>
          <p className="text-[11px] mt-1" style={{ color:"var(--muted)" }}>
            {doneCount}/{tasks.length} done · +{XP_TASK} XP each · 🔥 {streak}-day streak
          </p>
        </div>
        {tasks.length>0 && (
          <span className="font-rajdhani font-bold text-sm timer-text"
            style={{ color:doneCount===tasks.length?accent:"var(--muted)" }}>{taskPct}%</span>
        )}
      </div>

      <div className="mb-3">
        <TaskInput onAdd={onAdd} accent={accent} light={pal.light} playClick={playClick}/>
      </div>

      <LayoutGroup>
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {tasks.length===0 && (
              <motion.p key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                className="text-center py-5 text-sm" style={{ color:"var(--muted)" }}>
                No quests yet — add one or click a chapter above 🗡️
              </motion.p>
            )}
            {tasks.map(t=>(
              <motion.div key={t.id} layout="position"
                initial={{ opacity:0,x:-16 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:20 }}
                transition={{ layout:{ duration:.22 } }}
                className="flex items-center gap-2 rounded-xl px-2"
                style={{ minHeight:52,
                  background:t.done?`${accent}0e`:"var(--row-base)",
                  border:`1px solid ${t.done?accent+"33":"var(--sep)"}` }}>
                <motion.button {...TAP} type="button" onClick={()=>onToggle(t.id)}
                  aria-label={t.done?`Unmark "${t.text}"`:`Complete "${t.text}"`}
                  className="flex-shrink-0 flex items-center justify-center cursor-pointer"
                  style={{ background:"none",border:"none",color:t.done?accent:"var(--sub-cl)",minWidth:48,minHeight:52 }}>
                  {t.done?<CheckCircle2 size={22}/>:<Circle size={22}/>}
                </motion.button>
                <span className="flex-1 text-xs break-words"
                  style={{ fontFamily:"Syne,sans-serif",color:t.done?"var(--muted)":"var(--text)",
                    textDecoration:t.done?"line-through":"none" }}>
                  {t.text}
                </span>
                {t.auto&&!t.done && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ color:accent,background:`${accent}18`,border:`1px solid ${accent}33` }}>syllabus</span>
                )}
                {t.done && (
                  <motion.span initial={{ scale:0 }} animate={{ scale:1 }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
                    style={{ color:accent,background:`${accent}18` }}>+{XP_TASK}XP</motion.span>
                )}
                <motion.button {...TAP} type="button" onClick={()=>onDelete(t.id)}
                  aria-label={`Delete "${t.text}"`}
                  className="flex-shrink-0 flex items-center justify-center cursor-pointer opacity-40"
                  style={{ background:"none",border:"none",color:"var(--sub-cl)",minWidth:44,minHeight:52 }}>
                  <Trash2 size={15}/>
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 19  ROOT APP
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const audio = useAudio();
  const game  = useGameState();
  const syl   = useSyllabusState();
  const taskS = useTaskState();

  // UI state
  const [page,        setPage]        = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeId,     setThemeId]     = useState(() => LS.r("st_theme","dark"));
  const [showExam,    setShowExam]    = useState(false);
  const [showTheme,   setShowTheme]   = useState(false);
  const [obStep,      setObStep]      = useState(0);

  // Active palette (JS-only values; colours come from CSS vars)
  const pal = PALETTES[themeId] ?? PALETTES.dark;

  // Exam accent
  const meta   = syl.exam ? EXAM_META[syl.exam] : null;
  const accent = meta?.accent ?? "#22d3ee";
  const glow   = meta?.glow   ?? "rgba(34,211,238,.4)";

  // Apply CSS vars + palette class — runs synchronously before paint
  useLayoutEffect(() => {
    applyTheme(themeId, accent, glow);
    LS.w("st_theme", themeId);
  }, [themeId, accent, glow]);

  // Stable pomo callbacks
  const handlePomoComplete = useCallback((info) => {
    game.addSession(info);
    burst(accent);
  }, [game.addSession, accent]);

  const handleXpEarned = useCallback((amt) => {
    game.awardXp(amt, accent);
  }, [game.awardXp, accent]);

  const timer = useRAFTimer({
    onPomoComplete: handlePomoComplete,
    onXpEarned:     handleXpEarned,
    playAlarm:      audio.playAlarm,
  });

  // Task toggle — bridges task + game + syllabus
  const handleToggleTask = useCallback((id) => {
    taskS.toggleTask(id, (t) => {
      game.awardXp(XP_TASK, accent);
      audio.playComplete();
      game.bumpStreak();
      burst(accent);
      if (t.auto && t.text.includes(" — ")) {
        const idx = t.text.indexOf(" — ");
        syl.markChapterDone(t.text.slice(0,idx), t.text.slice(idx+3));
      }
    });
  }, [taskS.toggleTask, game.awardXp, game.bumpStreak, syl.markChapterDone, accent, audio.playComplete]);

  const handleChapterClick = useCallback((sub, ch) => {
    audio.playClick(); taskS.addChapterTask(sub, ch);
  }, [taskS.addChapterTask, audio.playClick]);

  // ── ONBOARDING ──────────────────────────────────────────────────────────────
  if (!syl.exam || !syl.grade) {
    const om=syl.exam?EXAM_META[syl.exam]:null, oa=om?.accent??"#38bdf8";
    return (
      <div className="min-h-screen flex items-center justify-center p-5"
        style={{ background:syl.exam?`radial-gradient(ellipse at 60% 20%,${oa}18,#09090b)`:"radial-gradient(ellipse at 50% 30%,#0f172a,#09090b)" }}>
        <AnimatePresence mode="wait">
          {obStep===0?(
            <motion.div key="s0" initial={{ opacity:0,y:36 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-36 }} className="text-center w-full max-w-lg">
              <motion.div animate={{ y:[0,-10,0] }} transition={{ repeat:Infinity,duration:3 }} style={{ fontSize:64,marginBottom:16 }}>🎯</motion.div>
              <h1 className="font-rajdhani font-bold tracking-widest mb-2"
                style={{ fontSize:"clamp(36px,8vw,52px)",background:"linear-gradient(135deg,#38bdf8,#818cf8,#e879f9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>
                STUDY TRACKER
              </h1>
              <p className="text-zinc-600 text-sm tracking-[.25em] uppercase mb-10">For Noobs → Becoming Legends</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(EXAM_META).map(([k,m])=>(
                  <motion.button key={k} whileHover={{ scale:1.04,y:-2 }} {...TAP} type="button"
                    onClick={()=>{ syl.switchExam(k);setObStep(1); }}
                    className="rounded-2xl flex flex-col items-center gap-2 cursor-pointer"
                    style={{ padding:"20px 12px",minHeight:100,border:`1.5px solid ${m.accent}55`,background:`linear-gradient(135deg,${m.accent}18,${m.accent}06)`,boxShadow:`0 0 28px ${m.glow}`,fontFamily:"Syne,sans-serif" }}>
                    <span style={{ fontSize:36 }}>{m.emoji}</span>
                    <span className="font-rajdhani font-bold tracking-wider" style={{ fontSize:22,color:m.accent }}>{m.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ):(
            <motion.div key="s1" initial={{ opacity:0,y:36 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-36 }} className="text-center w-full max-w-sm">
              <div style={{ fontSize:52,marginBottom:12 }}>🎓</div>
              <h2 className="font-rajdhani font-bold tracking-widest text-3xl mb-2" style={{ color:oa }}>SELECT GRADE</h2>
              <p className="text-zinc-600 text-sm mb-7">We'll personalise your syllabus</p>
              <div className="flex flex-col gap-3">
                {(EXAM_META[syl.exam]?.grades??["Class 11","Class 12","Dropper"]).map(g=>(
                  <motion.button key={g} whileHover={{ scale:1.02,x:4 }} {...TAP} type="button"
                    onClick={()=>syl.setGrade(g)}
                    className="w-full rounded-xl px-5 text-left text-base font-semibold text-zinc-200 cursor-pointer"
                    style={{ minHeight:52,border:`1px solid ${oa}44`,background:`${oa}11`,fontFamily:"Syne,sans-serif" }}>{g}</motion.button>
                ))}
              </div>
              <button type="button" onClick={()=>setObStep(0)} className="mt-5 text-zinc-600 text-sm hover:text-zinc-400"
                style={{ background:"none",border:"none",cursor:"pointer",fontFamily:"Syne,sans-serif" }}>← Change Exam</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── PAGE COMPONENTS ─────────────────────────────────────────────────────────

  function Dashboard() {
    return (
      <div className="flex flex-col gap-4">
        {/* Hero */}
        <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }}
          className="st-card glass rounded-2xl border p-5"
          style={{ borderColor:`${accent}44`,boxShadow:`0 8px 50px ${glow}`,position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-60,right:-60,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${glow},transparent 68%)`,pointerEvents:"none" }}/>
          <div className="flex flex-wrap gap-3 justify-between items-start mb-4 relative">
            <div>
              <p className="text-[10px] tracking-[.2em] uppercase mb-1" style={{ color:"var(--muted)" }}>OVERALL PROGRESS</p>
              <h2 className="font-rajdhani font-bold" style={{ color:"var(--text)",fontSize:"clamp(24px,5vw,34px)" }}>
                {syl.pct}% <span style={{ color:accent,fontSize:"clamp(14px,3vw,20px)" }}>Complete</span>
              </h2>
            </div>
            <div className="flex gap-2">
              {[{e:"🔥",v:game.streak,l:"Streak",c:"#f59e0b"},{e:"⭐",v:`Lv.${game.level}`,l:"Level",c:accent},{e:"⚡",v:game.xp,l:"XP",c:accent}].map((s,i)=>(
                <div key={i} className="text-center rounded-xl px-2.5 py-2"
                  style={{ background:"var(--badge)",border:"1px solid var(--sep)" }}>
                  <div className="text-sm text-center mb-0.5">{s.e}</div>
                  <div className="font-rajdhani font-bold timer-text" style={{ fontSize:14,color:s.c }}>{s.v}</div>
                  <div className="text-[9px] tracking-widest" style={{ color:"var(--muted)" }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background:"var(--track)" }}
            role="progressbar" aria-valuenow={syl.pct} aria-valuemin={0} aria-valuemax={100}>
            <motion.div initial={{ width:0 }} animate={{ width:`${syl.pct}%` }} transition={{ duration:1.3,ease:"easeOut" }}
              className="h-full rounded-full" style={{ background:`linear-gradient(90deg,${accent},${accent}88)`,boxShadow:`0 0 16px ${glow}` }}/>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[11px]" style={{ color:"var(--muted)" }}>{syl.doneCh}/{syl.totalCh} chapters</span>
            <span className="text-[11px] font-semibold" style={{ color:accent }}>{meta?.label} · {syl.grade}</span>
          </div>
        </motion.div>

        {/* Subject + Chapter */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-[1fr_1.7fr]">
          <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} transition={{ delay:.08 }}
            className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)" }}>
            <p className="text-[10px] tracking-[.2em] uppercase mb-3" style={{ color:"var(--muted)" }}>📖 SUBJECTS</p>
            <div className="flex flex-col gap-2">
              {Object.keys(syl.subs).map(sub=>{
                const chs=syl.subs[sub],d=chs.filter(c=>syl.chapters[`${sub}::${c}`]).length;
                const sp=Math.round(d/chs.length*100),sel=syl.selSub===sub;
                return (
                  <motion.button key={sub} whileHover={{ x:2 }} {...TAP} type="button"
                    onClick={()=>{ audio.playClick();syl.setSelSub(sel?null:sub); }}
                    className="text-left rounded-xl px-3 cursor-pointer"
                    style={{ minHeight:52,paddingTop:10,paddingBottom:10,
                      background:sel?`${accent}1c`:"var(--row-base)",
                      border:`1px solid ${sel?accent+"55":"var(--sep)"}`,
                      color:sel?accent:"var(--text)",
                      fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:sel?700:500 }}>
                    <div className="flex justify-between mb-1.5">
                      <span>{sub}</span>
                      <span className="timer-text" style={{ fontFamily:"DM Mono,monospace",fontSize:11,opacity:.7 }}>{sp}%</span>
                    </div>
                    <div className="h-[3px] rounded-full" style={{ background:"var(--track)" }}>
                      <motion.div animate={{ width:`${sp}%` }} transition={{ duration:.6 }}
                        className="h-full rounded-full" style={{ background:accent }}/>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }} transition={{ delay:.12 }}
            className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)",maxHeight:380,overflowY:"auto" }}>
            <p className="text-[10px] tracking-[.2em] uppercase mb-3 sticky top-0 pb-1 z-10 st-sticky" style={{ color:"var(--muted)" }}>
              📋 {syl.selSub?`CHAPTERS — ${syl.selSub.toUpperCase()}`:"CHAPTERS (PICK A SUBJECT)"}
            </p>
            {!syl.selSub?(
              <div className="text-center py-10 text-sm" style={{ color:"var(--muted)" }}>← Select a subject</div>
            ):(
              <div className="flex flex-col gap-1.5">
                {syl.subs[syl.selSub].map((ch,i)=>{
                  const inTask  =taskS.tasks.some(t=>t.text===`${syl.selSub} — ${ch}`);
                  const taskDone=taskS.tasks.find(t=>t.text===`${syl.selSub} — ${ch}`&&t.done);
                  return (
                    <motion.button key={ch}
                      initial={{ opacity:0,x:-8 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*.012 }}
                      whileHover={{ x:2 }} {...TAP} type="button"
                      onClick={()=>handleChapterClick(syl.selSub,ch)}
                      className="flex items-center gap-2.5 rounded-lg px-3 text-left cursor-pointer"
                      style={{ minHeight:40,
                        background:taskDone?`${accent}16`:inTask?`${accent}09`:"var(--row-base)",
                        border:`1px solid ${taskDone?accent+"44":inTask?accent+"22":"var(--sep)"}`,
                        color:taskDone?accent:"var(--text)",fontFamily:"Syne,sans-serif",fontSize:12 }}>
                      <span style={{ fontSize:13,flexShrink:0 }}>{taskDone?"✅":inTask?"🔵":"○"}</span>
                      <span style={{ textDecoration:taskDone?"line-through":"none",opacity:taskDone?.5:1 }}>{ch}</span>
                      {!inTask&&<span className="ml-auto text-[9px] font-bold whitespace-nowrap" style={{ color:accent,opacity:.6 }}>+task ↓</span>}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Task list — separate memo component, zero re-renders from timer */}
        <TaskList
          tasks={taskS.tasks} doneCount={taskS.doneCount}
          onToggle={handleToggleTask} onDelete={taskS.deleteTask} onAdd={taskS.addTask}
          accent={accent} streak={game.streak} playClick={audio.playClick}
        />
      </div>
    );
  }

  function ProgressPage() {
    const bars=[accent,"#f59e0b","#e879f9","#4ade80","#f87171"];
    return (
      <div className="flex flex-col gap-4">
        <motion.div initial={{ opacity:0,y:18 }} animate={{ opacity:1,y:0 }}
          className="st-card glass rounded-2xl border p-6 text-center"
          style={{ background:`linear-gradient(135deg,${accent}18,transparent)`,borderColor:`${accent}44`,boxShadow:`0 0 50px ${glow}` }}>
          <motion.div animate={{ rotate:[0,6,-6,0] }} transition={{ repeat:Infinity,duration:4 }} style={{ fontSize:50,marginBottom:6 }}>🏆</motion.div>
          <p className="font-rajdhani font-bold timer-text" style={{ fontSize:"clamp(38px,10vw,50px)",color:accent }}>{game.level}</p>
          <p className="text-sm mb-4" style={{ color:"var(--muted)" }}>Current Level</p>
          <div className="h-2 rounded-full overflow-hidden max-w-xs mx-auto" style={{ background:"var(--track)" }}>
            <motion.div initial={{ width:0 }} animate={{ width:`${Math.min(100,game.xp/(XP_LV*game.level)*100)}%` }}
              transition={{ duration:1.5,ease:"easeOut" }} className="h-full rounded-full xp-bar"/>
          </div>
          <p className="text-xs mt-2 font-mono timer-text" style={{ color:"var(--muted)" }}>{game.xp} / {XP_LV*game.level} XP → Level {game.level+1}</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {[{e:"📚",v:syl.doneCh,l:"Chapters"},{e:"⚔️",v:taskS.doneCount,l:"Tasks"},{e:"🍅",v:game.sessions.length,l:"Sessions"}].map((s,i)=>(
            <motion.div key={i} initial={{ opacity:0,scale:.9 }} animate={{ opacity:1,scale:1 }} transition={{ delay:i*.08 }}
              className="st-card glass rounded-2xl border p-4 text-center" style={{ borderColor:"var(--border)" }}>
              <div style={{ fontSize:24,marginBottom:4 }}>{s.e}</div>
              <p className="font-rajdhani font-bold timer-text" style={{ fontSize:28,color:accent }}>{s.v}</p>
              <p className="text-[10px] tracking-widest" style={{ color:"var(--muted)" }}>{s.l}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.15 }}
          className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)" }}>
          <p className="text-[10px] tracking-[.2em] uppercase mb-4" style={{ color:"var(--muted)" }}>📊 SUBJECT BREAKDOWN</p>
          <div className="flex flex-col gap-4">
            {Object.entries(syl.subs).map(([sub,chs],i)=>{
              const d=chs.filter(c=>syl.chapters[`${sub}::${c}`]).length,sp=Math.round(d/chs.length*100),bc=bars[i%bars.length];
              return (
                <motion.div key={sub} initial={{ opacity:0,x:-16 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*.07 }}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold" style={{ color:"var(--text)" }}>{sub}</span>
                    <span className="font-bold text-xs timer-text" style={{ color:bc,fontFamily:"DM Mono,monospace" }}>{d}/{chs.length} · {sp}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background:"var(--track)" }}>
                    <motion.div initial={{ width:0 }} animate={{ width:`${sp}%` }} transition={{ duration:1,delay:i*.1,ease:"easeOut" }}
                      className="h-full rounded-full" style={{ background:`linear-gradient(90deg,${bc},${bc}99)`,boxShadow:`0 0 10px ${bc}55` }}/>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:.22 }}
          className="st-card glass rounded-2xl border p-5" style={{ borderColor:"var(--border)" }}>
          <p className="text-[10px] tracking-[.2em] uppercase mb-4" style={{ color:"var(--muted)" }}>🏅 ACHIEVEMENTS</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[{e:"🔥",l:"First Blood",d:"Complete 1 chapter",ok:syl.doneCh>=1},{e:"⚡",l:"On Fire",d:"5 chapters done",ok:syl.doneCh>=5},{e:"🎯",l:"Quest Master",d:"Finish 5 tasks",ok:taskS.doneCount>=5},{e:"🍅",l:"Pomo Pro",d:"Log 3 sessions",ok:game.sessions.length>=3},{e:"⭐",l:"Rising Star",d:"Reach Level 2",ok:game.level>=2},{e:"💎",l:"Diamond Mind",d:"50% syllabus done",ok:syl.pct>=50}].map((a,i)=>(
              <motion.div key={i} initial={{ opacity:0,scale:.9 }} animate={{ opacity:1,scale:1 }} transition={{ delay:i*.05 }}
                className="rounded-xl p-3"
                style={{ background:a.ok?`${accent}12`:"var(--row-base)",border:`1px solid ${a.ok?accent+"33":"var(--sep)"}`,opacity:a.ok?1:.42 }}>
                <div style={{ fontSize:22,marginBottom:3 }}>{a.ok?a.e:"🔒"}</div>
                <p className="text-xs font-semibold" style={{ color:"var(--text)" }}>{a.l}</p>
                <p className="text-[10px]" style={{ color:"var(--muted)" }}>{a.d}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── ROOT RENDER ─────────────────────────────────────────────────────────────
  // The outer div has NO dynamic className — background comes from CSS var.
  // Theme changes update :root variables; this div never gets a class swap.
  return (
    <ThemeCtx.Provider value={pal}>
      <div className="app-shell" style={{ minHeight:"100dvh" }}>

        <Sidebar page={page} setPage={setPage} open={sidebarOpen} setOpen={setSidebarOpen}
          accent={accent} xp={game.xp} level={game.level} playClick={audio.playClick}/>

        <BottomNav page={page} setPage={setPage} accent={accent} playClick={audio.playClick}/>

        <main className="st-main" style={{ minHeight:"100dvh" }}>
          <Header
            page={page} accent={accent} streak={game.streak} xp={game.xp} meta={meta}
            timerMode={timer.timerMode} running={timer.running} swRun={timer.swRun}
            phase={timer.phase} timerSec={timer.timerSec} swTime={timer.swTime}
            showTheme={showTheme} setShowTheme={setShowTheme}
            themeId={themeId} setThemeId={setThemeId}
            setShowExam={setShowExam} switchExam={syl.switchExam} exam={syl.exam}
            mutedUI={audio.mutedUI} onToggleMute={audio.toggleMute} playClick={audio.playClick}
          />

          {showTheme && <div className="fixed inset-0 z-[49]" onClick={()=>setShowTheme(false)}/>}

          <div className="px-4 md:px-6 pt-4 pb-24 md:pb-6 max-w-[900px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={page}
                initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-14 }}
                transition={{ duration:.18 }}>
                {page==="dashboard" && <Dashboard/>}
                {page==="timer"     && (
                  <TimerPanel
                    timer={timer} accent={accent} glow={glow}
                    subs={syl.subs} sessions={game.sessions}
                  />
                )}
                {page==="progress"  && <ProgressPage/>}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <AnimatePresence>
          {showExam && <ExamModal exam={syl.exam} onSelect={syl.switchExam} onClose={()=>setShowExam(false)}/>}
        </AnimatePresence>

        {game.lvlUp && <LevelUpToast level={game.lvlUp} accent={accent} onDone={()=>game.setLvlUp(null)}/>}
      </div>
    </ThemeCtx.Provider>
  );
}
