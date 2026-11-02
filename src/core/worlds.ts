import { LEVELS_PER_WORLD, WORLD_COUNT } from './types'

export type PropKind = 'depot' | 'city' | 'park' | 'beach' | 'mountain' | 'candy' | 'neon' | 'airport' | 'festival' | 'hub'

export interface WorldTheme {
  id: number
  name: string
  blurb: string
  teaches: string
  /** Sky gradient, top then bottom. */
  sky: [number, number]
  ground: number
  road: number
  sidewalk: number
  accent: number
  prop: PropKind
  dark: boolean
}

export const WORLDS: WorldTheme[] = [
  {
    id: 1,
    name: 'Sunny Bus Depot',
    blurb: 'Learn the ropes in a cheerful little depot.',
    teaches: 'Tap a bus \u00b7 match colours \u00b7 fill bays',
    sky: [0x9ad8f2, 0xdff4ff],
    ground: 0x86c98a,
    road: 0x5b6474,
    sidewalk: 0xeadfc6,
    accent: 0xf2c94c,
    prop: 'depot',
    dark: false,
  },
  {
    id: 2,
    name: 'Downtown Dash',
    blurb: 'Narrow lanes and longer buses downtown.',
    teaches: 'Longer buses \u00b7 tighter blocks',
    sky: [0x8fb8e8, 0xd7e7f7],
    ground: 0x9aa5b5,
    road: 0x4f5766,
    sidewalk: 0xc9c2b4,
    accent: 0xf2914b,
    prop: 'city',
    dark: false,
  },
  {
    id: 3,
    name: 'Parkside Pickup',
    blurb: 'Pickups wind between the flower beds.',
    teaches: 'Cross traffic \u00b7 four bays',
    sky: [0xa8d8a0, 0xe9f6da],
    ground: 0x7fc47c,
    road: 0x5a6462,
    sidewalk: 0xd9d2ad,
    accent: 0x4fb98a,
    prop: 'park',
    dark: false,
  },
  {
    id: 4,
    name: 'Beach Bus Bash',
    blurb: 'Salt air, sand and one-way seaside lanes.',
    teaches: 'One-way lanes \u00b7 capacity planning',
    sky: [0x8fd8ec, 0xfbeecb],
    ground: 0xe8d5a3,
    road: 0x5a6472,
    sidewalk: 0xf4e4bd,
    accent: 0x4cc7d6,
    prop: 'beach',
    dark: false,
  },
  {
    id: 5,
    name: 'Mountain Transit',
    blurb: 'Big buses, tight turns and thin air.',
    teaches: 'Large buses \u00b7 spare buses',
    sky: [0x92b6d6, 0xd7e3ea],
    ground: 0x8aa48d,
    road: 0x505a68,
    sidewalk: 0xccc7b6,
    accent: 0xa07af0,
    prop: 'mountain',
    dark: false,
  },
  {
    id: 6,
    name: 'Candy Commute',
    blurb: 'A sweet little town with sticky jams.',
    teaches: 'Mixed queues \u00b7 five bays',
    sky: [0xffb8d7, 0xffe9f3],
    ground: 0xf4b6d0,
    road: 0x7d5d80,
    sidewalk: 0xffd6e6,
    accent: 0xef7fb8,
    prop: 'candy',
    dark: false,
  },
  {
    id: 7,
    name: 'Neon Night Routes',
    blurb: 'After-dark routes with traffic gates.',
    teaches: 'Traffic gates \u00b7 route choices',
    sky: [0x1b1e3a, 0x3b2a5e],
    ground: 0x2a2c50,
    road: 0x303552,
    sidewalk: 0x4a4470,
    accent: 0x4cc7d6,
    prop: 'neon',
    dark: true,
  },
  {
    id: 8,
    name: 'Airport Express',
    blurb: 'Shuttle the crowds between the terminals.',
    teaches: 'Priority loading \u00b7 long queues',
    sky: [0xbcd6e8, 0xeaf4fb],
    ground: 0xb9c4ce,
    road: 0x555f6d,
    sidewalk: 0xd9dde3,
    accent: 0x4f8ff0,
    prop: 'airport',
    dark: false,
  },
  {
    id: 9,
    name: 'Festival Frenzy',
    blurb: 'Everyone wants the last bus home.',
    teaches: 'Crowded queues \u00b7 three bays',
    sky: [0xf7b267, 0xffe6bf],
    ground: 0xa8c47c,
    road: 0x5c5a58,
    sidewalk: 0xe8d9b0,
    accent: 0xef5f5b,
    prop: 'festival',
    dark: false,
  },
  {
    id: 10,
    name: 'Grand Transit Challenge',
    blurb: 'The depot to end all depots.',
    teaches: 'Everything at once',
    sky: [0x223255, 0x4a6b96],
    ground: 0x3b5470,
    road: 0x364152,
    sidewalk: 0x8f9aab,
    accent: 0xf2c94c,
    prop: 'hub',
    dark: true,
  },
]

