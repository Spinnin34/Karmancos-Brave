import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, motion } from 'motion/react'
import { Skeleton } from 'boneyard-js/react'
import {
  ArrowUpRight, Bookmark, Check, ChevronDown, Cloud, Download,
  History, ImagePlus, Import, LayoutGrid, Menu, MoreHorizontal,
  PanelLeftClose, Pencil, Plus, Search, Settings2, ShieldCheck, Sparkles, Trash2, GripVertical, X,
} from 'lucide-react'
import { FaMicrosoft } from 'react-icons/fa6'
import { SiBrave, SiDuckduckgo, SiEcosia, SiGoogle, SiKagi, SiStartpage } from 'react-icons/si'
import DotWave from './DotWave.jsx'
import './index.css'

const ENGINES = [
  { id: 'google', name: 'Google', Icon: SiGoogle, hint: 'Balanced results', color: '#FFB1C0', privacy: 'Standard', speed: 96, focus: 88, url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { id: 'bing', name: 'Bing', Icon: FaMicrosoft, hint: 'Visual discovery', color: '#FFB1C0', privacy: 'Standard', speed: 93, focus: 84, url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { id: 'brave', name: 'Brave', Icon: SiBrave, hint: 'Private & independent', color: '#FFB1C0', privacy: 'High', speed: 91, focus: 92, url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
  { id: 'duckduckgo', name: 'DuckDuckGo', Icon: SiDuckduckgo, hint: 'Privacy first', color: '#FFB1C0', privacy: 'High', speed: 89, focus: 86, url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { id: 'kagi', name: 'Kagi', Icon: SiKagi, hint: 'Premium signal', color: '#FFB1C0', privacy: 'High', speed: 87, focus: 97, url: (q) => `https://kagi.com/search?q=${encodeURIComponent(q)}` },
  { id: 'ecosia', name: 'Ecosia', Icon: SiEcosia, hint: 'Climate positive', color: '#FFB1C0', privacy: 'Good', speed: 86, focus: 82, url: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}` },
  { id: 'startpage', name: 'Startpage', Icon: SiStartpage, hint: 'Private Google results', color: '#FFB1C0', privacy: 'High', speed: 84, focus: 89, url: (q) => `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}` },
]

const DEFAULT_BOOKMARKS = [
  { id: 'vercel', title: 'Vercel', url: 'https://vercel.com' },
  { id: 'github', title: 'GitHub', url: 'https://github.com' },
]

const SEARCH_LAUNCH_DURATION = 520
const FAVICON_CACHE_KEY = 'karmancos:favicon-cache:v2'
const MAX_CACHED_FAVICONS = 48
const faviconCache = new Map()
let faviconCacheHydrated = false

function hydrateFaviconCache() {
  if (faviconCacheHydrated) return
  faviconCacheHydrated = true
  try {
    const stored = JSON.parse(localStorage.getItem(FAVICON_CACHE_KEY) || '{}')
    Object.entries(stored).forEach(([source, cachedSource]) => {
      if (typeof cachedSource === 'string' && /^(data:image\/|https?:\/\/)/.test(cachedSource)) faviconCache.set(source, cachedSource)
    })
  } catch { /* corrupted or unavailable storage should never block the UI */ }
}

function getCachedFavicon(source) {
  hydrateFaviconCache()
  const dataUrl = faviconCache.get(source)
  if (!dataUrl) return null
  faviconCache.delete(source)
  faviconCache.set(source, dataUrl)
  return dataUrl
}

function persistFavicon(source, cachedSource = source) {
  if (!source || !cachedSource) return
  hydrateFaviconCache()
  faviconCache.delete(source)
  faviconCache.set(source, cachedSource)
  while (faviconCache.size > MAX_CACHED_FAVICONS) faviconCache.delete(faviconCache.keys().next().value)
  try {
    localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(Object.fromEntries(faviconCache)))
  } catch {
    // Keep the in-memory cache even when localStorage is full or disabled.
  }
}

function readMemory(key, fallback) {
  try {
    const value = localStorage.getItem(`karmancos:${key}`)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function useMemory(key, fallback, persistDelay = 0) {
  const [value, setValue] = useState(() => readMemory(key, fallback))
  useEffect(() => {
    const persist = () => {
      try { localStorage.setItem(`karmancos:${key}`, JSON.stringify(value)) } catch { /* storage may be unavailable */ }
    }
    if (!persistDelay) { persist(); return undefined }
    const timer = window.setTimeout(persist, persistDelay)
    return () => window.clearTimeout(timer)
  }, [key, persistDelay, value])
  return [value, setValue]
}

function normalizeUrl(raw) {
  const candidate = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`
  const url = new URL(candidate)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid URL')
  return url.toString()
}

function domainFor(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return 'saved page' }
}

function faviconSources(url) {
  try {
    const host = new URL(url).hostname
    return [
      `https://icons.duckduckgo.com/ip3/${host}.ico`,
      `https://${host}/favicon.ico`,
      `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=128`,
    ]
  } catch {
    return []
  }
}

function Favicon({ url, title, size = 18, bare = false }) {
  const sources = useMemo(() => faviconSources(url), [url])
  const [sourceIndex, setSourceIndex] = useState(0)
  const [source, setSource] = useState(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    hydrateFaviconCache()
    const cachedIndex = sources.findIndex((item) => Boolean(getCachedFavicon(item)))
    setSourceIndex(cachedIndex >= 0 ? cachedIndex : 0)
    setSource(cachedIndex >= 0 ? getCachedFavicon(sources[cachedIndex]) : (sources[0] || null))
    setLoaded(false)
  }, [sources])
  const initial = (title || 'W').trim().charAt(0).toUpperCase()
  const handleError = () => {
    const nextIndex = sourceIndex + 1
    setLoaded(false)
    setSourceIndex(nextIndex)
    setSource(sources[nextIndex] || null)
  }
  return (
    <span className={`favicon ${bare ? 'favicon--bare' : ''} ${loaded ? 'has-image' : ''}`} style={{ '--favicon-size': `${size}px` }} aria-hidden="true">
      <span className="favicon-fallback">{initial}</span>
      {source && <img src={source} data-source={source.startsWith('data:') ? '' : source} alt="" loading="eager" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" onLoad={(event) => { setLoaded(true); if (event.currentTarget.dataset.source) persistFavicon(event.currentTarget.dataset.source) }} onError={handleError} />}
    </span>
  )
}

function DotWaveLegacy() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas.parentElement
    let frame = 0
    let width = 0
    let height = 0
    let dpr = 1
    let renderer = null

    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
    `

    const fragmentShaderSource = `#version 300 es
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_pixelRatio;
      uniform vec3 u_colorFront;
      uniform vec3 u_colorMid;
      uniform vec3 u_colorBase;
      out vec4 fragColor;

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
        m = m * m; m = m * m;
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

      const int BAYER[64] = int[64](
         0, 32,  8, 40,  2, 34, 10, 42,
        48, 16, 56, 24, 50, 18, 58, 26,
        12, 44,  4, 36, 14, 46,  6, 38,
        60, 28, 52, 20, 62, 30, 54, 22,
         3, 35, 11, 43,  1, 33,  9, 41,
        51, 19, 59, 27, 49, 17, 57, 25,
        15, 47,  7, 39, 13, 45,  5, 37,
        63, 31, 55, 23, 61, 29, 53, 21
      );

      float bayer8(vec2 p) {
        ivec2 ip = ivec2(mod(floor(p), 8.0));
        return float(BAYER[ip.y * 8 + ip.x]) / 64.0;
      }

      float flowField(vec2 uv, float t) {
        vec2 p = uv * 2.1;
        vec2 q = vec2(
          snoise(p + vec2(0.08 * t, 0.035 * t)),
          snoise(p + vec2(-0.05 * t, 0.07 * t) + vec2(4.1, 2.7))
        );
        vec2 r = vec2(
          snoise(p + 2.3 * q + vec2(0.05 * t, -0.04 * t) + vec2(1.7, 9.2)),
          snoise(p + 2.3 * q + vec2(-0.06 * t, 0.05 * t) + vec2(8.3, 2.8))
        );
        float n1 = snoise(p + 2.2 * r + vec2(0.04 * t, 0.06 * t));
        float n2 = snoise(p * 1.65 - 1.2 * q + vec2(-0.07 * t, 0.045 * t));
        return clamp(0.5 + 0.5 * (0.65 * n1 + 0.35 * n2), 0.0, 1.0);
      }

      void main() {
        // High density of pixels: ~3.2px spacing
        float pxSize = 3.2 * u_pixelRatio;
        vec2 gridCoord = floor(gl_FragCoord.xy / pxSize);
        vec2 cellCenter = (gridCoord + 0.5) * pxSize;
        vec2 cellOffset = gl_FragCoord.xy - cellCenter;

        vec2 uv = cellCenter / u_resolution.y;
        float t = u_time * 0.22;
        float noiseVal = flowField(uv, t);

        // Bottom to top fade:
        // "la parte de abajo se supone que es negro y va haciendo un difumina a la parte de arriba y ahi se ve ese efecto"
        float yNorm = gl_FragCoord.y / u_resolution.y;
        float bottomFade = smoothstep(0.30, 0.86, yNorm);

        // Framing on sides
        float xNorm = abs((gl_FragCoord.x / u_resolution.x) * 2.0 - 1.0);
        float edgeBoost = 0.65 + 0.55 * xNorm;

        float density = noiseVal * bottomFade * edgeBoost;

        // Dither matrix so pixels coalesce into shapes
        float dither = bayer8(gridCoord) - 0.5;
        float dithered = density + dither * 0.42;
        float visible = smoothstep(0.36, 0.58, dithered);

        // Pixels expand to join neighbors when dense ("se van uniendo")
        float maxRadius = pxSize * 0.55;
        float r = maxRadius * clamp(visible * 1.2, 0.0, 1.0);
        float dist = length(cellOffset);
        float pixelFill = 1.0 - smoothstep(r - 0.55, r + 0.55, dist);

        if (visible > 0.82) {
          pixelFill = max(pixelFill, smoothstep(0.82, 0.98, visible));
        }

        float strength = pixelFill * bottomFade;

        // Original Karmancos palette: base dark, mid dusty-rose, front pink
        vec3 col = mix(u_colorBase, u_colorMid, strength);
        col = mix(col, u_colorFront, smoothstep(0.38, 0.88, strength * density * 1.3));

        fragColor = vec4(col, 1.0);
      }
    `

    const compile = (gl, type, source) => {
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

    const resize = () => {
      const rect = host.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (renderer?.gl) {
        const pixelWidth = Math.max(1, Math.round(width * dpr))
        const pixelHeight = Math.max(1, Math.round(height * dpr))
        renderer.gl.canvas.width = pixelWidth
        renderer.gl.canvas.height = pixelHeight
        renderer.gl.viewport(0, 0, pixelWidth, pixelHeight)
      } else if (renderer?.context) {
        renderer.context.canvas.width = Math.round(width * dpr)
        renderer.context.canvas.height = Math.round(height * dpr)
        renderer.context.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    const paint = (time) => {
      frame = requestAnimationFrame(paint)
      if (renderer?.gl) {
        const { gl, program, uniforms } = renderer
        gl.useProgram(program)
        gl.uniform1f(uniforms.time, (time - renderer.startedAt) * 0.001 + 25.0)
        gl.uniform2f(uniforms.resolution, gl.canvas.width, gl.canvas.height)
        gl.uniform1f(uniforms.pixelRatio, dpr)
        gl.uniform3f(uniforms.colorFront, 1.0, 0.694, 0.753)    // #FFB1C0
        gl.uniform3f(uniforms.colorMid, 0.659, 0.365, 0.439)     // #A85D70
        gl.uniform3f(uniforms.colorBase, 0.063, 0.043, 0.051)    // #100b0d
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        return
      }
      const context = renderer?.context
      if (!context) return
      context.fillStyle = '#100b0d'
      context.fillRect(0, 0, width, height)
      const step = 4
      const t = (time - renderer.startedAt) * 0.0003 + 10
      for (let y = 0; y < Math.min(height, 460); y += step) {
        const yNorm = 1 - y / height
        const bottomFade = Math.max(0, Math.min(1, (yNorm - 0.28) / 0.52))
        if (bottomFade <= 0.01) continue
        for (let x = 0; x < width + step; x += step) {
          const nx = x * 0.003
          const ny = y * 0.003
          const qx = Math.sin(nx * 1.5 + t * 0.5) * Math.cos(ny * 1.2 - t * 0.4)
          const qy = Math.cos(nx * 1.3 - t * 0.4) * Math.sin(ny * 1.6 + t * 0.6)
          const val = (Math.sin((nx + qx * 0.8) * 2.0 + t) + Math.cos((ny + qy * 0.8) * 2.0 - t * 0.8) + 2) / 4
          const density = val * bottomFade
          if (density < 0.28) continue
          const alpha = Math.min(1, (density - 0.28) / 0.45)
          context.fillStyle = density > 0.65 ? `rgba(255, 177, 192, ${alpha})` : `rgba(168, 93, 112, ${alpha * 0.75})`
          context.beginPath()
          context.arc(x, y, 0.8 + density * 1.4, 0, Math.PI * 2)
          context.fill()
        }
      }
    }

    const webglOptions = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false }
    let gl = null
    const probeCanvas = document.createElement('canvas')
    const probe = probeCanvas.getContext('webgl2', webglOptions)
    if (probe) {
      const probeVertex = compile(probe, probe.VERTEX_SHADER, vertexShaderSource)
      const probeFragment = compile(probe, probe.FRAGMENT_SHADER, fragmentShaderSource)
      if (probeVertex && probeFragment) {
        const probeProgram = probe.createProgram()
        probe.attachShader(probeProgram, probeVertex)
        probe.attachShader(probeProgram, probeFragment)
        probe.linkProgram(probeProgram)
        if (probe.getProgramParameter(probeProgram, probe.LINK_STATUS)) {
          gl = canvas.getContext('webgl2', webglOptions)
        }
      }
      probe.getExtension('WEBGL_lose_context')?.loseContext()
    }
    if (gl) {
      const vertex = compile(gl, gl.VERTEX_SHADER, vertexShaderSource)
      const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
      const program = vertex && fragment ? gl.createProgram() : null
      if (program) {
        gl.attachShader(program, vertex)
        gl.attachShader(program, fragment)
        gl.linkProgram(program)
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
          const buffer = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW)
          const position = gl.getAttribLocation(program, 'a_position')
          gl.enableVertexAttribArray(position)
          gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
          const uniforms = {
            time: gl.getUniformLocation(program, 'u_time'),
            resolution: gl.getUniformLocation(program, 'u_resolution'),
            pixelRatio: gl.getUniformLocation(program, 'u_pixelRatio'),
            colorFront: gl.getUniformLocation(program, 'u_colorFront'),
            colorMid: gl.getUniformLocation(program, 'u_colorMid'),
            colorBase: gl.getUniformLocation(program, 'u_colorBase'),
          }
          gl.enable(gl.BLEND)
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
          renderer = { gl, program, uniforms, startedAt: performance.now() }
        }
      }
    }
    if (!renderer) {
      if (gl) canvas.style.display = 'none'
      const fallbackCanvas = gl ? document.createElement('canvas') : canvas
      if (gl) { fallbackCanvas.className = 'dot-wave-fallback'; host.prepend(fallbackCanvas) }
      renderer = { context: fallbackCanvas.getContext('2d', { alpha: true }), fallbackCanvas: gl ? fallbackCanvas : null, startedAt: performance.now() }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    frame = requestAnimationFrame(paint)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      if (renderer?.gl) renderer.gl.getExtension('WEBGL_lose_context')?.loseContext()
      renderer?.fallbackCanvas?.remove()
    }
  }, [])

  return <div className="dot-wave" aria-hidden="true"><canvas ref={canvasRef} /><div className="dot-vignette" /></div>
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Sparkles size={13} fill="currentColor" />
    </span>
  )
}

function MonoPulse({ values = [18, 34, 25, 48, 39, 63, 56], compact = false }) {
  const max = Math.max(...values)
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${34 - (value / max) * 27}`).join(' ')
  return (
    <svg className={compact ? 'mono-pulse compact' : 'mono-pulse'} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((value, index) => <circle key={index} cx={(index / (values.length - 1)) * 100} cy={34 - (value / max) * 27} r="1.65" fill="currentColor" />)}
    </svg>
  )
}

