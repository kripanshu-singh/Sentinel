"use client";

import { useEffect, useRef } from "react";

/**
 * HeroCanvas — GPU-accelerated organic noise mesh that breathes in Sentinel teal.
 * Rendered via WebGL with a simplex-noise-like shader. Falls back gracefully if
 * WebGL is unavailable (canvas simply invisible; grid-floor CSS remains visible).
 *
 * Mouse position softly biases the noise phase, giving a subtle "alive" response
 * without being distracting.
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return; // silent fallback — CSS grid floor still shows

    // ── Resize ────────────────────────────────────────────────────────────────
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    function resize() {
      if (!canvas || !gl) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // ── Mouse tracking ────────────────────────────────────────────────────────
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetX = 0.5;
    let targetY = 0.5;

    function onMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width;
      targetY = 1 - (e.clientY - rect.top) / rect.height;
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // ── Shader source ─────────────────────────────────────────────────────────
    const vert = `
      attribute vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;

    // Organic noise mesh — biased toward Sentinel teal (#00685f / #6bd8cb)
    const frag = `
      precision mediump float;

      uniform float u_time;
      uniform vec2  u_res;
      uniform vec2  u_mouse;

      // Hash helpers
      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 17.5);
        return fract(p.x * p.y);
      }

      // 2D value noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i),             hash(i + vec2(1,0)), u.x),
          mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
          u.y
        );
      }

      // Fractional brownian motion (5 octaves)
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;
        float aspect = u_res.x / u_res.y;
        vec2 p = uv * vec2(aspect, 1.0);

        // Mouse-biased phase drift (subtle — max 0.3 shift)
        vec2 mBias = (u_mouse - 0.5) * 0.3;

        float t = u_time * 0.08;
        float n1 = fbm(p * 2.0 + t + mBias);
        float n2 = fbm(p * 3.5 - t * 0.7 + vec2(n1 * 1.8));
        float n = mix(n1, n2, 0.55);

        // Sentinel teal palette
        // deep: #00685f → rgb(0, 104, 95)
        // light: #6bd8cb → rgb(107, 216, 203)
        vec3 deep  = vec3(0.0, 0.408, 0.373);
        vec3 light = vec3(0.42, 0.847, 0.796);
        vec3 bg    = vec3(0.969, 0.976, 0.984); // #f7f9fb

        // Use n to blend between bg and a soft teal haze
        float mask = smoothstep(0.4, 0.75, n);
        vec3  col  = mix(bg, mix(deep, light, mask * 0.6), mask * 0.14);

        // Radial vignette — brightest at top-center where content lives
        float dist = length((uv - vec2(0.5, 0.75)) * vec2(1.0, 1.4));
        float vignette = 1.0 - smoothstep(0.4, 1.1, dist);
        col = mix(bg, col, vignette);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    // ── Compile shaders ───────────────────────────────────────────────────────
    function compile(type: number, src: string): WebGLShader | null {
      if (!gl) return null;
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("Shader error:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Program link error:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // ── Fullscreen quad ───────────────────────────────────────────────────────
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime  = gl.getUniformLocation(prog, "u_time");
    const uRes   = gl.getUniformLocation(prog, "u_res");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    // ── Render loop ───────────────────────────────────────────────────────────
    let rafId: number;
    let start: number | null = null;

    function frame(ts: number) {
      if (!gl || !canvas) return;
      if (start === null) start = ts;
      const elapsed = (ts - start) / 1000;

      // Smooth mouse
      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;

      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
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
