'use client';

import { useEffect, useRef, useState } from 'react';
import { defaultSeasonForMonth, isSeason, SEASONS, type Season } from '@/lib/season';

// Palettes port the "차곡 계절 배경 · 버전 1" design canvas; colours are the
// kraft tokens from globals.css so the particles read as part of the app.

type Shape = 'petal' | 'leaf' | 'snow';

type Palette = {
  colors: string[];
  fall: number;
  drift: number;
  spin: number;
  shape: Shape;
};

const PALETTES: Record<Season, Palette> = {
  봄: { colors: ['#e6b9be', '#efd0cf', '#d99aa6', '#f0e3da'], fall: 0.16, drift: 1.1, spin: 0.6, shape: 'petal' },
  여름: { colors: ['#6f8064', '#829170', '#93a37e', '#5f7256'], fall: 0.22, drift: 1.1, spin: 0.7, shape: 'leaf' },
  가을: { colors: ['#b8623d', '#c9884f', '#a06a37', '#6f8064'], fall: 0.3, drift: 1.4, spin: 1, shape: 'leaf' },
  겨울: { colors: ['#fbf7ee', '#efe9dc', '#e5dccc', '#f4f0e6'], fall: 0.26, drift: 0.7, spin: 0.15, shape: 'snow' },
};

const DENSITY_MIN = 20;
const DENSITY_MAX = 140;
const DENSITY_DEFAULT = 70;

const LS_SEASON = 'chagok.bg.season';
const LS_DENSITY = 'chagok.bg.density';
const LS_MOTION = 'chagok.bg.motion';

// Every localStorage / Intl access is guarded — private mode, blocked storage
// and SSR must all fall back rather than throw.

function readLS(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
}

function seoulMonth(): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(new Date())
    );
  } catch {
    return new Date().getMonth() + 1;
  }
}

function initialSeason(): Season {
  const stored = readLS(LS_SEASON);
  if (isSeason(stored)) return stored;
  return defaultSeasonForMonth(seoulMonth());
}

function initialDensity(): number {
  const n = Number(readLS(LS_DENSITY));
  if (Number.isFinite(n) && n >= DENSITY_MIN && n <= DENSITY_MAX) return n;
  return DENSITY_DEFAULT;
}

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

/** Explicit user choice wins; otherwise follow the OS "reduce motion" setting. */
function initialMotion(): boolean {
  const stored = readLS(LS_MOTION);
  if (stored === 'on') return true;
  if (stored === 'off') return false;
  return !prefersReducedMotion();
}

// Plain imperative engine — owns the canvas, the rAF loop, and the
// pointer/resize listeners; React just builds and tears it down.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  va: number;
  c: string;
  o: number;
};

class ParticleField {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private t = 0;
  private particles: Particle[] = [];
  private pal: Palette = PALETTES['가을'];
  private shape: Shape = 'leaf';
  private mouse = { x: -9999, y: -9999 };
  private animate: boolean;
  private running = false;

  constructor(
    private canvas: HTMLCanvasElement,
    season: Season,
    density: number,
    animate: boolean
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.animate = animate;
    this.pal = PALETTES[season];
    this.shape = this.pal.shape;

    this.resize();
    this.seed(density);

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });

    this.step();
    if (animate) this.start();
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  /** Turn the drift on/off at runtime (the control's "움직임" toggle). */
  setAnimate(on: boolean): void {
    this.animate = on;
    if (on) {
      this.start();
    } else {
      this.stop();
      this.step();
    }
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.step();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setSeason(season: Season): void {
    this.pal = PALETTES[season];
    this.shape = this.pal.shape;
    for (const q of this.particles) {
      q.c = this.pal.colors[(Math.random() * this.pal.colors.length) | 0];
      q.vy = this.pal.fall * (0.6 + Math.random() * 0.9);
      q.vx = (Math.random() - 0.5) * this.pal.drift;
    }
    if (!this.animate) this.step();
  }

  setDensity(density: number): void {
    const target = Math.max(1, Math.round(density));
    const current = this.particles.length;
    if (target > current) {
      for (let i = 0; i < target - current; i++) {
        this.particles.push(this.make(Math.random() * this.w, Math.random() * this.h));
      }
    } else if (target < current) {
      this.particles.splice(0, current - target);
    }
    if (!this.animate) this.step();
  }

  private onResize = (): void => {
    this.resize();
    if (!this.animate) this.step();
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private make(x: number, y: number): Particle {
    const p = this.pal;
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * p.drift,
      vy: p.fall * (0.6 + Math.random() * 0.9),
      r: 4 + Math.random() * 7,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.05 * p.spin,
      c: p.colors[(Math.random() * p.colors.length) | 0],
      o: 0.3 + Math.random() * 0.45,
    };
  }

  private seed(count: number): void {
    const n = Math.max(1, Math.round(count));
    const arr: Particle[] = [];
    for (let i = 0; i < n; i++) arr.push(this.make(Math.random() * this.w, Math.random() * this.h));
    this.particles = arr;
  }

  private step(): void {
    const { ctx, w, h, pal } = this;
    this.t += 1;
    ctx.clearRect(0, 0, w, h);
    const mx = this.mouse.x;
    const my = this.mouse.y;
    const wind = this.animate
      ? Math.sin(this.t * 0.006) * 0.24 + Math.sin(this.t * 0.013) * 0.11
      : 0;

    for (const q of this.particles) {
      if (this.animate) {
        const dx = q.x - mx;
        const dy = q.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 24000) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / 155) * 2.1;
          q.vx += (dx / d) * f;
          q.vy += (dy / d) * f * 0.55;
        }
        q.vx += wind * 0.04;
        q.vx *= 0.985;
        q.vy = q.vy * 0.985 + pal.fall * 0.02;
        q.x += q.vx;
        q.y += q.vy;
        q.a += q.va + q.vx * 0.01;

        if (q.y > h + 24) {
          q.y = -24;
          q.x = Math.random() * w;
          q.vy = Math.abs(pal.fall) * (0.6 + Math.random());
        }
        if (q.x < -34) q.x = w + 20;
        if (q.x > w + 34) q.x = -20;
      }

      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.a);
      ctx.globalAlpha = Math.max(0, Math.min(1, q.o));
      ctx.fillStyle = q.c;
      if (this.shape === 'snow') {
        ctx.beginPath();
        ctx.arc(0, 0, q.r * 0.5, 0, 7);
        ctx.fill();
      } else if (this.shape === 'petal') {
        ctx.beginPath();
        ctx.ellipse(0, 0, q.r, q.r * 0.52, 0, 0, 7);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -q.r);
        ctx.quadraticCurveTo(q.r, -q.r * 0.2, q.r * 0.32, q.r);
        ctx.quadraticCurveTo(0, q.r * 0.55, -q.r * 0.32, q.r);
        ctx.quadraticCurveTo(-q.r, -q.r * 0.2, 0, -q.r);
        ctx.fill();
        ctx.strokeStyle = 'rgba(58,47,38,0.16)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -q.r);
        ctx.lineTo(0, q.r);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

