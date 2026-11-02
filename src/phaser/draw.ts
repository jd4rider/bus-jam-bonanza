import Phaser from 'phaser'
import {
  DIR_ANGLE,
  DIR_VECTORS,
  COLOR_META,
  type BusColor,
  type BusDefinition,
  type Direction,
  type GridPoint,
  type LevelDefinition,
  type SymbolShape,
} from '../core/types'
import type { PropKind, WorldTheme } from '../core/worlds'
import { shade, type Rect } from './common'

const SKIN = [0xf6d3ad, 0xe8b78a, 0xcd9268, 0x9a6545, 0x6f4630, 0xffe0c2]
const HAIR = [0x3a2c25, 0x6b4630, 0x1f2430, 0xb3743d, 0x8a3f4c, 0x2f4f4a]

function points(values: Array<[number, number]>): Phaser.Geom.Point[] {
  return values.map(([x, y]) => new Phaser.Geom.Point(x, y))
}

export function symbolPoints(shape: SymbolShape, x: number, y: number, size: number): Phaser.Geom.Point[] {
  const radius = size / 2
  switch (shape) {
    case 'triangle':
      return points([
        [x, y - radius],
        [x + radius * 0.92, y + radius * 0.78],
        [x - radius * 0.92, y + radius * 0.78],
      ])
    case 'diamond':
      return points([
        [x, y - radius],
        [x + radius * 0.82, y],
        [x, y + radius],
        [x - radius * 0.82, y],
      ])
    case 'hex':
      return points(
        Array.from({ length: 6 }, (_, index) => {
          const angle = (Math.PI / 3) * index - Math.PI / 2
          return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius] as [number, number]
        }),
      )
    case 'star': {
      const inner = radius * 0.46
      return points(
        Array.from({ length: 10 }, (_, index) => {
          const angle = (Math.PI / 5) * index - Math.PI / 2
          const r = index % 2 === 0 ? radius : inner
          return [x + Math.cos(angle) * r, y + Math.sin(angle) * r] as [number, number]
        }),
      )
    }
    default:
      return points([
        [x - radius, y - radius],
        [x + radius, y - radius],
        [x + radius, y + radius],
        [x - radius, y + radius],
      ])
  }
}

export function drawSymbol(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  shape: SymbolShape,
): void {
  const radius = size / 2
  graphics.fillStyle(color, 1)
  switch (shape) {
    case 'circle':
      graphics.fillCircle(x, y, radius)
      break
    case 'square':
      graphics.fillRoundedRect(x - radius, y - radius, size, size, size * 0.24)
      break
    case 'cross':
      graphics.fillRoundedRect(x - radius, y - size * 0.17, size, size * 0.34, size * 0.1)
      graphics.fillRoundedRect(x - size * 0.17, y - radius, size * 0.34, size, size * 0.1)
      break
    case 'heart': {
      const r = radius * 0.36
      graphics.fillCircle(x - radius * 0.28, y - radius * 0.2, r)
      graphics.fillCircle(x + radius * 0.28, y - radius * 0.2, r)
      graphics.fillTriangle(x - radius * 0.62, y - radius * 0.02, x + radius * 0.62, y - radius * 0.02, x, y + radius * 0.72)
      break
    }
    default:
      graphics.fillPoints(symbolPoints(shape, x, y, size), true)
  }
}

export function drawBadge(
  scene: Phaser.Scene,
  color: BusColor,
  radius: number,
  options: { ring?: boolean } = {},
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0)
  const graphics = scene.add.graphics()
  if (options.ring !== false) {
    graphics.fillStyle(0xffffff, 0.95)
    graphics.fillCircle(0, 0, radius)
    graphics.lineStyle(Math.max(1, radius * 0.12), 0x000000, 0.12)
    graphics.strokeCircle(0, 0, radius)
  }
  drawSymbol(graphics, 0, 0, radius * 1.25, COLOR_META[color].hex, COLOR_META[color].symbol)
  container.add(graphics)
  return container
}

export interface PassengerVisual {
  container: Phaser.GameObjects.Container
  height: number
}

