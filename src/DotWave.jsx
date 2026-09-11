import { useEffect, useRef } from 'react'

const VERTEX_SHADER = `#version 300 es
  in vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`

const FRAGMENT_SHADER = `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  out vec4 fragColor;

  const vec3 BASE = vec3(0.0627, 0.0431, 0.0510); // #100b0d
  const vec3 PLUM_LOW = vec3(0.1843, 0.1373, 0.1451); // #2f2325
  const vec3 WINE_MID = vec3(0.4588, 0.1882, 0.2549); // #753041
  const vec3 DUSTY_HIGH = vec3(0.5647, 0.4314, 0.4549); // #906e74

  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float organicField(vec2 p, float time) {
    vec2 driftA = vec2(time * 0.0306, -time * 0.0216);
    vec2 driftB = vec2(-time * 0.0198, time * 0.0324);
    vec2 warp = vec2(
      snoise(p * 0.92 + driftA + vec2(13.7, 4.1)),
      snoise(p * 0.92 + driftB + vec2(2.8, 17.4))
    ) * 0.42;
    vec2 warped = p * 1.58 + warp;
    float broad = snoise(warped + driftA + vec2(7.2, 11.6)) * 0.5 + 0.5;
    float middle = snoise(warped * 1.62 + driftB + vec2(19.1, 5.7)) * 0.5 + 0.5;
    float detail = snoise(warped * 3.25 - driftA * 0.65 + vec2(31.4, 8.6)) * 0.5 + 0.5;
    return clamp(broad * 0.56 + middle * 0.31 + detail * 0.13, 0.0, 1.0);
  }

  void main() {
    // Six CSS pixels between cells, with a hard-edged square mark in each cell.
    float gridSize = 6.0 * u_pixelRatio;
    vec2 cell = floor(gl_FragCoord.xy / gridSize);
    vec2 cellCenter = (cell + 0.5) * gridSize;
    vec2 cellOffset = abs(gl_FragCoord.xy - cellCenter);
    float aspect = u_resolution.x / u_resolution.y;
    vec2 normalized = vec2(cellCenter.x / u_resolution.x, 1.0 - cellCenter.y / u_resolution.y);
    vec2 p = vec2((normalized.x - 0.5) * aspect, normalized.y);

    float noiseValue = organicField(p, u_time);
    float topEnvelope = 1.0 - smoothstep(0.22, 0.76, normalized.y);
    float edgeDistance = abs(normalized.x * 2.0 - 1.0);
    float sideBoost = mix(0.88, 1.22, pow(edgeDistance, 1.25));

    // Keep a soft, wide central void behind the search surface.
    vec2 voidPoint = vec2((normalized.x - 0.5) / 0.48, (normalized.y - 0.39) / 0.31);
    float centralVoid = 1.0 - smoothstep(0.30, 1.02, length(voidPoint));
    float density = noiseValue * topEnvelope * sideBoost * (1.0 - centralVoid * 0.74) * 1.06;
    // Keep the edge coherent so neighboring cells form connected clouds instead of specks.
    float cellActivity = smoothstep(0.34, 0.56, density);
    float merge = smoothstep(0.46, 0.70, density);
    float halfDot = mix(1.25, 3.12, merge) * u_pixelRatio;
    float square = step(cellOffset.x, halfDot) * step(cellOffset.y, halfDot);
    float strength = square * cellActivity * smoothstep(0.02, 0.72, topEnvelope);

    vec3 ink = mix(PLUM_LOW, WINE_MID, smoothstep(0.25, 0.68, density));
    ink = mix(ink, DUSTY_HIGH, smoothstep(0.70, 0.98, density));
    fragColor = vec4(mix(BASE, ink, strength), 1.0);
  }
`

const clamp01 = (value) => Math.max(0, Math.min(1, value))
const mix = (a, b, amount) => a + (b - a) * amount
const smoothstep = (edge0, edge1, value) => {
  const amount = clamp01((value - edge0) / (edge1 - edge0))
  return amount * amount * (3 - 2 * amount)
}

