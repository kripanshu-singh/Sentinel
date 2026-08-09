"use client";

import { useEffect, useRef } from "react";

/**
 * CtaBloom — Dark obsidian panel with an animated teal radial bloom.
 * Uses Canvas 2D (no WebGL needed) — renders on OffscreenCanvas in a
 * requestAnimationFrame loop. Very low GPU cost.
 *
 * The bloom is a soft, breathing radial gradient centered slightly above
 * center, with a handful of orbiting "flare" particles to give life.
 * Degrades to a static teal radial gradient via CSS if canvas is unavailable.
 */
export function CtaBloom() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // Particles — orbit the central bloom
    const PARTICLE_COUNT = 22;
    type Particle = {
      angle: number;
      radius: number;
      speed: number;
      size: number;
      opacity: number;
    };

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 60 + Math.random() * 200,
      speed: (0.0003 + Math.random() * 0.0004) * (Math.random() < 0.5 ? 1 : -1),
      size: 1 + Math.random() * 2.5,
      opacity: 0.15 + Math.random() * 0.35,
    }));

    let rafId: number;
    let start: number | null = null;

    function frame(ts: number) {
      if (!canvas || !ctx) return;
      if (start === null) start = ts;
      const elapsed = ts - start;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Background — obsidian (#1a1f21 ≈ brand inverse-surface)
      ctx.fillStyle = "#15191b";
      ctx.fillRect(0, 0, w, h);

      // Central bloom
      const cx = w * 0.5;
      const cy = h * 0.38;
      const breath = 0.85 + 0.15 * Math.sin(elapsed * 0.001);
      const bloomR = Math.min(w, h) * 0.65 * breath;

      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
      bloom.addColorStop(0,    "rgba(107,216,203, 0.25)"); // #6bd8cb 25%
      bloom.addColorStop(0.3,  "rgba(0,130,120,  0.14)"); // mid teal 14%
      bloom.addColorStop(0.65, "rgba(0,104, 95,  0.06)"); // #00685f 6%
      bloom.addColorStop(1,    "rgba(0,  0,  0,  0)");

      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      // Second, smaller inner glow for punch
      const innerR = Math.min(w, h) * 0.2 * breath;
      const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
      inner.addColorStop(0,   "rgba(107,216,203, 0.45)");
      inner.addColorStop(0.6, "rgba(107,216,203, 0.10)");
      inner.addColorStop(1,   "rgba(107,216,203, 0)");

      ctx.fillStyle = inner;
      ctx.fillRect(0, 0, w, h);

      // Orbiting particles
      for (const p of particles) {
        p.angle += p.speed;
        const px = cx + Math.cos(p.angle) * p.radius * dpr;
        const py = cy + Math.sin(p.angle) * p.radius * dpr * 0.45;

        ctx.beginPath();
        ctx.arc(px, py, p.size * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(107,216,203,${p.opacity * (0.6 + 0.4 * breath)})`;
        ctx.fill();
      }

      // Subtle noise grid overlay (uses pattern via repeated rects)
      ctx.fillStyle = "rgba(107,216,203,0.025)";
      const gridSize = 64 * dpr;
      for (let gx = 0; gx < w; gx += gridSize) {
        ctx.fillRect(gx, 0, 1, h);
      }
      for (let gy = 0; gy < h; gy += gridSize) {
        ctx.fillRect(0, gy, w, 1);
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
