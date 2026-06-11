import React, { useEffect, useRef, useState } from "react";

const COLORS = {
  background: "#0a0a0a",
  blade: "#E3B93C",
  bladeEdge: "#A8862B",
  ring: "#8A7B5C",
  text: "#F7F3EA",
  subtext: "#E8D5A3",
};

const BLADES = 9;
const CYCLE_MS = 3880;
const OPEN_PHASE = 0.65;
const MIN_APERTURE = 0.10;
const MAX_APERTURE = 0.80;
const BLADE_SWEEP = Math.PI * 0.55;
const FADE_MS = 600;

function openFracToBladeAngle(frac) {
  const apertureR = MIN_APERTURE + frac * (MAX_APERTURE - MIN_APERTURE);
  return 2 * Math.asin(Math.min(1, apertureR / 2));
}

export default function ApertureLoader({ done = false, onComplete }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const fadeStartRef = useRef(null);
  const doneStartRef = useRef(null);
  const doneStartFracRef = useRef(0);
  const doneRef = useRef(done);
  const onCompleteRef = useRef(onComplete);

  doneRef.current = done;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();

    const draw = (now) => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, w, h);

      const t = ((now - start) % CYCLE_MS) / CYCLE_MS;
      let frac, opening;
      if (t < OPEN_PHASE) {
        frac = t / OPEN_PHASE;
        opening = true;
      } else {
        opening = false;
        frac = 1 - (t - OPEN_PHASE) / (1 - OPEN_PHASE);
      }

      let alpha = 1;
      if (doneRef.current) {
        if (doneStartRef.current === null) {
          doneStartRef.current = now;
          doneStartFracRef.current = frac;
        }
        const startFrac = doneStartFracRef.current;
        const openDur = Math.max(250, (1 - startFrac) * 900);
        const k = Math.min(1, (now - doneStartRef.current) / openDur);
        frac = startFrac + (1 - startFrac) * k;
        opening = true;
        if (k >= 1) {
          if (fadeStartRef.current === null) fadeStartRef.current = now;
          const f = (now - fadeStartRef.current) / FADE_MS;
          alpha = Math.max(0, 1 - f);
          if (alpha === 0) {
            onCompleteRef.current?.();
            return;
          }
        }
      }

      ctx.globalAlpha = alpha;

      const cx = w / 2;
      const cy = h / 2 - 40;
      const R = Math.min(w, h) * 0.22;
      const phi = openFracToBladeAngle(frac);

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.ring;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha * 0.4;
      ctx.stroke();
      ctx.globalAlpha = alpha;

      // Blades
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      for (let i = 0; i < BLADES; i++) {
        const pivotAngle = (i * 2 * Math.PI) / BLADES;
        const px = cx + R * Math.cos(pivotAngle);
        const py = cy + R * Math.sin(pivotAngle);
        const toCenter = pivotAngle + Math.PI;
        const innerEnd = toCenter + phi;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, R, innerEnd, innerEnd + BLADE_SWEEP);
        ctx.closePath();
        ctx.fillStyle = COLORS.blade;
        ctx.fill();
        ctx.strokeStyle = COLORS.bladeEdge;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      ctx.restore();

      // KLIKLY wordmark
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#FFD700";
      ctx.font = "900 36px 'Rubik', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "6px";
      ctx.fillText("KLIKLY", cx, cy + R + 52);

      // Subtitle
      ctx.fillStyle = COLORS.subtext;
      ctx.font = "400 15px 'Rubik', Arial, sans-serif";
      ctx.letterSpacing = "0px";
      ctx.fillText("מערכת ניהול צלמים", cx, cy + R + 78);

      // Loading dots
      const dots = Math.floor((now / 500) % 4);
      const dotsStr = "טוען" + ".".repeat(dots);
      ctx.fillStyle = "#555";
      ctx.font = "400 12px 'Rubik', Arial, sans-serif";
      ctx.fillText(dotsStr, cx, cy + R + 106);

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.background,
        zIndex: 9999,
      }}
      role="status"
      aria-label="טוען..."
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}