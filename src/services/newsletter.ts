/**
 * Newsletter subscribers data access layer.
 *
 * Uses `newsletter_subscribers` (email, is_active, subscribed_at).
 */
import { supabase } from '@/lib/supabase'
import type { NewsletterSubscriberInsert } from '@/lib/types'

export async function subscribeNewsletter(email: string) {
  const normalized = email.trim().toLowerCase()

  // Idempotent: reactivate if previously unsubscribed.
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('id, is_active')
    .eq('email', normalized)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ is_active: true, unsubscribed_at: null })
      .eq('id', existing.id)
    if (error) throw error
    return { created: false }
  }

  const { error } = await supabase.from('newsletter_subscribers').insert({
    email: normalized,
    is_active: true,
  } as NewsletterSubscriberInsert)
  if (error) throw error
  return { created: true }
}

export async function isSubscribed(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('is_active')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (error || !data) return false
  return Boolean(data.is_active)
}