export function createPassenger(scene: Phaser.Scene, color: BusColor, size: number, seed = 0, highContrast = false): PassengerVisual {
  const meta = COLOR_META[color]
  const skin = SKIN[Math.abs(seed) % SKIN.length]
  const hair = HAIR[Math.abs(seed * 3 + 1) % HAIR.length]
  const container = scene.add.container(0, 0)
  const graphics = scene.add.graphics()

  graphics.fillStyle(0x000000, 0.2)
  graphics.fillEllipse(0, size * 0.47, size * 0.56, size * 0.18)
  graphics.fillStyle(0x3a4054, 1)
  graphics.fillRoundedRect(-size * 0.2, size * 0.2, size * 0.15, size * 0.24, size * 0.06)
  graphics.fillRoundedRect(size * 0.05, size * 0.2, size * 0.15, size * 0.24, size * 0.06)
  graphics.fillStyle(meta.deep, 1)
  graphics.fillRoundedRect(-size * 0.27, -size * 0.08, size * 0.54, size * 0.36, size * 0.14)
  graphics.fillStyle(meta.hex, 1)
  graphics.fillRoundedRect(-size * 0.24, -size * 0.08, size * 0.48, size * 0.29, size * 0.12)
  graphics.fillStyle(skin, 1)
  graphics.fillRoundedRect(-size * 0.32, size * 0.0, size * 0.09, size * 0.22, size * 0.045)
  graphics.fillRoundedRect(size * 0.23, size * 0.0, size * 0.09, size * 0.22, size * 0.045)
  graphics.fillStyle(skin, 1)
  graphics.fillCircle(0, -size * 0.27, size * 0.22)
  graphics.fillStyle(hair, 1)
  graphics.fillEllipse(0, -size * 0.36, size * 0.4, size * 0.2)
  graphics.fillStyle(0x24242e, 1)
  graphics.fillCircle(-size * 0.075, -size * 0.26, size * 0.027)
  graphics.fillCircle(size * 0.075, -size * 0.26, size * 0.027)
  graphics.lineStyle(Math.max(1, size * 0.02), 0x24242e, 0.75)
  graphics.beginPath()
  graphics.arc(0, -size * 0.19, size * 0.075, 0.25, Math.PI - 0.25)
  graphics.strokePath()
  graphics.fillStyle(0xffffff, 0.95)
  graphics.fillCircle(size * 0.14, size * 0.1, size * 0.1)
  drawSymbol(graphics, size * 0.14, size * 0.1, size * 0.12, meta.deep, meta.symbol)

  if (highContrast) {
    graphics.lineStyle(Math.max(1.2, size * 0.025), 0xffffff, 0.9)
    graphics.strokeRoundedRect(-size * 0.27, -size * 0.08, size * 0.54, size * 0.36, size * 0.14)
  }

  container.add(graphics)
  return { container, height: size }
}

export interface BusVisualOptions {
  highContrast?: boolean
  interactive?: boolean
  alpha?: number
}

/** A rounded toy bus, drawn once and rotated to its lane direction. */
export function createBus(
  scene: Phaser.Scene,
  bus: BusDefinition,
  cell: number,
  options: BusVisualOptions = {},
): Phaser.GameObjects.Container {
  const meta = COLOR_META[bus.color]
  const width = bus.length * cell - Math.max(6, cell * 0.12)
  const height = cell * 0.68
  const radius = height * 0.3
  const container = scene.add.container(0, 0)
  const graphics = scene.add.graphics()

  graphics.fillStyle(0x000000, 0.22)
  graphics.fillEllipse(3, height * 0.5, width * 0.98, height * 0.5)
  graphics.fillStyle(0x252b3a, 1)
  graphics.fillRoundedRect(-width / 2 + 8, height * 0.3, width * 0.16, height * 0.22, height * 0.1)
  graphics.fillRoundedRect(width / 2 - width * 0.24, height * 0.3, width * 0.16, height * 0.22, height * 0.1)
  graphics.fillStyle(meta.deep, 1)
  graphics.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, radius)
  graphics.fillStyle(meta.hex, 1)
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
  graphics.fillStyle(meta.light, 0.72)
  graphics.fillRoundedRect(-width / 2 + 4, -height / 2 + 3, width - 8, height * 0.4, radius * 0.8)
  graphics.fillStyle(0x27364a, 0.92)
  const windows = Math.max(2, bus.length + 1)
  const windowWidth = (width - 24) / windows - 4
  for (let index = 0; index < windows; index += 1) {
    graphics.fillRoundedRect(-width / 2 + 12 + index * (windowWidth + 4), -height * 0.14, windowWidth, height * 0.22, 3)
  }
  graphics.fillStyle(0xdff4ff, 0.9)
  graphics.fillRoundedRect(width / 2 - 12, -height * 0.14, 7, height * 0.26, 3)
  graphics.fillStyle(0xffe9a3, 1)
  graphics.fillCircle(width / 2 - 8, height * 0.18, Math.max(2, height * 0.055))
  graphics.fillCircle(-width / 2 + 8, height * 0.18, Math.max(2, height * 0.055))
  graphics.fillStyle(0xffffff, 0.9)
  graphics.fillCircle(0, -height * 0.02, height * 0.19)
  drawSymbol(graphics, 0, -height * 0.02, height * 0.24, meta.deep, meta.symbol)

  if (options.highContrast) {
    graphics.lineStyle(2.4, 0xffffff, 0.95)
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, radius)
  }
  if (options.alpha !== undefined) container.setAlpha(options.alpha)
  container.add(graphics)
  container.setSize(width + 8, height + 16)
  if (options.interactive) {
    // The bus is drawn around (0,0); the container's centred display origin
    // makes a zero-based rectangle line up with that centred artwork.
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width + 8, height + 18),
      Phaser.Geom.Rectangle.Contains,
    )
    if (container.input) container.input.cursor = 'pointer'
  }
  container.setRotation(DIR_ANGLE[bus.direction])
  return container
}

