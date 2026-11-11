import Phaser from 'phaser'
import { openTipJar } from './support'
import { app } from '../core/app'
import { sound } from '../core/audio'
import {
  analyseState,
  busById,
  capacityOf,
  cloneState,
  dispatchBus,
  initialState,
  isVictory,
  occupiedBays,
  remainingPassengers,
} from '../core/engine'
import { globalNumberOf, levelById, levelByNumber } from '../core/levels'
import { dailyChallenge, endlessLevel, expertLevel, type GameMode } from '../core/modes'
import { nextSolutionMove } from '../core/solver'
import {
  clearSession,
  loadSession,
  recordCompletion,
  recordEndless,
  saveSession,
  starsFor,
  type SavedSession,
} from '../core/saves'
import { COLOR_META, type BusDefinition, type EngineState, type LevelDefinition, type SymbolShape } from '../core/types'
import { achievementById } from '../core/achievements'
import { WORLDS, shade } from '../core/worlds'
import {
  announce,
  backdrop,
  button,
  fadeIn,
  iconButton,
  label,
  panel,
  PAPER,
  stage,
  starRow,
  toast,
  type Rect,
} from './common'
import {
  createBoardingToken,
  createBus,
  createPassenger,
  drawEnvironment,
  drawProp,
  drawQueueTrack,
} from './draw'

export interface GameData {
  levelId?: string
  mode?: GameMode
  resume?: boolean
  dailyKey?: string
  run?: number
  step?: number
  cleared?: number
  state?: EngineState
  moves?: number
  hints?: number
}

interface Snapshot {
  state: EngineState
  moves: number
  hints: number
}

interface Layout {
  portrait: boolean
  width: number
  height: number
  board: Rect
  bays: Rect
  queue: Rect
  toolbar: Rect
  cell: number
  queueCenter: { x: number; y: number }
  queueRadius: { x: number; y: number }
}

type OverlayKind = 'pause' | 'results' | 'deadlock' | null

const SYMBOL_WORDS: Record<SymbolShape, string> = {
  square: 'square',
  circle: 'circle',
  triangle: 'triangle',
  star: 'star',
  diamond: 'diamond',
  cross: 'cross',
  heart: 'heart',
  hex: 'hexagon',
}

const MODE_NAMES: Record<GameMode, string> = {
  journey: 'Journey',
  zen: 'Zen',
  daily: 'Daily Challenge',
  expert: 'Expert',
  endless: 'Endless',
  free: 'Free Play',
}

export class GameScene extends Phaser.Scene {
  private sceneData: GameData = {}
  private level!: LevelDefinition
  private world = WORLDS[0]
  private mode: GameMode = 'journey'
  private dailyKey?: string
  private run = 0
  private step = 0
  private cleared = 0

  private state!: EngineState
  private moves = 0
  private hintsUsed = 0
  private history: Snapshot[] = []
  private future: Snapshot[] = []

  private layout!: Layout
  private root!: Phaser.GameObjects.Container
  private boardLayer!: Phaser.GameObjects.Container
  private busLayer!: Phaser.GameObjects.Container
  private bayLayer!: Phaser.GameObjects.Container
  private queueLayer!: Phaser.GameObjects.Container
  private fxLayer!: Phaser.GameObjects.Container
  private uiLayer!: Phaser.GameObjects.Container

  private busVisuals = new Map<string, Phaser.GameObjects.Container>()
  private overlay: Phaser.GameObjects.Container | null = null
  private overlayKind: OverlayKind = null

  private busy = false
  private ended = false
  private paused = false
  private hintStage = 0
  private newAchievements: string[] = []
  private progressBar!: Phaser.GameObjects.Graphics
  private hudMoves!: Phaser.GameObjects.Text
  private hudLeft!: Phaser.GameObjects.Text
  private hudBays!: Phaser.GameObjects.Text
  private hudPar!: Phaser.GameObjects.Text
  private queueCountText!: Phaser.GameObjects.Text
  private undoButton: Phaser.GameObjects.Container | null = null
  private redoButton: Phaser.GameObjects.Container | null = null
  private resizePending = false

  constructor() {
    super('Game')
  }

  init(data: GameData): void {
    this.sceneData = data ?? {}
  }

