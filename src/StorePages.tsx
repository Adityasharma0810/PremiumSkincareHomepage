import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Bottle, Button, Icon, type UIProduct } from "./storefront"
import {
  getProducts,
  getCategories,
  getSkinConcerns,
} from "@/services/products"
import { useCart } from "@/store/cart-context"
import { useAuth } from "@/store/auth-context"
import { createAddress, getAddresses, getCouponByCode, getCustomerOrders } from "@/services/orders"
import { getDtdcTracking, type DtdcTrackingResponse } from "@/services/dtdc"
import { adaptCatalogProduct } from "@/lib/product-adapter"
import type { Address, Coupon, Order, OrderItem, Shipment } from "@/lib/types"
import type { CheckoutMethod, ShippingAddress } from "@/services/razorpay"

export type Route = "home" | "concerns" | "bag" | "orders" | "sign-in" | "sign-up"
export function readRoute(): Route {
  const path = window.location.hash.split("?")[0].replace(/^#\/?/, "")
  return ["concerns", "bag", "orders", "sign-in", "sign-up"].includes(path)
    ? path as Route
    : "home"
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`

function formatTrackingTime(timestamp?: number) {
  if (!timestamp) return null
  const milliseconds = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
  return new Date(milliseconds).toLocaleString("en-IN")
}

function formatShipmentTime(timestamp?: string | null) {
  if (!timestamp) return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("en-IN")
}

function latestTrackingEvent(events: DtdcTrackingResponse["events"]) {
  return events.reduce<(typeof events)[number] | null>((latest, event) => {
    if (!event.event_time) return latest
    return !latest || !latest.event_time || event.event_time > latest.event_time
      ? event
      : latest
  }, null)
}

function isDeliveredTrackingStatus(status?: string) {
  return status?.trim().toLowerCase().replace(/[\s-]+/g, "_") === "delivered"
}

type OrderTimelineStage = {
  label: string
  state: "complete" | "current" | "upcoming"
  time: string | null
}

function getOrderTimeline(order: CustomerOrder, tracking?: DtdcTrackingResponse): OrderTimelineStage[] {
  const stages = [
    { label: "Order placed", matches: /order.{0,8}(placed|confirmed)|created/ },
    { label: "Packed", matches: /pack(ed|ing)?|ready for dispatch/ },
    { label: "Picked up by courier", matches: /picked up|pickup|collected by courier|handed to courier/ },
    { label: "In transit", matches: /in.?transit|departed|arrived at|reached.*hub|line.?haul/ },
    { label: "Out for delivery", matches: /out for delivery|with delivery agent/ },
    { label: "Delivered", matches: /delivered|proof of delivery/ },
  ]
  const events = tracking?.events ?? []
  const statusText = `${order.status} ${order.shipment?.status ?? ""} ${tracking?.status ?? ""}`
    .toLowerCase()
    .replace(/[_-]+/g, " ")
  const eventTexts = events.map((event) =>
    `${event.customer_update ?? ""} ${event.type ?? ""}`.toLowerCase().replace(/[_-]+/g, " "),
  )
  let lastCompleteIndex = 0

  stages.slice(1).forEach((stage, index) => {
    const stageIndex = index + 1
    const matchedEvents = events.filter((_, eventIndex) => stage.matches.test(eventTexts[eventIndex]))
    if (stage.matches.test(statusText) || matchedEvents.length) {
      lastCompleteIndex = Math.max(lastCompleteIndex, stageIndex)
    }
  })

  const currentStatusIndex = statusText.includes("delivered")
    ? 5
    : statusText.includes("out for delivery")
      ? 4
      : /in transit/.test(statusText)
        ? 3
        : /picked up|collected/.test(statusText)
          ? 2
          : /packed/.test(statusText)
            ? 1
            : 0
  lastCompleteIndex = Math.max(lastCompleteIndex, currentStatusIndex)

  return stages.map((stage, index) => {
    const matchingEvent = events
      .filter((_, eventIndex) => stage.matches.test(eventTexts[eventIndex]) && events[eventIndex].event_time)
      .sort((a, b) => (b.event_time ?? 0) - (a.event_time ?? 0))[0]
    const shipmentTime = index === 0
      ? order.created_at
      : index === 2
        ? order.shipment?.picked_up_at
        : index === 5
          ? order.shipment?.delivered_at
          : null
    return {
      label: stage.label,
      state: index <= lastCompleteIndex
        ? "complete"
        : index === lastCompleteIndex + 1
          ? "current"
          : "upcoming",
      time: matchingEvent?.event_time
        ? formatTrackingTime(matchingEvent.event_time)
        : formatShipmentTime(shipmentTime),
    }
  })
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav className="page-breadcrumb" aria-label="Breadcrumb">
      <a href="#/">Home</a>
      <span>/</span>
      <span aria-current="page">{current}</span>
    </nav>
  )
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: ReactNode
  description: string
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

type CustomerOrder = Order & {
  items: OrderItem[]
  shipment: Shipment | null
  paymentMethod: string | null
}
type OrdersFilter = "all" | "to-receive" | "delivered" | "cod"

function isOrderDelivered(order: CustomerOrder) {
  return order.status === "delivered" || order.shipment?.status === "delivered"
}

export function OrdersPage({ userId }: { userId: string | null }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [filter, setFilter] = useState<OrdersFilter>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [trackingByOrder, setTrackingByOrder] = useState<Record<string, DtdcTrackingResponse>>({})
  const [trackingLoading, setTrackingLoading] = useState<Record<string, boolean>>({})
  const [trackingErrors, setTrackingErrors] = useState<Record<string, string>>({})
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})

  async function loadTracking(orderId: string) {
    setTrackingLoading((current) => ({ ...current, [orderId]: true }))
    setTrackingErrors((current) => ({ ...current, [orderId]: "" }))
    try {
      const tracking = await getDtdcTracking(orderId)
      setTrackingByOrder((current) => ({ ...current, [orderId]: tracking }))
    } catch (cause) {
      console.error("Could not load DTDC tracking", cause)
      setTrackingErrors((current) => ({
        ...current,
        [orderId]: cause instanceof Error ? cause.message : "Tracking is temporarily unavailable.",
      }))
    } finally {
      setTrackingLoading((current) => ({ ...current, [orderId]: false }))
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")

    if (!userId) {
      setOrders([])
      setLoading(false)
      return () => {
        active = false
      }
    }

    getCustomerOrders()
      .then((result) => {
        if (active) setOrders(result)
      })
      .catch((cause: unknown) => {
        console.error("Could not load customer orders", cause)
        if (active) {
          setError("We couldn’t load your orders. Please try again.")
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId, retry])

  const isCodOrder = (order: CustomerOrder) => order.paymentMethod === "cod"
  const isOrderComplete = (order: CustomerOrder) =>
    isOrderDelivered(order) || isDeliveredTrackingStatus(trackingByOrder[order.id]?.status)
  const deliveredOrders = orders.filter(isOrderComplete)
  const toReceiveOrders = orders.filter((order) =>
    !isOrderComplete(order) && (order.payment_status === "paid" || isCodOrder(order)),
  )
  const codOrders = orders.filter(isCodOrder)
  const visibleOrders = orders.filter((order) => {
    if (filter === "to-receive") return toReceiveOrders.includes(order)
    if (filter === "delivered") return deliveredOrders.includes(order)
    if (filter === "cod") return codOrders.includes(order)
    return true
  })

  return (
    <main className="store-page orders-page">
      <div className="section-shell">
        <Breadcrumb current="My orders" />
        <PageHeading
          eyebrow="YOUR DERMA AURA ORDER HISTORY"
          title={<>A little care, <em>on its way.</em></>}
          description="Follow your deliveries, see what has arrived, and check any cash-on-delivery orders."
        />
        {!userId ? (
          <section className="orders-empty">
            <span className="orders-empty-icon"><Icon name="bag" size={30} /></span>
            <h2>Sign in to see your orders.</h2>
            <p>Your order history will be waiting here when you sign in.</p>
            <a className="button" href="#/sign-in?next=orders">
              Sign in to your account <Icon name="arrow" size={17} />
            </a>
          </section>
        ) : loading ? (
          <p className="orders-message" role="status">Gathering your order details…</p>
        ) : error ? (
          <section className="orders-empty" role="alert">
            <h2>We couldn’t find your orders.</h2>
            <p>{error}</p>
            <button className="button" onClick={() => setRetry((value) => value + 1)}>
              Try again <Icon name="arrow" size={17} />
            </button>
          </section>
        ) : orders.length === 0 ? (
          <section className="orders-empty">
            <span className="orders-empty-icon"><Icon name="leaf" size={30} /></span>
            <h2>Your orders will appear here.</h2>
            <p>Paid orders and cash-on-delivery orders will show here once placed.</p>
            <a className="button" href="#/concerns">
              Explore skincare <Icon name="arrow" size={17} />
            </a>
          </section>
        ) : (
          <>
            <nav className="orders-filters" aria-label="Filter orders">
              {([
                ["all", "All orders", orders.length],
                ["to-receive", "To receive", toReceiveOrders.length],
                ["delivered", "Delivered", deliveredOrders.length],
                ["cod", "Cash on delivery", codOrders.length],
              ] as const).map(([value, label, total]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label} <span>{total}</span>
                </button>
              ))}
            </nav>
            {visibleOrders.length ? (
              <div className="orders-list">
                {visibleOrders.map((order) => {
                  const codOrder = isCodOrder(order)
                  const delivered = isOrderComplete(order)
                  const latestEvent = trackingByOrder[order.id]
                    ? latestTrackingEvent(trackingByOrder[order.id].events)
                    : null
                  const shipmentTime = order.shipment?.status === "delivered"
                    ? order.shipment.delivered_at || order.shipment.updated_at
                    : order.shipment?.updated_at ||
                      (order.shipment?.status === "picked_up" || order.shipment?.status === "in_transit" ||
                        order.shipment?.status === "out_for_delivery"
                        ? order.shipment.picked_up_at
                        : order.shipment?.booked_at)
                  const statusUpdatedAt = latestEvent?.event_time
                    ? formatTrackingTime(latestEvent.event_time)
                    : formatShipmentTime(shipmentTime)
                  const tracking = trackingByOrder[order.id]
                  const timeline = getOrderTimeline(order, tracking)
                  return (
                    <article className="paid-order-card" key={order.id}>
                      <header className="paid-order-header">
                        <div>
                          <span className="eyebrow">ORDER</span>
                          <h2>{order.order_number}</h2>
                          <p>
                            {order.payment_status === "paid" ? "Paid" : "Placed"}{" "}
                            {new Date(order.paid_at || order.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span className="paid-order-status">
                          <Icon name={delivered ? "check" : codOrder ? "bag" : "check"} size={15} />
                          {delivered
                            ? "Completed"
                            : codOrder
                              ? "Cash on delivery"
                              : order.payment_status === "paid"
                                ? "Paid · on its way"
                                : "Order confirmed"}
                        </span>
                      </header>
                      <ul className="paid-order-items">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            <span className="paid-order-item-icon"><Icon name="leaf" size={18} /></span>
                            <div className="paid-order-item-details">
                              <strong>{item.product_name}</strong>
                              {(item.variant_name || item.size_label) && (
                                <span>{item.variant_name || item.size_label}</span>
                              )}
                              <span>Qty {item.quantity} · {rupees(Number(item.unit_price))} each</span>
                            </div>
                            <strong className="paid-order-line-total">{rupees(Number(item.line_total))}</strong>
                          </li>
                        ))}
                      </ul>
                      <footer className="paid-order-footer">
                        <span>{order.items.length} {order.items.length === 1 ? "item" : "items"}</span>
                        <span>
                          {order.payment_status === "paid"
                            ? "Total paid"
                            : codOrder
                              ? "Due on delivery"
                              : "Payment pending"}
                          <strong>{rupees(Number(order.total_amount))}</strong>
                        </span>
                      </footer>
                      <section className="paid-order-shipment" aria-label="Shipment details">
                          <div className="paid-order-shipment-summary">
                            <div>
                              <span className="eyebrow">DELIVERY</span>
                              <strong>
                                {(tracking?.status || order.shipment?.status || "Preparing your order").replace(/_/g, " ")}
                              </strong>
                              {statusUpdatedAt && (
                                <span className="paid-order-status-time">
                                  Updated {statusUpdatedAt}
                                </span>
                              )}
                              {delivered && (
                                <span className="paid-order-completed">Completed</span>
                              )}
                              {codOrder && order.payment_status !== "paid" && (
                                <span>Pay {rupees(Number(order.total_amount))} in cash when delivered</span>
                              )}
                              {(order.shipment?.awb_number || order.shipment?.consignment_number) && (
                                <span>
                                  Tracking number: {order.shipment.awb_number || order.shipment.consignment_number}
                                </span>
                              )}
                              {order.shipment && (
                                <span>
                                  Delivery partner: {order.shipment.courier_service || order.shipment.provider}
                                </span>
                              )}
                            </div>
                            <button
                              className="paid-order-track-button"
                              type="button"
                              aria-expanded={!!expandedOrders[order.id]}
                              aria-controls={`order-timeline-${order.id}`}
                              onClick={() => {
                                const isOpening = !expandedOrders[order.id]
                                setExpandedOrders((current) => ({ ...current, [order.id]: isOpening }))
                                if (
                                  isOpening &&
                                  (order.shipment?.awb_number || order.shipment?.consignment_number) &&
                                  !trackingByOrder[order.id] &&
                                  !trackingLoading[order.id]
                                ) {
                                  void loadTracking(order.id)
                                }
                              }}
                            >
                              <Icon name={expandedOrders[order.id] ? "minus" : "plus"} size={14} />
                              {expandedOrders[order.id] ? "Hide timeline" : "View delivery timeline"}
                            </button>
                          </div>
                          {expandedOrders[order.id] && (
                            <div className="paid-order-tracking" id={`order-timeline-${order.id}`}>
                              <div className="paid-order-timeline-heading">
                                <strong>Order journey</strong>
                                {order.shipment && (order.shipment.awb_number || order.shipment.consignment_number) && (
                                  <button
                                    className="paid-order-refresh"
                                    type="button"
                                    disabled={trackingLoading[order.id]}
                                    onClick={() => void loadTracking(order.id)}
                                  >
                                    {trackingLoading[order.id] ? "Refreshing…" : "Refresh tracking"}
                                  </button>
                                )}
                              </div>
                              {trackingLoading[order.id] && <p role="status">Getting the latest courier updates…</p>}
                              {trackingErrors[order.id] && (
                                <p className="paid-order-tracking-error" role="alert">{trackingErrors[order.id]}</p>
                              )}
                              <ol className="paid-order-timeline">
                                {timeline.map((stage) => (
                                  <li className={`paid-order-timeline-step is-${stage.state}`} key={stage.label}>
                                    <span className="paid-order-timeline-marker" aria-hidden="true">
                                      {stage.state === "complete" ? <Icon name="check" size={11} /> : null}
                                    </span>
                                    <div>
                                      <strong>{stage.label}</strong>
                                      <span>{stage.state === "complete" ? "Completed" : stage.state === "current" ? "In progress" : "Upcoming"}</span>
                                      {stage.time && <time>{stage.time}</time>}
                                    </div>
                                  </li>
                                ))}
                              </ol>
                              {tracking?.events.length ? (
                                <div className="paid-order-tracking-updates">
                                  <strong>Courier updates</strong>
                                  {tracking.events.map((event, index) => (
                                    <div className="paid-order-tracking-event" key={`${event.event_time ?? index}-${index}`}>
                                      <span>{event.customer_update || event.type || "Shipment update"}</span>
                                      <small>
                                        {[event.hub_name, formatTrackingTime(event.event_time)]
                                          .filter(Boolean).join(" · ")}
                                      </small>
                                      {event.failure_reason && <small>{event.failure_reason}</small>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                !trackingLoading[order.id] && (
                                  <p className="paid-order-tracking-note">
                                    {order.shipment?.awb_number || order.shipment?.consignment_number
                                      ? "Courier updates will appear here as soon as they are available."
                                      : "Your order is being prepared. Courier and driver details will appear once a shipment is booked."}
                                  </p>
                                )
                              )}
                              {order.shipment && (
                                <p className="paid-order-driver-note">
                                  {order.shipment.courier_service || order.shipment.provider} is handling delivery.
                                  Driver details will show here if shared by the courier.
                                </p>
                              )}
                            </div>
                          )}
                        </section>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="orders-message">There are no orders in this section yet.</p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Concerns page                                                      */
/* ------------------------------------------------------------------ */
export function ConcernsPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [concernsList, setConcernsList] = useState<any[]>([])
  const [products, setProducts] = useState<UIProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProducts, setExpandedProducts] = useState<string[]>([])
  const [cartActionError, setCartActionError] = useState("")
  const { addToCart, loading: cartLoading } = useCart()

  const initialConcern = () =>
    new URLSearchParams(window.location.hash.split("?")[1]).get("concern") || ""
  const [selected, setSelected] = useState<string[]>(() =>
    concernsList.some((c) => c.id === initialConcern()) ? [initialConcern()] : [],
  )
  const [skin, setSkin] = useState("all")
  const [category, setCategory] = useState("all")
  const [price, setPrice] = useState("all")
  const [sort, setSort] = useState("featured")
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [cats, cons, allProducts] = await Promise.all([
          getCategories(),
          getSkinConcerns(),
          getProducts(),
        ])
        if (!mounted) return
        setCategories(cats)
        setConcernsList(cons)
        setProducts(allProducts.map(adaptCatalogProduct))
      } catch (err) {
        console.error("Failed to load catalog", err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      const value = initialConcern()
      setSelected(
        concernsList.some((c) => c.id === value) ? [value] : [],
      )
    }
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [concernsList])

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((v) => v !== id) : [...s, id],
    )
  }
  function clear() {
    setSelected([])
    setSkin("all")
    setCategory("all")
    setPrice("all")
  }
  const activeCount =
    selected.length +
    Number(skin !== "all") +
    Number(category !== "all") +
    Number(price !== "all")

  // Build a filterable view from the Supabase-adapted products. The adapted
  // UIProduct carries `kind` (serum/jar/pump/tube) and `price`, so category
  // and price filters work server-relevant fields; concern shortcuts toggle
  // visual state (the product↔concern join lives in product_concerns).
  const results = products.filter((p) => {
    const categoryMatch = category === "all" || p.kind === category
    const priceMatch =
      price === "all" ||
      (price === "under500"
        ? p.price < 500
        : price === "500to700"
          ? p.price >= 500 && p.price <= 700
          : p.price > 700)
    return categoryMatch && priceMatch
  }).sort((a, b) => {
    if (sort === "low") return a.price - b.price
    if (sort === "high") return b.price - a.price
    return 0
  })

  if (loading) {
    return (
      <main className="store-page concerns-page">
        <div className="section-shell">
          <Breadcrumb current="Shop by concern" />
          <PageHeading
            eyebrow="YOUR SKIN. YOUR KIND OF CARE."
            title="Loading…"
            description="Please wait while we load your essentials."
          />
        </div>
      </main>
    )
  }

  return (
    <main className="store-page concerns-page">
      <div className="section-shell">
        <Breadcrumb current="Shop by concern" />
        <PageHeading
          eyebrow="YOUR SKIN. YOUR KIND OF CARE."
          title={
            <>
              A little care for <em>every concern.</em>
            </>
          }
          description="Listen to your skin. Find thoughtfully paired essentials for what it needs today."
        />
        <div className="concern-shortcuts" aria-label="Choose a skin concern">
          {concernsList.map((c: any) => {
            const pressed = selected.includes(c.id)
            return (
              <button
                key={c.id}
                className={pressed ? "concern-shortcut selected" : "concern-shortcut"}
                aria-pressed={pressed}
                onClick={() => toggle(c.id)}
              >
                <span className="concern-symbol">
                  <Icon name={(c as any).icon ?? "leaf"} size={23} />
                </span>
                <strong>{c.name}</strong>
                <small>{(c as any).short_description ?? ""}</small>
              </button>
            )
          })}
        </div>
        <div className="catalog-layout">
          <aside
            className={`catalog-filters ${filtersOpen ? "filters-open" : ""}`}
            id="catalog-filters"
          >
            <div className="filter-title">
              <h2>A little more specific</h2>
              <button onClick={clear} disabled={!activeCount}>
                Reset
              </button>
            </div>
            <fieldset>
              <legend>Skin concern</legend>
              <p>Choose one or more</p>
              {concernsList.map((c: any) => (
                <label className="filter-option" key={c.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Skin type</legend>
              <label className="sr-only" htmlFor="skin-type">
                Skin type
              </label>
              <select
                id="skin-type"
                value={skin}
                onChange={(e) => setSkin(e.target.value)}
              >
                <option value="all">All skin types</option>
                {["Dry", "Oily", "Combination", "Normal", "Sensitive"].map(
                  (s) => (
                    <option key={s} value={s.toLowerCase()}>
                      {s}
                    </option>
                  ),
                )}
              </select>
            </fieldset>
            <fieldset>
              <legend>Product type</legend>
              {[
                ["all", "All essentials"],
                ["serum", "Serums"],
                ["jar", "Moisturisers"],
                ["pump", "Cleansers"],
                ["tube", "Sunscreens"],
              ].map(([id, label]) => (
                <label className="filter-option" key={id}>
                  <input
                    type="radio"
                    name="category"
                    value={id}
                    checked={category === id}
                    onChange={() => setCategory(id)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>A little within budget</legend>
              <label className="sr-only" htmlFor="price-range">
                Price range
              </label>
              <select
                id="price-range"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              >
                <option value="all">All prices</option>
                <option value="under500">Under ₹500</option>
                <option value="500to700">₹500 – ₹700</option>
                <option value="over700">Above ₹700</option>
              </select>
            </fieldset>
            <div className="filter-care-note">
              <Icon name="leaf" size={19} />
              <p>
                Every skin story is different. Always patch test a new product.
              </p>
            </div>
          </aside>
          <section
            className="catalog-results"
            aria-label="Recommended skincare"
          >
            <div className="catalog-toolbar">
              <div>
                <h2>
                  {selected.length === 1
                    ? concernsList.find((c: any) => c.id === selected[0])?.name
                    : "Your everyday essentials"}
                </h2>
                <p aria-live="polite">
                  {results.length}{" "}
                  {results.length === 1 ? "essential" : "essentials"} for your
                  skin{" "}
                  {selected.length > 1 && "· matching any selected concern"}
                </p>
              </div>
              <div className="catalog-tools">
                <button
                  className="filter-toggle"
                  aria-expanded={filtersOpen}
                  aria-controls="catalog-filters"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <Icon name="menu" size={17} /> Filters{" "}
                  {activeCount > 0 && `(${activeCount})`}
                </button>
                <label className="sort-control">
                  Sort by
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sort products"
                  >
                    <option value="featured">Recommended</option>
                    <option value="low">Price: low to high</option>
                    <option value="high">Price: high to low</option>
                  </select>
                </label>
              </div>
            </div>
            {activeCount > 0 && (
              <div className="active-filters">
                {selected.map((id) => (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${concernsList.find((c: any) => c.id === id)?.name} filter`}
                  >
                    {concernsList.find((c: any) => c.id === id)?.name}
                    <Icon name="close" size={12} />
                  </button>
                ))}
                {skin !== "all" && (
                  <button onClick={() => setSkin("all")}>
                    {skin} skin
                    <Icon name="close" size={12} />
                  </button>
                )}
                {category !== "all" && (
                  <button onClick={() => setCategory("all")}>
                    Product type
                    <Icon name="close" size={12} />
                  </button>
                )}
                {price !== "all" && (
                  <button onClick={() => setPrice("all")}>
                    Price range
                    <Icon name="close" size={12} />
                  </button>
                )}
                <button className="clear-filters" onClick={clear}>
                  Clear all
                </button>
              </div>
            )}
            {results.length ? (
              <div className="catalog-grid">
                {results.map((p) => {
                  const expanded = expandedProducts.includes(p.id)
                  const category = p.type.length <= 30 ? p.type : null
                  const description =
                    p.shortDescription ?? (p.type.length > 30 ? p.type : null)

                  return (
                  <article
                    className={`product-card${expanded ? " is-expanded" : ""}`}
                    key={p.id}
                  >
                    <div className={`product-art art-${p.color}`}>
                      {p.badge && (
                        <span className={`badge ${p.badge === "New" ? "sage-badge" : ""}`}>
                          {p.badge}
                        </span>
                      )}
                      {p.imageUrl ? (
                        <img className="product-photo" src={p.imageUrl} alt={p.name} />
                      ) : (
                        <Bottle
                          color={p.color}
                          kind={p.kind}
                          label={p.name.split(" ").slice(0, 2).join(" ")}
                        />
                      )}
                    </div>
                    <div className="product-details product-card-details">
                      {category && (
                        <span className="eyebrow product-category">{category}</span>
                      )}
                      <h3>{p.name}</h3>
                      {description && (
                        <>
                          <button
                            type="button"
                            className="description-toggle"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedProducts((current) =>
                                expanded
                                  ? current.filter((id) => id !== p.id)
                                  : [...current, p.id],
                              )
                            }
                          >
                            {expanded ? "Hide description" : "View description"}
                          </button>
                          {expanded && (
                            <p className="product-card-description">{description}</p>
                          )}
                        </>
                      )}
                      <div className="product-card-price">
                        <span className="product-price">₹{p.price}</span>
                        {p.old != null && p.old > p.price && (
                          <>
                            <del>₹{p.old}</del>
                            <strong>{Math.round(((p.old - p.price) / p.old) * 100)}% OFF</strong>
                          </>
                        )}
                      </div>
                      <div className="product-card-actions">
                        <button
                          className="add-button"
                            disabled={cartLoading}
                            onClick={async () => {
                              setCartActionError("")
                              if (!p.variantId) {
                                setCartActionError(`${p.name} is not available right now.`)
                                return
                              }
                              try {
                                await addToCart(p.variantId, 1)
                              } catch (error) {
                                console.error("Could not add product to bag", error)
                                setCartActionError(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not add this item to your bag. Please try again.",
                                )
                              }
                            }}
                          >
                            {!p.variantId
                              ? "Unavailable"
                              : cartLoading
                                ? "Please wait…"
                                : "Add to cart"}
                          </button>
                        </div>
                      </div>
                  </article>
                  )
                })}
              </div>
            ) : (
              <div className="catalog-empty">
                <Icon name="leaf" size={40} />
                <h2>A fresh start for your filters.</h2>
                <p>
                  We couldn’t find a match for this combination. Try a different
                  concern or clear your filters.
                </p>
                <Button onClick={clear}>Explore all essentials</Button>
              </div>
            )}
            {cartActionError && (
              <p className="form-error" role="alert">{cartActionError}</p>
            )}
            <div className="catalog-note">
              <Icon name="shield" size={19} />
              <p>
                Thoughtful skincare, not a diagnosis. These concept
                recommendations are illustrative. For persistent skin concerns,
                consult a dermatologist.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Bag page                                                           */