export function footprintCenter(level: LevelDefinition, bus: BusDefinition, rect: Rect, cell: number): GridPoint {
  const vector = { x: 0, y: 0 }
  const direction = DIR_VECTORS[bus.direction]
  const mid = (bus.length - 1) / 2
  vector.x = bus.position.x + direction.x * mid
  vector.y = bus.position.y + direction.y * mid
  return {
    x: rect.x + (vector.x + 0.5) * cell,
    y: rect.y + (vector.y + 0.5) * cell,
  }
}

export function cellRect(rect: Rect, cell: number, x: number, y: number): Rect {
  return { x: rect.x + x * cell, y: rect.y + y * cell, w: cell, h: cell }
}

function drawArrow(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  direction: Direction,
  size: number,
  color: number,
  alpha: number,
): void {
  const angle = DIR_ANGLE[direction]
  const tipX = x + Math.cos(angle) * size * 0.6
  const tipY = y + Math.sin(angle) * size * 0.6
  const leftX = x - Math.cos(angle) * size * 0.35 - Math.sin(angle) * size * 0.42
  const leftY = y - Math.sin(angle) * size * 0.35 + Math.cos(angle) * size * 0.42
  const rightX = x - Math.cos(angle) * size * 0.35 + Math.sin(angle) * size * 0.42
  const rightY = y - Math.sin(angle) * size * 0.35 - Math.cos(angle) * size * 0.42
  graphics.fillStyle(color, alpha)
  graphics.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY)
}

