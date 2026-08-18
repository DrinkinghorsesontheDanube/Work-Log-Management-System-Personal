<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let bgImage: HTMLImageElement | null = null
let lastX = -1000
let lastY = -1000
let prevX = -1000
let prevY = -1000
let frameId = 0
let initialized = false

const BG_URL = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=traditional%20Chinese%20ink%20wash%20landscape%20painting%2C%20shanshui%20style%2C%20misty%20mountains%2C%20bamboo%20forest%2C%20waterfall%2C%20pine%20trees%2C%20cranes%20flying%2C%20scholar%20pavilion%2C%20Song%20dynasty%20aesthetic%2C%20monochrome%20ink%20with%20subtle%20color%20washes%2C%20rice%20paper%20texture%2C%20masterpiece%20brushwork%2C%20ethereal%20mist%2C%20serene%20atmosphere%2C%20classical%20Chinese%20painting&image_size=landscape_16_9'

function resize() {
  if (!canvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  canvasRef.value.style.width = w + 'px'
  canvasRef.value.style.height = h + 'px'

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (!initialized) fillOverlay()
  }
}

function fillOverlay() {
  if (!ctx) return
  const w = window.innerWidth
  const h = window.innerHeight
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#1a1814'
  ctx.fillRect(0, 0, w, h)
  initialized = true
}

function loadBackground() {
  bgImage = new Image()
  bgImage.crossOrigin = 'anonymous'
  bgImage.onload = () => { /* 背景加载完成后无需额外处理 */ }
  bgImage.src = BG_URL
}

function erase(x: number, y: number) {
  if (!ctx) return
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'

  const radius = 45

  if (prevX > -999 && prevY > -999) {
    const dx = x - prevX
    const dy = y - prevY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.floor(dist / 6))

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = prevX + dx * t
      const py = prevY + dy * t
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(0.5, 'rgba(0,0,0,0.8)')
      grad.addColorStop(0.8, 'rgba(0,0,0,0.3)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.8)')
    grad.addColorStop(0.8, 'rgba(0,0,0,0.3)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function onMouseMove(e: MouseEvent) {
  prevX = lastX
  prevY = lastY
  lastX = e.clientX
  lastY = e.clientY
  erase(e.clientX, e.clientY)
}

function onMouseLeave() {
  lastX = -1000
  lastY = -1000
  prevX = -1000
  prevY = -1000
}

function animate() {
  if (!ctx || !canvasRef.value) return
  frameId = requestAnimationFrame(animate)
}

onMounted(() => {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  resize()
  fillOverlay()
  loadBackground()

  canvasRef.value.style.backgroundImage = `url(${BG_URL})`
  canvasRef.value.style.backgroundSize = 'cover'
  canvasRef.value.style.backgroundPosition = 'center'

  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('resize', resize)
  document.addEventListener('mouseleave', onMouseLeave)
  frameId = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('resize', resize)
  document.removeEventListener('mouseleave', onMouseLeave)
  cancelAnimationFrame(frameId)
})
</script>

<template>
  <canvas ref="canvasRef" class="ink-canvas"></canvas>
</template>

<style scoped>
.ink-canvas {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
</style>
