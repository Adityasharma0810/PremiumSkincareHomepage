import { supabase } from '@/lib/supabase'
import {
  FunctionsFetchError,
  FunctionsHttpError,
} from '@supabase/supabase-js'

export interface RazorpayOrder {
  orderId: string
  razorpayOrderId: string
  keyId: string
  amount: number
  currency: string
}

export interface ShippingAddress {
  recipientName: string
  phone: string
  addressLine1: string
  addressLine2: string
  landmark: string
  city: string
  state: string
  pincode: string
  country: string
}

export type CheckoutMethod = 'razorpay' | 'cod'

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export async function createCodOrder(
  cartId: string,
  couponCode: string | null,
  shippingAddress: ShippingAddress,
): Promise<{ cartCleared: boolean; shipmentPending: boolean }> {
  const { data, error } = await supabase.functions.invoke('razorpay', {
    body: { action: 'create-cod-order', cartId, couponCode, shippingAddress },
  })
  if (error) await throwFunctionError(error)
  if (!data?.success) throw new Error('Your COD order could not be confirmed. Please check My orders before trying again.')
  return {
    cartCleared: data?.cartCleared !== false,
    shipmentPending: data?.shipmentPending === true,
  }
}

interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  prefill: { name?: string; email?: string }
  theme: { color: string }
  handler: (response: RazorpayPaymentResponse) => void
  modal: { ondismiss: () => void }
}

interface RazorpayCheckoutInstance {
  open(): void
  on(event: 'payment.failed', callback: (response: {
    error?: { description?: string }
  }) => void): void
}

type RazorpayCheckoutConstructor = new (
  options: RazorpayCheckoutOptions,
) => RazorpayCheckoutInstance

type RazorpayWindow = Window & {
  Razorpay?: RazorpayCheckoutConstructor
}

async function throwFunctionError(error: Error): Promise<never> {
  if (error instanceof FunctionsFetchError) {
    throw new Error(
      'Could not reach the checkout function. Deploy the razorpay Supabase Edge Function to the same project as this app, then try again.',
    )
  }

  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null
    if (error.context.status === 404) {
      throw new Error(
        'The checkout function is not deployed to this Supabase project yet. Deploy the razorpay Edge Function, then try again.',
      )
    }
    throw new Error(body?.error || error.message)
  }
  throw error
}

function loadRazorpayCheckout(): Promise<RazorpayCheckoutConstructor> {
  const existing = (window as RazorpayWindow).Razorpay
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      const checkout = (window as RazorpayWindow).Razorpay
      if (checkout) resolve(checkout)
      else reject(new Error('Razorpay Checkout failed to initialize.'))
    }
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'))
    document.head.appendChild(script)
  })
}

export async function createRazorpayOrder(
  cartId: string,
  couponCode: string | null,
  shippingAddress: ShippingAddress,
): Promise<RazorpayOrder> {
  const { data, error } = await supabase.functions.invoke('razorpay', {
    body: { action: 'create-order', cartId, couponCode, shippingAddress },
  })
  if (error) await throwFunctionError(error)
  return data as RazorpayOrder
}

export async function openRazorpayCheckout({
  order,
  customer,
}: {
  order: RazorpayOrder
  customer: { name?: string; email?: string }
}): Promise<RazorpayPaymentResponse> {
  const Razorpay = await loadRazorpayCheckout()

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.razorpayOrderId,
      name: 'derma aura',
      description: 'Your skincare order',
      prefill: customer,
      theme: { color: '#218477' },
      handler: resolve,
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled. Your bag is unchanged.')),
      },
    })

    checkout.on('payment.failed', (response) => {
      reject(new Error(response.error?.description || 'Razorpay could not complete the payment.'))
    })
    checkout.open()
  })
}

export async function verifyRazorpayPayment({
  orderId,
  cartId,
  payment,
}: {
  orderId: string
  cartId: string
  payment: RazorpayPaymentResponse
}): Promise<void> {
  const { error } = await supabase.functions.invoke('razorpay', {
    body: {
      action: 'verify-payment',
      orderId,
      cartId,
      ...payment,
    },
  })
  if (error) await throwFunctionError(error)
}
