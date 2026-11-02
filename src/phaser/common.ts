import Phaser from 'phaser'
import { sound } from '../core/audio'
import { css, shade } from '../core/worlds'

export { css, shade }

export const DESIGN_W = 720
export const DESIGN_H = 1280
export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif'
export const FONT_TITLE = 'Georgia, "Iowan Old Style", "Times New Roman", serif'
export const INK = '#243046'
export const INK_SOFT = '#65718a'
export const PAPER = '#fff8ec'
export const CREAM = 0xfff3d9
export const NIGHT = 0x141d30
export const GOLD = 0xf2c94c

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface TextOptions {
  origin?: number | [number, number]
  align?: 'left' | 'center' | 'right'
  fontStyle?: string
  wrap?: number
  alpha?: number
  lineSpacing?: number
  fontFamily?: string
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 20,
  color: string = INK,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, {
    fontFamily: options.fontFamily ?? FONT,
    fontSize: `${size}px`,
    color,
    align: options.align ?? 'left',
    fontStyle: options.fontStyle,
    lineSpacing: options.lineSpacing,
    resolution: 2,
    wordWrap: options.wrap ? { width: options.wrap, useAdvancedWrap: true } : undefined,
  })
  if (options.origin !== undefined) {
    if (Array.isArray(options.origin)) text.setOrigin(options.origin[0], options.origin[1])
    else text.setOrigin(options.origin, options.origin)
  }
  if (options.alpha !== undefined) text.setAlpha(options.alpha)
  return text
}

export function title(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 46,
  color: string = PAPER,
  origin = 0.5,
): Phaser.GameObjects.Text {
  return label(scene, x, y, content, size, color, { origin, fontFamily: FONT_TITLE, fontStyle: 'bold' })
}

/** A design-space container that always fits the screen. */
export function stage(
  scene: Phaser.Scene,
  designWidth = DESIGN_W,
  designHeight = DESIGN_H,
): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0)
  const fit = (): void => {
    const width = scene.scale.width
    const height = scene.scale.height
    const scale = Math.min(width / designWidth, height / designHeight)
    root.setScale(scale)
    root.setPosition((width - designWidth * scale) / 2, (height - designHeight * scale) / 2)
  }
  fit()
  scene.scale.on(Phaser.Scale.Events.RESIZE, fit)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, fit)
  })
  return root
}

/** Deep night backdrop with a soft horizon glow and tiny city lights. */
export function backdrop(scene: Phaser.Scene, top = 0x2b3f66, bottom = 0x0d1422): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(-100)
  const draw = (): void => {
    const width = scene.scale.width
    const height = scene.scale.height
    graphics.clear()
    graphics.fillStyle(bottom, 1)
    graphics.fillRect(0, 0, width, height)
    graphics.fillGradientStyle(top, top, bottom, bottom, 1)
    graphics.fillRect(0, 0, width, height)
    graphics.fillStyle(0xffffff, 0.035)
    graphics.fillEllipse(width * 0.5, height * 0.18, width * 1.15, height * 0.7)
    for (let index = 0; index < 46; index += 1) {
      const x = ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1
      const y = ((Math.sin(index * 78.233) * 12345.6789) % 1 + 1) % 1
      const radius = 1 + (((index * 7) % 5) / 5) * 1.6
      graphics.fillStyle(index % 5 === 0 ? 0xffe6a3 : 0xffffff, index % 3 === 0 ? 0.22 : 0.1)
      graphics.fillCircle(x * width, y * height * 0.85, radius)
    }
  }
  draw()
  scene.scale.on(Phaser.Scale.Events.RESIZE, draw)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, draw)
    graphics.destroy()
  })
  return graphics
}

export interface PanelOptions {
  radius?: number
  fill?: number
  side?: number
  alpha?: number
  raised?: number
  stroke?: number
  strokeAlpha?: number
  shadow?: boolean
  highlight?: boolean
}