export default function SeasonalBackground() {
  const [mounted, setMounted] = useState(false);
  // Lazy initializers run once and are `window`-guarded, so the value is right
  // from the first client render; the component still renders nothing until
  // `mounted` flips, so SSR and hydration always agree (both render null).
  const [season, setSeason] = useState<Season>(() =>
    typeof window === 'undefined' ? '가을' : initialSeason()
  );
  const [density, setDensity] = useState(() =>
    typeof window === 'undefined' ? DENSITY_DEFAULT : initialDensity()
  );
  const [motion, setMotion] = useState(() =>
    typeof window === 'undefined' ? true : initialMotion()
  );
  const [open, setOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<ParticleField | null>(null);

  useEffect(() => {
    // Deliberately effect + setState (like TaskBoard's notif-permission probe):
    // the component renders `null` on the server and the first client render,
    // and only reveals itself strictly after mount — no hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Build / tear down the particle field once the canvas exists.
  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    let field: ParticleField | null = null;
    try {
      field = new ParticleField(canvasRef.current, season, density, motion);
      fieldRef.current = field;
    } catch {
      fieldRef.current = null;
    }
    return () => {
      field?.destroy();
      fieldRef.current = null;
    };
    // Season/density/motion changes are pushed imperatively below, not by rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    fieldRef.current?.setSeason(season);
  }, [season]);

  useEffect(() => {
    fieldRef.current?.setDensity(density);
  }, [density]);

  useEffect(() => {
    fieldRef.current?.setAnimate(motion);
  }, [motion]);

  function pickSeason(next: Season) {
    setSeason(next);
    writeLS(LS_SEASON, next);
  }

  function changeDensity(next: number) {
    setDensity(next);
    writeLS(LS_DENSITY, String(next));
  }

  function toggleMotion() {
    setMotion((on) => {
      const next = !on;
      writeLS(LS_MOTION, next ? 'on' : 'off');
      return next;
    });
  }

  if (!mounted) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 block h-full w-full"
      />

      <div className="pointer-events-auto fixed bottom-6 right-6 z-40 text-[13px] text-ink">
        {open ? (
          <div className="w-64 rounded-card border border-hairline bg-[rgba(251,247,238,0.95)] p-4 shadow-float backdrop-blur-sm">
            <div className="flex items-center justify-between font-bold">
              <span>배경</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="배경 설정 닫기"
                className="flex rounded-btn p-0.5 text-muted-soft transition-colors hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex gap-1">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickSeason(s)}
                  aria-pressed={season === s}
                  className={`flex-1 rounded-btn border py-1.5 text-[12.5px] transition-colors ${
                    season === s
                      ? 'border-primary bg-primary font-semibold text-on-primary'
                      : 'border-hairline text-body hover:bg-surface-soft'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-baseline justify-between text-xs text-muted">
              <span>밀도</span>
              <b className="font-semibold text-ink">{density}개</b>
            </div>
            <input
              type="range"
              min={DENSITY_MIN}
              max={DENSITY_MAX}
              step={10}
              value={density}
              onChange={(e) => changeDensity(Number(e.target.value))}
              aria-label="배경 밀도"
              className="mt-2 w-full accent-[#b8623d]"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted">움직임</span>
              <button
                type="button"
                role="switch"
                aria-checked={motion}
                aria-label="배경 움직임"
                onClick={toggleMotion}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  motion ? 'bg-primary' : 'bg-surface-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-canvas shadow-sm transition-all ${
                    motion ? 'left-[1.125rem]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-strip border border-hairline bg-[rgba(251,247,238,0.9)] px-4 py-2 shadow-float backdrop-blur-sm transition-colors hover:text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
            </svg>
            <span>{season}</span>
          </button>
        )}
      </div>
    </>
  );
}
