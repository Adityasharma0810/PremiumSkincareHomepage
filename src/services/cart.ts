/**
 * Shopping cart data access layer.
 *
 * Uses the `carts` and `cart_items` tables. A cart is owned by a user
 * (user_id) or, for guests, by a client-generated cart id stored in
 * localStorage. cart_items reference product_variants.
 */
import { supabase } from '@/lib/supabase'
import type { Cart, CartItem, CartItemInsert } from '@/lib/types'
import { resolveProductImageUrl } from '@/lib/product-images'

export interface GuestCartLine {
  variantId: string
  quantity: number
}

/* ------------------------------------------------------------------ */
/* Cart resolution                                                    */
/* ------------------------------------------------------------------ */

/** Get (or create) the cart for the current user/guest. */
export async function resolveCart(userId: string | null): Promise<string> {
  if (userId) {
    const { data: existing, error: lookupError } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (existing?.id) return existing.id

    const { data: created, error } = await supabase
      .from('carts')
      .insert({ user_id: userId, status: 'active' })
      .select('id')
      .single()
    if (error) throw error
    return created.id
  }

  throw new Error('A signed-in user is required to create a server cart.')
}

/* ------------------------------------------------------------------ */
/* Cart items                                                         */
/* ------------------------------------------------------------------ */
export async function getCartItems(cartId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from('cart_items')
    .select('*, variant:product_variants(*)')
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as CartItem[]
}

export async function addToCart({
  cartId,
  variantId,
  quantity = 1,
}: {
  cartId: string
  variantId: string
  quantity?: number
}): Promise<void> {
  // Upsert behaviour: increase quantity if the variant already exists.
  const { data: existing, error: lookupError } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('variant_id', variantId)
    .maybeSingle()

  if (lookupError) throw lookupError

  if (existing?.id) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: (existing.quantity || 0) + quantity })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('cart_items').insert({
    cart_id: cartId,
    variant_id: variantId,
    quantity,
  } as CartItemInsert)
  if (error) throw error
}

export async function updateCartItemQuantity({
  itemId,
  quantity,
}: {
  itemId: string
  quantity: number
}): Promise<void> {
  if (quantity <= 0) {
    await removeCartItem(itemId)
    return
  }
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', itemId)
  if (error) throw error
}

export async function removeCartItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId)
  if (error) throw error
}

export async function clearCart(cartId: string): Promise<void> {
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId)
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Totals                                                             */
/* ------------------------------------------------------------------ */
export interface CartSummary {
  itemCount: number
  subtotal: number
  items: Array<{
    id: string
    variantId: string
    quantity: number
    productName: string
    variantName: string | null
    sku: string | null
    sizeLabel: string | null
    unitPrice: number
    lineTotal: number
    imageUrl: string | null
  }>
}

export async function getCartSummary(cartId: string): Promise<CartSummary> {
  const { data: items, error } = await supabase
    .from('cart_items')
    .select(`
      *,
      variant:product_variants (
        *,
        product:products (
          name,
          slug,
          product_images (image_url, is_primary)
        )
      )
    `)
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = (items ?? []) as Array<{
    id: string
    variant_id: string
    quantity: number
    variant: {
      sku: string | null
      size_label: string | null
      price: number
      product: {
        name: string
        slug: string
        product_images: Array<{ image_url: string; is_primary: boolean }> | null
      } | null
    }
  }>

  let subtotal = 0
  let itemCount = 0
  const mapped = rows.map((row) => {
    const unitPrice = row.variant?.price ?? 0
    const lineTotal = unitPrice * row.quantity
    subtotal += lineTotal
    itemCount += row.quantity
    return {
      id: row.id,
      variantId: row.variant_id,
      quantity: row.quantity,
      productName: row.variant?.product?.name ?? 'Product',
      variantName: row.variant?.size_label ?? null,
      sku: row.variant?.sku ?? null,
      sizeLabel: row.variant?.size_label ?? null,
      unitPrice,
      lineTotal,
      imageUrl: resolveProductImageUrl(
        row.variant?.product?.product_images?.find((image) => image.is_primary)?.image_url
          ?? row.variant?.product?.product_images?.[0]?.image_url,
      ),
    }
  })

  return { itemCount, subtotal, items: mapped }
}

export async function getGuestCartSummary(
  guestItems: GuestCartLine[],
): Promise<CartSummary> {
  if (!guestItems.length) return { itemCount: 0, subtotal: 0, items: [] }

  const quantities = new Map(
    guestItems.map((item) => [item.variantId, item.quantity]),
  )
  const { data, error } = await supabase
    .from('product_variants')
    .select(`
      id,
      sku,
      size_label,
      price,
      is_active,
      product:products (
        name,
        slug,
        product_images (image_url, is_primary)
      )
    `)
    .in('id', [...quantities.keys()])
    .eq('is_active', true)

  if (error) throw error

  const variants = (data ?? []) as Array<{
    id: string
    sku: string | null
    size_label: string | null
    price: number
    product: {
      name: string
      slug: string
      product_images: Array<{ image_url: string; is_primary: boolean }> | null
    } | null
  }>
  const items = variants.flatMap((variant) => {
    const quantity = quantities.get(variant.id)
    if (!quantity || !variant.product) return []

    const lineTotal = Number(variant.price) * quantity
    const images = variant.product.product_images ?? []
    return [{
      id: `guest-${variant.id}`,
      variantId: variant.id,
      quantity,
      productName: variant.product.name,
      variantName: variant.size_label,
      sku: variant.sku,
      sizeLabel: variant.size_label,
      unitPrice: Number(variant.price),
      lineTotal,
      imageUrl: resolveProductImageUrl(
        images.find((image) => image.is_primary)?.image_url ?? images[0]?.image_url,
      ),
    }]
  })

  return {
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
    items,
  }
}