interface NameParts {
  first: string[]
  second: string[]
}

const NAME_PARTS: NameParts[] = [
  { first: ['Sunny', 'Morning', 'Lemon', 'Daisy', 'Honey', 'Picnic', 'Breezy', 'Golden', 'First', 'Warm'], second: ['Stop', 'Lane', 'Loop'] },
  { first: ['Metro', 'Brick', 'Corner', 'Market', 'Clock', 'Lantern', 'Busy', 'Taxi', 'Neon', 'Avenue'], second: ['Rush', 'Block', 'Crossing'] },
  { first: ['Willow', 'Clover', 'Fountain', 'Pebble', 'Meadow', 'Sparrow', 'Maple', 'Petal', 'Garden', 'Shady'], second: ['Green', 'Path', 'Grove'] },
  { first: ['Sunset', 'Palm', 'Seashell', 'Surf', 'Coral', 'Lagoon', 'Breeze', 'Sandcastle', 'Tide', 'Harbor'], second: ['Wave', 'Pier', 'Shore'] },
  { first: ['Alpine', 'Pine', 'Summit', 'Echo', 'Glacier', 'Cabin', 'Ridge', 'Frost', 'Valley', 'Cable'], second: ['Climb', 'Pass', 'View'] },
  { first: ['Sherbet', 'Marshmallow', 'Licorice', 'Caramel', 'Gumdrop', 'Peppermint', 'Waffle', 'Sugar', 'Fizz', 'Taffy'], second: ['Sweet', 'Treat', 'Way'] },
  { first: ['Glow', 'Midnight', 'Pixel', 'Electric', 'Moonlit', 'Chrome', 'Violet', 'Signal', 'Disco', 'After'], second: ['Lane', 'Circuit', 'Night'] },
  { first: ['Runway', 'Terminal', 'Jet', 'Cabin', 'Gate', 'Departure', 'Skyline', 'Trolley', 'Passport', 'Baggage'], second: ['Express', 'Shuttle', 'Route'] },
  { first: ['Balloon', 'Carnival', 'Parade', 'Ribbon', 'Confetti', 'Lantern', 'Bunting', 'Meadow', 'Starlight', 'Jubilee'], second: ['Party', 'Square', 'Fete'] },
  { first: ['Grand', 'Central', 'Iron', 'Crown', 'Legacy', 'Titan', 'Meridian', 'Atlas', 'Horizon', 'Summit'], second: ['Hub', 'Junction', 'Terminus'] },
]

export function levelName(world: number, index: number): string {
  const parts = NAME_PARTS[world - 1] ?? NAME_PARTS[0]
  const first = parts.first[index % 10]
  const second = parts.second[Math.floor(index / 10) % 3]
  return `${first} ${second}`
}

export function worldOf(globalLevel: number): WorldTheme {
  const world = Math.floor((globalLevel - 1) / LEVELS_PER_WORLD) + 1
  return WORLDS[Math.min(WORLD_COUNT, Math.max(1, world)) - 1]
}

export function worldNumber(globalLevel: number): number {
  return Math.floor((globalLevel - 1) / LEVELS_PER_WORLD) + 1
}

export function levelInWorld(globalLevel: number): number {
  return ((globalLevel - 1) % LEVELS_PER_WORLD) + 1
}

export function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`
}

export function shade(hex: number, amount: number): number {
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  const mix = (channel: number): number =>
    Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount)
  return (mix(r) << 16) | (mix(g) << 8) | mix(b)
}
