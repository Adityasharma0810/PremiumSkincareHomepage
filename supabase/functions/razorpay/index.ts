import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type CartRow = {
  id: string
  quantity: number
  variant: {
    id: string
    product_id: string
    sku: string | null
    variant_name: string | null
    size_label: string | null
    price: number
    compare_at_price: number | null
    stock_quantity: number
    is_active: boolean
    product: { name: string; is_active: boolean } | null
  } | null
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}

function razorpayKeyId(): string {
  const keyId = requiredEnv('RAZORPAY_KEY_ID')
  if (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
    throw new Error('Razorpay key must start with rzp_test_ or rzp_live_.')
  }
  return keyId
}

function razorpayAuthorization() {
  const credentials = `${razorpayKeyId()}:${requiredEnv('RAZORPAY_KEY_SECRET')}`
  return `Basic ${btoa(credentials)}`
}

type DtdcRouteNode = {
  courier_partner: string
  courier_accounts: string
  mode: 'shipment' | 'bag'
  node_type: 'FM' | 'MM' | 'LM'
}

function isDtdcRouteNode(value: unknown): value is DtdcRouteNode {
  if (!value || typeof value !== 'object') return false
  const node = value as Record<string, unknown>
  return typeof node.courier_partner === 'string' &&
    !!node.courier_partner.trim() &&
    typeof node.courier_accounts === 'string' &&
    !!node.courier_accounts.trim() &&
    (node.mode === 'shipment' || node.mode === 'bag') &&
    (node.node_type === 'FM' || node.node_type === 'MM' || node.node_type === 'LM')
}

function positiveNumber(name: string): number | null {
  const raw = Deno.env.get(name)?.trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

function dtdcConfiguration() {
  const names = [
    'DTDC_API_KEY',
    'DTDC_CUSTOMER_CODE',
    'DTDC_SERVICE_TYPE_ID',
    'DTDC_HUB_CODE',
    'DTDC_SENDER_NAME',
    'DTDC_SENDER_PHONE',
    'DTDC_SENDER_ADDRESS_LINE1',
    'DTDC_SENDER_CITY',
    'DTDC_SENDER_STATE',
    'DTDC_SENDER_PINCODE',
  ]
  const missing = names.filter((name) => !Deno.env.get(name)?.trim())
  const weight = positiveNumber('DTDC_PARCEL_WEIGHT_KG')
  const length = positiveNumber('DTDC_PARCEL_LENGTH_CM')
  const width = positiveNumber('DTDC_PARCEL_WIDTH_CM')
  const height = positiveNumber('DTDC_PARCEL_HEIGHT_CM')
  if (weight === null) missing.push('DTDC_PARCEL_WEIGHT_KG')
  if (length === null) missing.push('DTDC_PARCEL_LENGTH_CM')
  if (width === null) missing.push('DTDC_PARCEL_WIDTH_CM')
  if (height === null) missing.push('DTDC_PARCEL_HEIGHT_CM')

  let routeNodes: DtdcRouteNode[] = []
  const rawNodes = Deno.env.get('DTDC_ROUTE_NODES_JSON')?.trim()
  if (!rawNodes) {
    missing.push('DTDC_ROUTE_NODES_JSON')
  } else {
    try {
      const parsed: unknown = JSON.parse(rawNodes)
      if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isDtdcRouteNode)) {
        missing.push('DTDC_ROUTE_NODES_JSON')
      } else {
        routeNodes = parsed
      }
    } catch {
      missing.push('DTDC_ROUTE_NODES_JSON')
    }
  }

  return {
    missing: [...new Set(missing)],
    routeNodes,
    weight,
    length,
    width,
    height,
  }
}

