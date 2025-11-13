import { useEffect, useMemo, useRef, useState } from 'react'

// Tomato Bauhaus theme values come from CSS variables defined in index.css
const defaultConfig = {
  focus: 25,
  short: 5,
  long: 15,
  cycles: 4,
  autoStart: true,
}

const pad = (n) => String(n).padStart(2, '0')

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }, [key, value])
  return [value, setValue]
}

function useInterval(callback, delay) {
  const savedCallback = useRef()
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])
  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => savedCallback.current && savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

export default function Pomodoro() {
  const [config, setConfig] = useLocalStorage('pomodoro-config', defaultConfig)
  const [phase, setPhase] = useLocalStorage('pomodoro-phase', 'focus') // 'focus' | 'short' | 'long'
  const [cycle, setCycle] = useLocalStorage('pomodoro-cycle', 1)
  const [secondsLeft, setSecondsLeft] = useState(() => config[phase] * 60)
  const [running, setRunning] = useLocalStorage('pomodoro-running', false)

  const totalSeconds = useMemo(() => config[phase] * 60, [config, phase])

  // Sync secondsLeft when phase or config changes
  useEffect(() => {
    setSecondsLeft((prev) => (prev > totalSeconds ? totalSeconds : prev))
  }, [totalSeconds])

  // Tick
  useInterval(
    () => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          onComplete()
          return 0
        }
        return s - 1
      })
    },
    running ? 1000 : null
  )

  // Audio cue using Web Audio API (no assets required)
  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      o.start()
      o.stop(ctx.currentTime + 0.28)
    } catch {}
  }

  const nextPhase = () => {
    if (phase === 'focus') {
      if (cycle % config.cycles === 0) return 'long'
      return 'short'
    }
    return 'focus'
  }

  const onComplete = () => {
    beep()
    const np = nextPhase()
    if (np === 'focus' && phase !== 'focus') {
      setCycle((c) => (c % config.cycles) + 1)
    }
    setPhase(np)
    setSecondsLeft(config[np] * 60)
    if (!config.autoStart) setRunning(false)
  }

  const start = () => setRunning(true)
  const pause = () => setRunning(false)
  const reset = () => {
    setRunning(false)
    setSecondsLeft(config[phase] * 60)
  }

  const setPhaseManual = (p) => {
    setPhase(p)
    setSecondsLeft(config[p] * 60)
    setRunning(false)
  }

  const pct = Math.max(0, Math.min(1, secondsLeft / totalSeconds))
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  // SVG circle metrics
  const R = 120
  const C = 2 * Math.PI * R
  const dash = C * pct

  // Handle keyboard space to start/pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setRunning((r) => !r)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="w-full max-w-3xl mx-auto px-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight uppercase" style={{letterSpacing: '0.02em'}}>
          Tomato Tempo
        </h1>
        <div className="hidden sm:flex items-center gap-2 text-xs uppercase">
          <span className="badge">Focus</span>
          <span className="badge">Short Break</span>
          <span className="badge">Long Break</span>
        </div>
      </header>

      <div className="relative grid sm:grid-cols-[1fr_auto] gap-8 items-center">
        <div className="relative rounded-2xl p-6 sm:p-10 border-4 border-[var(--ink)] bg-[var(--paper)] shadow-hard">
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-[var(--tomato)] rounded-full blur-2xl opacity-60 pointer-events-none"></div>
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-[var(--sun)] rounded-full blur-2xl opacity-50 pointer-events-none"></div>

          <div className="flex items-center gap-2 mb-6">
            {['focus','short','long'].map((p) => (
              <button
                key={p}
                onClick={() => setPhaseManual(p)}
                className={`tab ${phase===p ? 'tab-active' : ''}`}
              >
                {p === 'focus' ? 'Focus' : p === 'short' ? 'Short' : 'Long'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={config.autoStart}
                  onChange={(e) => setConfig({...config, autoStart: e.target.checked})}
                />
                <span>Auto</span>
              </label>
            </div>
          </div>

          <div className="grid place-items-center py-4">
            <div className="relative">
              <svg width={300} height={300} viewBox="0 0 300 300" className="drop">
                <circle cx="150" cy="150" r={R} fill="none" stroke="var(--grid)" strokeWidth="18"/>
                <circle cx="150" cy="150" r={R} fill="none" strokeDasharray={`${dash} ${C}`} strokeLinecap="round" stroke="var(--tomato)" strokeWidth="18" className="transition-all duration-300"/>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="font-mono text-6xl sm:text-7xl tracking-tighter">
                    {pad(minutes)}:{pad(seconds)}
                  </div>
                  <div className="uppercase text-xs tracking-[0.25em] mt-2 opacity-80">
                    {phase === 'focus' ? `Cycle ${cycle} / ${config.cycles}` : phase === 'short' ? 'Short Break' : 'Long Break'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            {!running ? (
              <button className="btn btn-primary" onClick={start}>Start</button>
            ) : (
              <button className="btn btn-ghost" onClick={pause}>Pause</button>
            )}
            <button className="btn btn-ghost" onClick={reset}>Reset</button>
          </div>
        </div>

        <aside className="rounded-2xl p-6 border-4 border-[var(--ink)] bg-[var(--paper)] shadow-hard sm:w-72">
          <h3 className="font-display text-xl uppercase mb-4">Settings</h3>
          <div className="space-y-4">
            {[
              {k:'focus', label:'Focus (min)'},
              {k:'short', label:'Short Break (min)'},
              {k:'long', label:'Long Break (min)'}
            ].map(({k,label}) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <label className="text-sm uppercase tracking-wider opacity-90">{label}</label>
                <div className="num">
                  <button onClick={() => setConfig({...config, [k]: Math.max(1, config[k]-1)})}>−</button>
                  <span>{config[k]}</span>
                  <button onClick={() => setConfig({...config, [k]: Math.min(180, config[k]+1)})}>+</button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm uppercase tracking-wider opacity-90">Cycles</label>
              <div className="num">
                <button onClick={() => setConfig({...config, cycles: Math.max(1, config.cycles-1)})}>−</button>
                <span>{config.cycles}</span>
                <button onClick={() => setConfig({...config, cycles: Math.min(12, config.cycles+1)})}>+</button>
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs leading-relaxed opacity-80">
            Tip: Press Space to start/pause. The timer will auto-advance through breaks.
          </p>
        </aside>
      </div>

      <footer className="mt-10 flex items-center justify-between text-[13px] opacity-80">
        <div className="inline-flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--tomato)] inline-block"></span>
          <span>Pomodoro rhythm for deliberate focus.</span>
        </div>
        <a className="underline hover:no-underline" href="/test">Backend Test</a>
      </footer>
    </div>
  )
}