/** A chunky raised card: drop shadow, side face, top face, hairline light. */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PanelOptions = {},
): Phaser.GameObjects.Container {
  const radius = options.radius ?? 24
  const raised = options.raised ?? 6
  const fill = options.fill ?? CREAM
  const side = options.side ?? shade(fill, -0.24)
  const container = scene.add.container(x, y)
  const graphics = scene.add.graphics()
  if (options.shadow !== false) {
    graphics.fillStyle(0x000000, 0.2)
    graphics.fillRoundedRect(4, raised + 6, width, height, radius)
  }
  graphics.fillStyle(side, 1)
  graphics.fillRoundedRect(0, raised, width, height, radius)
  graphics.fillStyle(fill, options.alpha ?? 1)
  graphics.fillRoundedRect(0, 0, width, height, radius)
  if (options.highlight !== false) {
    graphics.fillStyle(0xffffff, 0.16)
    graphics.fillRoundedRect(5, 4, width - 10, height * 0.34, radius * 0.8)
  }
  if (options.stroke !== undefined) {
    graphics.lineStyle(2, options.stroke, options.strokeAlpha ?? 0.6)
    graphics.strokeRoundedRect(1, 1, width - 2, height - 2, radius)
  }
  container.add(graphics)
  return container
}

export interface ButtonOptions {
  fill?: number
  textColor?: string
  size?: number
  radius?: number
  subtitle?: string
  disabled?: boolean
  icon?: string
  glow?: boolean
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const radius = options.radius ?? Math.min(28, height / 2.4)
  const fill = options.fill ?? 0xf2c94c
  const container = scene.add.container(x, y)
  const graphics = scene.add.graphics()
  graphics.fillStyle(0x000000, 0.24)
  graphics.fillRoundedRect(3, 7, width, height, radius)
  graphics.fillStyle(shade(fill, -0.28), 1)
  graphics.fillRoundedRect(0, 5, width, height, radius)
  graphics.fillStyle(fill, options.disabled ? 0.7 : 1)
  graphics.fillRoundedRect(0, 0, width, height, radius)
  graphics.fillStyle(0xffffff, 0.2)
  graphics.fillRoundedRect(5, 4, width - 10, height * 0.4, radius * 0.75)
  if (options.glow) {
    graphics.lineStyle(3, 0xffffff, 0.35)
    graphics.strokeRoundedRect(1.5, 1.5, width - 3, height - 3, radius)
  }
  const textColor = options.textColor ?? '#2a2314'
  const content = label(scene, width / 2, height / 2 - 2, text, options.size ?? 21, textColor, {
    origin: 0.5,
    fontStyle: 'bold',
  })
  container.add(graphics)
  container.add(content)
  if (options.icon) {
    const icon = label(scene, width - 26, height / 2 - 2, options.icon, 20, textColor, { origin: 0.5 })
    container.add(icon)
  }
  if (options.subtitle) {
    container.add(label(scene, width / 2, height - 15, options.subtitle, 11, textColor, { origin: 0.5, alpha: 0.75 }))
  }
  container.setSize(width, height + 7)
  // Container input includes a centred display origin, so offset the hit
  // rectangle to keep the clickable area on the top-left artwork.
  if (!options.disabled) {
    container.setInteractive(
      new Phaser.Geom.Rectangle(width / 2, (height + 7) / 2, width, height + 7),
      Phaser.Geom.Rectangle.Contains,
    )
    container.input!.cursor = 'pointer'
    container.on('pointerdown', () => {
      scene.tweens.add({ targets: container, scale: 0.97, duration: 60, ease: 'Sine.Out' })
    })
    container.on('pointerout', () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 90 })
    })
    container.on('pointerup', () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Back.Out' })
      sound.click()
      onClick()
    })
  } else {
    container.setAlpha(0.55)
  }
  container.setData('label', content)
  return container
}