async function bookDtdcShipment(
  admin: ReturnType<typeof createClient>,
  shipmentId: string,
  order: {
    order_number: string
    total_amount: number
    shipping_address_snapshot: Record<string, unknown> | null
  },
  isCod = false,
) {
  const configuration = dtdcConfiguration()
  if (configuration.missing.length) {
    const { error } = await admin
      .from('shipments')
      .update({
        response_payload: {
          booking_status: 'pending_configuration',
          missing_configuration: configuration.missing,
        },
      })
      .eq('id', shipmentId)
    if (error) console.error('Could not update pending DTDC shipment configuration status.')
    return
  }

  const address = order.shipping_address_snapshot
  if (!address) {
    console.error('Cannot create DTDC shipment without the order shipping address.')
    return
  }

  const declaredValue = String(Math.round(Number(order.total_amount)))
  const piece = {
    description: 'Skincare products',
    declared_value: declaredValue,
    weight: String(configuration.weight),
    height: String(configuration.height),
    length: String(configuration.length),
    width: String(configuration.width),
    weight_unit: 'kg',
    dimension_unit: 'cm',
  }
  const requestPayload = {
    action_type: 'delivery',
    consignment_type: 'forward',
    movement_type: 'forward',
    load_type: 'NON-DOCUMENT',
    description: 'derma aura skincare order',
    customer_code: Deno.env.get('DTDC_CUSTOMER_CODE')?.trim() || undefined,
    reference_number: order.order_number,
    customer_reference_number: order.order_number,
    service_type_id: Deno.env.get('DTDC_SERVICE_TYPE_ID')!.trim(),
    dimension_unit: 'cm',
    length: String(configuration.length),
    width: String(configuration.width),
    height: String(configuration.height),
    weight_unit: 'kg',
    weight: String(configuration.weight),
    cod_collection_mode: isCod ? 'cash' : undefined,
    cod_amount: isCod ? String(Number(order.total_amount)) : '0',
    invoice_amount: String(Number(order.total_amount)),
    declared_value: Math.round(Number(order.total_amount)),
    num_pieces: 1,
    is_risk_surcharge_applicable: false,
    hub_code: Deno.env.get('DTDC_HUB_CODE')!.trim(),
    origin_details: {
      name: Deno.env.get('DTDC_SENDER_NAME')!.trim(),
      phone: Deno.env.get('DTDC_SENDER_PHONE')!.trim(),
      address_line_1: Deno.env.get('DTDC_SENDER_ADDRESS_LINE1')!.trim(),
      address_line_2: Deno.env.get('DTDC_SENDER_ADDRESS_LINE2')?.trim() || undefined,
      pincode: Deno.env.get('DTDC_SENDER_PINCODE')!.trim(),
      city: Deno.env.get('DTDC_SENDER_CITY')!.trim(),
      state: Deno.env.get('DTDC_SENDER_STATE')!.trim(),
      country: Deno.env.get('DTDC_SENDER_COUNTRY')?.trim() || 'India',
    },
    destination_details: {
      name: address.recipient_name,
      phone: address.phone,
      address_line_1: address.address_line1,
      address_line_2: address.address_line2 || undefined,
      pincode: address.pincode,
      city: address.city,
      state: address.state,
      country: address.country || 'India',
    },
    nodes: configuration.routeNodes.map((node) => ({
      ...node,
      declared_value: declaredValue,
    })),
    pieces_detail: [piece],
  }

  try {
    const response = await fetch(
      'https://app.shipsy.in/api/customer/integration/consignment/upload/softdata/v2',
      {
        method: 'POST',
        headers: {
          'api-key': Deno.env.get('DTDC_API_KEY')!.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      },
    )
    const responseText = await response.text()
    let responsePayload: Record<string, unknown>
    try {
      responsePayload = JSON.parse(responseText)
    } catch {
      responsePayload = { message: 'DTDC returned an unreadable response.' }
    }

    if (!response.ok || responsePayload.success !== true) {
      const { error } = await admin
        .from('shipments')
        .update({
          status: 'exception',
          request_payload: requestPayload,
          response_payload: { booking_status: 'failed', provider: responsePayload },
        })
        .eq('id', shipmentId)
      if (error) console.error('Could not save DTDC booking failure to the shipment record.')
      console.error(`DTDC booking was not confirmed (HTTP ${response.status}).`)
      return
    }

    const consignmentNumber = typeof responsePayload.reference_number === 'string'
      ? responsePayload.reference_number
      : ''
    if (!consignmentNumber) {
      const { error } = await admin
        .from('shipments')
        .update({
          status: 'exception',
          request_payload: requestPayload,
          response_payload: { booking_status: 'missing_reference', provider: responsePayload },
        })
        .eq('id', shipmentId)
      if (error) console.error('Could not save DTDC booking response to the shipment record.')
      console.error('DTDC reported success without a consignment reference.')
      return
    }

    const { error } = await admin
      .from('shipments')
      .update({
        status: 'booked',
        consignment_number: consignmentNumber,
        awb_number: typeof responsePayload.courier_partner_reference_number === 'string'
          ? responsePayload.courier_partner_reference_number
          : consignmentNumber,
        courier_service: typeof responsePayload.courier_partner === 'string'
          ? responsePayload.courier_partner
          : 'DTDC',
        booked_at: new Date().toISOString(),
        request_payload: requestPayload,
        response_payload: responsePayload,
      })
      .eq('id', shipmentId)
    if (error) console.error('Could not save successful DTDC booking to the shipment record.')
  } catch (error) {
    console.error('DTDC shipment booking request failed:', error)
    const { error: updateError } = await admin
      .from('shipments')
      .update({
        status: 'exception',
        request_payload: requestPayload,
        response_payload: { booking_status: 'request_failed' },
      })
      .eq('id', shipmentId)
    if (updateError) console.error('Could not save DTDC request failure to the shipment record.')
  }
}

async function createOrder(
  request: Request,
  body: Record<string, unknown>,
  paymentMethod: 'razorpay' | 'cod',
) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sign in to continue to checkout.' }, 401)
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const anonKey = requiredEnv('SUPABASE_ANON_KEY')
  const admin = createClient(
    supabaseUrl,
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(
    authorization.slice('Bearer '.length),
  )
  if (authError || !user) return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401)

  const cartId = typeof body.cartId === 'string' ? body.cartId : ''
  if (!cartId) return jsonResponse({ error: 'Your bag could not be found.' }, 400)

  const rawAddress = body.shippingAddress
  if (!rawAddress || typeof rawAddress !== 'object') {
    return jsonResponse({ error: 'A delivery address is required.' }, 400)
  }
  const addressFields = rawAddress as Record<string, unknown>
  const shippingAddress = {
    recipient_name: typeof addressFields.recipientName === 'string'
      ? addressFields.recipientName.trim()
      : '',
    phone: typeof addressFields.phone === 'string'
      ? addressFields.phone.trim()
      : '',
    address_line1: typeof addressFields.addressLine1 === 'string'
      ? addressFields.addressLine1.trim()
      : '',
    address_line2: typeof addressFields.addressLine2 === 'string'
      ? addressFields.addressLine2.trim()
      : '',
    landmark: typeof addressFields.landmark === 'string'
      ? addressFields.landmark.trim()
      : '',
    city: typeof addressFields.city === 'string' ? addressFields.city.trim() : '',
    state: typeof addressFields.state === 'string' ? addressFields.state.trim() : '',
    pincode: typeof addressFields.pincode === 'string'
      ? addressFields.pincode.trim()
      : '',
    country: 'India',
  }
  const phoneDigits = shippingAddress.phone.replace(/\D/g, '')
  if (
    !shippingAddress.recipient_name ||
    !shippingAddress.address_line1 ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !/^\d{6}$/.test(shippingAddress.pincode) ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 15
  ) {
    return jsonResponse({ error: 'Enter a valid delivery name, address, phone number, city, state, and 6-digit PIN code.' }, 400)
  }

  const { data: cart, error: cartError } = await admin
    .from('carts')
    .select('id, user_id, status')
    .eq('id', cartId)
    .maybeSingle()
  if (cartError) throw cartError
  if (!cart || cart.status !== 'active') {
    return jsonResponse({ error: 'This bag is no longer active. Refresh and try again.' }, 400)
  }
  if (cart.user_id && cart.user_id !== user.id) {
    return jsonResponse({ error: 'This bag belongs to a different account.' }, 403)
  }
  if (!cart.user_id) {
    const { data: claimed, error } = await admin
      .from('carts')
      .update({ user_id: user.id })
      .eq('id', cartId)
      .is('user_id', null)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!claimed) return jsonResponse({ error: 'Could not associate your bag with your account.' }, 409)
  }

  const { data: cartRows, error: itemsError } = await admin
    .from('cart_items')
    .select(`
      id,
      quantity,
      variant:product_variants!inner (
        id,
        product_id,
        sku,
        variant_name,
        size_label,
        price,
        compare_at_price,
        stock_quantity,
        is_active,
        product:products!inner (name, is_active)
      )
    `)
    .eq('cart_id', cartId)
  if (itemsError) throw itemsError
  const items = (cartRows ?? []) as unknown as CartRow[]
  if (!items.length) return jsonResponse({ error: 'Your bag is empty.' }, 400)

  for (const item of items) {
    const variant = item.variant
    if (
      !variant ||
      !variant.is_active ||
      !variant.product?.is_active ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > variant.stock_quantity
    ) {
      return jsonResponse({ error: 'A bag item is unavailable or has insufficient stock. Refresh your bag and try again.' }, 409)
    }
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.variant!.price) * item.quantity,
    0,
  )
  let couponId: string | null = null
  let discountAmount = 0
  const couponCode = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : ''
  if (couponCode) {
    const now = new Date().toISOString()
    const { data: coupon, error } = await admin
      .from('coupons')
      .select('*')
      .eq('code', couponCode)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    if (
      !coupon ||
      (coupon.starts_at && coupon.starts_at > now) ||
      (coupon.expires_at && coupon.expires_at < now) ||
      subtotal < Number(coupon.minimum_order_value || 0)
    ) {
      return jsonResponse({ error: 'The applied coupon is no longer valid. Remove it and try again.' }, 409)
    }
    if (coupon.usage_limit != null) {
      const { count, error: usageError } = await admin
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
      if (usageError) throw usageError
      if ((count ?? 0) >= Number(coupon.usage_limit)) {
        return jsonResponse({ error: 'This coupon has reached its redemption limit.' }, 409)
      }
    }
    if (coupon.per_user_limit != null) {
      const { count, error: userUsageError } = await admin
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', user.id)
      if (userUsageError) throw userUsageError
      if ((count ?? 0) >= Number(coupon.per_user_limit)) {
        return jsonResponse({ error: 'You have already used this coupon the maximum number of times.' }, 409)
      }
    }
    couponId = coupon.id
    discountAmount = coupon.discount_type.includes('percent')
      ? subtotal * Number(coupon.discount_value) / 100
      : Number(coupon.discount_value)
    if (coupon.maximum_discount != null) {
      discountAmount = Math.min(discountAmount, Number(coupon.maximum_discount))
    }
    discountAmount = Math.min(subtotal, Math.round(discountAmount))
  }

  const shippingFee = 0
  const totalAmount = subtotal + shippingFee - discountAmount
  const amountInPaise = Math.round(totalAmount * 100)
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    return jsonResponse({ error: 'The order total is invalid.' }, 400)
  }

  let razorpayOrder: { id: string } | null = null
  if (paymentMethod === 'razorpay') {
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: razorpayAuthorization(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `derma_aura_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`,
        notes: { user_id: user.id },
      }),
    })
    if (!razorpayResponse.ok) {
      console.error('Razorpay order creation failed:', await razorpayResponse.text())
      return jsonResponse({ error: 'Razorpay could not start the payment. Please try again.' }, 500)
    }
    razorpayOrder = await razorpayResponse.json()
  }

  const { data: savedAddress, error: addressError } = await admin
    .from('addresses')
    .insert({
      user_id: user.id,
      ...shippingAddress,
      address_type: 'other',
      is_default: false,
    })
    .select('id')
    .single()
  if (addressError) throw addressError

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      order_number: `DERMA-AURA-${crypto.randomUUID().toUpperCase()}`,
      user_id: user.id,
      customer_email: user.email ?? '',
      customer_name: shippingAddress.recipient_name,
      customer_phone: shippingAddress.phone,
      status: paymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
      payment_status: 'pending',
      currency: 'INR',
      subtotal,
      discount_amount: discountAmount,
      shipping_fee: shippingFee,
      tax_amount: 0,
      total_amount: totalAmount,
      coupon_id: couponId,
      shipping_address_id: savedAddress.id,
      shipping_address_snapshot: shippingAddress,
    })
    .select('id, order_number')
    .single()
  if (orderError) throw orderError

  const { error: orderItemsError } = await admin.from('order_items').insert(
    items.map((item) => ({
      order_id: order.id,
      product_id: item.variant!.product_id,
      variant_id: item.variant!.id,
      product_name: item.variant!.product!.name,
      variant_name: item.variant!.variant_name,
      sku: item.variant!.sku,
      size_label: item.variant!.size_label,
      unit_price: Number(item.variant!.price),
      compare_at_price: item.variant!.compare_at_price,
      quantity: item.quantity,
      line_total: Number(item.variant!.price) * item.quantity,
    })),
  )
  if (orderItemsError) {
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    throw orderItemsError
  }

  const { error: paymentError } = await admin.from('payments').insert({
    order_id: order.id,
    user_id: user.id,
    provider: 'razorpay',
    provider_order_id: razorpayOrder?.id ?? null,
    amount: totalAmount,
    currency: 'INR',
    status: 'created',
    signature_verified: false,
    payment_method: paymentMethod === 'cod' ? 'cash_on_delivery' : null,
    gateway_response: { cart_id: cartId, payment_method: paymentMethod },
  })
  if (paymentError) {
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    throw paymentError
  }

  if (paymentMethod === 'cod') {
    if (couponId && discountAmount > 0) {
      const { error: redemptionError } = await admin
        .from('coupon_redemptions')
        .insert({
          coupon_id: couponId,
          order_id: order.id,
          user_id: user.id,
          discount_amount: discountAmount,
        })
      if (redemptionError) {
        const [{ error: orderUpdateError }, { error: paymentUpdateError }] = await Promise.all([
          admin.from('orders')
            .update({ status: 'cancelled', payment_status: 'failed' })
            .eq('id', order.id),
          admin.from('payments')
            .update({ status: 'failed', failure_reason: 'COD coupon redemption failed.' })
            .eq('order_id', order.id),
        ])
        if (orderUpdateError) console.error('Could not cancel COD order after coupon redemption failed.')
        if (paymentUpdateError) console.error('Could not mark COD payment failed after coupon redemption failed.')
        throw redemptionError
      }
    }

    const { data: shipment, error: shipmentError } = await admin
      .from('shipments')
      .insert({
        order_id: order.id,
        provider: 'dtdc',
        courier_service: 'DTDC',
        status: 'pending',
        request_payload: {
          destination: shippingAddress,
          package: null,
        },
        response_payload: { booking_status: 'pending_configuration' },
      })
      .select('id')
      .single()
    if (shipmentError) {
      console.error('COD order was created, but its DTDC shipment record could not be created.')
    } else {
      await bookDtdcShipment(admin, shipment.id, {
        order_number: order.order_number,
        total_amount: totalAmount,
        shipping_address_snapshot: shippingAddress,
      }, true)
    }

    const { error: clearCartError } = await admin
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)
    if (clearCartError) console.error('COD order was created, but the bag could not be cleared.')

    return jsonResponse({
      success: true,
      orderId: order.id,
      cartCleared: !clearCartError,
      shipmentPending: !!shipmentError,
    })
  }

  if (!razorpayOrder) throw new Error('Razorpay order was not created.')
  return jsonResponse({
    orderId: order.id,
    razorpayOrderId: razorpayOrder.id,
    keyId: razorpayKeyId(),
    amount: amountInPaise,
    currency: 'INR',
  })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