export function drawEnvironment(
  scene: Phaser.Scene,
  level: LevelDefinition,
  theme: WorldTheme,
  rect: Rect,
  cell: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0)
  const graphics = scene.add.graphics()
  const pad = Math.max(10, cell * 0.18)
  const radius = Math.max(12, cell * 0.22)

  // Raised sidewalk slab with a side face, then the asphalt on top.
  graphics.fillStyle(0x000000, 0.22)
  graphics.fillRoundedRect(rect.x - pad + 4, rect.y - pad + pad + 8, rect.w + pad * 2, rect.h + pad * 2, radius)
  graphics.fillStyle(shade(theme.sidewalk, -0.32), 1)
  graphics.fillRoundedRect(rect.x - pad, rect.y - pad + 9, rect.w + pad * 2, rect.h + pad * 2, radius)
  graphics.fillStyle(theme.sidewalk, 1)
  graphics.fillRoundedRect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2, radius)
  graphics.fillStyle(0xffffff, 0.18)
  graphics.fillRoundedRect(rect.x - pad + 4, rect.y - pad + 3, rect.w + pad * 2 - 8, pad * 0.8, radius * 0.6)

  graphics.fillStyle(theme.road, 1)
  graphics.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, Math.max(8, cell * 0.14))
  graphics.lineStyle(2, 0xffffff, 0.1)
  graphics.strokeRoundedRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, Math.max(8, cell * 0.14))

  // Deterministic asphalt speckles.
  for (let index = 0; index < 70; index += 1) {
    const nx = ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1
    const ny = ((Math.sin(index * 78.233 + 4.1) * 12345.6789) % 1 + 1) % 1
    graphics.fillStyle(index % 4 === 0 ? 0xffffff : 0x000000, index % 4 === 0 ? 0.05 : 0.06)
    graphics.fillCircle(rect.x + nx * rect.w, rect.y + ny * rect.h, 1 + (index % 3))
  }

  graphics.lineStyle(1, 0xffffff, 0.05)
  for (let column = 1; column < level.width; column += 1) {
    graphics.beginPath()
    graphics.moveTo(rect.x + column * cell, rect.y + 4)
    graphics.lineTo(rect.x + column * cell, rect.y + rect.h - 4)
    graphics.strokePath()
  }
  for (let row = 1; row < level.height; row += 1) {
    graphics.beginPath()
    graphics.moveTo(rect.x + 4, rect.y + row * cell)
    graphics.lineTo(rect.x + rect.w - 4, rect.y + row * cell)
    graphics.strokePath()
  }

  // Parking outlines under every bus.
  for (const bus of level.buses) {
    const cells = Array.from({ length: bus.length }, (_, step) => {
      const vector = DIR_VECTORS[bus.direction]
      return { x: bus.position.x + vector.x * step, y: bus.position.y + vector.y * step }
    })
    const first = cells[0]
    const last = cells[cells.length - 1]
    const minX = Math.min(first.x, last.x)
    const minY = Math.min(first.y, last.y)
    const width = Math.abs(first.x - last.x) + 1
    const height = Math.abs(first.y - last.y) + 1
    const inset = cell * 0.09
    graphics.fillStyle(0x000000, 0.1)
    graphics.fillRoundedRect(
      rect.x + minX * cell + inset,
      rect.y + minY * cell + inset,
      width * cell - inset * 2,
      height * cell - inset * 2,
      cell * 0.1,
    )
    graphics.lineStyle(1.5, 0xffffff, 0.14)
    graphics.strokeRoundedRect(
      rect.x + minX * cell + inset,
      rect.y + minY * cell + inset,
      width * cell - inset * 2,
      height * cell - inset * 2,
      cell * 0.1,
    )
  }

  // One-way arrows at each used lane's exit.
  const lanes = new Map<string, { direction: Direction; x: number; y: number }>()
  for (const bus of level.buses) {
    const key = `${bus.direction}:${bus.direction === 'east' || bus.direction === 'west' ? bus.position.y : bus.position.x}`
    if (lanes.has(key)) continue
    const laneIndex = bus.direction === 'east' || bus.direction === 'west' ? bus.position.y : bus.position.x
    let x = 0
    let y = 0
    if (bus.direction === 'east') x = rect.x + rect.w + pad * 0.55
    if (bus.direction === 'west') x = rect.x - pad * 0.55
    if (bus.direction === 'south') y = rect.y + rect.h + pad * 0.55
    if (bus.direction === 'north') y = rect.y - pad * 0.55
    if (bus.direction === 'east' || bus.direction === 'west') y = rect.y + (laneIndex + 0.5) * cell
    else x = rect.x + (laneIndex + 0.5) * cell
    lanes.set(key, { direction: bus.direction, x, y })
  }
  for (const lane of lanes.values()) {
    drawArrow(graphics, lane.x, lane.y, lane.direction, Math.max(9, cell * 0.22), theme.accent, 0.95)
  }

  // Crosswalk stripes at the top and bottom ends of the lot.
  graphics.fillStyle(0xffffff, 0.14)
  for (let index = 0; index < Math.max(4, level.width); index += 1) {
    const stripeWidth = Math.max(4, cell * 0.1)
    graphics.fillRoundedRect(rect.x + index * cell + cell * 0.2, rect.y + 4, stripeWidth, cell * 0.2, 2)
    graphics.fillRoundedRect(rect.x + index * cell + cell * 0.2, rect.y + rect.h - cell * 0.24, stripeWidth, cell * 0.2, 2)
  }

  container.add(graphics)
  return container
}

export function drawQueueTrack(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  theme: WorldTheme,
  count: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0)
  const graphics = scene.add.graphics()
  graphics.fillStyle(0x000000, 0.18)
  graphics.fillEllipse(x + 4, y + 4, radiusX * 2 + 34, radiusY * 2 + 30)
  graphics.fillStyle(shade(theme.sidewalk, -0.16), 1)
  graphics.fillEllipse(x, y, radiusX * 2 + 30, radiusY * 2 + 26)
  graphics.fillStyle(theme.sidewalk, 1)
  graphics.fillEllipse(x, y - 3, radiusX * 2 + 30, radiusY * 2 + 26)
  graphics.lineStyle(2, 0xffffff, 0.22)
  graphics.strokeEllipse(x, y - 3, radiusX * 2 + 30, radiusY * 2 + 26)
  graphics.fillStyle(shade(theme.ground, 0.06), 0.5)
  graphics.fillEllipse(x, y - 3, radiusX * 1.45, radiusY * 1.2)
  graphics.lineStyle(9, 0xffffff, 0.13)
  graphics.strokeEllipse(x, y - 3, radiusX * 2, radiusY * 2)
  for (let index = 0; index < Math.min(18, Math.max(6, count)); index += 1) {
    const angle = Math.PI + (index / Math.max(6, count)) * Math.PI * 1.9
    graphics.fillStyle(theme.accent, 0.35)
    graphics.fillCircle(x + Math.cos(angle) * radiusX, y - 3 + Math.sin(angle) * radiusY, 2.2)
  }
  container.add(graphics)
  return container
}

