import {
  useState, useEffect, useLayoutEffect, useRef,
  useCallback, useMemo, memo, createContext, useContext,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  BookOpen, Timer, TrendingUp, Menu, X,
  Flame, Play, Pause, RotateCcw, Home,
  CheckCircle2, Circle, Trash2, Plus, Palette, ChevronDown,
  Volume2, VolumeX, AlertTriangle, Download,
} from "lucide-react";
import confetti from "canvas-confetti";

// ─────────────────────────────────────────────────────────────────────────────
// § CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const BURNOUT_THRESHOLD = 120 * 60; // 120 minutes in seconds
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

const PALETTES = {
  dark:  { id:"dark",  cls:"",        light:false },
  light: { id:"light", cls:"t-light", light:true  },
  neon:  { id:"neon",  cls:"t-neon",  light:false },
};

// ─────────────────────────────────────────────────────────────────────────────
// § UTILS
// ─────────────────────────────────────────────────────────────────────────────
const LS = {
  r:(k,d)=>{ try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):d;}catch{return d;} },
  w:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
};
const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const today = () => new Date().toDateString();

// ─────────────────────────────────────────────────────────────────────────────
// § HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);
  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };
  return { isInstallable: !!deferredPrompt, install };
}

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
  const [totalWork, setTotalWork] = useState(0); // For Burnout Monitoring

  const rafRef      = useRef(null);
  const swRafRef    = useRef(null);
  const deadlineRef = useRef(0);
  const live        = useRef({});
  live.current      = { phase, pomoDur, brkDur, topic };

  useEffect(() => {
    if (!running || timerMode !== "pomodoro") {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    deadlineRef.current = performance.now() + 1000;
    const tick = (now) => {
      if (now >= deadlineRef.current) {
        deadlineRef.current += 1000;
        setTimerSec(s => {
          if (s > 1) {
            if (live.current.phase === "work") setTotalWork(tw => tw + 1);
            return s - 1;
          }
          cancelAnimationFrame(rafRef.current);
          setRunning(false);
          playAlarm?.();
          const { phase:ph, pomoDur:pd, brkDur:bd, topic:tp } = live.current;
          if (ph === "work") {
            onXpEarned?.(XP_POMO);
            onPomoComplete?.({ subject:tp||"General Study", dur:pd, time:new Date().toLocaleTimeString() });
            setPhase("break");
            return bd * 60;
          }
          setPhase("work");
          setTotalWork(0); // Reset burnout on successful long break
          return pd * 60;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, timerMode, onPomoComplete, onXpEarned, playAlarm]);

  useEffect(() => {
    if (!swRun) return;
    const sTick = () => {
      setSwTime(s => s + 1);
      swRafRef.current = setTimeout(sTick, 1000);
    };
    swRafRef.current = setTimeout(sTick, 1000);
    return () => clearTimeout(swRafRef.current);
  }, [swRun]);

  const resetTimer = useCallback(() => {
    setRunning(false); setSwRun(false);
    if (timerMode==="pomodoro") { setTimerSec(pomoDur*60); setPhase("work"); setTotalWork(0); }
    else setSwTime(0);
  }, [timerMode,pomoDur]);

  return { timerMode,pomoDur,setPomoDur,brkDur,setBrkDur,timerSec,running,setRunning,phase,swTime,swRun,setSwRun,topic,setTopic,resetTimer,setTimerMode,totalWork };
}

// ─────────────────────────────────────────────────────────────────────────────
// § COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const CanvasRing = memo(function CanvasRing({ pct, ghostPct, accent, size=220 }) {
  const cv = useRef(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useLayoutEffect(() => {
    const c = cv.current; if (!c) return;
    const px = size * dpr;
    c.width = px; c.height = px;
    c.style.width = `${size}px`; c.style.height = `${size}px`;
  }, [size, dpr]);

  useEffect(() => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext("2d");
    const px = size * dpr;
    const cx = px / 2, cy = px / 2;
    const r = (size - 14) / 2 * dpr;
    ctx.clearRect(0, 0, px, px);

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 6 * dpr;
    ctx.stroke();

    // Ghost Metric (Past Self)
    if (ghostPct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*ghostPct);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.setLineDash([4 * dpr, 6 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Main Progress
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 8 * dpr;
      ctx.lineCap = "round";
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10 * dpr;
      ctx.stroke();
    }
  }, [pct, ghostPct, accent, size, dpr]);

  return <canvas ref={cv} className="timer-canvas absolute inset-0" />;
});

const MasteryHeatmap = memo(function MasteryHeatmap({ subjects, chapters, onChapterClick, tasks, accent }) {
  return (
    <div className="flex flex-col gap-6">
      {Object.entries(subjects).map(([sub, chs]) => (
        <div key={sub} className="flex flex-col gap-2">
          <h4 className="text-[10px] font-bold tracking-[0.2em] opacity-50 uppercase">{sub}</h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14px,1fr))] gap-1.5">
            {chs.map(ch => {
              const isDone = chapters[`${sub}::${ch}`];
              const inTasks = tasks.some(t => t.text === `${sub} — ${ch}` && !t.done);
              const color = isDone ? "#22c55e" : inTasks ? "#eab308" : "var(--track)";
              return (
                <motion.div
                  key={ch}
                  whileHover={{ scale: 1.3 }}
                  onClick={() => onChapterClick(sub, ch)}
                  className="heatmap-cell"
                  title={ch}
                  style={{ background: color, boxShadow: isDone ? `0 0 8px #22c55e44` : 'none' }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § ROOT APP
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const pwa = usePWA();
  const [xp, setXp] = useState(() => LS.r("st_xp", 0));
  const [level, setLevel] = useState(() => LS.r("st_lv", 1));
  const [streak, setStreak] = useState(() => LS.r("st_strk", 0));
  const [exam, setExam] = useState(() => LS.r("st_exam", null));
  const [grade, setGrade] = useState(() => LS.r("st_grade", null));
  const [chapters, setChapters] = useState(() => LS.r("st_ch", {}));
  const [tasks, setTasks] = useState(() => LS.r("st_tasks", []));
  const [sessions, setSessions] = useState(() => LS.r("st_sess", []));
  const [page, setPage] = useState("dashboard");
  const [themeId, setThemeId] = useState(() => LS.r("st_theme", "dark"));
  const [burnoutAlert, setBurnoutAlert] = useState(false);

  const meta = EXAM_META[exam] || EXAM_META.JEE;
  const accent = meta.accent;

  const timer = useRAFTimer({
    onPomoComplete: (s) => setSessions(p => [...p, s]),
    onXpEarned: (amt) => setXp(p => {
        let nx = p + amt;
        let nl = level;
        if (nx >= XP_LV * nl) { nx -= (XP_LV * nl); nl++; burst(accent); }
        setLevel(nl);
        return nx;
    }),
    playAlarm: () => { try { new Audio(SOUND_URLS.alarm).play() } catch(e){} }
  });

  const isBurnout = timer.totalWork >= BURNOUT_THRESHOLD;

  useEffect(() => {
    if (isBurnout && !burnoutAlert) {
      setBurnoutAlert(true);
      // Non-intrusive notification logic could go here
    }
  }, [isBurnout, burnoutAlert]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const pal = PALETTES[themeId] || PALETTES.dark;
    Object.values(PALETTES).forEach(p => p.cls && root.classList.remove(p.cls));
    if (pal.cls) root.classList.add(pal.cls);
    
    if (isBurnout) {
      root.classList.add("burnout-active");
    } else {
      root.classList.remove("burnout-active");
      root.style.setProperty("--ac", accent);
      root.style.setProperty("--glow", meta.glow);
    }
  }, [themeId, accent, meta.glow, isBurnout]);

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (!t.done) {
        setXp(p => p + XP_TASK);
        if (t.auto) {
          const [s, c] = t.text.split(" — ");
          setChapters(prevCh => ({ ...prevCh, [`${s}::${c}`]: true }));
        }
      }
      return { ...t, done: !t.done };
    }));
  };

  const addChapterTask = (sub, ch) => {
    const txt = `${sub} — ${ch}`;
    if (tasks.some(t => t.text === txt)) return;
    setTasks(p => [...p, { id: Date.now(), text: txt, done: false, auto: true }]);
  };

  function burst(color) {
    confetti({ particleCount:100, spread:70, origin:{y:0.6}, colors:[color, "#ffffff"] });
  }

  // ── RENDER ONBOARDING ───────────────────────────────────────────────────
  if (!exam || !grade) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-6 text-center">
            <div className="max-w-md w-full">
                <h1 className="text-4xl font-bold tracking-tighter mb-8 text-white">FocusOS <span className="text-cyan-400">v2</span></h1>
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {Object.entries(EXAM_META).map(([k, v]) => (
                        <button key={k} onClick={() => setExam(k)} className="st-card p-6 hover:border-cyan-500/50 transition-all">
                            <span className="text-3xl block mb-2">{v.emoji}</span>
                            <span className="font-bold text-sm text-zinc-400">{v.label}</span>
                        </button>
                    ))}
                </div>
                {exam && (
                    <div className="flex flex-col gap-2">
                        {EXAM_META[exam].grades.map(g => (
                            <button key={g} onClick={() => setGrade(g)} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10">
                                {g}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="app-shell min-h-screen flex">
      {/* PROFESSIONAL SIDEBAR */}
      <aside className="w-[70px] hidden md:flex flex-col items-center py-6 border-r border-white/5 fixed h-full bg-zinc-950/50 glass z-50">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-black text-xl mb-10">F</div>
        <nav className="flex flex-col gap-6">
            <button onClick={() => setPage("dashboard")} className={`p-3 rounded-xl transition-all ${page==="dashboard"?"bg-cyan-500/10 text-cyan-400":"text-zinc-600"}`}><Home size={20}/></button>
            <button onClick={() => setPage("timer")} className={`p-3 rounded-xl transition-all ${page==="timer"?"bg-cyan-500/10 text-cyan-400":"text-zinc-600"}`}><Timer size={20}/></button>
            <button onClick={() => setPage("progress")} className={`p-3 rounded-xl transition-all ${page==="progress"?"bg-cyan-500/10 text-cyan-400":"text-zinc-600"}`}><TrendingUp size={20}/></button>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
             <button onClick={() => setThemeId(t=>t==="dark"?"light":"dark")} className="p-3 text-zinc-600"><Palette size={20}/></button>
             {pwa.isInstallable && <button onClick={pwa.install} className="p-3 text-cyan-400"><Download size={20}/></button>}
        </div>
      </aside>

      <main className="flex-1 md:ml-[70px] p-4 md:p-8 max-w-6xl mx-auto w-full pb-24">
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{page.toUpperCase()}</h2>
                <p className="text-xs text-zinc-500 font-medium tracking-widest">{exam} • {grade}</p>
            </div>
            <div className="flex gap-3">
                <div className="st-card px-4 py-2 flex items-center gap-2 glass">
                    <Flame size={16} className="text-orange-500"/>
                    <span className="timer-text text-sm">{streak}D</span>
                </div>
                <div className="st-card px-4 py-2 flex items-center gap-2 glass">
                    <span className="text-cyan-400 font-black text-xs">LVL {level}</span>
                </div>
            </div>
        </header>

        <AnimatePresence mode="wait">
            {page === "dashboard" && (
                <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} className="grid md:grid-cols-2 gap-8">
                    <section>
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-sm font-bold tracking-widest text-zinc-500">SYLLABUS MASTERY</h3>
                            <span className="text-xs text-cyan-400 font-bold">{Math.round((Object.values(chapters).filter(Boolean).length / Object.values(SUBJECTS[exam]).flat().length)*100)}% Complete</span>
                        </div>
                        <div className="st-card p-6 glass">
                            <MasteryHeatmap 
                                subjects={SUBJECTS[exam]} 
                                chapters={chapters} 
                                tasks={tasks}
                                onChapterClick={addChapterTask}
                                accent={accent}
                            />
                        </div>
                    </section>

                    <section className="flex flex-col gap-8">
                        <div>
                            <h3 className="text-sm font-bold tracking-widest text-zinc-500 mb-4 uppercase">Daily Quests</h3>
                            <div className="flex flex-col gap-2">
                                {tasks.map(t => (
                                    <div key={t.id} className="st-card p-4 glass flex items-center gap-4">
                                        <button onClick={() => toggleTask(t.id)} className={t.done ? "text-green-500" : "text-zinc-700"}>
                                            {t.done ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                        </button>
                                        <span className={`text-sm font-medium flex-1 ${t.done ? "text-zinc-600 line-through" : ""}`}>{t.text}</span>
                                        <button onClick={() => setTasks(p => p.filter(x => x.id !== t.id))} className="text-zinc-800 hover:text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                <div className="mt-2 flex gap-2">
                                    <input 
                                        id="new-task-input"
                                        name="new-task"
                                        type="text" 
                                        placeholder="Add mission..." 
                                        className="flex-1 px-4 py-3 text-sm"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && e.target.value.trim()) {
                                                setTasks(p => [...p, {id: Date.now(), text: e.target.value, done: false}]);
                                                e.target.value = "";
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                </motion.div>
            )}

            {page === "timer" && (
                <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="max-w-md mx-auto">
                    <div className="st-card p-10 glass text-center relative overflow-hidden">
                        {burnoutAlert && isBurnout && (
                             <div className="absolute top-4 left-0 right-0 px-4">
                                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-2 flex items-center gap-2 justify-center">
                                    <AlertTriangle size={14} className="text-red-500"/>
                                    <span className="text-[10px] font-bold text-red-500 uppercase">Brain Saturation: Recovery Advised</span>
                                </div>
                             </div>
                        )}

                        <div className="relative w-[220px] h-[220px] mx-auto mb-8">
                            <CanvasRing 
                                pct={timer.timerSec / (timer.phase === "work" ? timer.pomoDur*60 : timer.brkDur*60)} 
                                ghostPct={0.7} // Hardcoded 70% average for the "Ghost" ring
                                accent={isBurnout ? "var(--warn)" : accent}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[10px] tracking-[0.3em] font-bold opacity-40 uppercase mb-1">{timer.phase}</span>
                                <span className="timer-text text-5xl">{fmt(timer.timerSec)}</span>
                            </div>
                        </div>

                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={() => timer.setRunning(!timer.running)}
                                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform"
                            >
                                {timer.running ? <Pause size={24}/> : <Play size={24} fill="black"/>}
                            </button>
                            <button onClick={timer.resetTimer} className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                                <RotateCcw size={20}/>
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </main>

      {/* MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass border-t border-white/5 flex items-center justify-around z-50">
            <button onClick={() => setPage("dashboard")} className={page==="dashboard"?"text-cyan-400":"text-zinc-600"}><Home/></button>
            <button onClick={() => setPage("timer")} className={page==="timer"?"text-cyan-400":"text-zinc-600"}><Timer/></button>
            <button onClick={() => setPage("progress")} className={page==="progress"?"text-cyan-400":"text-zinc-600"}><TrendingUp/></button>
      </nav>
    </div>
  );
}
