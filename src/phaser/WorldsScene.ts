import Phaser from 'phaser'
import { app } from '../core/app'
import { levelByNumber } from '../core/levels'
import { LEVELS_PER_WORLD } from '../core/types'
import { WORLDS, worldOf } from '../core/worlds'
import {
  backdrop,
  button,
  css,
  fadeIn,
  fadeTo,
  iconButton,
  label,
  panel,
  PAPER,
  stage,
  title,
} from './common'
import { drawProp } from './draw'

export interface WorldsData {
  mode: 'journey' | 'zen' | 'free'
}

export class WorldsScene extends Phaser.Scene {
  private data_: WorldsData = { mode: 'journey' }

  constructor() {
    super('Worlds')
  }

  init(data: WorldsData): void {
    this.data_ = { mode: data.mode ?? 'journey' }
  }

  create(): void {
    app.refresh()
    backdrop(this)
    const root = stage(this)
    fadeIn(this)

    const modeName = this.data_.mode === 'zen' ? 'Zen' : this.data_.mode === 'free' ? 'Free Play' : 'Journey'
    root.add(title(this, 360, 74, modeName, 40, PAPER))
    root.add(label(this, 360, 122, 'Choose a world', 16, '#9fb0ca', { origin: 0.5 }))

    root.add(iconButton(this, 54, 68, '\u2190', () => fadeTo(this, 'Menu'), { size: 54, fill: 0x223354 }))

    const unlocked = app.progress.unlocked
    WORLDS.forEach((world) => {
      const column = (world.id - 1) % 2
      const row = Math.floor((world.id - 1) / 2)
      const x = 24 + column * 340
      const y = 170 + row * 180
      const firstLevel = (world.id - 1) * LEVELS_PER_WORLD + 1
      const isOpen = unlocked >= firstLevel
      const levels = app.progress.completed
      let stars = 0
      for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
        const level = levelByNumber(firstLevel + index)
        if (!level) continue
        stars += levels[level.id]?.stars ?? 0
      }

      const card = panel(this, x, y, 332, 166, {
        fill: world.dark ? 0x24334f : 0xfff3d9,
        side: world.dark ? 0x111a2b : 0xd8c9a8,
        radius: 22,
        stroke: isOpen ? world.accent : 0x000000,
        strokeAlpha: isOpen ? 0.55 : 0.2,
      })
      card.setAlpha(isOpen ? 1 : 0.55)
      root.add(card)

      const swatch = this.add.graphics()
      swatch.fillStyle(world.accent, 1)
      swatch.fillRoundedRect(14, 14, 10, 138, 5)
      card.add(swatch)

      card.add(label(this, 38, 18, `WORLD ${world.id}`, 10, world.dark ? '#9fb0ca' : '#8a7a5c', { fontStyle: 'bold' }))
      card.add(label(this, 38, 36, world.name, 19, world.dark ? PAPER : '#243046', { wrap: 210 }))
      card.add(label(this, 38, 92, isOpen ? `${stars} / ${LEVELS_PER_WORLD * 3} \u2605` : 'Locked', 14, isOpen ? css(world.accent) : '#8a93a6', { fontStyle: 'bold' }))
      card.add(label(this, 38, 118, world.teaches, 10, world.dark ? '#8fa3c2' : '#6f7a8d', { wrap: 210 }))

      const prop = this.add.graphics()
      drawProp(prop, world.prop, 280, 118, 32, world.accent)
      card.add(prop)

      if (isOpen) {
        card.setSize(332, 166)
        card.setInteractive(new Phaser.Geom.Rectangle(166, 83, 332, 166), Phaser.Geom.Rectangle.Contains)
        if (card.input) card.input.cursor = 'pointer'
        card.on('pointerup', () => {
          fadeTo(this, 'Levels', { world: world.id, mode: this.data_.mode })
        })
        card.on('pointerdown', () => this.tweens.add({ targets: card, scale: 0.98, duration: 70 }))
        card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 90 }))
      }
    })

    const currentWorld = worldOf(unlocked)
    root.add(
      label(this, 360, 1104, `You are in ${currentWorld.name} \u00b7 level ${unlocked}`, 13, '#8fa3c2', { origin: 0.5 }),
    )
    root.add(
      button(this, 250, 1150, 220, 56, 'Back to menu', () => fadeTo(this, 'Menu'), {
        fill: 0x223354,
        textColor: PAPER,
        size: 16,
        radius: 18,
      }),
    )
  }
}
