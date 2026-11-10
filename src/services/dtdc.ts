import { supabase } from '@/lib/supabase'

export interface DtdcTrackingEvent {
  type?: string
  event_time?: number
  hub_name?: string | null
  customer_update?: string | null
  failure_reason?: string | null
}

export interface DtdcTrackingResponse {
  reference_number: string
  status: string
  creation_date?: number
  events: DtdcTrackingEvent[]
}

export async function getDtdcTracking(orderId: string): Promise<DtdcTrackingResponse> {
  const { data, error } = await supabase.functions.invoke('razorpay', {
    body: { action: 'track-shipment', orderId },
  })

  if (error) throw error
  return data as DtdcTrackingResponse
}