const simplexNoise = (x, y) => {
  const c0 = 0.211324865405187
  const c1 = 0.366025403784439
  const c2 = -0.577350269189626
  const c3 = 0.024390243902439
  const skew = (x + y) * c1
  let ix = Math.floor(x + skew)
  let iy = Math.floor(y + skew)
  const unskew = (ix + iy) * c0
  const x0 = x - ix + unskew
  const y0 = y - iy + unskew
  const i1x = x0 > y0 ? 1 : 0
  const i1y = x0 > y0 ? 0 : 1
  const x1 = x0 + c0 - i1x
  const y1 = y0 + c0 - i1y
  const x2 = x0 + c2
  const y2 = y0 + c2
  ix = ((ix % 289) + 289) % 289
  iy = ((iy % 289) + 289) % 289
  const permute = (value) => ((value * 34 + 1) * value) % 289
  const p0 = permute(permute(iy) + ix)
  const p1 = permute(permute(iy + i1y) + ix + i1x)
  const p2 = permute(permute(iy + 1) + ix + 1)
  const falloff = (px, py) => Math.pow(Math.max(0.5 - px * px - py * py, 0), 4)
  const gradient = (permutation, px, py) => {
    const gradientX = 2 * ((permutation * c3) - Math.floor(permutation * c3)) - 1
    const h = Math.abs(gradientX) - 0.5
    const offset = Math.floor(gradientX + 0.5)
    const a0 = gradientX - offset
    const correction = 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h)
    return a0 * px * correction + h * py * correction
  }
  return 130 * (
    falloff(x0, y0) * gradient(p0, x0, y0)
    + falloff(x1, y1) * gradient(p1, x1, y1)
    + falloff(x2, y2) * gradient(p2, x2, y2)
  )
}

const fallbackOrganicField = (x, y, time) => {
  const driftAx = time * 0.0306
  const driftAy = -time * 0.0216
  const driftBx = -time * 0.0198
  const driftBy = time * 0.0324
  const warpX = simplexNoise(x * 0.92 + driftAx + 13.7, y * 0.92 + driftAy + 4.1) * 0.42
  const warpY = simplexNoise(x * 0.92 + driftBx + 2.8, y * 0.92 + driftBy + 17.4) * 0.42
  const warpedX = x * 1.58 + warpX
  const warpedY = y * 1.58 + warpY
  const broad = simplexNoise(warpedX + driftAx + 7.2, warpedY + driftAy + 11.6) * 0.5 + 0.5
  const middle = simplexNoise(warpedX * 1.62 + driftBx + 19.1, warpedY * 1.62 + driftBy + 5.7) * 0.5 + 0.5
  const detail = simplexNoise(warpedX * 3.25 - driftAx * 0.65 + 31.4, warpedY * 3.25 - driftAy * 0.65 + 8.6) * 0.5 + 0.5
  return clamp01(broad * 0.56 + middle * 0.31 + detail * 0.13)
}

const colorToCss = (r, g, b) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

const createWebglRenderer = (canvas) => {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false })
  if (!gl) return null
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vertex || !fragment) return null
  const program = gl.createProgram()
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'a_position')
  gl.useProgram(program)
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  return {
    gl,
    program,
    buffer,
    uniforms: {
      time: gl.getUniformLocation(program, 'u_time'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pixelRatio: gl.getUniformLocation(program, 'u_pixelRatio'),
    },
  }
}

