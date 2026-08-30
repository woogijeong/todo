'use client';

import { useEffect, useRef, useState } from 'react';
import { CELEBRATE_EVENT, type CelebrationKind } from '@/lib/celebrate';

const COLORS = ['#b8623d', '#c9884f', '#6f8064', '#d9a94f', '#dca87e', '#f0e3d0', '#3a2f26'];

type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  a: number;
  va: number;
  sway: number;
  c: string;
};

class Confetti {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private running = false;
  private bits: Bit[] = [];
  private flash = 0;
  private reduced: boolean;

  constructor(private canvas: HTMLCanvasElement, reduced: boolean) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.reduced = reduced;
    this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = (): void => this.resize();

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  fire(): void {
    if (!this.ctx) return;
    const cx = this.w / 2;
    const cy = this.h * 0.42;
    this.flash = 1;
    this.spawn(this.reduced ? 44 : 30, cx, cy, true);
    if (!this.reduced) {
      window.setTimeout(() => this.spawn(64, cx, 0, false), 110);
      window.setTimeout(() => this.spawn(46, cx, 0, false), 480);
    }
    this.ensureLoop();
  }

  private spawn(count: number, cx: number, cy: number, fromCenter: boolean): void {
    for (let i = 0; i < count; i++) {
      const strip = Math.random() < 0.35;
      this.bits.push({
        x: fromCenter ? cx + (Math.random() - 0.5) * 120 : Math.random() * this.w,
        y: fromCenter ? cy : -20 - Math.random() * 140,
        vx: (Math.random() - 0.5) * (fromCenter ? 9 : 2.4),
        vy: fromCenter ? -(2 + Math.random() * 6) : 1 + Math.random() * 2.5,
        w: strip ? 3 + Math.random() * 2 : 7 + Math.random() * 6,
        h: strip ? 12 + Math.random() * 10 : 7 + Math.random() * 6,
        a: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 0.3,
        sway: Math.random() * Math.PI * 2,
        c: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
    this.ensureLoop();
  }

  private ensureLoop(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    const loop = () => {
      if (!this.ctx) {
        this.running = false;
        return;
      }
      this.step();
      if (this.bits.length || this.flash > 0.01) {
        this.raf = requestAnimationFrame(loop);
      } else {
        this.running = false;
        this.ctx.clearRect(0, 0, this.w, this.h);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private step(): void {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    if (this.flash > 0.01) {
      const r = (1 - this.flash) * Math.max(w, h) * 0.5 + 40;
      const g = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, r);
      g.addColorStop(0, `rgba(217,169,79,${this.flash * 0.5})`);
      g.addColorStop(1, 'rgba(217,169,79,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      this.flash *= 0.9;
    }

    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.sway += 0.06;
      b.vy = Math.min(b.vy + 0.12, 6.5);
      b.x += b.vx + Math.sin(b.sway) * 0.9;
      b.y += b.vy;
      b.vx *= 0.99;
      b.a += b.va;
      if (b.y > h + 40) {
        this.bits.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * (0.6 + 0.4 * Math.abs(Math.cos(b.sway))));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

export default function CelebrationOverlay() {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Confetti | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let engine: Confetti | null = null;
    try {
      engine = new Confetti(canvasRef.current, reduced);
      engineRef.current = engine;
    } catch {
      engineRef.current = null;
    }

    const onCelebrate = (e: Event) => {
      // `kind` is available on the event for future per-kind styling; the
      // confetti is the same for 'goal' and 'day' today.
      void (e as CustomEvent<{ kind: CelebrationKind }>).detail;
      engineRef.current?.fire();
    };
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);

    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
      engine?.destroy();
      engineRef.current = null;
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 block h-full w-full"
    />
  );
}