async function verifyPayment(request: Request, body: Record<string, unknown>) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sign in to verify your payment.' }, 401)
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const anonKey = requiredEnv('SUPABASE_ANON_KEY')
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(
    authorization.slice('Bearer '.length),
  )
  if (authError || !user) return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401)

  const admin = createClient(
    supabaseUrl,
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  const razorpayOrderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : ''
  const razorpayPaymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : ''
  const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : ''
  const cartId = typeof body.cartId === 'string' ? body.cartId : ''
  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !signature || !cartId) {
    return jsonResponse({ error: 'Razorpay returned incomplete payment details.' }, 400)
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('id, order_id, provider_order_id, amount, currency, status, gateway_response')
    .eq('order_id', orderId)
    .eq('user_id', user.id)
    .eq('provider', 'razorpay')
    .maybeSingle()
  if (paymentError) throw paymentError
  if (!payment || payment.provider_order_id !== razorpayOrderId) {
    return jsonResponse({ error: 'The payment does not match this order.' }, 400)
  }
  if (payment.gateway_response?.cart_id !== cartId) {
    return jsonResponse({ error: 'The bag does not match this payment.' }, 400)
  }

  const { data: order, error: orderLookupError } = await admin
    .from('orders')
    .select('order_number, total_amount, coupon_id, discount_amount, shipping_address_snapshot')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()
  if (orderLookupError) throw orderLookupError

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(requiredEnv('RAZORPAY_KEY_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${razorpayOrderId}|${razorpayPaymentId}`),
  )
  const expectedSignature = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  if (!constantTimeEqual(expectedSignature, signature)) {
    return jsonResponse({ error: 'Razorpay payment signature verification failed.' }, 400)
  }

  const razorpayPaymentResponse = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
    { headers: { Authorization: razorpayAuthorization() } },
  )
  if (!razorpayPaymentResponse.ok) {
    console.error('Razorpay payment lookup failed:', await razorpayPaymentResponse.text())
    return jsonResponse({ error: 'Could not confirm payment status with Razorpay.' }, 502)
  }
  const razorpayPayment = await razorpayPaymentResponse.json()
  if (
    razorpayPayment.order_id !== razorpayOrderId ||
    Number(razorpayPayment.amount) !== Math.round(Number(payment.amount) * 100) ||
    razorpayPayment.currency !== payment.currency
  ) {
    return jsonResponse({ error: 'The Razorpay payment details do not match the order total.' }, 400)
  }

  let finalPayment = razorpayPayment
  if (razorpayPayment.status === 'authorized') {
    const captureResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: razorpayAuthorization(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(Number(payment.amount) * 100),
          currency: payment.currency,
        }),
      },
    )
    if (!captureResponse.ok) {
      console.error('Razorpay capture failed:', await captureResponse.text())
      return jsonResponse({ error: 'Payment was authorized but could not be captured. Contact support before retrying.' }, 502)
    }
    finalPayment = await captureResponse.json()
  }
  if (finalPayment.status !== 'captured') {
    return jsonResponse({ error: 'Razorpay has not captured this payment yet.' }, 409)
  }

  const { data: cart, error: cartError } = await admin
    .from('carts')
    .select('id, user_id, status')
    .eq('id', cartId)
    .maybeSingle()
  if (cartError) throw cartError
  if (!cart || cart.user_id !== user.id || cart.status !== 'active') {
    return jsonResponse({ error: 'Payment succeeded, but the bag could not be confirmed. Contact support with payment ID.' }, 409)
  }

  const paidAt = new Date().toISOString()
  const { error: updatePaymentError } = await admin
    .from('payments')
    .update({
      provider_payment_id: razorpayPaymentId,
      signature_verified: true,
      status: 'captured',
      payment_method: finalPayment.method ?? null,
      gateway_response: { cart_id: cartId, razorpay: finalPayment },
      paid_at: paidAt,
    })
    .eq('id', payment.id)
  if (updatePaymentError) throw updatePaymentError

  const { error: updateOrderError } = await admin
    .from('orders')
    .update({ status: 'confirmed', payment_status: 'paid', paid_at: paidAt })
    .eq('id', orderId)
    .eq('user_id', user.id)
  if (updateOrderError) throw updateOrderError

  if (order.coupon_id && Number(order.discount_amount) > 0) {
    const { data: redemption, error: redemptionLookupError } = await admin
      .from('coupon_redemptions')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle()
    if (redemptionLookupError) throw redemptionLookupError
    if (!redemption) {
      const { error: redemptionError } = await admin
        .from('coupon_redemptions')
        .insert({
          coupon_id: order.coupon_id,
          order_id: orderId,
          user_id: user.id,
          discount_amount: order.discount_amount,
        })
      if (redemptionError) throw redemptionError
    }
  }

  const { data: existingShipment, error: shipmentLookupError } = await admin
    .from('shipments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (shipmentLookupError) throw shipmentLookupError
  if (!existingShipment) {
    const { data: shipment, error: shipmentError } = await admin
      .from('shipments')
      .insert({
        order_id: orderId,
        provider: 'dtdc',
        courier_service: 'DTDC',
        status: 'pending',
        request_payload: {
          destination: order.shipping_address_snapshot,
          package: null,
        },
        response_payload: { booking_status: 'pending_configuration' },
      })
      .select('id')
      .single()
    if (shipmentError) throw shipmentError
    await bookDtdcShipment(admin, shipment.id, order)
  }

  const { error: clearCartError } = await admin
    .from('cart_items')
    .delete()
    .eq('cart_id', cartId)
  if (clearCartError) throw clearCartError

  return jsonResponse({ success: true, orderId })
}