function BookmarkSkeleton() {
  return (
    <div className="bookmark-skeleton" aria-label="Loading saved pages">
      {[0, 1].map((item) => <div className="skeleton-row" key={item}><span /><div><i /><i /></div></div>)}
    </div>
  )
}

function SavedPages({ bookmarks, loading, onAdd, onRemove, onReorder, onShowAll }) {
  const [draggedId, setDraggedId] = useState(null)
  const dragOverId = useRef(null)
  const dragOverElement = useRef(null)

  const clearDropTarget = () => {
    if (dragOverElement.current) delete dragOverElement.current.dataset.dropTarget
    dragOverElement.current = null
  }

  const startDragging = (event, id) => {
    clearDropTarget()
    dragOverId.current = null
    setDraggedId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  const dragOver = (event, id) => {
    event.preventDefault()
    if (draggedId && draggedId !== id && dragOverId.current !== id) {
      clearDropTarget()
      dragOverId.current = id
      dragOverElement.current = event.currentTarget
      event.dataTransfer.dropEffect = 'move'
      event.currentTarget.dataset.dropTarget = 'true'
    }
  }

  const drop = (event, targetId) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedId
    if (sourceId && sourceId !== targetId) onReorder(sourceId, targetId)
    clearDropTarget()
    setDraggedId(null)
    dragOverId.current = null
  }

  const stopDragging = (event) => {
    clearDropTarget()
    setDraggedId(null)
    dragOverId.current = null
  }

  return (
    <div className="saved-zone">
      <div className="sidebar-section-title">
        <span>Saved pages</span>
        <div><button aria-label="Add saved page" onClick={onAdd}><Plus size={14} /></button><button aria-label="Show all saved pages" onClick={onShowAll}><MoreHorizontal size={15} /></button></div>
      </div>
      <Skeleton name="saved-pages" loading={loading} animate="shimmer" transition={240} darkColor="rgba(255,177,192,.08)" fallback={<BookmarkSkeleton />}>
        <div className="bookmark-list">
          {bookmarks.map((bookmark, index) => (
            <motion.div className="bookmark-row" layout key={bookmark.id} draggable data-dragging={draggedId === bookmark.id ? 'true' : undefined} onDragStart={(event) => startDragging(event, bookmark.id)} onDragOver={(event) => dragOver(event, bookmark.id)} onDrop={(event) => drop(event, bookmark.id)} onDragEnd={stopDragging} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} transition={{ delay: index * .035, duration: .2 }}>
              <span className="bookmark-drag-handle" title="Drag to reorder" aria-hidden="true"><GripVertical size={14} /></span>
              <button className="bookmark-link" onClick={() => window.location.assign(bookmark.url)} title={`Open ${bookmark.title}`}>
                <Favicon url={bookmark.url} title={bookmark.title} size={28} bare />
                <span className="bookmark-copy"><strong>{bookmark.title}</strong><small>{domainFor(bookmark.url)}</small></span>
              </button>
              <button className="bookmark-remove" onClick={() => onRemove(bookmark.id)} aria-label={`Remove ${bookmark.title}`}><X size={12} /></button>
            </motion.div>
          ))}
          {!bookmarks.length && <button className="empty-bookmarks" onClick={onAdd}><Plus size={13} /> Save your first page</button>}
        </div>
      </Skeleton>
    </div>
  )
}

