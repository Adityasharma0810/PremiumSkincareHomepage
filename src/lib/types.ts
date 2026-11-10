/**
 * Supabase database types generated from DATABASE_SCHEMA.md.
 *
 * These mirror the 23 project-owned tables declared in setup_supabase.py
 * plus Supabase-managed auth.users (linked via profiles.id).
 *
 * PostgreSQL type mapping used here:
 *   uuid, text → string
 *   integer, numeric(10,2) → number
 *   boolean → boolean
 *   timestamptz, date → string (ISO-8601)
 *   text[] → string[]
 *   jsonb → any
 */

/* ------------------------------------------------------------------ */
/* Generic table shape required by the Supabase client                */
/* ------------------------------------------------------------------ */
type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type DBTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type Database = {
  public: {
    Tables: {
      profiles: DBTable
      categories: DBTable
      skin_concerns: DBTable
      products: DBTable
      product_images: DBTable
      product_variants: DBTable
      product_concerns: DBTable
      addresses: DBTable
      carts: DBTable
      cart_items: DBTable
      wishlists: DBTable
      wishlist_items: DBTable
      coupons: DBTable
      orders: DBTable
      order_items: DBTable
      coupon_redemptions: DBTable
      payments: DBTable
      webhook_events: DBTable
      shipments: DBTable
      shipment_events: DBTable
      inventory_movements: DBTable
      reviews: DBTable
      newsletter_subscribers: DBTable
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

/* ------------------------------------------------------------------ */
/* profiles                                                           */
/* ------------------------------------------------------------------ */
export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: string | null
  created_at: string
  updated_at: string
}
export type ProfileInsert = Partial<
  Pick<Profile, 'email' | 'full_name' | 'phone' | 'avatar_url' | 'role'>
> & { id: string }
export type ProfileUpdate = Partial<
  Pick<Profile, 'full_name' | 'phone' | 'avatar_url' | 'role'>
>

/* ------------------------------------------------------------------ */
/* categories                                                         */
/* ------------------------------------------------------------------ */
export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
export type CategoryInsert = Partial<
  Pick<
    Category,
    'name' | 'slug' | 'description' | 'sort_order' | 'is_active'
  >
>
export type CategoryUpdate = Partial<
  Pick<Category, 'name' | 'slug' | 'description' | 'sort_order' | 'is_active'>
>

/* ------------------------------------------------------------------ */
/* skin_concerns                                                      */
/* ------------------------------------------------------------------ */
export interface SkinConcern {
  id: string
  name: string
  slug: string
  short_description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
export type SkinConcernInsert = Partial<
  Pick<
    SkinConcern,
    | 'name'
    | 'slug'
    | 'short_description'
    | 'icon'
    | 'sort_order'
    | 'is_active'
  >
>
export type SkinConcernUpdate = Partial<
  Pick<
    SkinConcern,
    | 'name'
    | 'slug'
    | 'short_description'
    | 'icon'
    | 'sort_order'
    | 'is_active'
  >
>

/* ------------------------------------------------------------------ */
/* products                                                           */
/* ------------------------------------------------------------------ */
export interface Product {
  id: string
  category_id: string | null
  name: string
  slug: string
  short_description: string | null
  description: string | null
  benefit_label: string | null
  kind: string | null
  badge_text: string | null
  skin_types: string[]
  key_benefits: string[]
  ingredients: any
  how_to_use: string | null
  is_featured: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}
export type ProductInsert = Partial<
  Pick<
    Product,
    | 'category_id'
    | 'name'
    | 'slug'
    | 'short_description'
    | 'description'
    | 'benefit_label'
    | 'kind'
    | 'badge_text'
    | 'skin_types'
    | 'key_benefits'
    | 'ingredients'
    | 'how_to_use'
    | 'is_featured'
    | 'is_active'
  >
>
export type ProductUpdate = Partial<
  Pick<
    Product,
    | 'category_id'
    | 'name'
    | 'slug'
    | 'short_description'
    | 'description'
    | 'benefit_label'
    | 'kind'
    | 'badge_text'
    | 'skin_types'
    | 'key_benefits'
    | 'ingredients'
    | 'how_to_use'
    | 'is_featured'
    | 'is_active'
  >
>

/* ------------------------------------------------------------------ */
/* product_images                                                     */
/* ------------------------------------------------------------------ */
export interface ProductImage {
  id: string
  product_id: string
  image_url: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
  created_at: string
}
export type ProductImageInsert = Partial<
  Pick<
    ProductImage,
    | 'product_id'
    | 'image_url'
    | 'alt_text'
    | 'sort_order'
    | 'is_primary'
  >
>
export type ProductImageUpdate = Partial<
  Pick<ProductImage, 'image_url' | 'alt_text' | 'sort_order' | 'is_primary'>
>

/* ------------------------------------------------------------------ */
/* product_variants                                                   */
/* ------------------------------------------------------------------ */
export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  variant_name: string | null
  size_label: string | null
  price: number
  compare_at_price: number | null
  stock_quantity: number
  low_stock_threshold: number
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}
export type ProductVariantInsert = Partial<
  Pick<
    ProductVariant,
    | 'product_id'
    | 'sku'
    | 'variant_name'
    | 'size_label'
    | 'price'
    | 'compare_at_price'
    | 'stock_quantity'
    | 'low_stock_threshold'
    | 'is_default'
    | 'is_active'
  >
>
export type ProductVariantUpdate = Partial<
  Pick<
    ProductVariant,
    | 'sku'
    | 'variant_name'
    | 'size_label'
    | 'price'
    | 'compare_at_price'
    | 'stock_quantity'
    | 'low_stock_threshold'
    | 'is_default'
    | 'is_active'
  >
>

/* ------------------------------------------------------------------ */
/* product_concerns                                                   */
/* ------------------------------------------------------------------ */
export interface ProductConcern {
  product_id: string
  concern_id: string
  created_at: string
}
export type ProductConcernInsert = Pick<ProductConcern, 'product_id' | 'concern_id'>

/* ------------------------------------------------------------------ */
/* addresses                                                          */
/* ------------------------------------------------------------------ */
export interface Address {
  id: string
  user_id: string
  recipient_name: string
  phone: string
  address_line1: string
  address_line2: string | null
  landmark: string | null
  city: string
  state: string
  pincode: string
  country: string
  address_type: string
  is_default: boolean
  created_at: string
  updated_at: string
}
export type AddressInsert = Partial<
  Pick<
    Address,
    | 'user_id'
    | 'recipient_name'
    | 'phone'
    | 'address_line1'
    | 'address_line2'
    | 'landmark'
    | 'city'
    | 'state'
    | 'pincode'
    | 'country'
    | 'address_type'
    | 'is_default'
  >
>
export type AddressUpdate = Partial<
  Pick<
    Address,
    | 'recipient_name'
    | 'phone'
    | 'address_line1'
    | 'address_line2'
    | 'landmark'
    | 'city'
    | 'state'
    | 'pincode'
    | 'country'
    | 'address_type'
    | 'is_default'
  >
>

/* ------------------------------------------------------------------ */
/* carts                                                              */
/* ------------------------------------------------------------------ */
export interface Cart {
  id: string
  user_id: string | null
  status: string
  created_at: string
  updated_at: string
}
export type CartInsert = Partial<Pick<Cart, 'user_id' | 'status'>>
export type CartUpdate = Partial<Pick<Cart, 'status'>>

/* ------------------------------------------------------------------ */
/* cart_items                                                         */
/* ------------------------------------------------------------------ */
export interface CartItem {
  id: string
  cart_id: string
  variant_id: string
  quantity: number
  created_at: string
  updated_at: string
}
export type CartItemInsert = Partial<
  Pick<CartItem, 'cart_id' | 'variant_id' | 'quantity'>
>
export type CartItemUpdate = Partial<Pick<CartItem, 'quantity'>>

/* ------------------------------------------------------------------ */
/* wishlists                                                          */
/* ------------------------------------------------------------------ */
export interface Wishlist {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}
export type WishlistInsert = Partial<Pick<Wishlist, 'user_id' | 'name'>>
export type WishlistUpdate = Partial<Pick<Wishlist, 'name'>>

/* ------------------------------------------------------------------ */
/* wishlist_items                                                     */
/* ------------------------------------------------------------------ */
export interface WishlistItem {
  id: string
  wishlist_id: string
  variant_id: string
  created_at: string
}
export type WishlistItemInsert = Pick<WishlistItem, 'wishlist_id' | 'variant_id'>

/* ------------------------------------------------------------------ */
/* coupons                                                            */
/* ------------------------------------------------------------------ */
export interface Coupon {
  id: string
  code: string
  description: string | null
  discount_type: string
  discount_value: number
  minimum_order_value: number
  maximum_discount: number | null
  usage_limit: number | null
  per_user_limit: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
export type CouponInsert = Partial<
  Pick<
    Coupon,
    | 'code'
    | 'description'
    | 'discount_type'
    | 'discount_value'
    | 'minimum_order_value'
    | 'maximum_discount'
    | 'usage_limit'
    | 'per_user_limit'
    | 'starts_at'
    | 'expires_at'
    | 'is_active'
  >
>
export type CouponUpdate = Partial<
  Pick<
    Coupon,
    | 'code'
    | 'description'
    | 'discount_type'
    | 'discount_value'
    | 'minimum_order_value'
    | 'maximum_discount'
    | 'usage_limit'
    | 'per_user_limit'
    | 'starts_at'
    | 'expires_at'
    | 'is_active'
  >
>

/* ------------------------------------------------------------------ */
/* orders                                                             */
/* ------------------------------------------------------------------ */
export interface Order {
  id: string
  order_number: string
  user_id: string
  customer_email: string
  customer_name: string
  customer_phone: string
  status: string
  payment_status: string
  currency: string
  subtotal: number
  discount_amount: number
  shipping_fee: number
  tax_amount: number
  total_amount: number
  coupon_id: string | null
  shipping_address_id: string | null
  billing_address_id: string | null
  shipping_address_snapshot: any
  billing_address_snapshot: any
  customer_note: string | null
  placed_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}
export type OrderInsert = Partial<
  Pick<
    Order,
    | 'order_number'
    | 'user_id'
    | 'customer_email'
    | 'customer_name'
    | 'customer_phone'
    | 'status'
    | 'payment_status'
    | 'currency'
    | 'subtotal'
    | 'discount_amount'
    | 'shipping_fee'
    | 'tax_amount'
    | 'total_amount'
    | 'coupon_id'
    | 'shipping_address_id'
    | 'billing_address_id'
    | 'shipping_address_snapshot'
    | 'billing_address_snapshot'
    | 'customer_note'
  >
>
export type OrderUpdate = Partial<
  Pick<
    Order,
    | 'status'
    | 'payment_status'
    | 'paid_at'
    | 'cancelled_at'
    | 'updated_at'
  >
>

/* ------------------------------------------------------------------ */
/* order_items                                                        */
/* ------------------------------------------------------------------ */
export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  size_label: string | null
  unit_price: number
  compare_at_price: number | null
  quantity: number
  line_total: number
  product_snapshot: any
  created_at: string
}
export type OrderItemInsert = Partial<
  Pick<
    OrderItem,
    | 'order_id'
    | 'product_id'
    | 'variant_id'
    | 'product_name'
    | 'variant_name'
    | 'sku'
    | 'size_label'
    | 'unit_price'
    | 'compare_at_price'
    | 'quantity'
    | 'line_total'
    | 'product_snapshot'
  >
>

/* ------------------------------------------------------------------ */
/* coupon_redemptions                                                 */
/* ------------------------------------------------------------------ */
export interface CouponRedemption {
  id: string
  coupon_id: string
  order_id: string
  user_id: string
  discount_amount: number
  redeemed_at: string
}
export type CouponRedemptionInsert = Partial<
  Pick<
    CouponRedemption,
    'coupon_id' | 'order_id' | 'user_id' | 'discount_amount'
  >
>

/* ------------------------------------------------------------------ */
/* payments                                                           */
/* ------------------------------------------------------------------ */
export interface Payment {
  id: string
  order_id: string
  user_id: string
  provider: string
  provider_order_id: string | null
  provider_payment_id: string | null
  signature_verified: boolean
  amount: number
  currency: string
  status: string
  payment_method: string | null
  gateway_response: any
  failure_reason: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}
export type PaymentInsert = Partial<
  Pick<
    Payment,
    | 'order_id'
    | 'user_id'
    | 'provider'
    | 'provider_order_id'
    | 'provider_payment_id'
    | 'signature_verified'
    | 'amount'
    | 'currency'
    | 'status'
    | 'payment_method'
    | 'gateway_response'
    | 'failure_reason'
  >
>
export type PaymentUpdate = Partial<
  Pick<
    Payment,
    | 'provider_order_id'
    | 'provider_payment_id'
    | 'signature_verified'
    | 'status'
    | 'payment_method'
    | 'gateway_response'
    | 'failure_reason'
    | 'paid_at'
  >
>

/* ------------------------------------------------------------------ */
/* webhook_events                                                     */
/* ------------------------------------------------------------------ */
export interface WebhookEvent {
  id: string
  provider: string
  provider_event_id: string
  event_type: string
  payload: any
  processed_at: string | null
  processing_error: string | null
  received_at: string
}
export type WebhookEventInsert = Partial<
  Pick<
    WebhookEvent,
    | 'provider'
    | 'provider_event_id'
    | 'event_type'
    | 'payload'
    | 'processed_at'
    | 'processing_error'
  >
>

/* ------------------------------------------------------------------ */
/* shipments                                                          */
/* ------------------------------------------------------------------ */
export interface Shipment {
  id: string
  order_id: string
  provider: string
  awb_number: string | null
  consignment_number: string | null
  courier_service: string | null
  tracking_url: string | null
  label_url: string | null
  status: string
  estimated_delivery_date: string | null
  booked_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  request_payload: any
  response_payload: any
  created_at: string
  updated_at: string
}
export type ShipmentInsert = Partial<
  Pick<
    Shipment,
    | 'order_id'
    | 'provider'
    | 'awb_number'
    | 'consignment_number'
    | 'courier_service'
    | 'tracking_url'
    | 'label_url'
    | 'status'
    | 'estimated_delivery_date'
    | 'booked_at'
    | 'picked_up_at'
    | 'delivered_at'
    | 'request_payload'
    | 'response_payload'
  >
>
export type ShipmentUpdate = Partial<
  Pick<
    Shipment,
    | 'awb_number'
    | 'consignment_number'
    | 'courier_service'
    | 'tracking_url'
    | 'label_url'
    | 'status'
    | 'estimated_delivery_date'
    | 'booked_at'
    | 'picked_up_at'
    | 'delivered_at'
    | 'response_payload'
  >
>

/* ------------------------------------------------------------------ */
/* shipment_events                                                    */
/* ------------------------------------------------------------------ */
export interface ShipmentEvent {
  id: string
  shipment_id: string
  event_code: string
  status: string
  description: string | null
  location: string | null
  event_time: string
  raw_event: any
  created_at: string
}
export type ShipmentEventInsert = Partial<
  Pick<
    ShipmentEvent,
    | 'shipment_id'
    | 'event_code'
    | 'status'
    | 'description'
    | 'location'
    | 'event_time'
    | 'raw_event'
  >
>

/* ------------------------------------------------------------------ */
/* inventory_movements                                                */
/* ------------------------------------------------------------------ */
export interface InventoryMovement {
  id: string
  variant_id: string
  order_id: string | null
  movement_type: string
  quantity_change: number
  reason: string | null
  reference: string | null
  created_by: string | null
  created_at: string
}
export type InventoryMovementInsert = Partial<
  Pick<
    InventoryMovement,
    | 'variant_id'
    | 'order_id'
    | 'movement_type'
    | 'quantity_change'
    | 'reason'
    | 'reference'
    | 'created_by'
  >
>

/* ------------------------------------------------------------------ */
/* reviews                                                            */
/* ------------------------------------------------------------------ */
export interface Review {
  id: string
  product_id: string
  user_id: string
  order_item_id: string | null
  rating: number
  title: string | null
  body: string | null
  status: string
  created_at: string
  updated_at: string
}
export type ReviewInsert = Partial<
  Pick<
    Review,
    | 'product_id'
    | 'user_id'
    | 'order_item_id'
    | 'rating'
    | 'title'
    | 'body'
    | 'status'
  >
>
export type ReviewUpdate = Partial<
  Pick<Review, 'rating' | 'title' | 'body' | 'status'>
>

/* ------------------------------------------------------------------ */
/* newsletter_subscribers                                             */
/* ------------------------------------------------------------------ */
export interface NewsletterSubscriber {
  id: string
  email: string
  is_active: boolean
  subscribed_at: string
  unsubscribed_at: string | null
}
export type NewsletterSubscriberInsert = Pick<
  NewsletterSubscriber,
  'email' | 'is_active'
>

/* ------------------------------------------------------------------ */
/* Convenience joined shapes used by the UI                           */
/* ------------------------------------------------------------------ */
export interface ProductWithDetails extends Product {
  category?: Category | null
  images: ProductImage[]
  variants: ProductVariant[]
  concerns: SkinConcern[]
}

export interface CartItemWithVariant extends CartItem {
  variant: ProductVariant & { product: Product }
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}