async function trackShipment(request: Request, body: Record<string, unknown>) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sign in to view shipment tracking.' }, 401)
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const anonKey = requiredEnv('SUPABASE_ANON_KEY')
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(
    authorization.slice('Bearer '.length),
  )
  if (authError || !user) {
    return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401)
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  if (!orderId) return jsonResponse({ error: 'An order is required for tracking.' }, 400)

  const admin = createClient(
    supabaseUrl,
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (orderError) throw orderError
  if (!order) return jsonResponse({ error: 'This order could not be found.' }, 404)

  const { data: shipment, error: shipmentError } = await admin
    .from('shipments')
    .select('consignment_number, awb_number')
    .eq('order_id', orderId)
    .maybeSingle()
  if (shipmentError) throw shipmentError
  const referenceNumber = shipment?.consignment_number || shipment?.awb_number
  if (!referenceNumber) {
    return jsonResponse({ error: 'DTDC tracking is not available until this order has a consignment number.' }, 409)
  }

  const trackingUrl = new URL(
    'https://app.shipsy.in/api/customer/integration/consignment/trackto',
  )
  trackingUrl.searchParams.set('reference_number', referenceNumber)
  const response = await fetch(trackingUrl, {
    headers: { 'api-key': requiredEnv('DTDC_API_KEY') },
  })
  if (!response.ok) {
    console.error(`DTDC tracking request failed (HTTP ${response.status}).`)
    return jsonResponse({ error: 'Could not retrieve tracking from DTDC right now.' }, 502)
  }

  const tracking = await response.json() as Record<string, unknown>
  if (
    typeof tracking.status !== 'string' ||
    !Array.isArray(tracking.events)
  ) {
    console.error('DTDC tracking returned an unexpected response shape.')
    return jsonResponse({ error: 'DTDC returned an unexpected tracking response.' }, 502)
  }
  return jsonResponse(tracking)
}