function AddBookmark({ onSave, onClose }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    try {
      const normalized = normalizeUrl(url)
      const fallbackTitle = new URL(normalized).hostname.replace(/^www\./, '')
      onSave({ id: crypto.randomUUID(), title: title.trim() || fallbackTitle, url: normalized })
    } catch { setError('Enter a valid web address') }
  }
  return (
    <motion.form className="bookmark-form" onSubmit={submit} initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: .98 }} transition={{ duration: .18 }}>
      <div className="form-head"><span>Save a page</span><button type="button" onClick={onClose} aria-label="Close"><X size={13} /></button></div>
      <label><span>URL</span><input autoFocus value={url} onChange={(event) => { setUrl(event.target.value); setError('') }} placeholder="example.com" /></label>
      <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional" /></label>
      {error && <p>{error}</p>}
      <button className="save-page" type="submit">Save page <ArrowUpRight size={13} /></button>
    </motion.form>
  )
}

function ProfileMenu({ profileImage, accountName, onName, onImage, onExport, onImport, onClose }) {
  const imageInput = useRef(null)
  const backupInput = useRef(null)
  const [draftName, setDraftName] = useState(accountName)
  const saveName = () => {
    const nextName = draftName.trim().slice(0, 28)
    if (!nextName) return setDraftName(accountName)
    onName(nextName)
  }
  return (
    <motion.div className="profile-menu" initial={{ opacity: 0, y: 7, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 7, scale: .98 }} transition={{ duration: .18 }}>
      <div className="profile-menu-head"><span>Local profile</span><button onClick={onClose}><X size={13} /></button></div>
      <button className="avatar-upload" onClick={() => imageInput.current?.click()}>
        <span className="large-avatar">{profileImage ? <img src={profileImage} alt="Profile" /> : accountName.charAt(0).toUpperCase()}<i><ImagePlus size={11} /></i></span>
        <span><strong>Change picture</strong><small>Stored on this device</small></span>
      </button>
      <input ref={imageInput} hidden type="file" accept="image/*" onChange={onImage} />
      <label className="profile-name-field">
        <span>Display name</span>
        <span><Pencil size={12} /><input value={draftName} maxLength={28} onChange={(event) => setDraftName(event.target.value)} onBlur={saveName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveName(); event.currentTarget.blur() } }} /></span>
      </label>
      <div className="profile-menu-actions">
        <button onClick={onExport}><Download size={14} /><span><strong>Export backup</strong><small>Bookmarks, history & profile</small></span></button>
        <button onClick={() => backupInput.current?.click()}><Import size={14} /><span><strong>Import backup</strong><small>Restore a JSON copy</small></span></button>
      </div>
      <input ref={backupInput} hidden type="file" accept="application/json" onChange={onImport} />
      <div className="memory-state"><ShieldCheck size={12} /><span>Private local memory</span></div>
    </motion.div>
  )
}

