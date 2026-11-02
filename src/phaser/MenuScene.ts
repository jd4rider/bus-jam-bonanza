import Phaser from 'phaser'
import { app } from '../core/app'
import { loadSession, totalStars } from '../core/saves'
import { utcDateKey } from '../core/rng'
import { TOTAL_LEVELS, type BusDefinition } from '../core/types'
import { levelByNumber } from '../core/levels'
import {
  backdrop,
  button,
  fadeIn,
  fadeTo,
  iconButton,
  label,
  PAPER,
  stage,
  title,
} from './common'
import { createBus, createPassenger } from './draw'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    app.refresh()
    backdrop(this)
    const root = stage(this)
    fadeIn(this)

    const stars = totalStars(app.progress)
    const session = loadSession()

    root.add(title(this, 360, 104, 'BUS JAM', 66, PAPER))
    root.add(title(this, 360, 172, 'BONANZA', 46, '#f2c94c'))
    root.add(
      label(this, 360, 224, 'A cozy little traffic puzzle', 17, '#c3cfe3', {
        origin: 0.5,
      }),
    )

    // Hero: a chunky toy bus waiting with two passengers.
    const heroRoad = this.add.graphics()
    heroRoad.fillStyle(0x000000, 0.2)
    heroRoad.fillRoundedRect(74, 300, 580, 146, 26)
    heroRoad.fillStyle(0x39445a, 1)
    heroRoad.fillRoundedRect(70, 292, 580, 146, 26)
    heroRoad.fillStyle(0x5b6474, 1)
    heroRoad.fillRoundedRect(70, 284, 580, 144, 26)
    heroRoad.fillStyle(0xffffff, 0.18)
    heroRoad.fillRoundedRect(84, 476, 552, 6, 3)
    for (let index = 0; index < 8; index += 1) {
      heroRoad.fillStyle(0xfff3d9, 0.6)
      heroRoad.fillRoundedRect(96 + index * 68, 400, 26, 4, 2)
    }
    root.add(heroRoad)

    const heroBus: BusDefinition = {
      id: 'hero',
      color: 'yellow',
      capacity: 6,
      position: { x: 0, y: 0 },
      direction: 'east',
      length: 2,
    }
    const bus = createBus(this, heroBus, 84)
    bus.setPosition(392, 350)
    root.add(bus)
    this.tweens.add({
      targets: bus,
      y: 344,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })

    const riders: Array<[string, number, number]> = [
      ['red', 160, 372],
      ['blue', 218, 388],
      ['green', 276, 366],
    ]
    for (const [color, x, y] of riders) {
      const passenger = createPassenger(this, color as BusDefinition['color'], 42, x)
      passenger.container.setPosition(x, y)
      root.add(passenger.container)
      this.tweens.add({
        targets: passenger.container,
        y: y - 3,
        duration: 700 + (x % 300),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    }

    root.add(
      label(this, 360, 508, `${stars} / ${TOTAL_LEVELS * 3} stars   \u00b7   ${app.progress.stats.passengers} passengers carried`, 14, '#9fb0ca', {
        origin: 0.5,
      }),
    )

    const continueLevel = session ? levelByNumber(Number(session.levelId.replace('level-', ''))) : levelByNumber(app.progress.unlocked)
    const continueLabel = session ? 'Continue' : app.progress.unlocked > 1 ? 'Continue Journey' : 'Start Journey'
    const continueSub = continueLevel ? `${continueLevel.name} \u00b7 level ${continueLevel.index + 1 + (continueLevel.world - 1) * 30}` : 'Sunny Bus Depot'
    root.add(
      button(this, 100, 544, 520, 80, continueLabel, () => {
        if (!continueLevel) return
        fadeTo(this, 'Game', {
          levelId: continueLevel.id,
          mode: session?.mode ?? 'journey',
          resume: Boolean(session),
          dailyKey: session?.dailyKey,
          run: session?.run,
          step: session?.step,
        })
      }, { fill: 0xf2c94c, textColor: '#2a2314', size: 24, subtitle: continueSub }),
    )

    const modes: Array<{ name: string; sub: string; fill: number; text: string; onClick: () => void }> = [
      {
        name: 'Journey',
        sub: '300 verified stops',
        fill: 0x4f8ff0,
        text: '#ffffff',
        onClick: () => fadeTo(this, 'Worlds', { mode: 'journey' }),
      },
      {
        name: 'Daily',
        sub: utcDateKey(),
        fill: 0x4fb98a,
        text: '#ffffff',
        onClick: () => fadeTo(this, 'Game', { mode: 'daily' }),
      },
      {
        name: 'Zen',
        sub: 'Relaxed, any stop',
        fill: 0x9ad8f2,
        text: '#173246',
        onClick: () => fadeTo(this, 'Worlds', { mode: 'zen' }),
      },
      {
        name: 'Expert',
        sub: 'Hardest verified par',
        fill: 0xa07af0,
        text: '#ffffff',
        onClick: () => fadeTo(this, 'Game', { mode: 'expert' }),
      },
      {
        name: 'Endless',
        sub: 'One unbroken run',
        fill: 0xf2914b,
        text: '#3a2411',
        onClick: () => fadeTo(this, 'Game', { mode: 'endless', run: Math.floor(Math.random() * 100000), step: 0 }),
      },
      {
        name: 'Free Play',
        sub: 'Replay unlocked stops',
        fill: 0xef7fb8,
        text: '#3a1226',
        onClick: () => fadeTo(this, 'Worlds', { mode: 'free' }),
      },
    ]

    modes.forEach((mode, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      root.add(
        button(this, 100 + column * 280, 640 + row * 92, 260, 80, mode.name, mode.onClick, {
          fill: mode.fill,
          textColor: mode.text,
          size: 20,
          subtitle: mode.sub,
        }),
      )
    })

    root.add(iconButton(this, 302, 940, '\u2605', () => fadeTo(this, 'Achievements'), { label: 'Awards', fill: 0x2b3f66 }))
    root.add(iconButton(this, 418, 940, '\u2630', () => fadeTo(this, 'Settings'), { label: 'Options', fill: 0x2b3f66 }))

    root.add(
      label(this, 360, 1022, 'One-way lanes \u00b7 traffic gates \u00b7 colourblind-friendly symbols', 12, '#8fa3c2', { origin: 0.5 }),
    )

    root.add(
      button(this, 210, 1080, 300, 54, 'Little Joy Arcade', () => {
        window.open('https://littlejoyarcade.site', '_blank', 'noopener,noreferrer')
      }, { fill: 0x1c2942, textColor: PAPER, size: 16, icon: '\u2197', radius: 18 }),
    )

    root.add(label(this, 360, 1170, `Bus Jam Bonanza \u00b7 v1.0 \u00b7 ${app.progress.settings.sound ? 'sound on' : 'sound off'}`, 11, '#6f819e', { origin: 0.5 }))
  }
}
