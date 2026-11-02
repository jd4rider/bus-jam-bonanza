import type { Progress } from './saves'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  check: (progress: Progress) => boolean
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_departure',
    name: 'First Departure',
    description: 'Complete your first level.',
    icon: 'bus',
    check: (progress) => progress.stats.levels >= 1,
  },
  {
    id: 'perfect_pickup',
    name: 'Perfect Pickup',
    description: 'Earn three stars on a level.',
    icon: 'star',
    check: (progress) => Object.values(progress.completed).some((record) => record.stars >= 3),
  },
  {
    id: 'ten_levels',
    name: 'Ten Levels Cleared',
    description: 'Finish ten Journey levels.',
    icon: 'flag',
    check: (progress) => Object.keys(progress.completed).length >= 10,
  },
  {
    id: 'hundred_passengers',
    name: 'Hundred Passengers',
    description: 'Carry 100 passengers in total.',
    icon: 'people',
    check: (progress) => progress.stats.passengers >= 100,
  },
  {
    id: 'bus_jam_solver',
    name: 'Bus Jam Solver',
    description: 'Earn three stars on ten different levels.',
    icon: 'brain',
    check: (progress) => Object.values(progress.completed).filter((record) => record.stars >= 3).length >= 10,
  },
  {
    id: 'color_commander',
    name: 'Colour Commander',
    description: 'Complete 50 levels.',
    icon: 'palette',
    check: (progress) => Object.keys(progress.completed).length >= 50,
  },
  {
    id: 'transit_master',
    name: 'Transit Master',
    description: 'Complete 150 levels.',
    icon: 'medal',
    check: (progress) => Object.keys(progress.completed).length >= 150,
  },
  {
    id: 'daily_driver',
    name: 'Daily Driver',
    description: 'Finish a Daily Challenge.',
    icon: 'calendar',
    check: (progress) => progress.stats.dailyPlayed >= 1,
  },
  {
    id: 'no_hint_hero',
    name: 'No Hint Hero',
    description: 'Finish 20 levels without using a hint.',
    icon: 'hero',
    check: (progress) => progress.stats.perfect >= 20,
  },
  {
    id: 'grand_depot_champion',
    name: 'Grand Depot Champion',
    description: 'Complete all 300 Journey levels.',
    icon: 'crown',
    check: (progress) => Object.keys(progress.completed).length >= 300,
  },
]

export function achievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id)
}

/** Unlocks any newly earned achievements and returns their ids. */
export function evaluateAchievements(progress: Progress): string[] {
  const unlocked: string[] = []
  for (const achievement of ACHIEVEMENTS) {
    if (progress.achievements.includes(achievement.id)) continue
    if (!achievement.check(progress)) continue
    progress.achievements.push(achievement.id)
    unlocked.push(achievement.id)
  }
  return unlocked
}