async function getCustomerOrders(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sign in to view your orders.' }, 401)
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const authClient = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(
    authorization.slice('Bearer '.length),
  )
  if (authError || !user) {
    return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401)
  }

  const admin = createClient(
    supabaseUrl,
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (ordersError) throw ordersError
  if (!orders?.length) return jsonResponse([])

  const orderIds = orders.map((order) => order.id)
  const [{ data: items, error: itemsError }, { data: shipments, error: shipmentsError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      admin.from('order_items').select('*').in('order_id', orderIds),
      admin.from('shipments').select('*').in('order_id', orderIds),
      admin.from('payments')
        .select('order_id, provider, payment_method')
        .eq('user_id', user.id)
        .in('order_id', orderIds),
    ])
  if (itemsError) throw itemsError
  if (shipmentsError) throw shipmentsError
  if (paymentsError) throw paymentsError

  return jsonResponse(orders.map((order) => {
    const payment = payments?.find((row) => row.order_id === order.id)
    return {
      ...order,
      items: items?.filter((item) => item.order_id === order.id) ?? [],
      shipment: shipments?.find((row) => row.order_id === order.id) ?? null,
      paymentMethod: payment?.payment_method === 'cash_on_delivery'
        ? 'cod'
        : payment?.payment_method ?? null,
    }
  }))
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  try {
    const body = await request.json() as Record<string, unknown>
    if (body.action === 'create-order') return await createOrder(request, body, 'razorpay')
    if (body.action === 'create-cod-order') return await createOrder(request, body, 'cod')
    if (body.action === 'verify-payment') return await verifyPayment(request, body)
    if (body.action === 'track-shipment') return await trackShipment(request, body)
    if (body.action === 'get-customer-orders') return await getCustomerOrders(request)
    return jsonResponse({ error: 'Unsupported payment action.' }, 400)
  } catch (error) {
    console.error('Checkout processing error:', error)
    return jsonResponse({ error: 'Checkout processing failed. Please try again.' }, 500)
  }
})