/* ------------------------------------------------------------------ */
type CartItemUI = {
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
}

type BagProps = {
  count: number
  user: { id: string; email: string | null; full_name: string | null } | null
  onCheckout: (address?: ShippingAddress, paymentMethod?: CheckoutMethod) => void
  coupon: Coupon | null
  setCoupon: (value: Coupon | null) => void
  checkoutLoading: boolean
  summary: { itemCount: number; subtotal: number; items: CartItemUI[] } | null
  setQuantity: (itemId: string, quantity: number) => void
  removeItem: (itemId: string) => void
}

export function BagPage({
  count,
  user,
  onCheckout,
  coupon,
  setCoupon,
  checkoutLoading,
  summary,
  setQuantity,
  removeItem,
}: BagProps) {
  const [code, setCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const [deliveryStep, setDeliveryStep] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<CheckoutMethod>("razorpay")
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState("")
  const [saveAddress, setSaveAddress] = useState(false)
  const [addressError, setAddressError] = useState("")
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    recipientName: user?.full_name ?? "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  })

  useEffect(() => {
    let active = true
    if (!user) {
      setSavedAddresses([])
      setSelectedAddressId("")
      return () => {
        active = false
      }
    }

    setAddressesLoading(true)
    setAddressError("")
    getAddresses(user.id)
      .then((addresses) => {
        if (!active) return
        setSavedAddresses(addresses)
        const preferred = addresses.find((address) => address.is_default) ?? addresses[0]
        if (preferred) {
          setSelectedAddressId(preferred.id)
          setShippingAddress({
            recipientName: preferred.recipient_name,
            phone: preferred.phone,
            addressLine1: preferred.address_line1,
            addressLine2: preferred.address_line2 ?? "",
            landmark: preferred.landmark ?? "",
            city: preferred.city,
            state: preferred.state,
            pincode: preferred.pincode,
            country: preferred.country || "India",
          })
        } else {
          setShippingAddress((current) => ({ ...current, recipientName: user.full_name ?? current.recipientName }))
        }
      })
      .catch((cause: unknown) => {
        console.error("Could not load saved delivery addresses", cause)
        if (active) setAddressError("Saved addresses could not be loaded. You can still enter an address manually.")
      })
      .finally(() => {
        if (active) setAddressesLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.id, user?.full_name])

  const items = summary?.items ?? []
  const subtotal = summary?.subtotal ?? 0
  const discount = coupon && subtotal >= Number(coupon.minimum_order_value || 0)
    ? Math.round(Math.min(
        coupon.discount_type.includes("percent")
          ? subtotal * Number(coupon.discount_value) / 100
          : Number(coupon.discount_value),
        coupon.maximum_discount == null
          ? Number.POSITIVE_INFINITY
          : Number(coupon.maximum_discount),
        subtotal,
      ))
    : 0
  const shipping = 0
  const savings =
    items.reduce((sum, i) => sum + (i.unitPrice - 0) * i.quantity, 0) + discount

  function updateShippingAddress<K extends keyof ShippingAddress>(field: K, value: ShippingAddress[K]) {
    setSelectedAddressId("")
    setShippingAddress((current) => ({ ...current, [field]: value }))
  }

  async function applyCoupon() {
    if (!code.trim()) return
    try {
      const c = await getCouponByCode(code)
      if (!c) {
        setCouponError("That code isn’t quite right. Try GLOW10.")
        return
      }
      if (subtotal < Number(c.minimum_order_value || 0)) {
        setCouponError(`This code requires a minimum order of ${rupees(Number(c.minimum_order_value))}.`)
        return
      }
      setCoupon(c)
      setCouponError("")
    } catch {
      setCouponError("That code isn’t quite right. Try GLOW10.")
    }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddressError("")
    if (saveAddress && user) {
      const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase()
      const existingAddress = savedAddresses.find((address) =>
        normalize(address.recipient_name) === normalize(shippingAddress.recipientName) &&
        normalize(address.phone) === normalize(shippingAddress.phone) &&
        normalize(address.address_line1) === normalize(shippingAddress.addressLine1) &&
        normalize(address.address_line2) === normalize(shippingAddress.addressLine2) &&
        normalize(address.landmark) === normalize(shippingAddress.landmark) &&
        normalize(address.city) === normalize(shippingAddress.city) &&
        normalize(address.state) === normalize(shippingAddress.state) &&
        normalize(address.pincode) === normalize(shippingAddress.pincode) &&
        normalize(address.country) === normalize(shippingAddress.country),
      )

      if (!existingAddress) {
        try {
          const createdAddress = await createAddress({
            user_id: user.id,
            recipient_name: shippingAddress.recipientName.trim(),
            phone: shippingAddress.phone.trim(),
            address_line1: shippingAddress.addressLine1.trim(),
            address_line2: shippingAddress.addressLine2.trim() || null,
            landmark: shippingAddress.landmark.trim() || null,
            city: shippingAddress.city.trim(),
            state: shippingAddress.state.trim(),
            pincode: shippingAddress.pincode.trim(),
            country: shippingAddress.country.trim() || "India",
            address_type: "home",
            is_default: false,
          })
          setSavedAddresses((current) => [createdAddress, ...current])
          setSelectedAddressId(createdAddress.id)
        } catch (cause) {
          console.error("Could not save delivery address", cause)
          setAddressError("We couldn’t save this address. Please try again or uncheck “Save this address for next time” to continue.")
          return
        }
      } else {
        setSelectedAddressId(existingAddress.id)
      }
    }
    onCheckout(shippingAddress, paymentMethod)
  }

  return (
    <main className="store-page bag-page">
      <div className="section-shell">
        <Breadcrumb current="Your bag" />
        <PageHeading
          eyebrow="YOUR NEXT GOOD SKIN DAY"
          title={
            <>
              A little bag of <em>good things.</em>
            </>
          }
          description="Your everyday care, one step closer. Let’s make room for a little glow."
        />
        <div className="shopping-steps">
          <span className="active">
            <b>01</b> Your bag
          </span>
          <i />
          <span className={user ? "active" : ""}>
            <b>02</b> {user ? "Signed in" : "Sign in"}
          </span>
          <i />
          <span>
            <b>03</b> Checkout
          </span>
        </div>
        {!count ? (
          <section className="bag-empty">
            <span className="empty-bag-icon">
              <Icon name="bag" size={47} />
            </span>
            <h2>Good things are waiting for you.</h2>
            <p>
              Your bag is a little empty. Discover skincare that feels like you.
            </p>
            <a href="#/concerns" className="button">
              Find your everyday essentials
              <Icon name="arrow" size={17} />
            </a>
            <span className="empty-bag-note">
              Thoughtfully made. Honestly effective.
            </span>
          </section>
        ) : (
          <div className="bag-layout">
            <section className="bag-products" aria-label="Bag items">
              <div className="bag-list-title">
                <h2>
                  Your essentials <span>({count})</span>
                </h2>
                <a href="#/concerns">
                  Keep exploring
                  <Icon name="arrow" size={15} />
                </a>
              </div>
              <div className="bag-shipping">
                <Icon name="check" size={17} />
                "A little care, on us. Shipping is complimentary on every order."
              </div>
              {items.map((p) => (
                <article className="bag-line" key={p.id}>
                  <div className={`bag-product-art art-amber`}>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.productName}
                        className="bag-thumb-img"
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                      />
                    ) : (
                      <Bottle
                        color="amber"
                        kind="serum"
                        label={p.productName.split(" ").slice(0, 2).join(" ")}
                      />
                    )}
                  </div>
                  <div className="bag-line-details">
                    <span className="eyebrow">{p.sizeLabel ?? "Essentials"}</span>
                    <h3>{p.productName}</h3>
                    <p>
                      {p.variantName ?? "30 ml"} · Everyday skin essentials
                    </p>
                    <div className="bag-line-controls">
                      <div className="quantity">
                        <button
                          aria-label={`Remove one ${p.productName}`}
                          onClick={() => setQuantity(p.id, p.quantity - 1)}
                        >
                          <Icon name="minus" size={14} />
                        </button>
                        <span aria-label={`Quantity ${p.quantity}`}>
                          {p.quantity}
                        </span>
                        <button
                          aria-label={`Add one ${p.productName}`}
                          onClick={() => setQuantity(p.id, p.quantity + 1)}
                        >
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      <button
                        className="remove-item"
                        onClick={() => removeItem(p.id)}
                        aria-label={`Remove ${p.productName} from bag`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="bag-line-price">
                    <strong>{rupees(p.lineTotal)}</strong>
                    <del>{rupees(p.unitPrice * p.quantity)}</del>
                    {p.quantity > 1 && <small>{rupees(p.unitPrice)} each</small>}
                  </div>
                </article>
              ))}
              <div className="bag-reassurance">
                <span>
                  <Icon name="leaf" size={17} /> Thoughtful ingredients
                </span>
                <span>
                  <Icon name="shield" size={17} /> Made with care
                </span>
                <span>
                  <Icon name="drop" size={17} /> Everyday essentials
                </span>
              </div>
            </section>
            <aside className="order-summary">
              <span className="eyebrow">A LITTLE CLOSER TO YOUR GLOW</span>
              <h2>The lovely details.</h2>
              <dl>
                <div>
                  <dt>
                    Subtotal ({count} {count === 1 ? "item" : "items"})
                  </dt>
                  <dd>{rupees(subtotal)}</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd className={shipping ? "" : "summary-free"}>
                    {shipping ? rupees(shipping) : "On us"}
                  </dd>
                </div>
                {coupon && (
                  <div className="summary-discount">
                    <dt>{coupon.code} · discount</dt>
                    <dd>−{rupees(discount)}</dd>
                  </div>
                )}
              </dl>
              <div className="coupon-area">
                {coupon ? (
                  <div className="coupon-applied">
                    <span>
                      <Icon name="check" size={15} /> {coupon.code} applied
                    </span>
                    <button
                      onClick={() => {
                        setCoupon(null)
                        setCode("")
                        setCouponError("")
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      applyCoupon()
                    }}
                  >
                    <label htmlFor="promo-code">
                      A little treat? Add a promo code.
                    </label>
                    <div className="promo-input">
                      <input
                        id="promo-code"
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value)
                          setCouponError("")
                        }}
                        placeholder="Try GLOW10"
                        aria-describedby={
                          couponError ? "coupon-error" : undefined
                        }
                        aria-invalid={!!couponError}
                      />
                      <button type="submit">Apply</button>
                    </div>
                    {couponError && (
                      <p className="form-error" id="coupon-error" role="alert">
                        {couponError}
                      </p>
                    )}
                  </form>
                )}
              </div>
              <div className="summary-total">
                <span>Total</span>
                <strong>{rupees(subtotal + shipping - discount)}</strong>
              </div>
              <p className="summary-tax">Inclusive of all taxes.</p>
              <p className="summary-savings">
                A little win. You’re saving {rupees(savings)} today.
              </p>
              {user ? (
                <div className="checkout-auth-note">
                  <Icon name="check" size={16} />
                  <span>
                    Continuing as {user.full_name ?? user.email}
                    <small>Signed in via Supabase</small>
                  </span>
                </div>
              ) : (
                <p className="checkout-auth-note">
                  <Icon name="user" size={18} />
                  <span>
                    A little hello before you go.
                    <small>Sign in or create an account to continue.</small>
                  </span>
                </p>
              )}
              {user && deliveryStep && (
                <form
                  className="checkout-address-form"
                  onSubmit={submitCheckout}
                >
                  <h3>Delivery address</h3>
                  {savedAddresses.length > 0 && (
                    <label className="checkout-saved-address-field">
                      Use a saved address
                      <select
                        value={selectedAddressId}
                        onChange={(event) => {
                          const addressId = event.target.value
                          setSelectedAddressId(addressId)
                          const address = savedAddresses.find((saved) => saved.id === addressId)
                          if (address) {
                            setShippingAddress({
                              recipientName: address.recipient_name,
                              phone: address.phone,
                              addressLine1: address.address_line1,
                              addressLine2: address.address_line2 ?? "",
                              landmark: address.landmark ?? "",
                              city: address.city,
                              state: address.state,
                              pincode: address.pincode,
                              country: address.country || "India",
                            })
                          } else if (!addressId) {
                            setShippingAddress({
                              recipientName: user?.full_name ?? "",
                              phone: "",
                              addressLine1: "",
                              addressLine2: "",
                              landmark: "",
                              city: "",
                              state: "",
                              pincode: "",
                              country: "India",
                            })
                          }
                        }}
                      >
                        <option value="">Enter a new address</option>
                        {savedAddresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.recipient_name} · {address.address_line1}, {address.city}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {addressesLoading && <p className="checkout-address-note" role="status">Loading your saved addresses…</p>}
                  {addressError && <p className="checkout-address-error" role="alert">{addressError}</p>}
                  <label>
                    Full name
                    <input
                      autoComplete="name"
                      value={shippingAddress.recipientName}
                      onChange={(event) => updateShippingAddress("recipientName", event.target.value)}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Mobile number
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      pattern="[0-9+\(\) \-]{10,18}"
                      value={shippingAddress.phone}
                      onChange={(event) => updateShippingAddress("phone", event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Address line 1
                    <input
                      autoComplete="address-line1"
                      value={shippingAddress.addressLine1}
                      onChange={(event) => updateShippingAddress("addressLine1", event.target.value)}
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Address line 2
                    <input
                      autoComplete="address-line2"
                      value={shippingAddress.addressLine2}
                      onChange={(event) => updateShippingAddress("addressLine2", event.target.value)}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Landmark (optional)
                    <input
                      value={shippingAddress.landmark}
                      onChange={(event) => updateShippingAddress("landmark", event.target.value)}
                      maxLength={120}
                    />
                  </label>
                  <div className="checkout-address-row">
                    <label>
                      City
                      <input
                        autoComplete="address-level2"
                        value={shippingAddress.city}
                        onChange={(event) => updateShippingAddress("city", event.target.value)}
                        required
                        maxLength={100}
                      />
                    </label>
                    <label>
                      State
                      <input
                        autoComplete="address-level1"
                        value={shippingAddress.state}
                        onChange={(event) => updateShippingAddress("state", event.target.value)}
                        required
                        maxLength={100}
                      />
                    </label>
                  </div>
                  <label>
                    PIN code
                    <input
                      autoComplete="postal-code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      value={shippingAddress.pincode}
                      onChange={(event) => updateShippingAddress("pincode", event.target.value)}
                      required
                    />
                  </label>
                  <label className="checkout-save-address">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(event) => setSaveAddress(event.target.checked)}
                    />
                    <span>Save this address for next time</span>
                  </label>
                  <fieldset className="checkout-payment-method">
                    <legend>How would you like to pay?</legend>
                    <label className={paymentMethod === "razorpay" ? "selected" : ""}>
                      <input
                        type="radio"
                        name="checkout-payment-method"
                        value="razorpay"
                        checked={paymentMethod === "razorpay"}
                        onChange={() => setPaymentMethod("razorpay")}
                      />
                      <span>
                        <strong>Pay online</strong>
                        <small>UPI, card, or net banking</small>
                      </span>
                    </label>
                    <label className={paymentMethod === "cod" ? "selected" : ""}>
                      <input
                        type="radio"
                        name="checkout-payment-method"
                        value="cod"
                        checked={paymentMethod === "cod"}
                        onChange={() => setPaymentMethod("cod")}
                      />
                      <span>
                        <strong>Cash on delivery</strong>
                        <small>Pay {rupees(subtotal + shipping - discount)} in cash when your order arrives</small>
                      </span>
                    </label>
                  </fieldset>
                  <button className="button" type="submit" disabled={checkoutLoading}>
                    {checkoutLoading
                      ? paymentMethod === "cod" ? "Placing your COD order…" : "Opening secure checkout…"
                      : paymentMethod === "cod"
                        ? `Place COD order · ${rupees(subtotal + shipping - discount)}`
                        : "Pay securely with Razorpay"}
                  </button>
                </form>
              )}
              {(!user || !deliveryStep) && (
                <button
                  className="button"
                  onClick={() => user ? setDeliveryStep(true) : onCheckout()}
                  disabled={checkoutLoading}
                >
                  {user ? "Continue to delivery" : "Sign in to checkout"}
                </button>
              )}
              <a className="signup-checkout" href="#/sign-up?next=bag">
                {user ? "" : "New here? Create an account"}
              </a>
              <p className="checkout-demo-note">
                {paymentMethod === "cod"
                  ? "Pay the delivery partner in cash when your order arrives."
                  : "Secure payments powered by Razorpay."}
              </p>
              {paymentMethod === "razorpay" && <div className="summary-payment">
                <span>UPI</span>
                <span>VISA</span>
                <span>Mastercard</span>
                <span>Net Banking</span>
              </div>}
            </aside>
          </div>
        )}
        <div className="bag-bottom-note">
          <Icon name="leaf" size={20} />
          <p>
            Less noise. More nourishment. <span>Skincare, with soul.</span>
          </p>
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Auth page                                                          */
/* ------------------------------------------------------------------ */
export function AuthPage({
  mode,
  user,
  onComplete,
  onSignOut,
}: {
  mode: "sign-in" | "sign-up"
  user: { id: string; email: string | null; full_name: string | null } | null
  onComplete: (
    email: string,
    password: string,
    fullName?: string,
  ) => void | Promise<void>
  onSignOut: () => void
}) {
  const signup = mode === "sign-up"
  const nextBag =
    new URLSearchParams(window.location.hash.split("?")[1]).get("next") ===
    "bag"
  const nextOrders =
    new URLSearchParams(window.location.hash.split("?")[1]).get("next") ===
    "orders"
  const nextQuery = nextBag ? "?next=bag" : nextOrders ? "?next=orders" : ""
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState("")
  const [forgot, setForgot] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  return (
    <main className="store-page auth-page">
      <div className="section-shell">
        <Breadcrumb current={signup ? "Create an account" : "Sign in"} />
        <div className="auth-layout">
          <aside className="auth-story">
            <span className="eyebrow">
              A LITTLE CARE. A BEAUTIFUL BEGINNING.
            </span>
            <h2>
              Your skin journey,
              <br />
              <em>a little more you.</em>
            </h2>
            <p>
              Simple rituals. Thoughtful ingredients.
              <br />A little everyday luxury, just for you.
            </p>
            <div className="auth-product-scene">
              <div className="auth-orbit" />
              <div className="auth-bottle-one">
                <Bottle label="Vitamin C" />
              </div>
              <div className="auth-bottle-two">
                <Bottle color="sage" kind="jar" label="Barrier Repair" />
              </div>
              <span className="auth-scene-caption">
                Good chemistry.
                <br />
                <em>Even better skin.</em>
              </span>
            </div>
            <div className="auth-story-foot">
              <Icon name="leaf" size={17} />
              <span>Made for your skin. And your everyday.</span>
            </div>
          </aside>
          <section className="auth-form-panel">
            {user ? (
              <div className="account-welcome">
                <span className="auth-welcome-icon">
                  <Icon name="user" size={28} />
                </span>
                <span className="eyebrow">YOUR DERMA AURA CORNER</span>
                <h1 tabIndex={-1}>
                  Hello, <em>{user.full_name ?? "there"}.</em>
                </h1>
                <p>
                  You’re signed in as <strong>{user.email}</strong>.
                  Your bag is right where you left it.
                </p>
                <div className="auth-demo-banner">
                  <Icon name="shield" size={18} />
                  <p>
                    Your account is managed by Supabase Auth. Your profile lives
                    in the profiles table.
                  </p>
                </div>
                <a className="button" href="#/bag">
                  Back to your bag
                  <Icon name="arrow" size={17} />
                </a>
                <a className="orders-account-link" href="#/orders">
                  View my orders <Icon name="arrow" size={15} />
                </a>
                <Button outline onClick={onSignOut}>
                  Sign out
                </Button>
              </div>
            ) : (
              <>
                <div className="auth-tabs" aria-label="Account pages">
                  <a
                    href={`#/sign-in${nextQuery}`}
                    aria-current={!signup ? "page" : undefined}
                  >
                    Sign in
                  </a>
                  <a
                    href={`#/sign-up${nextQuery}`}
                    aria-current={signup ? "page" : undefined}
                  >
                    Create an account
                  </a>
                </div>
                <span className="eyebrow">
                  {signup
                    ? "YOUR GLOW STORY STARTS HERE"
                    : "GOOD TO SEE YOU AGAIN"}
                </span>
                <h1 tabIndex={-1}>
                  {signup ? (
                    <>
                      A little hello.
                      <br />
                      <em>A lot of good things.</em>
                    </>
                  ) : (
                    <>
                      Welcome back,
                      <br />
                      <em>glow-getter.</em>
                    </>
                  )}
                </h1>
                <p className="auth-description">
                  {nextBag
                    ? "Your bag is waiting. Sign in or join us to continue to checkout."
                    : nextOrders
                      ? "Sign in or create an account to see your orders."
                    : signup
                      ? "Make yourself at home. A simpler skincare ritual starts with you."
                      : "A moment for you, and the skin you’re in."}
                </p>
                <form
                  className="auth-form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setError("")
                    setSubmitting(true)
                    try {
                      if (signup && name.trim().length < 2) {
                        setError(
                          "Please enter your name (at least 2 characters).",
                        )
                        return
                      }
                      if (signup && password !== confirm) {
                        setError("Your passwords don’t match. Please try again.")
                        return
                      }
                      await onComplete(email.trim(), password, signup ? name.trim() : undefined)
                    } catch (err: any) {
                      setError(err?.message || "Sign in failed. Please try again.")
                    } finally {
                      setSubmitting(false)
                    }
                  }}
                >
                  {signup && (
                    <div className="form-field">
                      <label htmlFor="auth-name">Your name</label>
                      <input
                        id="auth-name"
                        autoComplete="name"
                        placeholder="What should we call you?"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        minLength={2}
                        maxLength={80}
                        required
                      />
                    </div>
                  )}
                  <div className="form-field">
                    <label htmlFor="auth-email">Email address</label>
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="auth-password">
                      {signup ? "Create a password" : "Password"}
                    </label>
                    <div className="password-input">
                      <input
                        id="auth-password"
                        type={visible ? "text" : "password"}
                        autoComplete={
                          signup ? "new-password" : "current-password"
                        }
                        placeholder={
                          signup
                            ? "At least 8 characters"
                            : "Enter your password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                        aria-describedby="password-hint"
                      />
                      <button
                        type="button"
                        onClick={() => setVisible(!visible)}
                        aria-label={visible ? "Hide password" : "Show password"}
                      >
                        {visible ? "Hide" : "Show"}
                      </button>
                    </div>
                    <small id="password-hint">
                      Use a password with 8 or more characters.
                    </small>
                  </div>
                  {signup && (
                    <div className="form-field">
                      <label htmlFor="auth-confirm">Confirm password</label>
                      <input
                        id="auth-confirm"
                        type={visible ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="One more time, just to be sure"
                        value={confirm}
                        onChange={(e) => {
                          setConfirm(e.target.value)
                          setError("")
                        }}
                        minLength={8}
                        required
                      />
                    </div>
                  )}
                  {signup ? (
                    <label className="auth-consent">
                      <input type="checkbox" required />
                      <span>
                        I understand an account will be created in Supabase.
                      </span>
                    </label>
                  ) : (
                    <div className="forgot-row">
                      <span>Just a little care, made simple.</span>
                      <button type="button" onClick={() => setForgot(!forgot)}>
                        Forgot password?
                      </button>
                    </div>
                  )}
                  {forgot && (
                    <p className="auth-inline-note" role="status">
                      Use the Supabase reset flow for real password recovery.
                    </p>
                  )}
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="button auth-submit"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Please wait…"
                      : signup
                        ? "Create account"
                        : "Sign in"}
                    <Icon name="arrow" size={18} />
                  </button>
                </form>
                <p className="auth-switch">
                  {signup
                    ? "Already part of the derma aura family?"
                    : "New to the derma aura family?"}{" "}
                  <a
                    href={`#/${signup ? "sign-in" : "sign-up"}${nextQuery}`}
                  >
                    {signup ? "Sign in" : "Create an account"}
                  </a>
                </p>
                <a
                  href={nextBag ? "#/bag" : nextOrders ? "#/orders" : "#/concerns"}
                  className="auth-back-link"
                >
                  ← {nextBag ? "Back to your bag" : nextOrders ? "Back to your orders" : "Keep exploring"}
                </a>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
