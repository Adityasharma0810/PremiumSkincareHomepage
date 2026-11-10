/**
 * Wishlist data access layer.
 *
 * Uses `wishlists` (owned by a user) and `wishlist_items` which reference
 * `product_variants`.
 */
import { supabase } from '@/lib/supabase'
import type { WishlistItemInsert } from '@/lib/types'

const DEFAULT_WISHLIST_NAME = 'My favourites'

/* ------------------------------------------------------------------ */
/* Resolve / create the user's default wishlist                       */
/* ------------------------------------------------------------------ */
export async function resolveWishlistId(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('wishlists')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created, error } = await supabase
    .from('wishlists')
    .insert({ user_id: userId, name: DEFAULT_WISHLIST_NAME })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

/* ------------------------------------------------------------------ */
/* Items                                                              */
/* ------------------------------------------------------------------ */
export async function getWishlistItems(userId: string): Promise<string[]> {
  const wishlistId = await resolveWishlistId(userId)

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('variant_id')
    .eq('wishlist_id', wishlistId)

  if (error) return []
  return ((data ?? []) as any[]).map((row: any) => row.variant_id)
}

export async function isInWishlist(
  userId: string,
  variantId: string,
): Promise<boolean> {
  const wishlistId = await resolveWishlistId(userId)

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('wishlist_id', wishlistId)
    .eq('variant_id', variantId)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export async function addToWishlist(userId: string, variantId: string): Promise<void> {
  const wishlistId = await resolveWishlistId(userId)

  const { error } = await supabase.from('wishlist_items').insert({
    wishlist_id: wishlistId,
    variant_id: variantId,
  } as WishlistItemInsert)
  if (error) throw error
}

export async function removeFromWishlist(
  userId: string,
  variantId: string,
): Promise<void> {
  const wishlistId = await resolveWishlistId(userId)

  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('wishlist_id', wishlistId)
    .eq('variant_id', variantId)
  if (error) throw error
}
