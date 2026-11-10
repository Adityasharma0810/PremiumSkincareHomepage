/**
 * Reviews data access layer.
 *
 * Uses `reviews` (product_id, user_id, order_item_id, rating, body, status).
 */
import { supabase } from '@/lib/supabase'
import type { Review, ReviewInsert } from '@/lib/types'

export async function getReviewsForProduct(
  productId: string,
): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Review[]
}

export async function createReview(review: ReviewInsert) {
  const { data, error } = await supabase
    .from('reviews')
    .insert(review)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getUserReviewForOrderItem({
  productId,
  userId,
  orderItemId,
}: {
  productId: string
  userId: string
  orderItemId: string
}) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('user_id', userId)
    .eq('order_item_id', orderItemId)
    .maybeSingle()
  if (error) return null
  return data
}

export async function getAverageRating(productId: string): Promise<{
  average: number
  count: number
}> {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('status', 'approved')

  if (error) return { average: 0, count: 0 }
  const rows = (data ?? []) as Array<{ rating: number }>
  if (rows.length === 0) return { average: 0, count: 0 }
  const average =
    rows.reduce((sum, r) => sum + r.rating, 0) / rows.length
  return { average: Math.round(average * 10) / 10, count: rows.length }
}
