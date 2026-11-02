// Little Joy Arcade adapter. The platform ships a plain drop-in client
// (public/arcade-client.js) that mirrors localStorage into the player's arcade
// account. Everything here degrades to local-only when that client is absent.

interface ArcadeUser {
  id?: string
  email?: string | null
  displayName?: string | null
}

interface ArcadeStatus {
  text: string
  signedIn: boolean
}

interface ArcadeClient {
  gameId: string
  configured: boolean
  signIn?: (email: string, password: string) => Promise<{ error: string | null }>
  signUp?: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>
  signOut?: () => Promise<void>
  syncNow?: (reason?: string) => Promise<void>
  user?: () => ArcadeUser | null
  status?: () => ArcadeStatus
}

declare global {
  interface Window {
    LittleJoyArcade?: ArcadeClient
  }
}

export const ARCADE_URL = 'https://littlejoyarcade.site'

function client(): ArcadeClient | undefined {
  return typeof window === 'undefined' ? undefined : window.LittleJoyArcade
}

export const arcade = {
  available(): boolean {
    return Boolean(client()?.configured)
  },
  gameId(): string {
    return client()?.gameId ?? 'bus-jam-bonanza'
  },
  userLabel(): string {
    const user = client()?.user?.()
    return user?.email ?? user?.displayName ?? 'Guest player'
  },
  status(): string {
    return client()?.status?.()?.text ?? 'Playing locally'
  },
  signedIn(): boolean {
    return Boolean(client()?.status?.()?.signedIn)
  },
  async sync(): Promise<void> {
    await client()?.syncNow?.('bus-jam-bonanza')
  },
  openArcade(): void {
    if (typeof window !== 'undefined') window.open(ARCADE_URL, '_blank', 'noopener,noreferrer')
  },
  /**
   * Reads the platform's local entitlement cache. The browser can only read
   * entitlements; grants happen server-side. No ads are shown in this build,
   * so this is a readiness hook rather than a gate.
   */
  adsAllowed(): boolean {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('lja:entitlements')
      if (!raw) return true
      const entitlements = JSON.parse(raw) as unknown
      if (!Array.isArray(entitlements)) return true
      if (entitlements.includes('arcade.ad_free')) return false
      if (entitlements.includes('bus-jam-bonanza.ad_free')) return false
      return true
    } catch {
      return true
    }
  },
  premiumThemes(): boolean {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('lja:entitlements')
      if (!raw) return false
      const entitlements = JSON.parse(raw) as unknown
      if (!Array.isArray(entitlements)) return false
      return entitlements.includes('bus-jam-bonanza.premium_themes') || entitlements.includes('arcade.premium')
    } catch {
      return false
    }
  },
}
