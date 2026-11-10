/**
 * Adapts Supabase product data into the UI product shape used by the
 * storefront components (storefront.tsx / StorePages.tsx), so the existing
 * visual design keeps working while data comes from Supabase.
 *
 * Mapping (DATABASE_SCHEMA.md → UI):
 *   id              → id
 *   name            → name
 *   benefit_label   → type (eyebrow)
 *   default variant price  → price
 *   default variant compare_at_price → old
 *   kind            → kind (drives bottle variant & colour)
 *   badge_text      → badge
 *   product_images[0] (primary) → imageUrl
 *   slug            → slug
 */
import type { ProductWithDetails } from '@/lib/types'
import { resolveProductImageUrl } from '@/lib/product-images'

export interface UIProduct {
  id: string
  variantId: string | null
  name: string
  type: string
  price: number
  old: number | null
  color: string
  kind: string
  badge: string | null
  imageUrl: string
  slug: string
  shortDescription: string | null
}

const COLOUR_BY_KIND: Record<string, string> = {
  serum: 'amber',
  jar: 'sage',
  pump: 'cream',
  tube: 'peach',
}

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1620915567248-b92229304e4e?auto=format&fit=crop&w=600&q=80'

export function adaptProduct(
  product: ProductWithDetails | any,
): UIProduct {
  const variants = product.variants ?? product.product_variants ?? []
  const activeVariants = variants.filter((variant: any) => variant.is_active !== false)
  const defaultVariant =
    activeVariants.find((variant: any) => variant.is_default) ||
    activeVariants[0] ||
    null
  const images = product.images ?? product.product_images ?? []
  const primaryImage = resolveProductImageUrl(
    images.find((img: any) => img.is_primary)?.image_url
      ?? images[0]?.image_url
      ?? DEFAULT_IMAGE,
  ) ?? DEFAULT_IMAGE

  const price = defaultVariant?.price ?? 0
  const old = defaultVariant?.compare_at_price ?? null

  return {
    id: product.id,
    variantId: defaultVariant?.id ?? null,
    name: product.name,
    type: product.benefit_label || 'Skincare essentials',
    price,
    old,
    color: COLOUR_BY_KIND[product.kind || ''] || 'amber',
    kind: product.kind || 'serum',
    badge: product.badge_text || null,
    imageUrl: primaryImage,
    slug: product.slug,
    shortDescription: product.short_description ?? null,
  }
}

export function adaptProducts(
  products: ProductWithDetails[] | any[],
): UIProduct[] {
  return products.map(adaptProduct)
}

/**
 * Adapts a raw Supabase product row (as returned by getProducts, which
 * eagerly loads product_images and product_variants) into a UIProduct.
 */
export function adaptCatalogProduct(row: any): UIProduct {
  const images = Array.isArray(row.product_images) ? row.product_images : []
  const variants = Array.isArray(row.product_variants) ? row.product_variants : []
  const activeVariants = variants.filter((v: any) => v.is_active !== false)
  const defaultVariant = activeVariants.find((v: any) => v.is_default) || activeVariants[0] || null
  const primaryImage = resolveProductImageUrl(
    images.find((img: any) => img.is_primary)?.image_url
      ?? images[0]?.image_url
      ?? DEFAULT_IMAGE,
  ) ?? DEFAULT_IMAGE

  const price = defaultVariant?.price ?? 0
  const old = defaultVariant?.compare_at_price ?? null

  return {
    id: row.id,
    variantId: defaultVariant?.id ?? null,
    name: row.name,
    type: row.benefit_label || 'Skincare essentials',
    price,
    old,
    color: COLOUR_BY_KIND[row.kind || ''] || 'amber',
    kind: row.kind || 'serum',
    badge: row.badge_text || null,
    imageUrl: primaryImage,
    slug: row.slug,
    shortDescription: row.short_description ?? null,
  }
}