export function drawProp(
  graphics: Phaser.GameObjects.Graphics,
  kind: PropKind,
  x: number,
  y: number,
  scale: number,
  accent: number,
): void {
  const trunk = 0x7a5230
  switch (kind) {
    case 'park':
    case 'mountain':
      graphics.fillStyle(trunk, 1)
      graphics.fillRoundedRect(x - scale * 0.1, y, scale * 0.2, scale * 0.7, scale * 0.08)
      graphics.fillStyle(kind === 'park' ? 0x5aa86a : 0x3f7a63, 1)
      graphics.fillCircle(x, y - scale * 0.18, scale * 0.42)
      graphics.fillCircle(x - scale * 0.3, y + scale * 0.05, scale * 0.3)
      graphics.fillCircle(x + scale * 0.3, y + scale * 0.05, scale * 0.3)
      break
    case 'beach':
      graphics.fillStyle(trunk, 1)
      graphics.fillRoundedRect(x - scale * 0.08, y - scale * 0.5, scale * 0.16, scale * 1.1, scale * 0.06)
      graphics.fillStyle(0x4fae7d, 1)
      for (let index = 0; index < 5; index += 1) {
        const angle = -Math.PI / 2 + (index - 2) * 0.5
        graphics.fillEllipse(
          x + Math.cos(angle) * scale * 0.4,
          y - scale * 0.5 + Math.sin(angle) * scale * 0.22,
          scale * 0.55,
          scale * 0.14,
        )
      }
      break
    case 'city':
    case 'hub':
    case 'airport':
      graphics.fillStyle(0x6f7f97, 1)
      graphics.fillRoundedRect(x - scale * 0.42, y - scale * 0.75, scale * 0.84, scale * 1.3, scale * 0.06)
      graphics.fillStyle(accent, 0.85)
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 2; column += 1) {
          graphics.fillRect(x - scale * 0.26 + column * scale * 0.3, y - scale * 0.6 + row * scale * 0.28, scale * 0.14, scale * 0.14)
        }
      }
      break
    case 'candy':
      graphics.fillStyle(0xffffff, 1)
      graphics.fillRoundedRect(x - scale * 0.06, y - scale * 0.3, scale * 0.12, scale * 0.9, scale * 0.06)
      graphics.fillStyle(accent, 1)
      graphics.fillCircle(x, y - scale * 0.45, scale * 0.34)
      graphics.lineStyle(scale * 0.05, 0xffffff, 0.8)
      graphics.strokeCircle(x, y - scale * 0.45, scale * 0.2)
      break
    case 'neon':
      graphics.fillStyle(0x1d2540, 1)
      graphics.fillRoundedRect(x - scale * 0.3, y - scale * 0.7, scale * 0.6, scale * 1.2, scale * 0.08)
      graphics.lineStyle(Math.max(2, scale * 0.06), accent, 0.9)
      graphics.strokeRoundedRect(x - scale * 0.22, y - scale * 0.6, scale * 0.44, scale * 0.44, scale * 0.06)
      break
    case 'festival':
      graphics.fillStyle(trunk, 1)
      graphics.fillRect(x - scale * 0.03, y - scale * 0.2, scale * 0.06, scale * 0.8)
      graphics.fillStyle(accent, 1)
      graphics.fillCircle(x - scale * 0.2, y - scale * 0.55, scale * 0.22)
      graphics.fillStyle(0x4f8ff0, 1)
      graphics.fillCircle(x + scale * 0.2, y - scale * 0.62, scale * 0.22)
      graphics.fillStyle(0xf2c94c, 1)
      graphics.fillCircle(x, y - scale * 0.82, scale * 0.2)
      break
    default:
      graphics.fillStyle(0xffffff, 0.5)
      graphics.fillRoundedRect(x - scale * 0.4, y - scale * 0.25, scale * 0.8, scale * 0.16, scale * 0.05)
      graphics.fillRect(x - scale * 0.32, y - scale * 0.1, scale * 0.07, scale * 0.5)
      graphics.fillRect(x + scale * 0.25, y - scale * 0.1, scale * 0.07, scale * 0.5)
      break
  }
}

/** A little walking token used for boarding animations. */
export function createBoardingToken(scene: Phaser.Scene, color: BusColor, size: number, seed: number): Phaser.GameObjects.Container {
  const passenger = createPassenger(scene, color, size, seed, false)
  passenger.container.setScale(0.9)
  return passenger.container
}
