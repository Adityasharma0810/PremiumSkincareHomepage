/**
 * Product data access layer.
 *
 * Reads products, categories, skin concerns, images, variants and the
 * product↔concern join table from Supabase according to DATABASE_SCHEMA.md.
 */
import { supabase } from '@/lib/supabase'
import type {
  Category,
  Product,
  ProductImage,
  ProductVariant,
  ProductWithDetails,
  SkinConcern,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Categories                                                         */
/* ------------------------------------------------------------------ */
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as Category[]
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data as Category
}

/* ------------------------------------------------------------------ */
/* Skin concerns                                                      */
/* ------------------------------------------------------------------ */
export async function getSkinConcerns(): Promise<SkinConcern[]> {
  const { data, error } = await supabase
    .from('skin_concerns')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as SkinConcern[]
}

/* ------------------------------------------------------------------ */
/* Products                                                           */
/* ------------------------------------------------------------------ */
export async function getProducts({
  categoryId,
  concernId,
  skinType,
  kind,
  isFeatured,
  limit,
}: {
  categoryId?: string
  concernId?: string
  skinType?: string
  kind?: string
  isFeatured?: boolean
  limit?: number
} = {}): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select(`
      *,
      product_images (*),
      product_variants (*)
    `)
    .eq('is_active', true)

  if (categoryId) query = query.eq('category_id', categoryId)
  if (isFeatured !== undefined) query = query.eq('is_featured', isFeatured)
  if (kind) query = query.eq('kind', kind)
  if (limit) query = query.limit(limit)

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error

  let products = (data ?? []) as Product[]

  // Client-side filters for array / join columns that Supabase can handle
  // natively but are simpler to apply here for the concept storefront.
  if (skinType) {
    products = products.filter((p) => p.skin_types.includes(skinType))
  }

  if (concernId) {
    const { data: links } = await supabase
      .from('product_concerns')
      .select('product_id')
      .eq('concern_id', concernId)
    const linked = new Set(
      ((links ?? []) as any[]).map((l: any) => l.product_id),
    )
    products = products.filter((p) => linked.has(p.id))
  }

  return products
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data as Product
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data as Product
}

export async function getProductWithDetails(
  id: string,
): Promise<ProductWithDetails | null> {
  const product = await getProductById(id)
  if (!product) return null

  const [images, variants, concerns] = await Promise.all([
    getProductImages(id),
    getProductVariants(id),
    getProductConcernIds(id),
  ])

  return {
    ...product,
    category: product.category_id ? await getCategoryById(product.category_id) : null,
    images,
    variants,
    concerns,
  }
}

async function getCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Category
}

export async function getProductImages(
  productId: string,
): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProductImage[]
}

export async function getProductVariants(
  productId: string,
): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProductVariant[]
}

async function getProductConcernIds(productId: string): Promise<SkinConcern[]> {
  const { data: links } = await supabase
    .from('product_concerns')
    .select('concern_id')
    .eq('product_id', productId)

  const concernIds = ((links ?? []) as any[]).map((l: any) => l.concern_id)
  if (concernIds.length === 0) return []

  const { data, error } = await supabase
    .from('skin_concerns')
    .select('*')
    .in('id', concernIds)

  if (error) return []
  return (data ?? []) as SkinConcern[]
}

export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  return getProducts({ isFeatured: true, limit })
}

export async function searchProducts(query: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Product[]
}

/* ------------------------------------------------------------------ */
/* Default variant helper                                             */
/* ------------------------------------------------------------------ */
export function getDefaultVariant(variants: ProductVariant[]): ProductVariant | null {
  return (
    variants.find((v) => v.is_default) || variants[0] || null
  )
}

export function formatPrice(amount: number | null): string {
  if (amount == null) return ''
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
