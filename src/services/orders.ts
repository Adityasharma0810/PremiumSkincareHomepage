/**
 * Orders data access layer.
 *
 * Covers `orders`, `order_items`, `addresses`, `coupons`, `payments` and
 * `shipments` per DATABASE_SCHEMA.md.
 */
import { supabase } from '@/lib/supabase'
import type {
  Address,
  AddressInsert,
  Coupon,
  Order,
  OrderInsert,
  OrderItem,
  OrderItemInsert,
  Payment,
  PaymentInsert,
  Shipment,
  ShipmentInsert,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */
export async function getOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Order[]
}

export async function getCustomerOrders(): Promise<Array<Order & {
  items: OrderItem[]
  shipment: Shipment | null
  paymentMethod: string | null
}>> {
  const { data, error } = await supabase.functions.invoke('razorpay', {
    body: { action: 'get-customer-orders' },
  })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('The orders service returned an invalid response.')
  const orders = data
    .filter((order) => !['cancelled', 'refunded'].includes(order.status) &&
      !['failed', 'refunded', 'partially_refunded'].includes(order.payment_status))
    .filter((order) => order.status !== 'pending_payment' || order.payment_status === 'paid')
  return orders
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).single()
  if (error) return null
  return data as Order
}

export async function createOrder(order: OrderInsert): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single()
  if (error) throw error
  return data as Order
}

export async function addOrderItems(items: OrderItemInsert[]): Promise<void> {
  const { error } = await supabase.from('order_items').insert(items)
  if (error) throw error
}

export async function updateOrderStatus(
  id: string,
  updates: Partial<Pick<Order, 'status' | 'payment_status' | 'paid_at' | 'cancelled_at'>>,
) {
  const { error } = await supabase.from('orders').update(updates).eq('id', id)
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Order items                                                        */
/* ------------------------------------------------------------------ */
export async function getOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/* ------------------------------------------------------------------ */
/* Addresses                                                          */
/* ------------------------------------------------------------------ */
export async function getAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Address[]
}

export async function createAddress(address: AddressInsert): Promise<Address> {
  const { data, error } = await supabase
    .from('addresses')
    .insert(address)
    .select()
    .single()
  if (error) throw error
  return data as Address
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  // Unset all defaults for the user, then set the chosen one.
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId)
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId)
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Coupons                                                            */
/* ------------------------------------------------------------------ */
export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  const coupon = data as Coupon
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date(now)) return null
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date(now)) return null
  return coupon
}

export async function getAllCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase.from('coupons').select('*').eq('is_active', true)
  if (error) throw error
  return (data ?? []) as Coupon[]
}

/* ------------------------------------------------------------------ */
/* Payments                                                           */
/* ------------------------------------------------------------------ */
export async function createPayment(payment: PaymentInsert) {
  const { data, error } = await supabase.from('payments').insert(payment).select().single()
  if (error) throw error
  return data
}

export async function updatePayment(
  id: string,
  updates: Partial<Pick<Payment, 'status' | 'provider_payment_id' | 'signature_verified' | 'gateway_response' | 'paid_at'>>,
) {
  const { error } = await supabase.from('payments').update(updates).eq('id', id)
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Shipments                                                          */
/* ------------------------------------------------------------------ */
export async function createShipment(shipment: ShipmentInsert) {
  const { data, error } = await supabase.from('shipments').insert(shipment).select().single()
  if (error) throw error
  return data
}