export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  glyph: string,
  onClick: () => void,
  options: { size?: number; fill?: number; color?: string; label?: string; disabled?: boolean } = {},
): Phaser.GameObjects.Container {
  const size = options.size ?? 64
  const fill = options.fill ?? 0x2b3f66
  const container = scene.add.container(x, y)
  const graphics = scene.add.graphics()
  graphics.fillStyle(0x000000, 0.22)
  graphics.fillRoundedRect(-size / 2 + 2, -size / 2 + 5, size, size, size / 3)
  graphics.fillStyle(shade(fill, 0.12), 1)
  graphics.fillRoundedRect(-size / 2, -size / 2, size, size, size / 3)
  graphics.fillStyle(0xffffff, 0.12)
  graphics.fillRoundedRect(-size / 2 + 4, -size / 2 + 3, size - 8, size * 0.38, size / 4)
  container.add(graphics)
  const glyphText = label(scene, 0, options.label ? -6 : 0, glyph, size * 0.42, options.color ?? PAPER, {
    origin: 0.5,
    fontStyle: 'bold',
  })
  container.add(glyphText)
  if (options.label) container.add(label(scene, 0, size * 0.28, options.label, 10, options.color ?? PAPER, { origin: 0.5, alpha: 0.8 }))
  container.setSize(size, size)
  if (!options.disabled) {
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, size, size), Phaser.Geom.Rectangle.Contains)
    container.input!.cursor = 'pointer'
    container.on('pointerdown', () => scene.tweens.add({ targets: container, scale: 0.93, duration: 60 }))
    container.on('pointerout', () => scene.tweens.add({ targets: container, scale: 1, duration: 80 }))
    container.on('pointerup', () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Back.Out' })
      sound.click()
      onClick()
    })
  } else {
    container.setAlpha(0.42)
  }
  return container
}

export function starRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  stars: number,
  size = 26,
  total = 3,
  animated = false,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)
  const gap = size * 1.2
  for (let index = 0; index < total; index += 1) {
    const earned = index < stars
    const glyph = label(scene, (index - (total - 1) / 2) * gap, 0, earned ? '\u2605' : '\u2606', size, earned ? '#ffce55' : '#ffffff', {
      origin: 0.5,
      alpha: earned ? 1 : 0.3,
    })
    container.add(glyph)
    if (earned && animated) {
      glyph.setScale(0.4)
      scene.tweens.add({ targets: glyph, scale: 1, duration: 300, delay: 160 + index * 130, ease: 'Back.Out' })
    }
  }
  return container
}

export function toast(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  message: string,
  options: { y?: number; width?: number; fill?: number; textColor?: string; duration?: number } = {},
): void {
  const width = options.width ?? 560
  const height = 58
  const x = (options as { x?: number }).x ?? DESIGN_W / 2
  const y = options.y ?? 214
  const container = scene.add.container(x, y).setDepth(3000)
  const card = panel(scene, -width / 2, 0, width, height, {
    fill: options.fill ?? 0x1e2a42,
    side: 0x0c1220,
    radius: 18,
    raised: 4,
    shadow: true,
    highlight: false,
    stroke: 0xffffff,
    strokeAlpha: 0.12,
  })
  const text = label(scene, 0, height / 2 - 1, message, 16, options.textColor ?? PAPER, {
    origin: 0.5,
    align: 'center',
    wrap: width - 40,
  })
  container.add(card)
  container.add(text)
  container.setAlpha(0)
  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: y + 8,
    duration: 160,
    ease: 'Sine.Out',
    hold: options.duration ?? 1500,
    yoyo: true,
    onComplete: () => container.destroy(),
  })
  announce(message)
}

export function announce(message: string): void {
  if (typeof document === 'undefined') return
  const node = document.getElementById('game-status')
  if (node) node.textContent = message
}

export function fadeTo(scene: Phaser.Scene, key: string, data?: object): void {
  const camera = scene.cameras.main
  if (camera.fadeEffect?.isRunning) return
  camera.fadeOut(170, 12, 18, 32)
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data))
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(220, 12, 18, 32)
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}
