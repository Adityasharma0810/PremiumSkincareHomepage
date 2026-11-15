import { supabase } from '@/lib/supabase'

export interface ShiprocketTrackingEvent {
  type?: string
  event_time?: number
  hub_name?: string | null
  customer_update?: string | null
  failure_reason?: string | null
}

export interface ShiprocketTrackingResponse {
  reference_number: string
  status: string
  events: ShiprocketTrackingEvent[]
}

export async function getShiprocketTracking(orderId: string): Promise<ShiprocketTrackingResponse> {
  const { data, error } = await supabase.functions.invoke('razorpay', {
    body: { action: 'track-shipment', orderId },
  })

  if (error) throw error
  return data as ShiprocketTrackingResponse
}