export default function DotWave() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas.parentElement
    const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const prefersReducedMotion = () => Boolean(reducedMotionQuery?.matches)
    let width = 1
    let height = 1
    let dpr = 1
    let elapsed = 0
    let frame = 0
    let previousTime = performance.now()
    let lastPaintTime = 0
    const frameInterval = 1000 / 30
    let renderer = createWebglRenderer(canvas)

    if (!renderer) {
      canvas.style.display = 'none'
      const fallbackCanvas = document.createElement('canvas')
      fallbackCanvas.className = 'dot-wave-fallback'
      host.prepend(fallbackCanvas)
      renderer = { context: fallbackCanvas.getContext('2d', { alpha: false }), fallbackCanvas }
    }

    const resize = () => {
      const rect = host.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const deviceDpr = Math.min(window.devicePixelRatio || 1, 1.25)
      const pixelBudgetScale = Math.sqrt(2200000 / (width * height))
      dpr = Math.min(deviceDpr, Math.max(0.5, pixelBudgetScale))
      const pixelWidth = Math.max(1, Math.round(width * dpr))
      const pixelHeight = Math.max(1, Math.round(height * dpr))
      if (renderer.gl) {
        renderer.gl.canvas.width = pixelWidth
        renderer.gl.canvas.height = pixelHeight
        renderer.gl.viewport(0, 0, pixelWidth, pixelHeight)
      } else if (renderer.context) {
        renderer.context.canvas.width = pixelWidth
        renderer.context.canvas.height = pixelHeight
        renderer.context.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    const drawFallback = (time) => {
      const context = renderer.context
      if (!context) return
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#100b0d'
      context.fillRect(0, 0, width, height)
      const gridSize = 6
      const aspect = width / height
      const plumLow = [47, 35, 37]
      const wineMid = [117, 48, 65]
      const dustyHigh = [144, 110, 116]

      for (let y = 0; y < height; y += gridSize) {
        const normalizedY = (y + gridSize * 0.5) / height
        const topEnvelope = 1 - smoothstep(0.22, 0.76, normalizedY)
        if (topEnvelope <= 0.01) continue
        for (let x = 0; x < width; x += gridSize) {
          const normalizedX = (x + gridSize * 0.5) / width
          const pX = (normalizedX - 0.5) * aspect
          const densityNoise = fallbackOrganicField(pX, normalizedY, time)
          const edgeDistance = Math.abs(normalizedX * 2 - 1)
          const sideBoost = mix(0.88, 1.22, edgeDistance ** 1.25)
          const voidX = (normalizedX - 0.5) / 0.48
          const voidY = (normalizedY - 0.39) / 0.31
          const centralVoid = 1 - smoothstep(0.30, 1.02, Math.hypot(voidX, voidY))
          const density = densityNoise * topEnvelope * sideBoost * (1 - centralVoid * 0.74) * 1.06
          const active = smoothstep(0.34, 0.56, density)
          if (active <= 0.01) continue

          const merge = smoothstep(0.46, 0.70, density)
          const halfDot = mix(1.25, 3.12, merge)
          const wineAmount = smoothstep(0.25, 0.68, density)
          let r = mix(plumLow[0], wineMid[0], wineAmount)
          let g = mix(plumLow[1], wineMid[1], wineAmount)
          let b = mix(plumLow[2], wineMid[2], wineAmount)
          const highAmount = smoothstep(0.70, 0.98, density)
          r = mix(r, dustyHigh[0], highAmount)
          g = mix(g, dustyHigh[1], highAmount)
          b = mix(b, dustyHigh[2], highAmount)
          context.fillStyle = colorToCss(r, g, b)
          context.globalAlpha = active * smoothstep(0.02, 0.72, topEnvelope)
          context.fillRect(x + gridSize * 0.5 - halfDot, y + gridSize * 0.5 - halfDot, halfDot * 2, halfDot * 2)
        }
      }
      context.globalAlpha = 1
    }

    const drawWebgl = (time) => {
      const { gl, program, uniforms } = renderer
      gl.useProgram(program)
      gl.uniform1f(uniforms.time, time)
      gl.uniform2f(uniforms.resolution, gl.canvas.width, gl.canvas.height)
      gl.uniform1f(uniforms.pixelRatio, dpr)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    const render = () => {
      if (renderer.gl) drawWebgl(elapsed + 11.0)
      else drawFallback(elapsed + 11.0)
    }

    const paint = (time) => {
      if (document.visibilityState !== 'visible') {
        frame = 0
        return
      }
      if (time - lastPaintTime < frameInterval) {
        frame = requestAnimationFrame(paint)
        return
      }
      const delta = Math.min(0.05, Math.max(0, (time - previousTime) * 0.001))
      previousTime = time
      lastPaintTime = time
      if (!prefersReducedMotion()) elapsed += delta
      render()
      frame = requestAnimationFrame(paint)
    }

    const start = () => {
      if (frame || document.visibilityState !== 'visible') return
      previousTime = performance.now()
      lastPaintTime = 0
      if (prefersReducedMotion()) render()
      else frame = requestAnimationFrame(paint)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else if (frame) { cancelAnimationFrame(frame); frame = 0 }
    }

    const handleMotionPreference = () => {
      if (prefersReducedMotion()) {
        if (frame) { cancelAnimationFrame(frame); frame = 0 }
        render()
      } else start()
    }

    resize()
    const observer = new ResizeObserver(() => { resize(); render() })
    observer.observe(host)
    document.addEventListener('visibilitychange', handleVisibility)
    const removeMotionListener = reducedMotionQuery
      ? ('addEventListener' in reducedMotionQuery
        ? (reducedMotionQuery.addEventListener('change', handleMotionPreference), () => reducedMotionQuery.removeEventListener('change', handleMotionPreference))
        : (reducedMotionQuery.addListener(handleMotionPreference), () => reducedMotionQuery.removeListener(handleMotionPreference)))
      : () => {}
    start()

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      removeMotionListener()
      if (frame) cancelAnimationFrame(frame)
      if (renderer.gl) {
        renderer.gl.deleteBuffer(renderer.buffer)
        renderer.gl.deleteProgram(renderer.program)
      }
      renderer.fallbackCanvas?.remove()
    }
  }, [])

  return <div className="dot-wave" aria-hidden="true"><canvas ref={canvasRef} /><div className="dot-vignette" /></div>
}