function Sidebar({ open, collapsed, activeView, setActiveView, bookmarks, loading, onAdd, onRemove, onReorder, profileImage, accountName, onName, onImage, onExport, onImport, onCollapse, onClose }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const sidebarRef = useRef(null)
  useEffect(() => {
    if (!profileOpen) return undefined
    const close = (event) => { if (!sidebarRef.current?.contains(event.target)) setProfileOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [profileOpen])
  const items = [
    { id: 'search', label: 'New search', Icon: Search },
    { id: 'saved', label: 'Saved pages', Icon: Bookmark },
    { id: 'history', label: 'History', Icon: History },
    { id: 'settings', label: 'Preferences', Icon: Settings2 },
  ]
  return (
    <aside ref={sidebarRef} className={`sidebar ${open ? 'sidebar--open' : ''} ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-topline">
        <button className="logo-button" onClick={() => setActiveView('search')} aria-label="Karmancos home"><BrandMark /></button>
        <div><button aria-label="Search saved pages"><Search size={15} /></button><button aria-label="Collapse sidebar" onClick={onCollapse}><PanelLeftClose size={15} /></button><button className="mobile-close" onClick={onClose} aria-label="Close sidebar"><X size={15} /></button></div>
      </div>
      <nav className="main-nav" aria-label="Primary navigation">
        {items.map(({ id, label, Icon }) => <button className={activeView === id ? 'active' : ''} key={id} onClick={() => { setActiveView(id); onClose() }}><Icon size={14} fill={id === 'saved' && activeView === id ? 'currentColor' : 'none'} /><span>{label}</span>{id === 'saved' && bookmarks.length > 0 && <em>{bookmarks.length}</em>}</button>)}
      </nav>
      <SavedPages bookmarks={bookmarks} loading={loading} onAdd={onAdd} onRemove={onRemove} onReorder={onReorder} onShowAll={() => { setActiveView('saved'); onClose() }} />
      <AnimatePresence>{profileOpen && <ProfileMenu profileImage={profileImage} accountName={accountName} onName={onName} onImage={onImage} onExport={onExport} onImport={onImport} onClose={() => setProfileOpen(false)} />}</AnimatePresence>
      <button className="profile" onClick={() => setProfileOpen((value) => !value)}>
        <span className="profile-avatar">{profileImage ? <img src={profileImage} alt="" /> : accountName.charAt(0).toUpperCase()}</span>
        <span><strong>{accountName}</strong><small>Local workspace</small></span><ChevronDown size={12} />
      </button>
    </aside>
  )
}

function EnginePeek({ engine, row }) {
  return (
    <motion.aside className="engine-peek" style={{ '--engine-row': `${Math.min(59 + row * 48, 185)}px` }} initial={{ opacity: 0, x: -5, scale: .99 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -4, scale: .99 }} transition={{ duration: .12, ease: [0.22, 1, 0.36, 1] }}>
      <div className="peek-head"><span className="engine-icon"><engine.Icon /></span><div><strong>{engine.name}</strong><small>{engine.hint}</small></div></div>
      <MonoPulse values={[engine.speed - 19, engine.focus - 27, engine.speed - 8, engine.focus - 12, engine.speed]} />
      <dl><div><dt>Speed</dt><dd>{engine.speed}<span>/100</span></dd></div><div><dt>Focus</dt><dd>{engine.focus}<span>/100</span></dd></div><div><dt>Privacy</dt><dd>{engine.privacy}</dd></div></dl>
    </motion.aside>
  )
}

function EngineMenu({ current, onSelect, onClose }) {
  const [hovered, setHovered] = useState(null)
  const [query, setQuery] = useState('')
  const filtered = ENGINES.filter((engine) => engine.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <motion.div className="engine-menu" initial={{ opacity: 0, y: -4, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -3, scale: .99 }} transition={{ duration: .14, ease: [0.22, 1, 0.36, 1] }}>
      <label className="engine-filter"><Search size={13} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a search engine" />{query && <button onClick={() => setQuery('')}><X size={12} /></button>}</label>
      <div className="engine-list" onMouseLeave={() => setHovered(null)}>
        {filtered.map((engine, index) => (
          <button className={current === engine.id ? 'selected' : ''} key={engine.id} onMouseEnter={() => setHovered({ engine, row: index })} onFocus={() => setHovered({ engine, row: index })} onBlur={() => setHovered(null)} onClick={() => { onSelect(engine.id); onClose() }}>
            <span className="engine-icon"><engine.Icon /></span><span><strong>{engine.name}</strong><small>{engine.hint}</small></span>{current === engine.id ? <Check size={14} /> : <ArrowUpRight size={13} />}
          </button>
        ))}
        {!filtered.length && <div className="engine-empty">No engines found</div>}
      </div>
      <AnimatePresence>{hovered && <EnginePeek key={hovered.engine.id} engine={hovered.engine} row={hovered.row} />}</AnimatePresence>
    </motion.div>
  )
}

function SearchLaunch({ engine, query, onCancel }) {
  return (
    <motion.div className="search-launch" role="status" aria-live="polite" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: .12, ease: [0.22, 1, 0.36, 1] }}>
      <span className="launch-icon"><engine.Icon /></span>
      <div className="launch-copy">
        <span>Opening {engine.name}</span>
        <strong>{query}</strong>
      </div>
      <button type="button" className="launch-cancel" onClick={onCancel} aria-label="Cancel search"><X size={13} /></button>
      <div className="launch-progress"><i /></div>
    </motion.div>
  )
}

function SearchHome({ engineId, setEngineId, onAdd, accountName }) {
  const [query, setQuery] = useMemory('search-draft', '', 160)
  const [menuOpen, setMenuOpen] = useState(false)
  const [launching, setLaunching] = useState(null)
  const engine = ENGINES.find((item) => item.id === engineId) || ENGINES[0]
  const rootRef = useRef(null)
  const launchTimer = useRef(null)
  const launchingRef = useRef(null)

  useEffect(() => { launchingRef.current = launching }, [launching])

  useEffect(() => {
    const close = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setMenuOpen(false) }
    const shortcuts = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); rootRef.current?.querySelector('input')?.focus() }
      if (event.key === 'Escape') { setMenuOpen(false); if (!launchingRef.current) setQuery('') }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', shortcuts)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', shortcuts) }
  }, [setQuery])

  useEffect(() => () => clearTimeout(launchTimer.current), [])

  const search = (event) => {
    event.preventDefault()
    const term = query.trim()
    if (!term || launching) return
    const history = readMemory('history', [])
    localStorage.setItem('karmancos:history', JSON.stringify([{ id: crypto.randomUUID(), query: term, engine: engine.id, at: Date.now() }, ...history].slice(0, 60)))
    setLaunching({ engine, query: term })
    launchTimer.current = setTimeout(() => {
      setQuery('')
      window.location.assign(engine.url(term))
    }, SEARCH_LAUNCH_DURATION)
  }

  return (
    <motion.section className="search-home" ref={rootRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}>
      <div className="workspace-line"><span><BrandMark /> {accountName}</span><i /><span><Cloud size={13} /> Synced locally</span></div>
      <div className="search-stage">
        <form className="search-shell" onSubmit={search}>
          <label onPointerEnter={() => setMenuOpen(false)}><span className="sr-only">Search the web</span><input onFocus={() => setMenuOpen(false)} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search with ${engine.name}…`} autoComplete="off" autoFocus /></label>
          <AnimatePresence>{query && <motion.button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')} initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .7 }}><X size={13} /></motion.button>}</AnimatePresence>
          <div className="search-toolbar">
            <div>
              <button type="button" className="round-tool" aria-label="Add page" title="Save a page" onClick={onAdd}><Plus size={16} /></button>
              <button type="button" className="engine-trigger" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}><span className="engine-icon"><engine.Icon /></span><span>{engine.name}</span><ChevronDown size={11} /></button>
            </div>
            <button className={`search-submit ${query.trim() ? 'ready' : ''}`} type="submit" aria-label="Search"><Search size={16} strokeWidth={2.4} /></button>
          </div>
          <span className="search-highlight" />
        </form>
        <AnimatePresence>{launching && <SearchLaunch engine={launching.engine} query={launching.query} onCancel={() => { clearTimeout(launchTimer.current); setLaunching(null) }} />}</AnimatePresence>
      </div>
      <AnimatePresence>{menuOpen && <EngineMenu current={engine.id} onSelect={setEngineId} onClose={() => setMenuOpen(false)} />}</AnimatePresence>
    </motion.section>
  )
}

function LibraryView({ view, bookmarks, history, onRemove, onOpen }) {
  const data = view === 'history' ? history : bookmarks
  const title = view === 'saved' ? 'Saved pages' : view === 'history' ? 'Search history' : 'Preferences'
  return (
    <motion.section className="library-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <span className="view-kicker">Local workspace</span><h1>{title}</h1>
      {view === 'settings' ? <div className="settings-card"><div><LayoutGrid size={16} /><span><strong>Private by default</strong><small>Your data stays in this browser until you export it.</small></span></div><div><ShieldCheck size={16} /><span><strong>Backup ready</strong><small>Use the profile menu to export or restore your memory.</small></span></div></div> : (
        <div className="library-list">{data.length ? data.map((item) => {
          const engine = ENGINES.find((entry) => entry.id === item.engine)
          return <div key={item.id} className={view === 'saved' ? 'library-row-openable' : ''} role={view === 'saved' ? 'button' : undefined} tabIndex={view === 'saved' ? 0 : undefined} onClick={() => view === 'saved' && onOpen(item.url)} onKeyDown={(event) => { if (view === 'saved' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(item.url) } }}>{view === 'saved' ? <Favicon url={item.url} title={item.title} size={25} bare /> : <span className="favicon">{engine ? <engine.Icon /> : <Search size={12} />}</span>}<span><strong>{view === 'saved' ? item.title : item.query}</strong><small>{view === 'saved' ? item.url : `${engine?.name || 'Search'} · ${new Date(item.at).toLocaleDateString()}`}</small></span>{view === 'saved' ? <button onClick={(event) => { event.stopPropagation(); onRemove(item.id) }}><Trash2 size={13} /></button> : <span className="history-time">{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div>
        }) : <div className="library-empty"><Bookmark size={18} /><span>Nothing here yet</span><small>Your local activity will appear here.</small></div>}</div>
      )}
    </motion.section>
  )
}

function Toast({ message }) {
  return <AnimatePresence>{message && <motion.div className="toast" initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}><Check size={13} />{message}</motion.div>}</AnimatePresence>
}

function App() {
  const [bookmarks, setBookmarks] = useMemory('bookmarks', DEFAULT_BOOKMARKS)
  const [engineId, setEngineId] = useMemory('engine', 'google')
  const [profileImage, setProfileImage] = useMemory('profile-image', '')
  const [accountName, setAccountName] = useMemory('account-name', 'Karmancos')
  const [history, setHistory] = useState(() => readMemory('history', []))
  const [activeView, setActiveView] = useMemory('active-view', 'search')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useMemory('sidebar-collapsed', false)
  const [bookmarkForm, setBookmarkForm] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const loading = false

  const notify = (message) => {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setActiveView('search'); requestAnimationFrame(() => document.querySelector('.search-shell input')?.focus()) }
    }
    window.addEventListener('keydown', shortcut)
    return () => { clearTimeout(toastTimer.current); window.removeEventListener('keydown', shortcut) }
  }, [])

  const saveBookmark = (bookmark) => { setBookmarks((items) => [bookmark, ...items]); setBookmarkForm(false); notify('Page saved locally') }
  const removeBookmark = (id) => { setBookmarks((items) => items.filter((item) => item.id !== id)); notify('Saved page removed') }
  const reorderBookmarks = (sourceId, targetId) => {
    setBookmarks((items) => {
      const sourceIndex = items.findIndex((item) => item.id === sourceId)
      const targetIndex = items.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items
      const next = [...items]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const uploadImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2_000_000) { notify('Choose an image under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { setProfileImage(reader.result); notify('Profile picture updated') }
    reader.readAsDataURL(file)
  }

  const exportBackup = () => {
    const payload = { version: 2, exportedAt: new Date().toISOString(), bookmarks, history: readMemory('history', history), engine: engineId, profileImage, accountName, activeView, sidebarCollapsed, searchDraft: readMemory('search-draft', '') }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    link.download = `karmancos-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    notify('Backup exported')
  }

  const importBackup = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!Array.isArray(data.bookmarks) || !Array.isArray(data.history)) throw new Error('Invalid backup')
        setBookmarks(data.bookmarks); setHistory(data.history); localStorage.setItem('karmancos:history', JSON.stringify(data.history))
        if (ENGINES.some((engine) => engine.id === data.engine)) setEngineId(data.engine)
        if (typeof data.profileImage === 'string') setProfileImage(data.profileImage)
        if (typeof data.accountName === 'string' && data.accountName.trim()) setAccountName(data.accountName.trim().slice(0, 28))
        if (['search', 'saved', 'history', 'settings'].includes(data.activeView)) setActiveView(data.activeView)
        if (typeof data.sidebarCollapsed === 'boolean') setSidebarCollapsed(data.sidebarCollapsed)
        if (typeof data.searchDraft === 'string') localStorage.setItem('karmancos:search-draft', JSON.stringify(data.searchDraft))
        notify('Backup restored')
      } catch { notify('That backup is not valid') }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const currentHistory = useMemo(() => activeView === 'history' ? readMemory('history', history) : history, [activeView, history])

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <Sidebar open={sidebarOpen} collapsed={sidebarCollapsed} activeView={activeView} setActiveView={(view) => { setActiveView(view); setHistory(readMemory('history', [])) }} bookmarks={bookmarks} loading={loading} onAdd={() => setBookmarkForm(true)} onRemove={removeBookmark} onReorder={reorderBookmarks} profileImage={profileImage} accountName={accountName} onName={(name) => { setAccountName(name); notify('Display name updated') }} onImage={uploadImage} onExport={exportBackup} onImport={importBackup} onCollapse={() => { setSidebarCollapsed(true); setSidebarOpen(false) }} onClose={() => setSidebarOpen(false)} />
      <AnimatePresence>{bookmarkForm && <AddBookmark onSave={saveBookmark} onClose={() => setBookmarkForm(false)} />}</AnimatePresence>
      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}
      <main className="main-stage">
        <DotWave />
        <button className={`sidebar-reopen ${sidebarCollapsed ? 'visible' : ''}`} onClick={() => { setSidebarCollapsed(false); setSidebarOpen(true) }} aria-label="Open sidebar"><Menu size={17} /></button>
        <AnimatePresence mode="wait">{activeView === 'search' ? <SearchHome key="search" engineId={engineId} setEngineId={setEngineId} onAdd={() => setBookmarkForm(true)} accountName={accountName} /> : <LibraryView key={activeView} view={activeView} bookmarks={bookmarks} history={currentHistory} onRemove={removeBookmark} onOpen={(url) => window.location.assign(url)} />}</AnimatePresence>
      </main>
      <Toast message={toast} />
    </div>
  )
}

const rootNode = document.getElementById('root')
const root = rootNode.__karmancosRoot || createRoot(rootNode)
rootNode.__karmancosRoot = root

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}favicon-sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
    // Favicon fallbacks keep the list usable when service workers are unavailable.
  })
}

root.render(<React.StrictMode><App /></React.StrictMode>)
