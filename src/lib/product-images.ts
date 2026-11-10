import { supabase } from '@/lib/supabase'

export function resolveProductImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl

  const objectPath = imageUrl
    .replace(/^\/+/, '')
    .replace(/^products\//, '')

  if (!objectPath) return null
  return supabase.storage.from('products').getPublicUrl(objectPath).data.publicUrl
}