  create(): void {
    app.refresh()
    this.resetTransientState()
    this.prepareLevel()
    backdrop(this, shade(this.world.sky[0], -0.52), shade(this.world.sky[1], -0.84))
    this.resolveState()
    this.layout = this.computeLayout()
    this.buildStage()
    this.renderAll()
    this.persistSession()
    fadeIn(this)
    sound.unlock()
    this.input.once('pointerdown', () => sound.unlock())

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize)
      this.input.keyboard?.removeAllListeners()
    })

    this.input.keyboard?.on('keydown-U', () => this.undo())
    this.input.keyboard?.on('keydown-Z', () => this.undo())
    this.input.keyboard?.on('keydown-Y', () => this.redo())
    this.input.keyboard?.on('keydown-R', () => this.restartLevel())
    this.input.keyboard?.on('keydown-H', () => this.giveHint())
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause())

    if (isVictory(this.level, this.state)) this.time.delayedCall(250, () => this.finishLevel())
  }

  /** Phaser reuses the scene instance across restart(), so per-level state
   * must be cleared here or a finished level's overlay/ended flag leaks into
   * the next stop and swallows every tap. */
  private resetTransientState(): void {
    this.busy = false
    this.ended = false
    this.paused = false
    this.overlay = null
    this.overlayKind = null
    this.hintStage = 0
    this.history = []
    this.future = []
    this.newAchievements = []
    this.resizePending = false
    this.undoButton = null
    this.redoButton = null
    this.busVisuals.clear()
  }

  private prepareLevel(): void {
    const data = this.sceneData
    this.mode = data.mode ?? 'journey'
    let level: LevelDefinition | undefined
    if (this.mode === 'daily') {
      const daily = dailyChallenge()
      level = daily.level
      this.dailyKey = daily.dateKey
    } else if (this.mode === 'endless') {
      this.run = data.run ?? 1
      this.step = data.step ?? 0
      level = endlessLevel(this.run, this.step)
    } else if (this.mode === 'expert') {
      this.run = data.run ?? 0
      level = data.levelId ? levelById(data.levelId) : expertLevel(this.run * 97 + this.step + app.progress.stats.dispatches)
    } else {
      level = data.levelId ? levelById(data.levelId) : levelByNumber(app.progress.unlocked)
    }
    this.level = level ?? levelByNumber(1)!
    this.world = WORLDS[Math.min(9, Math.max(0, this.level.world - 1))]
    this.cleared = data.cleared ?? 0
  }

  private stateIsCompatible(candidate: EngineState): boolean {
    if (!candidate || !Array.isArray(candidate.parked) || !Array.isArray(candidate.bays)) return false
    if (candidate.bays.length !== this.level.bays) return false
    if (!Number.isInteger(candidate.queueIndex) || candidate.queueIndex < 0) return false
    if (candidate.queueIndex > this.level.queue.length) return false
    const ids = new Set(this.level.buses.map((bus) => bus.id))
    const parked = new Set(candidate.parked)
    if (parked.size !== candidate.parked.length) return false
    for (const id of parked) if (!ids.has(id)) return false
    const bayIds = new Set<string>()
    for (const slot of candidate.bays) {
      if (!slot) continue
      if (!ids.has(slot.busId) || parked.has(slot.busId)) return false
      if (bayIds.has(slot.busId)) return false
      const capacity = capacityOf(this.level, slot.busId)
      if (!Number.isInteger(slot.filled) || slot.filled < 0 || slot.filled > capacity) return false
      bayIds.add(slot.busId)
    }
    return true
  }

  private resolveState(): void {
    const data = this.sceneData
    if (data.state && this.stateIsCompatible(data.state) && !isVictory(this.level, data.state)) {
      this.state = cloneState(data.state)
      this.moves = data.moves ?? this.level.par
      this.hintsUsed = data.hints ?? 0
      return
    }
    if (data.resume) {
      const session = loadSession()
      if (session && session.levelId === this.level.id && this.stateIsCompatible(session.state)) {
        if (!isVictory(this.level, session.state)) {
          this.state = cloneState(session.state)
          this.moves = session.moves
          this.hintsUsed = session.hints
          return
        }
      }
    }
    this.state = initialState(this.level)
    this.moves = 0
    this.hintsUsed = 0
  }

  private computeLayout(): Layout {
    const portrait = this.scale.width < this.scale.height || this.scale.width === this.scale.height
    const width = portrait ? 720 : 1280
    const height = portrait ? 1280 : 720
    const boardArea: Rect = portrait ? { x: 16, y: 122, w: 688, h: 508 } : { x: 16, y: 116, w: 748, h: 548 }
    const cell = Math.min((boardArea.w - 22) / this.level.width, (boardArea.h - 22) / this.level.height)
    const board: Rect = {
      x: boardArea.x + (boardArea.w - cell * this.level.width) / 2,
      y: boardArea.y + (boardArea.h - cell * this.level.height) / 2,
      w: cell * this.level.width,
      h: cell * this.level.height,
    }
    const bays: Rect = portrait ? { x: 16, y: 646, w: 688, h: 104 } : { x: 780, y: 116, w: 484, h: 104 }
    const queue: Rect = portrait ? { x: 18, y: 762, w: 684, h: 368 } : { x: 780, y: 232, w: 484, h: 340 }
    const toolbar: Rect = portrait ? { x: 16, y: 1150, w: 688, h: 100 } : { x: 780, y: 584, w: 484, h: 84 }
    const queueCenter = { x: queue.x + queue.w / 2, y: queue.y + queue.h * 0.55 }
    const queueRadius = portrait ? { x: 282, y: 112 } : { x: 196, y: 102 }
    return { portrait, width, height, board, bays, queue, toolbar, cell, queueCenter, queueRadius }
  }

  private buildStage(): void {
    this.root = stage(this, this.layout.width, this.layout.height)
    this.boardLayer = this.add.container(0, 0)
    this.busLayer = this.add.container(0, 0)
    this.bayLayer = this.add.container(0, 0)
    this.queueLayer = this.add.container(0, 0)
    this.fxLayer = this.add.container(0, 0)
    this.uiLayer = this.add.container(0, 0)
    this.root.add([this.boardLayer, this.busLayer, this.bayLayer, this.queueLayer, this.fxLayer, this.uiLayer])

    this.boardLayer.add(drawEnvironment(this, this.level, this.world, this.layout.board, this.layout.cell))

    const queueStatic = this.add.container(0, 0)
    const count = Math.min(24, Math.max(8, this.level.queue.length))
    queueStatic.add(
      drawQueueTrack(
        this,
        this.layout.queueCenter.x,
        this.layout.queueCenter.y,
        this.layout.queueRadius.x,
        this.layout.queueRadius.y,
        this.world,
        count,
      ),
    )
    const props = this.add.graphics()
    drawProp(props, this.world.prop, this.layout.queue.x + 46, this.layout.queue.y + 322, 34, this.world.accent)
    drawProp(props, this.world.prop === 'beach' ? 'park' : 'city', this.layout.queue.x + this.layout.queue.w - 52, this.layout.queue.y + 318, 32, this.world.accent)
    queueStatic.add(props)
    const sign = this.add.graphics()
    const signX = Math.min(this.layout.queue.x + this.layout.queue.w - 64, this.layout.queueCenter.x + this.layout.queueRadius.x + 18)
    sign.fillStyle(0x8a93a6, 1)
    sign.fillRoundedRect(signX - 3, this.layout.queueCenter.y - 48, 6, 78, 3)
    sign.fillStyle(0xfff3d9, 1)
    sign.fillRoundedRect(signX - 26, this.layout.queueCenter.y - 74, 52, 30, 7)
    sign.fillStyle(this.world.accent, 1)
    sign.fillRoundedRect(signX - 20, this.layout.queueCenter.y - 69, 40, 5, 2)
    queueStatic.add(sign)
    queueStatic.add(
      label(this, signX, this.layout.queueCenter.y - 47, 'STOP', 9, '#243046', { origin: 0.5, fontStyle: 'bold' }),
    )
    this.root.addAt(queueStatic, 1)

    const header = this.add.graphics()
    header.fillStyle(0x0c1322, 0.66)
    header.fillRoundedRect(12, 10, this.layout.width - 24, 96, 22)
    header.lineStyle(1, 0xffffff, 0.1)
    header.strokeRoundedRect(12, 10, this.layout.width - 24, 96, 22)
    this.uiLayer.add(header)

    const worldLine = `${this.world.name}  \u00b7  ${MODE_NAMES[this.mode]}`
    this.uiLayer.add(label(this, 30, 24, worldLine.toUpperCase(), 10, '#9fb0ca', { fontStyle: 'bold' }))
    this.uiLayer.add(label(this, 30, 40, this.level.name, 25, PAPER, { fontStyle: 'bold' }))
    const global = globalNumberOf(this.level)
    this.uiLayer.add(
      label(this, this.layout.width - 84, 24, `LEVEL ${global}`, 10, '#9fb0ca', {
        origin: [1, 0],
        fontStyle: 'bold',
      }),
    )

    this.hudMoves = label(this, 30, 78, '', 13, '#c3cfe3')
    this.hudLeft = label(this, 178, 78, '', 13, '#c3cfe3')
    this.hudBays = label(this, 326, 78, '', 13, '#c3cfe3')
    this.hudPar = label(this, 486, 78, '', 13, '#c3cfe3')
    this.uiLayer.add([this.hudMoves, this.hudLeft, this.hudBays, this.hudPar])

    this.progressBar = this.add.graphics()
    this.uiLayer.add(this.progressBar)

    this.uiLayer.add(
      iconButton(this, this.layout.width - 48, 56, 'II', () => this.togglePause(), {
        size: 46,
        fill: 0x223354,
        color: PAPER,
      }),
    )

    this.queueCountText = label(
      this,
      this.layout.queue.x + this.layout.queue.w - 18,
      this.layout.queue.y + 10,
      '',
      12,
      '#9fb0ca',
      { origin: [1, 0], fontStyle: 'bold' },
    )
    this.uiLayer.add(this.queueCountText)
    this.uiLayer.add(
      label(this, this.layout.queue.x + 16, this.layout.queue.y + 10, 'PASSENGER QUEUE', 10, '#9fb0ca', { fontStyle: 'bold' }),
    )

    this.buildToolbar()
  }

  private buildToolbar(): void {
    const { toolbar } = this.layout
    const size = this.layout.portrait ? 66 : 56
    const gap = this.layout.portrait ? 112 : 112
    const centerY = toolbar.y + size / 2 + 2
    const startX = toolbar.x + toolbar.w / 2 - gap * 1.5
    const actions: Array<{ glyph: string; caption: string; action: () => void }> = [
      { glyph: '\u21b6', caption: 'Undo', action: () => this.undo() },
      { glyph: '\u21b7', caption: 'Redo', action: () => this.redo() },
      { glyph: '?', caption: 'Hint', action: () => this.giveHint() },
      { glyph: '\u21bb', caption: 'Restart', action: () => this.restartLevel() },
    ]
    actions.forEach((action, index) => {
      const created = iconButton(this, startX + index * gap, centerY, action.glyph, action.action, {
        size,
        fill: 0x223354,
        label: action.caption,
      })
      this.uiLayer.add(created)
      if (index === 0) this.undoButton = created
      if (index === 1) this.redoButton = created
    })
  }

  private handleResize = (): void => {
    if (!this.layout) return
    const landscape = this.scale.width > this.scale.height
    if (landscape === this.layout.portrait) {
      if (this.busy) {
        this.resizePending = true
        return
      }
      this.scene.restart({
        ...this.sceneData,
        levelId: this.level.id,
        state: this.state,
        moves: this.moves,
        hints: this.hintsUsed,
        cleared: this.cleared,
      })
    }
  }

  private busLabel(bus: BusDefinition): string {
    return `${COLOR_META[bus.color].name} ${SYMBOL_WORDS[COLOR_META[bus.color].symbol]} bus`
  }

  private busLabelById(id: string): string {
    const bus = busById(this.level, id)
    return bus ? this.busLabel(bus) : 'bus'
  }

  private renderAll(): void {
    this.renderBuses()
    this.renderBays()
    this.renderQueue()
    this.updateHud()
    this.updateToolbar()
  }

  private renderBuses(): void {
    this.busLayer.removeAll(true)
    this.busVisuals.clear()
    for (const bus of this.level.buses) {
      if (!this.state.parked.includes(bus.id)) continue
      const visual = createBus(this, bus, this.layout.cell, {
        highContrast: app.highContrast,
        interactive: true,
      })
      const cells = Array.from({ length: bus.length }, (_, step) => {
        const vector = bus.direction === 'east' ? { x: 1, y: 0 } : bus.direction === 'west' ? { x: -1, y: 0 } : bus.direction === 'south' ? { x: 0, y: 1 } : { x: 0, y: -1 }
        return { x: bus.position.x + vector.x * step, y: bus.position.y + vector.y * step }
      })
      const first = cells[0]
      const last = cells[cells.length - 1]
      const midX = (first.x + last.x) / 2
      const midY = (first.y + last.y) / 2
      visual.setPosition(
        this.layout.board.x + (midX + 0.5) * this.layout.cell,
        this.layout.board.y + (midY + 0.5) * this.layout.cell,
      )
      visual.on('pointerdown', () => this.handleBusTap(bus.id))
      visual.on('pointerover', () => {
        if (!this.busy && !this.overlayKind) visual.setScale(1.03)
      })
      visual.on('pointerout', () => visual.setScale(1))
      this.busLayer.add(visual)
      this.busVisuals.set(bus.id, visual)
    }
  }

  private baySlotCenter(index: number): { x: number; y: number } {
    const slotWidth = this.layout.bays.w / this.level.bays
    return {
      x: this.layout.bays.x + slotWidth * (index + 0.5),
      y: this.layout.bays.y + this.layout.bays.h * 0.52,
    }
  }

  private renderBays(): void {
    this.bayLayer.removeAll(true)
    const { bays } = this.layout
    const slotWidth = bays.w / this.level.bays
    for (let index = 0; index < this.level.bays; index += 1) {
      const x = bays.x + index * slotWidth
      const card = panel(this, x + 5, bays.y, slotWidth - 10, bays.h, {
        fill: 0x1c2942,
        side: 0x0a1120,
        radius: 16,
        raised: 5,
        highlight: false,
        stroke: 0xffffff,
        strokeAlpha: 0.12,
      })
      this.bayLayer.add(card)
      card.add(label(this, (slotWidth - 10) / 2, 8, `BAY ${index + 1}`, 9, '#9fb0ca', { origin: 0.5, fontStyle: 'bold' }))
      const slot = this.state.bays[index]
      if (!slot) {
        const dashed = this.add.graphics()
        dashed.lineStyle(2, 0xffffff, 0.18)
        const inset = 16
        const width = slotWidth - 10 - inset * 2
        const height = bays.h - 34
        const step = 10
        for (let offset = 0; offset < width; offset += step * 2) {
          dashed.beginPath()
          dashed.moveTo(x + 5 + inset + offset, bays.y + 26)
          dashed.lineTo(x + 5 + inset + Math.min(width, offset + step), bays.y + 26)
          dashed.strokePath()
          dashed.beginPath()
          dashed.moveTo(x + 5 + inset + offset, bays.y + 26 + height)
          dashed.lineTo(x + 5 + inset + Math.min(width, offset + step), bays.y + 26 + height)
          dashed.strokePath()
        }
        dashed.beginPath()
        dashed.moveTo(x + 5 + inset, bays.y + 26)
        dashed.lineTo(x + 5 + inset, bays.y + 26 + height)
        dashed.strokePath()
        dashed.beginPath()
        dashed.moveTo(x + 5 + inset + width, bays.y + 26)
        dashed.lineTo(x + 5 + inset + width, bays.y + 26 + height)
        dashed.strokePath()
        this.bayLayer.add(dashed)
        card.add(label(this, (slotWidth - 10) / 2, bays.h * 0.62, 'open', 12, '#5d6f8c', { origin: 0.5 }))
        continue
      }
      const bus = busById(this.level, slot.busId)
      if (!bus) continue
      const cell = Math.min((slotWidth - 34) / Math.max(2, bus.length), 46)
      const visual = createBus(this, { ...bus, position: { x: 0, y: 0 }, direction: 'east' }, cell, {
        highContrast: app.highContrast,
      })
      visual.setPosition(x + slotWidth / 2, bays.y + bays.h * 0.47)
      this.bayLayer.add(visual)
      const capacity = this.level.buses.find((item) => item.id === slot.busId)?.capacity ?? slot.filled
      const pips = this.add.graphics()
      const pipGap = Math.min(11, (slotWidth - 46) / Math.max(1, capacity))
      const totalWidth = pipGap * (capacity - 1)
      for (let pip = 0; pip < capacity; pip += 1) {
        pips.fillStyle(pip < slot.filled ? COLOR_META[bus.color].hex : 0xffffff, pip < slot.filled ? 1 : 0.16)
        pips.fillCircle(x + slotWidth / 2 - totalWidth / 2 + pip * pipGap, bays.y + bays.h - 18, Math.min(3.6, pipGap * 0.34))
      }
      this.bayLayer.add(pips)
      card.add(
        label(this, (slotWidth - 10) / 2, bays.h - 34, `${slot.filled} / ${capacity}`, 10, '#c3cfe3', {
          origin: 0.5,
          fontStyle: 'bold',
        }),
      )
    }
  }

  private queuePositions(count: number): Array<{ x: number; y: number }> {
    const { queueCenter, queueRadius } = this.layout
    const span = Math.PI * 1.9
    return Array.from({ length: count }, (_, index) => {
      const angle = Math.PI + (count <= 1 ? 0 : (index / count) * span)
      return {
        x: queueCenter.x + Math.cos(angle) * queueRadius.x,
        y: queueCenter.y + Math.sin(angle) * queueRadius.y,
      }
    })
  }

  private renderQueue(): void {
    this.queueLayer.removeAll(true)
    const remaining = this.level.queue.slice(this.state.queueIndex)
    const maxShown = this.layout.portrait ? 22 : 18
    const shown = Math.min(remaining.length, maxShown)
    this.queueCountText.setText(remaining.length ? `${remaining.length} waiting` : 'All aboard')

    if (!remaining.length) {
      this.queueLayer.add(
        label(this, this.layout.queueCenter.x, this.layout.queueCenter.y, 'Queue clear \u2014 enjoy the ride!', 17, '#8fa3c2', {
          origin: 0.5,
        }),
      )
      return
    }

    const positions = this.queuePositions(shown)
    const spacing =
      (2 * Math.PI * Math.sqrt((this.layout.queueRadius.x ** 2 + this.layout.queueRadius.y ** 2) / 2)) / Math.max(1, shown)
    const size = Phaser.Math.Clamp(spacing * 0.52, 13, 27)

    if (positions.length) {
      const marker = this.add.graphics()
      marker.lineStyle(3, 0xffce55, 0.95)
      marker.strokeCircle(positions[0].x, positions[0].y, size * 0.72)
      marker.fillStyle(0xffce55, 1)
      marker.fillTriangle(
        positions[0].x,
        positions[0].y - size * 1.28,
        positions[0].x - 7,
        positions[0].y - size * 1.62,
        positions[0].x + 7,
        positions[0].y - size * 1.62,
      )
      this.queueLayer.add(marker)
      this.queueLayer.add(
        label(this, positions[0].x, positions[0].y - size * 1.9, 'NEXT', 9, '#ffce55', { origin: 0.5, fontStyle: 'bold' }),
      )
    }

    for (let index = 0; index < shown; index += 1) {
      const color = remaining[index]
      const passenger = createPassenger(this, color, size, this.state.queueIndex + index, app.highContrast)
      passenger.container.setPosition(positions[index].x, positions[index].y)
      this.queueLayer.add(passenger.container)
      if (!app.reducedMotion) {
        this.tweens.add({
          targets: passenger.container,
          y: positions[index].y - 3,
          duration: 900 + (index % 5) * 130,
          delay: index * 35,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        })
      }
    }

    if (remaining.length > shown) {
      this.queueLayer.add(
        label(this, this.layout.queueCenter.x, this.layout.queueCenter.y + this.layout.queueRadius.y + 24, `+${remaining.length - shown} more waiting`, 12, '#9fb0ca', {
          origin: 0.5,
        }),
      )
    }
  }

  private updateHud(): void {
    const remaining = remainingPassengers(this.level, this.state)
    const occupied = occupiedBays(this.state)
    this.hudMoves.setText(`Moves ${this.moves}`)
    this.hudLeft.setText(`Left ${remaining}`)
    this.hudBays.setText(`Bays ${occupied}/${this.level.bays}`)
    this.hudPar.setText(`Par ${this.level.par}`)
    const total = this.level.queue.length
    const done = total - remaining
    this.progressBar.clear()
    const x = 30
    const y = 100
    const width = this.layout.width - 60
    this.progressBar.fillStyle(0xffffff, 0.12)
    this.progressBar.fillRoundedRect(x, y, width, 4, 2)
    if (done > 0) {
      this.progressBar.fillStyle(0xf2c94c, 0.95)
      this.progressBar.fillRoundedRect(x, y, Math.max(4, (done / Math.max(1, total)) * width), 4, 2)
    }
  }

  private updateToolbar(): void {
    if (this.undoButton) this.undoButton.setAlpha(this.history.length ? 1 : 0.42)
    if (this.redoButton) this.redoButton.setAlpha(this.future.length ? 1 : 0.42)
  }

  private handleBusTap(busId: string): void {
    if (this.busy || this.ended || this.overlayKind || this.paused) return
    sound.unlock()
    const result = dispatchBus(this.level, this.state, busId)
    if (!result.ok) {
      sound.blocked()
      this.shakeBus(busId)
      let message = 'That bus cannot leave yet.'
      if (result.reason === 'no-bay') message = 'All boarding bays are busy. Fill one to free a bay.'
      else if (result.blocker?.kind === 'bus' && result.blocker.busId) {
        message = `The ${this.busLabelById(result.blocker.busId)} is parked in the way.`
      } else if (result.blocker?.kind === 'barrier') {
        message = 'The traffic gate is still closed. Dispatch another bus to open it.'
      } else if (result.blocker?.kind === 'obstacle') {
        message = 'A planter blocks that lane.'
      }
      toast(this, this.root, message, { y: this.layout.portrait ? 202 : 190, width: 600 })
      return
    }

    this.history.push({ state: cloneState(this.state), moves: this.moves, hints: this.hintsUsed })
    this.future = []
    this.state = result.state
    this.moves += 1
    this.hintStage = 0
    this.busy = true
    sound.horn()
    this.updateHud()
    this.updateToolbar()
    this.persistSession()

    const container = this.busVisuals.get(busId)
    const bus = busById(this.level, busId)
    if (!container || !bus) {
      this.renderAll()
      this.completeTurn()
      return
    }
    const vector =
      bus.direction === 'east' ? { x: 1, y: 0 } : bus.direction === 'west' ? { x: -1, y: 0 } : bus.direction === 'south' ? { x: 0, y: 1 } : { x: 0, y: -1 }
    const distance = (result.route.length + bus.length + 1) * this.layout.cell
    const duration = app.reducedMotion ? 90 : this.ms(430)
    this.tweens.add({
      targets: container,
      x: container.x + vector.x * distance,
      y: container.y + vector.y * distance,
      duration,
      ease: 'Sine.In',
      onComplete: () => {
        container.destroy()
        this.busVisuals.delete(busId)
        this.renderBays()
        this.playBoarding(result)
      },
    })
  }

  private ms(value: number): number {
    return Math.max(60, value / Math.max(0.5, app.speed))
  }

  private playBoarding(result: ReturnType<typeof dispatchBus>): void {
    const steps = result.boarding
    const tokens = Math.min(steps.length, 10)
    const start = this.queuePositions(1)[0] ?? { x: this.layout.queueCenter.x, y: this.layout.queueCenter.y }
    for (let index = 0; index < tokens; index += 1) {
      const step = steps[index]
      const target = this.baySlotCenter(step.bayIndex)
      const token = createBoardingToken(this, step.color, 26, step.passenger)
      token.setPosition(start.x, start.y)
      this.fxLayer.add(token)
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2((start.x + target.x) / 2, Math.min(start.y, target.y) - 90),
        new Phaser.Math.Vector2(target.x, target.y),
      )
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.ms(340),
        delay: this.ms(index * 52),
        onUpdate: (tween) => {
          const point = curve.getPoint(tween.getValue() ?? 0)
          token.setPosition(point.x, point.y)
          token.setAlpha(1 - (tween.getValue() ?? 0) * 0.35)
        },
        onComplete: () => token.destroy(),
      })
      if (index < 5) this.time.delayedCall(this.ms(index * 52), () => sound.board())
    }

    const wait = steps.length ? this.ms(tokens * 52 + 360) : this.ms(120)
    this.time.delayedCall(wait, () => {
      this.renderBays()
      this.renderQueue()
      this.renderBuses()
      if (result.departed.length) {
        sound.depart()
        result.departed.forEach((busId) => {
          const bus = busById(this.level, busId)
          if (bus) this.confetti(this.baySlotCenter(result.bayIndex), COLOR_META[bus.color].hex)
        })
      }
      this.updateHud()
      this.completeTurn()
    })
  }

  private completeTurn(): void {
    this.busy = false
    this.updateToolbar()
    this.updateHud()
    this.persistSession()
    if (this.resizePending) {
      this.resizePending = false
      this.handleResize()
      return
    }
    if (isVictory(this.level, this.state)) {
      this.finishLevel()
      return
    }
    const analysis = analyseState(this.level, this.state)
    if (analysis.deadlocked) this.showDeadlock()
  }

  private confetti(position: { x: number; y: number }, color: number): void {
    const count = app.reducedMotion ? 5 : 14
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4
      const distance = Phaser.Math.Between(28, app.reducedMotion ? 46 : 84)
      const dot = this.add.circle(position.x, position.y, Phaser.Math.FloatBetween(2, 4.4), index % 3 === 0 ? 0xffffff : color, 1)
      this.fxLayer.add(dot)
      this.tweens.add({
        targets: dot,
        x: position.x + Math.cos(angle) * distance,
        y: position.y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: this.ms(620),
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy(),
      })
    }
  }

  private shakeBus(busId: string): void {
    const container = this.busVisuals.get(busId)
    if (!container) return
    const baseX = container.x
    this.tweens.add({
      targets: container,
      x: baseX + 7,
      duration: 50,
      yoyo: true,
      repeat: app.reducedMotion ? 1 : 3,
      onComplete: () => container.setX(baseX),
    })
  }

  private undo(): void {
    if (this.busy || this.ended || this.paused) return
    const snapshot = this.history.pop()
    if (!snapshot) {
      toast(this, this.root, 'Nothing to undo yet.', { y: this.layout.portrait ? 202 : 190 })
      return
    }
    this.future.push({ state: cloneState(this.state), moves: this.moves, hints: this.hintsUsed })
    this.state = snapshot.state
    this.moves = snapshot.moves
    this.hintsUsed = snapshot.hints
    this.hintStage = 0
    this.renderAll()
    this.persistSession()
    sound.undo()
    announce('Move undone.')
  }

  private redo(): void {
    if (this.busy || this.ended || this.paused) return
    const snapshot = this.future.pop()
    if (!snapshot) {
      toast(this, this.root, 'Nothing to redo.', { y: this.layout.portrait ? 202 : 190 })
      return
    }
    this.history.push({ state: cloneState(this.state), moves: this.moves, hints: this.hintsUsed })
    this.state = snapshot.state
    this.moves = snapshot.moves
    this.hintsUsed = snapshot.hints
    this.renderAll()
    this.persistSession()
    sound.click()
    announce('Move redone.')
  }

  private restartLevel(): void {
    if (this.busy) {
      toast(this, this.root, 'Let the bus finish first.', { y: this.layout.portrait ? 202 : 190 })
      return
    }
    this.closeOverlay()
    this.history = []
    this.future = []
    this.state = initialState(this.level)
    this.moves = 0
    this.hintsUsed = 0
    this.ended = false
    this.hintStage = 0
    this.renderAll()
    this.persistSession()
    sound.undo()
    announce('Level restarted.')
  }

  private giveHint(): void {
    if (this.busy || this.ended || this.paused) return
    const result = nextSolutionMove(this.level, this.state, { maxStates: 140_000, maxMillis: 1200 })
    if (!result.move) {
      sound.blocked()
      toast(this, this.root, 'No verified move from here. Try Undo or Restart.', {
        y: this.layout.portrait ? 202 : 190,
        width: 600,
      })
      return
    }
    const bus = busById(this.level, result.move)
    if (!bus) return
    this.hintsUsed += 1
    this.hintStage = Math.min(3, this.hintStage + 1)
    sound.hint()
    this.highlightBus(result.move)
    this.persistSession()
    this.updateHud()
    const front = this.level.queue[this.state.queueIndex]
    const name = this.busLabel(bus)
    if (this.hintStage === 1) {
      toast(this, this.root, `Try the ${name}.`, { y: this.layout.portrait ? 202 : 190 })
    } else if (this.hintStage === 2) {
      const reason =
        front === bus.color
          ? `The ${name} can reach a bay, and its colour is next in the queue.`
          : `The ${name} can reach a bay and will free the lane a waiting colour needs.`
      toast(this, this.root, reason, { y: this.layout.portrait ? 202 : 190, width: 620 })
    } else {
      toast(this, this.root, 'Here comes the next verified dispatch.', { y: this.layout.portrait ? 202 : 190 })
      this.time.delayedCall(700, () => {
        if (!this.busy && !this.ended && !this.overlayKind) this.handleBusTap(result.move!)
      })
    }
  }

  private highlightBus(busId: string): void {
    const container = this.busVisuals.get(busId)
    if (!container) return
    const ring = this.add.circle(container.x, container.y, this.layout.cell * 0.48, 0xffffff, 0)
    ring.setStrokeStyle(3, 0xffce55, 1)
    this.fxLayer.add(ring)
    this.tweens.add({
      targets: ring,
      scale: 1.55,
      alpha: 0,
      duration: 850,
      repeat: 1,
      onComplete: () => ring.destroy(),
    })
    this.tweens.add({ targets: container, scale: 1.07, duration: 170, yoyo: true, repeat: 2, ease: 'Sine.InOut' })
  }

  private persistSession(): void {
    if (this.ended) return
    const session: SavedSession = {
      version: 1,
      levelId: this.level.id,
      state: this.state,
      moves: this.moves,
      hints: this.hintsUsed,
      mode: this.mode,
      dailyKey: this.dailyKey,
      run: this.run,
      step: this.step,
      at: Date.now(),
    }
    saveSession(session)
  }

  private finishLevel(): void {
    if (this.ended) return
    this.ended = true
    this.busy = false
    clearSession()
    const stars = starsFor(this.moves, this.level.par, this.hintsUsed)
    this.cleared += this.mode === 'endless' ? 1 : 0
    this.newAchievements = []
    if (this.mode === 'endless') {
      app.progress = recordEndless(app.progress, this.cleared)
    } else {
      const completion = recordCompletion(app.progress, {
        levelId: this.level.id,
        levelNumber: globalNumberOf(this.level),
        stars,
        moves: this.moves,
        hints: this.hintsUsed,
        passengers: this.level.queue.length,
        dailyKey: this.mode === 'daily' ? this.dailyKey : undefined,
      })
      app.progress = completion.progress
      this.newAchievements = completion.newAchievements
    }
    sound.win()
    announce(`Level cleared with ${stars} star${stars === 1 ? '' : 's'}.`)
    this.time.delayedCall(app.reducedMotion ? 220 : 480, () => this.showResults(stars))
    this.time.delayedCall(app.reducedMotion ? 240 : 900, () => {
      if (!this.ended) return
      this.confetti({ x: this.layout.width / 2, y: this.layout.height * 0.4 }, 0xffce55)
    })
  }

  private closeOverlay(): void {
    if (this.overlay) {
      this.overlay.destroy(true)
      this.overlay = null
    }
    this.overlayKind = null
  }

  private openOverlay(
    kind: Exclude<OverlayKind, null>,
    width: number,
    height: number,
    build: (cardX: number, cardY: number) => void,
  ): void {
    this.closeOverlay()
    this.overlayKind = kind
    const container = this.add.container(0, 0).setDepth(5000)
    const veil = this.add.rectangle(0, 0, this.layout.width, this.layout.height, 0x080d16, 0.7).setOrigin(0)
    veil.setInteractive()
    container.add(veil)
    const cardX = (this.layout.width - width) / 2
    const cardY = (this.layout.height - height) / 2
    container.add(
      panel(this, cardX, cardY, width, height, {
        fill: 0xfff3d9,
        side: 0xd8c9a8,
        radius: 28,
        raised: 8,
        stroke: 0xffffff,
        strokeAlpha: 0.5,
      }),
    )
    // The builder adds its content through `this.overlay`, so the reference
    // must exist before it runs. Assigning it afterwards produced an empty
    // card for the results, pause and deadlock screens.
    this.root.add(container)
    this.overlay = container
    build(cardX, cardY)
  }

  private togglePause(): void {
    if (this.ended) return
    if (this.overlayKind === 'pause') {
      this.closeOverlay()
      this.paused = false
      return
    }
    if (this.overlayKind) return
    this.paused = true
    sound.click()
    const width = 540
    const height = 430
    this.openOverlay('pause', width, height, (x, y) => {
      const overlay = this.overlay
      if (!overlay) return
      overlay.add(label(this, x + width / 2, y + 34, 'Paused', 30, '#243046', { origin: 0.5, fontStyle: 'bold' }))
      overlay.add(
        label(this, x + width / 2, y + 76, `${this.level.name} \u00b7 ${this.level.index + 1} / 30 in this world`, 13, '#6f7a8d', {
          origin: 0.5,
        }),
      )
      overlay.add(
        button(this, x + 60, y + 110, width - 120, 62, 'Resume', () => {
          this.closeOverlay()
          this.paused = false
        }, { fill: 0xf2c94c, textColor: '#2a2314', size: 19 }),
      )
      overlay.add(
        button(this, x + 60, y + 190, width - 120, 56, 'Restart this stop', () => {
          this.closeOverlay()
          this.paused = false
          this.restartLevel()
        }, { fill: 0x4f8ff0, textColor: '#ffffff', size: 17 }),
      )
      overlay.add(
        button(this, x + 60, y + 262, width - 120, 56, 'Quit to menu', () => {
          this.scene.start('Menu')
        }, { fill: 0x223354, textColor: PAPER, size: 17 }),
      )
      overlay.add(
        label(this, x + width / 2, y + 352, 'Your progress is saved; Continue will bring you back.', 11, '#6f7a8d', {
          origin: 0.5,
        }),
      )
    })
  }

  private showDeadlock(): void {
    if (this.overlayKind) return
    sound.lose()
    announce('Traffic jam. Undo or restart to keep going.')
    const analysis = analyseState(this.level, this.state)
    const width = 580
    const height = 480
    this.openOverlay('deadlock', width, height, (x, y) => {
      const overlay = this.overlay
      if (!overlay) return
      overlay.add(label(this, x + width / 2, y + 34, 'Traffic jam!', 30, '#b93a3a', { origin: 0.5, fontStyle: 'bold' }))
      const message =
        analysis.reason === 'bays-full'
          ? 'Every bay is holding a bus that cannot board the next passenger. Undo a dispatch so a matching colour can reach a bay.'
          : 'Every remaining bus is boxed in and nobody can board. Undo or restart and try a different order.'
      overlay.add(
        label(this, x + 44, y + 82, message, 14, '#4b5567', {
          wrap: width - 88,
          lineSpacing: 5,
        }),
      )
      overlay.add(
        label(this, x + width / 2, y + 164, `${remainingPassengers(this.level, this.state)} passengers still waiting`, 13, '#6f7a8d', {
          origin: 0.5,
        }),
      )
      overlay.add(
        button(this, x + 50, y + 204, width - 100, 58, 'Undo last move', () => {
          this.closeOverlay()
          this.undo()
        }, { fill: 0xf2c94c, textColor: '#2a2314', size: 17 }),
      )
      overlay.add(
        button(this, x + 50, y + 276, width - 100, 54, 'Restart this stop', () => {
          this.closeOverlay()
          this.restartLevel()
        }, { fill: 0x4f8ff0, textColor: '#ffffff', size: 16 }),
      )
      overlay.add(
        button(this, x + 50, y + 344, width - 100, 50, 'Keep looking', () => this.closeOverlay(), {
          fill: 0x223354,
          textColor: PAPER,
          size: 15,
        }),
      )
      overlay.add(
        label(this, x + width / 2, y + 422, 'No ads, no penalties. A hint is available if you want one.', 11, '#6f7a8d', {
          origin: 0.5,
        }),
      )
    })
  }

  private showResults(stars: number): void {
    if (this.overlayKind === 'results') return
    const width = 580
    const height = 600
    const global = globalNumberOf(this.level)
    const record = app.progress.completed[this.level.id]
    this.openOverlay('results', width, height, (x, y) => {
      const overlay = this.overlay
      if (!overlay) return
      const headline = this.mode === 'endless' ? `Run: ${this.cleared} cleared` : 'Stop cleared!'
      overlay.add(label(this, x + width / 2, y + 30, headline, 30, '#243046', { origin: 0.5, fontStyle: 'bold' }))
      overlay.add(
        label(this, x + width / 2, y + 68, this.level.name, 15, '#6f7a8d', { origin: 0.5 }),
      )
      overlay.add(starRow(this, x + width / 2, y + 128, stars, 46, 3, !app.reducedMotion))
      overlay.add(
        label(this, x + width / 2, y + 188, `${this.moves} moves \u00b7 par ${this.level.par}`, 17, '#243046', {
          origin: 0.5,
          fontStyle: 'bold',
        }),
      )
      if (record) {
        overlay.add(
          label(this, x + width / 2, y + 216, `Best: ${record.bestMoves} moves \u00b7 ${record.stars} \u2605`, 12, '#6f7a8d', {
            origin: 0.5,
          }),
        )
      }
      if (this.hintsUsed > 0) {
        overlay.add(label(this, x + width / 2, y + 240, `${this.hintsUsed} hint${this.hintsUsed === 1 ? '' : 's'} used`, 12, '#8a6a2a', { origin: 0.5 }))
      }
      if (this.newAchievements.length) {
        const names = this.newAchievements.map((id) => achievementById(id)?.name ?? id).join(', ')
        overlay.add(
          label(this, x + width / 2, y + 268, `Award unlocked: ${names}`, 12, '#2f7f5c', {
            origin: 0.5,
            wrap: width - 70,
          }),
        )
      }
      if (this.mode === 'endless') {
        overlay.add(
          label(this, x + width / 2, y + 286, 'Endless keeps every cleared stop in the run.', 11, '#6f7a8d', {
            origin: 0.5,
          }),
        )
      }

      const nextLabel =
        this.mode === 'endless' ? 'Next stop' : this.mode === 'journey' ? (global < 300 ? 'Next stop' : 'Journey complete') : 'Play again'
      overlay.add(
        button(this, x + 50, y + 318, width - 100, 60, nextLabel, () => this.nextLevel(), {
          fill: 0xf2c94c,
          textColor: '#2a2314',
          size: 18,
        }),
      )
      overlay.add(
        button(this, x + 50, y + 392, (width - 116) / 2, 54, 'Retry', () => this.retryLevel(), {
          fill: 0x4f8ff0,
          textColor: '#ffffff',
          size: 15,
        }),
      )
      overlay.add(
        button(this, x + 66 + (width - 116) / 2, y + 392, (width - 116) / 2, 54, this.mode === 'journey' || this.mode === 'free' || this.mode === 'zen' ? 'Map' : 'Menu', () => {
          if (this.mode === 'free' || this.mode === 'zen') {
            this.scene.start('Levels', { world: this.level.world, mode: this.mode })
          } else {
            this.scene.start('Menu')
          }
        }, { fill: 0x223354, textColor: PAPER, size: 15 }),
      )
      // Quiet support link: results panel only, under the actions inside the card.
      overlay.add(
        button(this, x + 50, y + 516, width - 100, 44, '☕ Buy me a coffee', () => openTipJar(), {
          fill: 0x223354,
          textColor: PAPER,
          size: 14,
        }),
      )
      overlay.add(
        label(this, x + width / 2, y + 476, this.mode === 'endless' ? 'Quit any time; the best run is saved.' : 'Three stars need par and no hints.', 11, '#6f7a8d', {
          origin: 0.5,
        }),
      )
      if (!app.reducedMotion) this.confetti({ x: x + width / 2, y: y + 140 }, 0xffce55)
    })
  }

  private nextLevel(): void {
    const global = globalNumberOf(this.level)
    if (this.mode === 'endless') {
      this.scene.restart({
        mode: 'endless',
        run: this.run,
        step: this.step + 1,
        cleared: this.cleared,
      })
      return
    }
    if (this.mode === 'journey') {
      if (global >= 300) {
        this.scene.start('Worlds', { mode: 'journey' })
        return
      }
      const next = levelByNumber(global + 1)
      if (next) this.scene.restart({ levelId: next.id, mode: 'journey' })
      return
    }
    if (this.mode === 'expert') {
      this.scene.restart({ mode: 'expert', run: this.run + 1, step: this.step })
      return
    }
    if (this.mode === 'daily') {
      this.scene.start('Menu')
      return
    }
    this.scene.start('Levels', { world: this.level.world, mode: this.mode })
  }

  private retryLevel(): void {
    this.scene.restart({
      levelId: this.level.id,
      mode: this.mode,
      dailyKey: this.dailyKey,
      run: this.run,
      step: this.step,
      cleared: this.cleared - (this.mode === 'endless' ? 1 : 0),
    })
  }
}
