"use client";

import { useEffect, useRef } from "react";

type M4 = Float32Array;

function m4Identity(): M4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function m4Multiply(a: M4, b: M4): M4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

function m4Perspective(fovy: number, aspect: number, near: number, far: number): M4 {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function m4LookAt(eye: number[], center: number[], up: number[]): M4 {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz);
  if (len === 0) {
    zx = 0;
    zy = 0;
    zz = 1;
  } else {
    zx /= len;
    zy /= len;
    zz /= len;
  }
  let sx = up[1] * zz - up[2] * zy;
  let sy = up[2] * zx - up[0] * zz;
  let sz = up[0] * zy - up[1] * zx;
  len = Math.hypot(sx, sy, sz);
  if (len === 0) {
    sx = 1;
    sy = 0;
    sz = 0;
  } else {
    sx /= len;
    sy /= len;
    sz /= len;
  }
  const ux = zy * sz - zz * sy;
  const uy = zz * sx - zx * sz;
  const uz = zx * sy - zy * sx;
  const out = new Float32Array(16);
  out[0] = sx;
  out[4] = sy;
  out[8] = sz;
  out[1] = ux;
  out[5] = uy;
  out[9] = uz;
  out[2] = -zx;
  out[6] = -zy;
  out[10] = -zz;
  out[12] = -(sx * eye[0] + sy * eye[1] + sz * eye[2]);
  out[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
  out[14] = zx * eye[0] + zy * eye[1] + zz * eye[2];
  out[3] = 0;
  out[7] = 0;
  out[11] = 0;
  out[15] = 1;
  return out;
}

function m4Translate(m: M4, x: number, y: number, z: number): M4 {
  const t = new Float32Array(m);
  t[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
  t[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
  t[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
  t[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return t;
}

const GRID_VERT = `
  attribute vec3 a_pos;
  attribute float a_fade;
  uniform mat4 u_mvp;
  uniform float u_time;
  varying float v_fade;
  void main() {
    vec3 p = a_pos;
    p.z += sin(p.x * 0.5 + u_time * 0.9) * 0.24;
    v_fade = a_fade;
    gl_Position = u_mvp * vec4(p, 1.0);
  }
`;

const GRID_FRAG = `
  precision mediump float;
  varying float v_fade;
  uniform vec3 u_color;
  uniform float u_alpha;
  void main() {
    float a = v_fade * u_alpha;
    gl_FragColor = vec4(u_color * a, a);
  }
`;

const PART_VERT = `
  attribute vec3 a_pos;
  attribute float a_fade;
  attribute float a_size;
  uniform mat4 u_mvp;
  varying float v_fade;
  void main() {
    vec4 clip = u_mvp * vec4(a_pos, 1.0);
    gl_Position = clip;
    v_fade = a_fade;
    gl_PointSize = clamp(a_size / clip.w, 1.5, 46.0);
  }
`;

const PART_FRAG = `
  precision mediump float;
  varying float v_fade;
  uniform vec3 u_color;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float core = smoothstep(0.5, 0.0, length(d));
    float a = core * core * v_fade;
    gl_FragColor = vec4(u_color * a, a);
  }
`;

const FS_QUAD_VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const GLOW_FRAG = `
  precision mediump float;
  uniform vec2 u_res;
  uniform vec2 u_center;
  uniform float u_time;
  uniform float u_alpha;
  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    vec2 d = uv - u_center;
    d.x *= u_res.x / u_res.y;
    float r = length(d);
    float breath = 0.88 + 0.12 * sin(u_time * 0.9);
    float a = smoothstep(0.42, 0.0, r) * breath * u_alpha;
    vec3 col = mix(vec3(0.42, 0.847, 0.796), vec3(0.0, 0.5, 0.45), clamp(r * 2.0, 0.0, 1.0));
    gl_FragColor = vec4(col * a, a);
  }
`;

const BG_RGB: [number, number, number] = [0.969, 0.976, 0.984];
const GRID_COLOR: [number, number, number] = [0.0, 0.46, 0.42];
const PART_COLOR: [number, number, number] = [0.0, 0.62, 0.56];

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function createShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("hero-canvas shader error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vsSrc: string,
  fsSrc: string
): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("hero-canvas program link error:", gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;

    const glMaybe = canvasEl.getContext("webgl2") ?? canvasEl.getContext("webgl");
    if (!glMaybe) return;
    const gl: WebGL2RenderingContext | WebGLRenderingContext = glMaybe;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // ── Programs ───────────────────────────────────────────────────────────────
    const gridProg = createProgram(gl, GRID_VERT, GRID_FRAG);
    const partProg = createProgram(gl, PART_VERT, PART_FRAG);
    const glowProg = createProgram(gl, FS_QUAD_VERT, GLOW_FRAG);
    if (!gridProg || !partProg || !glowProg) return;

    gl.useProgram(gridProg);
    const gridPos = gl.getAttribLocation(gridProg, "a_pos");
    const gridFade = gl.getAttribLocation(gridProg, "a_fade");
    const gridMvp = gl.getUniformLocation(gridProg, "u_mvp");
    const gridTime = gl.getUniformLocation(gridProg, "u_time");
    const gridColor = gl.getUniformLocation(gridProg, "u_color");
    const gridAlpha = gl.getUniformLocation(gridProg, "u_alpha");

    gl.useProgram(partProg);
    const partPos = gl.getAttribLocation(partProg, "a_pos");
    const partFade = gl.getAttribLocation(partProg, "a_fade");
    const partSize = gl.getAttribLocation(partProg, "a_size");
    const partMvp = gl.getUniformLocation(partProg, "u_mvp");
    const partColor = gl.getUniformLocation(partProg, "u_color");

    gl.useProgram(glowProg);
    const glowPos = gl.getAttribLocation(glowProg, "a_pos");
    const glowRes = gl.getUniformLocation(glowProg, "u_res");
    const glowCenter = gl.getUniformLocation(glowProg, "u_center");
    const glowTime = gl.getUniformLocation(glowProg, "u_time");
    const glowAlpha = gl.getUniformLocation(glowProg, "u_alpha");

    // ── Grid geometry (static) ─────────────────────────────────────────────────
    const CELL = 1.75;
    const X_MIN = -14;
    const X_MAX = 14;
    const Z_MIN = -43;
    const Z_MAX = 6.25;

    const gridPts: number[] = [];
    const gridFds: number[] = [];
    for (let x = X_MIN; x <= X_MAX + 1e-6; x += CELL) {
      gridPts.push(x, 0, Z_MAX, x, 0, Z_MIN);
      gridFds.push(1 - smoothstep(3, 40, 7 - Z_MAX), 1 - smoothstep(3, 40, 7 - Z_MIN));
    }
    for (let z = Z_MIN; z <= Z_MAX + 1e-6; z += CELL) {
      gridPts.push(X_MIN, 0, z, X_MAX, 0, z);
      const f = 1 - smoothstep(3, 40, 7 - z);
      gridFds.push(f, f);
    }

    const gridBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridPts), gl.STATIC_DRAW);
    const gridFadeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridFadeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridFds), gl.STATIC_DRAW);
    const gridCount = gridPts.length / 3;

    // ── Particles (dynamic) ────────────────────────────────────────────────────
    const PCOUNT = 84;
    const parts = Array.from({ length: PCOUNT }, () => ({
      x: (Math.random() * 2 - 1) * 12.5,
      z: -18 - Math.random() * 26,
      speed: 1.3 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
      amp: 0.35 + Math.random() * 1.2,
      freq: 0.3 + Math.random() * 0.9,
    }));
    const pPos = new Float32Array(PCOUNT * 3);
    const pFade = new Float32Array(PCOUNT);
    const pSize = new Float32Array(PCOUNT);
    for (let i = 0; i < PCOUNT; i++) pSize[i] = 185 * dpr;

    const partBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pPos.length * 4, gl.DYNAMIC_DRAW);
    const partFadeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, partFadeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pFade.length * 4, gl.DYNAMIC_DRAW);
    const partSizeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, partSizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pSize, gl.STATIC_DRAW);

    // ── Fullscreen quad (glow) ─────────────────────────────────────────────────
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    // ── Interaction ────────────────────────────────────────────────────────────
    const mouse = { u: 0.5, v: 0.5 };
    const mouseTarget = { u: 0.5, v: 0.5 };
    function onMouseMove(e: MouseEvent) {
      mouseTarget.u = e.clientX / window.innerWidth;
      mouseTarget.v = e.clientY / window.innerHeight;
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    let visible = true;
    let rafId = 0;
    let start: number | null = null;
    let last = 0;

    function projectNdc(mvp: M4, x: number, y: number, z: number): [number, number] {
      const v = [x, y, z, 1];
      const o = [0, 0, 0, 0];
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let c = 0; c < 4; c++) s += mvp[c * 4 + r] * v[c];
        o[r] = s;
      }
      const w = o[3] || 1;
      return [o[0] / w, o[1] / w];
    }

    function frame(ts: number) {
      rafId = requestAnimationFrame(frame);
      if (!visible) return;
      if (start === null) {
        start = ts;
        last = ts;
      }
      const elapsed = (ts - start) / 1000;
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;

      mouse.u += (mouseTarget.u - mouse.u) * 0.05;
      mouse.v += (mouseTarget.v - mouse.v) * 0.05;

      // ── Camera + matrices ─────────────────────────────────────────────────────
      const aspect = canvas.width / canvas.height;
      const proj = m4Perspective((52 * Math.PI) / 180, aspect, 0.1, 200);

      const scroll = window.scrollY || 0;
      const eye: number[] = [
        (mouse.u - 0.5) * 1.6,
        2.55 + (mouse.v - 0.5) * 0.5 + scroll * 0.0035,
        7.4,
      ];
      const target: number[] = [
        (mouse.u - 0.5) * 0.7,
        -0.4 - (mouse.v - 0.5) * 0.35 - scroll * 0.0028,
        -15,
      ];
      const view = m4LookAt(eye, target, [0, 1, 0]);

      const stream = (elapsed * 1.5) % CELL;
      const model = m4Translate(m4Identity(), 0, 0, stream);
      const mvp = m4Multiply(proj, m4Multiply(view, model));

      gl.clearColor(BG_RGB[0], BG_RGB[1], BG_RGB[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);

      // ── Horizon glow ──────────────────────────────────────────────────────────
      const [gx, gy] = projectNdc(mvp, 0, 0, -200);
      gl.useProgram(glowProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(glowPos);
      gl.vertexAttribPointer(glowPos, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform2f(glowRes, canvas.width, canvas.height);
      gl.uniform2f(glowCenter, (gx + 1) / 2, (1 - gy) / 2);
      gl.uniform1f(glowTime, elapsed);
      gl.uniform1f(glowAlpha, 0.16);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // ── Grid floor ────────────────────────────────────────────────────────────
      gl.useProgram(gridProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
      gl.enableVertexAttribArray(gridPos);
      gl.vertexAttribPointer(gridPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridFadeBuf);
      gl.enableVertexAttribArray(gridFade);
      gl.vertexAttribPointer(gridFade, 1, gl.FLOAT, false, 0, 0);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(gridMvp, false, mvp);
      gl.uniform1f(gridTime, elapsed);
      gl.uniform3f(gridColor, GRID_COLOR[0], GRID_COLOR[1], GRID_COLOR[2]);
      gl.uniform1f(gridAlpha, 0.4);
      gl.drawArrays(gl.LINES, 0, gridCount);

      // ── Event packets ─────────────────────────────────────────────────────────
      for (let i = 0; i < PCOUNT; i++) {
        const p = parts[i];
        p.z += p.speed * dt;
        if (p.z > 4.5) {
          p.z = -44 - Math.random() * 6;
          p.x = (Math.random() * 2 - 1) * 12.5;
        }
        const px = p.x + Math.sin(elapsed * p.freq + p.phase) * p.amp;
        pPos[i * 3] = px;
        pPos[i * 3 + 1] = 0;
        pPos[i * 3 + 2] = p.z;
        pFade[i] =
          smoothstep(-44, -9, p.z) * (1 - smoothstep(1.2, 4.2, p.z));
      }
      gl.useProgram(partProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pPos);
      gl.enableVertexAttribArray(partPos);
      gl.vertexAttribPointer(partPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, partFadeBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pFade);
      gl.enableVertexAttribArray(partFade);
      gl.vertexAttribPointer(partFade, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, partSizeBuf);
      gl.enableVertexAttribArray(partSize);
      gl.vertexAttribPointer(partSize, 1, gl.FLOAT, false, 0, 0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniformMatrix4fv(partMvp, false, mvp);
      gl.uniform3f(partColor, PART_COLOR[0], PART_COLOR[1], PART_COLOR[2]);
      gl.drawArrays(gl.POINTS, 0, PCOUNT);
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { rootMargin: "200px" }
    );
    io.observe(canvas);

    if (reduced) {
      frame(performance.now());
      cancelAnimationFrame(rafId);
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      [gridProg, partProg, glowProg].forEach((p) => {
        if (p) gl.deleteProgram(p);
      });
      [gridBuf, gridFadeBuf, partBuf, partFadeBuf, partSizeBuf, quadBuf].forEach(
        (b) => {
          if (b) gl.deleteBuffer(b);
        }
      );
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