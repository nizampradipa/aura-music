import { useEffect, useRef } from 'react';
import type { CoverPalette, MoodMode, VisualizerQuality, VisualizerStyle } from '../types/music';

interface VisualizerCanvasProps {
  palette: CoverPalette;
  style: VisualizerStyle;
  mode: MoodMode;
  quality: VisualizerQuality;
  isPlaying: boolean;
  trackId: string | null;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  depth: number;
  phase: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  from: [number, number, number],
  to: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
}

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha.toFixed(3)})`;
}

function resolveEffectiveQuality(quality: VisualizerQuality): 'high' | 'low' {
  if (quality !== 'auto') return quality;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const isSmall = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  return cores <= 4 || isSmall ? 'low' : 'high';
}

export function VisualizerCanvas({
  palette,
  style,
  mode,
  quality,
  isPlaying,
  trackId,
}: VisualizerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store latest reactive parameters in refs so the RAF loop runs smoothly without resetting
  const targetPaletteRef = useRef<CoverPalette>(palette);
  const currentPaletteRef = useRef<{
    dominant: [number, number, number];
    vibrant: [number, number, number];
    muted: [number, number, number];
    deep: [number, number, number];
  }>({
    dominant: [...palette.dominantRgb],
    vibrant: [...palette.vibrantRgb],
    muted: [...palette.mutedRgb],
    deep: [...palette.deepRgb],
  });

  const configRef = useRef({
    style,
    mode,
    quality,
    isPlaying,
  });

  const transitionPulseRef = useRef(0);

  useEffect(() => {
    targetPaletteRef.current = palette;
  }, [palette]);

  useEffect(() => {
    configRef.current = { style, mode, quality, isPlaying };
  }, [style, mode, quality, isPlaying]);

  useEffect(() => {
    // Gentle swell whenever track changes
    transitionPulseRef.current = 1;
  }, [trackId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReduced = reducedMotionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
    };
    reducedMotionQuery.addEventListener('change', onMotionChange);

    // Pre-seed deterministic particles for Orbit style
    const particles: Particle[] = Array.from({ length: 68 }, (_, i) => {
      const seed = (i * 2654435761) % 1000 / 1000;
      const seed2 = ((i + 17) * 1597334677) % 1000 / 1000;
      return {
        angle: seed * Math.PI * 2,
        radius: 0.14 + seed2 * 0.44,
        speed: (0.04 + seed * 0.08) * (i % 2 === 0 ? 1 : -1),
        size: 1.1 + seed2 * 2.4,
        depth: 0.35 + seed * 0.65,
        phase: seed2 * Math.PI * 2,
      };
    });

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const eff = resolveEffectiveQuality(configRef.current.quality);
      dpr = Math.min(window.devicePixelRatio || 1, eff === 'high' ? 1.5 : 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    let lastTime = performance.now();
    let simTime = 0;
    let velocity = configRef.current.isPlaying ? 1 : 0.08;
    let hidden = document.hidden;

    const renderFrame = (now: number) => {
      const cfg = configRef.current;
      const effQuality = resolveEffectiveQuality(cfg.quality);

      // Night mode caps refresh rate gently (~30fps) to save GPU & battery
      const minFrameMs = cfg.mode === 'night' ? 32 : effQuality === 'low' ? 24 : 15;
      const dtMs = now - lastTime;
      if (!prefersReduced && dtMs < minFrameMs) {
        rafId = window.requestAnimationFrame(renderFrame);
        return;
      }

      const dt = Math.min(dtMs / 1000, 0.1);
      lastTime = now;

      // Crossfade palette smoothly over ~800ms
      const colorStep = Math.min(1, dt * 2.4);
      const target = targetPaletteRef.current;
      const cur = currentPaletteRef.current;
      cur.dominant = lerpRgb(cur.dominant, target.dominantRgb, colorStep);
      cur.vibrant = lerpRgb(cur.vibrant, target.vibrantRgb, colorStep);
      cur.muted = lerpRgb(cur.muted, target.mutedRgb, colorStep);
      cur.deep = lerpRgb(cur.deep, target.deepRgb, colorStep);

      // Night mode gently warms the deep/dominant field toward candlelit amber
      const warmMix = cfg.mode === 'night' ? 0.24 : 0;
      const warmTint: [number, number, number] = [214, 134, 68];
      const dom = warmMix > 0 ? lerpRgb(cur.dominant, warmTint, warmMix * 0.55) : cur.dominant;
      const vib = warmMix > 0 ? lerpRgb(cur.vibrant, warmTint, warmMix) : cur.vibrant;
      const mut = cur.muted;
      const deep = cur.deep;

      // Ease velocity gently toward idle when paused
      const modeSpeed = cfg.mode === 'night' ? 0.32 : cfg.mode === 'focus' ? 0.48 : 1;
      const targetVelocity = prefersReduced ? 0 : cfg.isPlaying ? modeSpeed : modeSpeed * 0.09;
      velocity = lerp(velocity, targetVelocity, Math.min(1, dt * 2.5));
      simTime += dt * velocity;
      transitionPulseRef.current = Math.max(0, transitionPulseRef.current - dt * 0.7);

      const brightness = cfg.mode === 'night' ? 0.62 : cfg.mode === 'focus' ? 0.84 : 1;
      const swell = transitionPulseRef.current;

      // 1. Base obsidian-tinted room backdrop
      ctx.globalCompositeOperation = 'source-over';
      const baseGrad = ctx.createLinearGradient(0, 0, width, height);
      baseGrad.addColorStop(0, rgba(deep, 1));
      baseGrad.addColorStop(0.55, rgba(lerpRgb(deep, dom, 0.28 * brightness), 1));
      baseGrad.addColorStop(1, rgba(lerpRgb(deep, [5, 6, 9], 0.55), 1));
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      const minDim = Math.min(width, height);
      const cx = width * 0.5;
      const cy = height * 0.5;

      if (prefersReduced) {
        // Static atmospheric washes for reduced motion
        const g1 = ctx.createRadialGradient(
          width * 0.28,
          height * 0.35,
          0,
          width * 0.28,
          height * 0.35,
          minDim * 0.78
        );
        g1.addColorStop(0, rgba(dom, 0.42 * brightness));
        g1.addColorStop(1, rgba(deep, 0));
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);

        const g2 = ctx.createRadialGradient(
          width * 0.74,
          height * 0.64,
          0,
          width * 0.74,
          height * 0.64,
          minDim * 0.7
        );
        g2.addColorStop(0, rgba(vib, 0.24 * brightness));
        g2.addColorStop(1, rgba(deep, 0));
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, width, height);
        return;
      }

      if (cfg.style === 'flow') {
        // Multi-lobe luminous silk light fields
        ctx.globalCompositeOperation = 'screen';
        const lobes = effQuality === 'high' ? 4 : 3;
        for (let i = 0; i < lobes; i += 1) {
          const phase = simTime * (0.19 + i * 0.055) + i * 1.9;
          const ox = cx + Math.cos(phase * 0.85) * width * (0.24 + i * 0.04);
          const oy = cy + Math.sin(phase * 1.1 + i) * height * (0.22 + i * 0.03);
          const r = minDim * (0.48 + 0.14 * Math.sin(phase * 0.7) + swell * 0.06);
          const col = i === 0 ? dom : i === 1 ? vib : mut;
          const alpha = (i === 1 ? 0.28 : 0.34) * brightness;

          const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
          grad.addColorStop(0, rgba(col, alpha));
          grad.addColorStop(0.52, rgba(col, alpha * 0.38));
          grad.addColorStop(1, rgba(col, 0));

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(ox, oy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (cfg.style === 'orbit') {
        // Subtle ambient core wash
        ctx.globalCompositeOperation = 'screen';
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.66);
        halo.addColorStop(0, rgba(dom, 0.36 * brightness));
        halo.addColorStop(0.55, rgba(mut, 0.16 * brightness));
        halo.addColorStop(1, rgba(deep, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);

        // Architectural hairline elliptical orbits
        ctx.save();
        ctx.translate(cx, cy);
        const rings = effQuality === 'high' ? 4 : 3;
        for (let r = 0; r < rings; r += 1) {
          const rx = minDim * (0.22 + r * 0.125);
          const ry = rx * (0.68 + r * 0.05);
          ctx.save();
          ctx.rotate(simTime * (0.04 + r * 0.015) * (r % 2 === 0 ? 1 : -1) + r * 0.55);
          ctx.strokeStyle = rgba(r === 1 ? vib : dom, (0.17 + swell * 0.12) * brightness);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Depth-sorted luminous dust motes
        const count = effQuality === 'high' ? particles.length : 34;
        for (let i = 0; i < count; i += 1) {
          const p = particles[i];
          const a = p.angle + simTime * p.speed;
          const dist = p.radius * minDim * (1 + Math.sin(simTime * 0.5 + p.phase) * 0.04);
          const x = Math.cos(a) * dist * 1.18;
          const y = Math.sin(a) * dist * 0.84;
          const twinkle = 0.55 + 0.45 * Math.sin(simTime * 1.3 + p.phase);
          const col = i % 3 === 0 ? vib : dom;
          const alpha = p.depth * twinkle * (0.55 + swell * 0.25) * brightness;

          ctx.fillStyle = rgba(col, alpha);
          ctx.beginPath();
          ctx.arc(x, y, p.size * p.depth, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        // Pulse: calm concentric acoustic waves breathing outward
        ctx.globalCompositeOperation = 'screen';
        const centerGlow = ctx.createRadialGradient(
          cx,
          cy,
          0,
          cx,
          cy,
          minDim * (0.52 + Math.sin(simTime * 0.8) * 0.04)
        );
        centerGlow.addColorStop(0, rgba(dom, 0.34 * brightness));
        centerGlow.addColorStop(0.65, rgba(vib, 0.13 * brightness));
        centerGlow.addColorStop(1, rgba(deep, 0));
        ctx.fillStyle = centerGlow;
        ctx.fillRect(0, 0, width, height);

        const ringCount = effQuality === 'high' ? 7 : 5;
        const maxR = Math.hypot(width, height) * 0.56;
        for (let i = 0; i < ringCount; i += 1) {
          const progress = ((simTime * 0.12 + i / ringCount) % 1 + 1) % 1;
          const eased = 1 - Math.pow(1 - progress, 1.75);
          const radius = eased * maxR;
          const fade = Math.sin(progress * Math.PI);
          const col = i % 2 === 0 ? vib : dom;
          const alpha = fade * (0.24 + swell * 0.12) * brightness;

          ctx.strokeStyle = rgba(col, alpha);
          ctx.lineWidth = 1.2 + (1 - progress) * 1.6;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, radius), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Soft outer room vignette so controls and lyrics stay effortlessly readable
      ctx.globalCompositeOperation = 'source-over';
      const vignette = ctx.createRadialGradient(
        cx,
        cy,
        minDim * 0.18,
        cx,
        cy,
        Math.hypot(width, height) * 0.65
      );
      vignette.addColorStop(0, 'rgba(6, 7, 11, 0.04)');
      vignette.addColorStop(1, `rgba(5, 6, 10, ${cfg.mode === 'night' ? 0.78 : 0.64})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      if (!hidden) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const startLoop = () => {
      window.cancelAnimationFrame(rafId);
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(renderFrame);
    };

    const onVisibility = () => {
      hidden = document.hidden;
      if (!hidden) {
        startLoop();
      } else {
        window.cancelAnimationFrame(rafId);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    startLoop();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="visualizer-canvas" aria-hidden="true" />;
}
