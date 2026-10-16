/**
 * Returns true when Supabase env vars are properly configured (not just placeholder text).
 * Allows the app to render without crashing during initial development
 * before .env.local has real values.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return (
    url.startsWith('http') &&
    !url.includes('your_supabase') &&
    url.includes('supabase')
  )
}
