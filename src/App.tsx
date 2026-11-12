import { useEffect, useRef, useState } from "react"

import { Icon, Bottle, Button, type UIProduct } from "./storefront"
import {
  ConcernsPage,
  ProductDetailPage,
  BagPage,
  OrdersPage,
  AuthPage,
  readRoute,
  readProductSlug,
  type Route,
} from "./StorePages"
import { useAuth } from "@/store/auth-context"
import { useCart } from "@/store/cart-context"
import { getFeaturedProducts, getProducts } from "@/services/products"
import { adaptProducts } from "@/lib/product-adapter"
import {
  createCodOrder,
  createRazorpayOrder,
  openRazorpayCheckout,
  verifyRazorpayPayment,
  type CheckoutMethod,
  type ShippingAddress,
} from "@/services/razorpay"
import type { Coupon } from "@/lib/types"
import "./pages.css"

const reviews = [
  {
    quote:
      "My skin has never felt this happy. The Vitamin C serum is officially my morning non-negotiable.",
    name: "Ananya S.",
    city: "Mumbai",
    initials: "AS",
    color: "#9c715a",
  },
  {
    quote:
      "Finally, skincare that does what it says. Simple ingredients, real results. My glow is back!",
    name: "Priya M.",
    city: "Bengaluru",
    initials: "PM",
    color: "#87927c",
  },
  {
    quote:
      "The routine combo made skincare so easy. Even my mum asked what I’ve been using!",
    name: "Riya K.",
    city: "New Delhi",
    initials: "RK",
    color: "#b88769",
  },
  {
    quote:
      "Lightweight, gentle, and perfect for my sensitive skin. I’m already on my third bottle.",
    name: "Meera P.",
    city: "Pune",
    initials: "MP",
    color: "#a19080",
  },
]
const infoCopy: Record<string, string> = {
  "Our story":
    "Less noise. More nourishment. Derma aura is a thoughtful approach to everyday skincare, inspired by Indian skin and the rituals that bring us back to ourselves. This is a concept storefront; products and claims are illustrative.",
  Shipping:
    "In this storefront concept, standard delivery is 3–5 working days across India. Shipping is complimentary on every order.",
  Returns:
    "Your peace of mind matters. For this concept, unopened products are eligible for return within 7 days of delivery. No purchases are processed in this demo.",
  FAQ: "Start simple: cleanse, treat, moisturise, and protect. Introduce one active at a time, patch test before use, and wear SPF every morning.",
  Contact:
    "A little guidance goes a long way. Explore our skincare FAQ or use the chat button for help finding your next ritual. This is an interactive brand concept, not a live shop.",
  "Checkout preview":
    "Checkout uses Razorpay. Test keys simulate payments; live keys charge real payments.",
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [productSlug, setProductSlug] = useState(readProductSlug)
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [panel, setPanel] = useState<"search" | null>(null)
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState("")
  const [notice, setNotice] = useState("")
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [stage, setStage] = useState(0)
  const [products, setProducts] = useState<UIProduct[]>([])
  const [catalogueProducts, setCatalogueProducts] = useState<UIProduct[]>([])
  const [productLoadError, setProductLoadError] = useState("")
  const [expandedProducts, setExpandedProducts] = useState<string[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const serumRef = useRef<HTMLElement>(null)
  const catalogueRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  const { user, signIn, signUp, signOut: authSignOut } = useAuth()
  const {
    cartId,
    loading: cartLoading,
    summary,
    addToCart,
    setQuantity,
    removeItem,
    refresh: refreshCart,
  } = useCart()
  const count = summary?.itemCount ?? 0

  useEffect(() => {
    const syncRoute = () => {
      setRoute(readRoute())
      setProductSlug(readProductSlug())
      setMenu(false)
      setPanel(null)
      setInfo(null)
      if (window.location.hash.startsWith("#/")) {
        window.scrollTo({ top: 0, behavior: "instant" })
      } else {
        requestAnimationFrame(() =>
          document
            .getElementById(window.location.hash.slice(1))
            ?.scrollIntoView({ behavior: "smooth" }),
        )
      }
    }
    window.addEventListener("hashchange", syncRoute)
    return () => window.removeEventListener("hashchange", syncRoute)
  }, [])

  useEffect(() => {
    const titles = {
      home: "Skincare, with soul.",
      concerns: "Shop by skin concern",
      bag: "Your bag",
      orders: "My orders",
      "sign-in": "Sign in",
      product: "Product details",
    }
    document.title = `derma aura — ${titles[route]}`
    if (route !== "home")
      document
        .querySelector<HTMLElement>("main h1")
        ?.focus({ preventScroll: true })
  }, [route])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [featured, catalogue] = await Promise.all([
          getFeaturedProducts(8),
          getProducts(),
        ])
        if (!mounted) return
        setProducts(adaptProducts(featured))
        setCatalogueProducts(adaptProducts(catalogue))
      } catch (err) {
        console.error("Failed to load initial data", err)
        setProductLoadError(
          err instanceof Error
            ? err.message
            : "The product catalogue could not be loaded.",
        )
      } finally {
        if (mounted) setDataLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  function navigate(destination: string) {
    setMenu(false)
    setPanel(null)
    setInfo(null)
    window.location.hash = `/${destination}`
  }

  async function checkout(
    shippingAddress?: ShippingAddress,
    paymentMethod: CheckoutMethod = "razorpay",
  ) {
    if (!count || checkoutLoading) return
    if (!user) {
      navigate("sign-in?next=bag")
      return
    }
    if (!shippingAddress) {
      setNotice("Enter your delivery address to continue.")
      return
    }
    if (!cartId) {
      setNotice("Your bag is still loading. Please try again.")
      return
    }
    setCheckoutLoading(true)
    try {
      if (paymentMethod === "cod") {
        const result = await createCodOrder(cartId, coupon?.code ?? null, shippingAddress)
        setCoupon(null)
        let cartRefreshFailed = false
        try {
          await refreshCart()
        } catch (refreshError) {
          cartRefreshFailed = true
          console.error("COD order was placed, but the bag could not be refreshed.", refreshError)
        }
        const messages = ["Your COD order is placed. Please pay the courier when it arrives."]
        if (!result.cartCleared) messages.push("Your bag could not be cleared; please don’t place the same order again.")
        if (cartRefreshFailed) messages.push("The bag view may need a refresh.")
        if (result.shipmentPending) messages.push("Courier setup is still pending.")
        setNotice(messages.join(" "))
        navigate("orders")
        return
      }

      const order = await createRazorpayOrder(
        cartId,
        coupon?.code ?? null,
        shippingAddress,
      )
      const payment = await openRazorpayCheckout({
        order,
        customer: {
          name: user.full_name ?? undefined,
          email: user.email ?? undefined,
        },
      })
      await verifyRazorpayPayment({ orderId: order.orderId, cartId, payment })
      await refreshCart()
      setCoupon(null)
      setNotice("Payment successful. Your order is confirmed; DTDC shipment is pending setup.")
    } catch (err) {
      console.error("Checkout failed", err)
      setNotice(err instanceof Error ? err.message : "Checkout could not be completed. Please try again.")
    } finally {
      setCheckoutLoading(false)
    }
  }

  function navigateAfterAuth() {
    const next = new URLSearchParams(window.location.hash.split("?")[1]).get("next")
    if (next === "orders" || next === "bag") navigate(next)
  }

  async function completeSignIn(emailValue: string, password: string) {
    await signIn(emailValue, password)
    navigateAfterAuth()
  }

  async function completeSignUp(emailValue: string, password: string) {
    const hasSession = await signUp(emailValue, password)
    if (hasSession) navigate("home")
    return hasSession
  }

  function handleAuthSignOut() {
    authSignOut()
    setNotice("You’ve signed out.")
    navigate("sign-in")
  }

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40)
      if (serumRef.current) {
        const rect = serumRef.current.getBoundingClientRect()
        const progress =
          (window.innerHeight - rect.top) /
          (window.innerHeight + rect.height * 0.3)
        setStage(progress > 0.72 ? 2 : progress > 0.36 ? 1 : 0)
      }
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(""), 3000)
    return () => clearTimeout(t)
  }, [notice])
  useEffect(() => {
    document.body.style.overflow = panel || info ? "hidden" : ""
    const previousFocus = document.activeElement as HTMLElement | null
    if (panel || info)
      dialogRef.current?.querySelector<HTMLElement>("button")?.focus()
    const focusTimer =
      panel === "search"
        ? setTimeout(() => searchRef.current?.focus(), 50)
        : undefined
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null)
        setInfo(null)
        setMenu(false)
      }
      if (e.key === "Tab" && dialogRef.current) {
        const controls = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            "button, input, a[href]",
          ),
        ).filter((el) => !el.hasAttribute("disabled"))
        const first = controls[0],
          last = controls[controls.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener("keydown", close)
    return () => {
      clearTimeout(focusTimer)
      document.body.style.overflow = ""
      window.removeEventListener("keydown", close)
      previousFocus?.focus()
    }
  }, [panel, info])

  async function handleAddVariant(variantId: string, productName: string) {
    if (cartLoading) {
      setNotice("Your bag is still loading. Please try again.")
      return
    }
    try {
      await addToCart(variantId, 1)
      setNotice(`${productName} added to your bag`)
    } catch (error) {
      console.error("Could not add product to bag", error)
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not add this item to your bag. Please try again.",
      )
    }
  }
  async function handleAdd(p: UIProduct) {
    if (!p.variantId) {
      setNotice(`${p.name} is not available right now.`)
      return
    }
    await handleAddVariant(p.variantId, p.name)
  }
  function shop() {
    setMenu(false)
    if (route !== "home") navigate("concerns")
    else document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })
  }
  function scrollCatalogue(direction: -1 | 1) {
    const catalogue = catalogueRef.current
    if (!catalogue) return
    catalogue.scrollBy({
      left: direction * catalogue.clientWidth * 0.8,
      behavior: "smooth",
    })
  }
  async function handleChangeQuantity(itemId: string, quantity: number) {
    await setQuantity(itemId, quantity)
  }

  const productCard = (p: UIProduct, duplicate = false) => {
    const expanded = expandedProducts.includes(p.id)
    const category = p.type.length <= 30 ? p.type : null
    const description =
      p.shortDescription ?? (p.type.length > 30 ? p.type : null)

    return (
      <article
        className={`product-card${expanded ? " is-expanded" : ""}`}
        key={`${p.id}-${duplicate}`}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a, button")) {
            return
          }
          window.location.hash = `/product/${encodeURIComponent(p.slug)}`
        }}
      >
      <a
        tabIndex={duplicate ? -1 : undefined}
        className={`product-art art-${p.color}`}
        href={`#/product/${encodeURIComponent(p.slug)}`}
        aria-label={`View ${p.name}`}
      >
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
        <span className="product-quick" aria-hidden="true">
          <Icon name="arrow" size={17} />
        </span>
      </a>
      <div className="product-details product-card-details">
        {category && <span className="eyebrow product-category">{category}</span>}
        <h3>
          <a
            tabIndex={duplicate ? -1 : undefined}
            href={`#/product/${encodeURIComponent(p.slug)}`}
          >
            {p.name}
          </a>
        </h3>
        {description && (
          <>
            <button
              type="button"
              className="description-toggle"
              tabIndex={duplicate ? -1 : undefined}
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
            tabIndex={duplicate ? -1 : undefined}
            className="add-button"
            onClick={() => handleAdd(p)}
          >
            Add to cart
          </button>
        </div>
      </div>
      </article>
    )
  }
  return (
    <>
      {!dataLoading && (
            <>
              <header className={`nav ${scrolled ? "scrolled" : ""}`}>
                <div className="nav-inner">
                  <button
                    className="icon-button mobile-menu"
                    aria-label="Open navigation"
                    aria-expanded={menu}
                    onClick={() => setMenu(!menu)}
                  >
                    <Icon name={menu ? "close" : "menu"} />
                  </button>
                  <a className="logo" href="#/" aria-label="derma aura home">
                    <img
                      src="https://i.pinimg.com/736x/90/21/62/902162d122a8865e264c661495dfa3b0.jpg"
                      alt=""
                    />
                  </a>
                  <nav
                    className={menu ? "links open" : "links"}
                    aria-label="Main navigation"
                  >
                    <button onClick={shop}>
                      Shop <span>⌄</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate("concerns")
                      }}
                    >
                      Products <span>⌄</span>
                    </button>
                    <a href="#shop" onClick={() => setMenu(false)}>
                      Our catalogue
                    </a>
                    <button
                      onClick={() => {
                        setInfo("Our story")
                        setMenu(false)
                      }}
                    >
                      Our story
                    </button>
                    <button onClick={() => navigate("orders")}>My orders</button>
                    <button
                      className="mobile-account-link"
                      onClick={() => navigate("sign-in")}
                    >
                      {user ? "Your account" : "Sign in"}
                    </button>
                  </nav>
                  <div className="nav-actions">
                    <button
                      className="icon-button desktop-action"
                      aria-label="Search products"
                      onClick={() => setPanel("search")}
                    >
                      <Icon name="search" />
                    </button>
                    <button
                      className="icon-button desktop-action"
                      aria-label={
                        user
                          ? `Your account, ${user.full_name ?? user.email}`
                          : "Sign in or create an account"
                      }
                      onClick={() => navigate("sign-in")}
                    >
                      <Icon name="user" />
                    </button>
                    <button
                      className="icon-button bag-button"
                      aria-label={`Open bag, ${count} items`}
                      onClick={() => navigate("bag")}
                    >
                      <Icon name="bag" />
                      <span className="cart-count">{count}</span>
                    </button>
                  </div>
                </div>
              </header>
              {route === "product" ? (
                <ProductDetailPage
                  slug={productSlug}
                  onAddToCart={handleAddVariant}
                />
              ) : route === "concerns" ? (
                <ConcernsPage />
              ) : route === "bag" ? (
                <BagPage
                  count={count}
                  user={user}
                  onCheckout={checkout}
                  coupon={coupon}
                  setCoupon={setCoupon}
                  checkoutLoading={checkoutLoading}
                  summary={summary}
                  setQuantity={handleChangeQuantity}
                  removeItem={removeItem}
                />
              ) : route === "orders" ? (
                <OrdersPage userId={user?.id ?? null} />
              ) : route === "sign-in" ? (
                <AuthPage
                  user={user}
                  onComplete={completeSignIn}
                  onCreateAccount={completeSignUp}
                  onSignOut={handleAuthSignOut}
                />
              ) : (
                <main>
                  <section className="shop-section catalogue-section" id="shop">
                    <div className="section-heading section-shell">
                      <div>
                        <span className="eyebrow">THE DERMA AURA COLLECTION</span>
                        <h1>
                          Our <em>catalogue.</em>
                        </h1>
                      </div>
                      <div className="catalogue-actions">
                        <button
                          className="catalogue-scroll-button scroll-left"
                          type="button"
                          aria-label="Scroll products left"
                          onClick={() => scrollCatalogue(-1)}
                        >
                          <Icon name="arrow" size={18} />
                        </button>
                        <button
                          className="catalogue-scroll-button scroll-right"
                          type="button"
                          aria-label="Scroll products right"
                          onClick={() => scrollCatalogue(1)}
                        >
                          <Icon name="arrow" size={18} />
                        </button>
                        <button
                          className="text-link"
                          onClick={() => {
                            setQuery("")
                            setPanel("search")
                          }}
                        >
                          Browse all products <Icon name="arrow" size={18} />
                        </button>
                      </div>
                    </div>
                    {productLoadError ? (
                      <p className="catalogue-message" role="alert">
                        We couldn’t load the catalogue. Please try again later.
                      </p>
                    ) : catalogueProducts.length === 0 ? (
                      <p className="catalogue-message" role="status">
                        No products are available right now.
                      </p>
                    ) : (
                      <div
                        className="catalogue-viewport"
                        ref={catalogueRef}
                        role="region"
                        aria-label="Skincare product catalogue"
                        tabIndex={0}
                      >
                        <div className="catalogue-track">
                          {catalogueProducts.map((p) => productCard(p))}
                        </div>
                      </div>
                    )}
                    <div className="marquee-caption">
                      <span className="moving-dot" /> Explore every product in the collection.
                      <span className="swipe-note">Swipe or use arrows to explore</span>
                    </div>
                    <div className="trust-strip">
                      <span>
                        <Icon name="leaf" size={17} /> Kind to your skin
                      </span>
                      <i />
                      <span>
                        <Icon name="shield" size={17} /> Dermatologically tested
                      </span>
                      <i />
                      <span>
                        <Icon name="drop" size={17} /> No unnecessary nasties
                      </span>
                      <i />
                      <span>
                        <span className="india-mark">IN</span> Made for Indian skin
                      </span>
                    </div>
                  </section>
                  <section
                    className={`serum-section stage-${stage}`}
                    id="ingredients"
                    ref={serumRef}
                  >
                    <div className="section-heading centered">
                      <span className="eyebrow">
                        SMALL BOTTLE. BEAUTIFUL POSSIBILITIES.
                      </span>
                      <h2>Meet the glow-getter.</h2>
                      <p>
                        Inside our bestseller: <strong>Vitamin C Glow Serum</strong>
                      </p>
                    </div>
                    <div className="serum-anatomy">
                      <div className="glow-orbit orbit-one" />
                      <div className="glow-orbit orbit-two" />
                      <div className="serum-center">
                        <div className="serum-glow" />
                        <Bottle large label="Vitamin C" />
                        <span className="floating-drop drop-one" />
                        <span className="floating-drop drop-two" />
                        <span className="floating-drop drop-three" />
                      </div>
                      <div className="ingredient ingredient-c">
                        <div className="ingredient-icon">
                          <Icon name="sun" />
                        </div>
                        <div>
                          <h3>Vitamin C</h3>
                          <p>A brighter, more radiant you.</p>
                        </div>
                        <span className="callout-line" />
                      </div>
                      <div className="ingredient ingredient-n">
                        <div className="ingredient-icon">
                          <Icon name="leaf" />
                        </div>
                        <div>
                          <h3>Niacinamide</h3>
                          <p>Even tone. Effortless confidence.</p>
                        </div>
                        <span className="callout-line" />
                      </div>
                      <div className="ingredient ingredient-h">
                        <div className="ingredient-icon">
                          <Icon name="drop" />
                        </div>
                        <div>
                          <h3>Hyaluronic Acid</h3>
                          <p>A long drink of hydration.</p>
                        </div>
                        <span className="callout-line" />
                      </div>
                      <div className="ingredient ingredient-e">
                        <div className="ingredient-icon">
                          <Icon name="shield" />
                        </div>
                        <div>
                          <h3>Vitamin E + Ferulic Acid</h3>
                          <p>Your daily defence, strengthened.</p>
                        </div>
                        <span className="callout-line" />
                      </div>
                      <span className="anatomy-note">
                        Good chemistry.
                        <br />
                        <em>Even better skin.</em>
                      </span>
                    </div>
                    <div className="serum-bottom">
                      <div className="serum-rating">
                        <span className="stars">★★★★★</span>
                        <span>
                          4.9/5 <span className="muted">(1,240 happy reviews)</span>
                        </span>
                      </div>
                      <div className="serum-purchase">
                        <strong>
                          ₹699 <del>₹899</del>
                        </strong>
                        <Button
                          onClick={() => {
                            handleAdd(products[0])
                            navigate("bag")
                          }}
                        >
                          Shop this serum
                        </Button>
                      </div>
                      <p>30 ml of everyday radiance. For all skin types.</p>
                    </div>
                    <div
                      className="stage-indicator"
                      aria-label={`Serum animation frame ${stage + 1} of 3`}
                    >
                      {["The formula", "The science", "The glow"].map((label, i) => (
                        <button
                          key={label}
                          className={stage === i ? "active" : ""}
                          onClick={() => setStage(i)}
                          aria-label={`Show ${label}`}
                        >
                          <span />
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="review-section" id="reviews">
                    <div className="section-heading centered">
                      <span className="eyebrow">REAL SKIN. REAL STORIES.</span>
                      <h2>
                        Loved by 50,000+ <em>skin journeys.</em>
                      </h2>
                      <p>Not just a glow. A feeling.</p>
                    </div>
                    <div className="marquee reviews-marquee">
                      <div className="marquee-track review-track">
                        {[false, true].map((duplicate) => (
                          <div
                            className="review-group"
                            key={String(duplicate)}
                            aria-hidden={duplicate || undefined}
                          >
                            {reviews.map((r, i) => (
                              <article className="review-card" key={r.name}>
                                <div className="review-top">
                                  <span className="stars">★★★★★</span>
                                  <span className="review-product">
                                    {
                                      [
                                        "Vitamin C Glow Serum",
                                        "The Daily Essentials",
                                        "Routine Glow Combo",
                                        "Hydra Boost Serum",
                                      ][i]
                                    }
                                  </span>
                                </div>
                                <blockquote>“{r.quote}”</blockquote>
                                <div className="review-person">
                                  <span
                                    className="avatar"
                                    style={{ background: r.color }}
                                  >
                                    {r.initials}
                                  </span>
                                  <div>
                                    <strong>{r.name}</strong>
                                    <span>{r.city}</span>
                                  </div>
                                  <span className="verified">
                                    <Icon name="check" size={12} /> Verified buyer
                                  </span>
                                </div>
                              </article>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="review-summary">
                      <span className="stars">★★★★★</span>
                      <span>
                        <strong>4.9 out of 5</strong> from our ever-growing derma aura family
                      </span>
                    </div>
                  </section>
                  <section className="newsletter section-shell">
                    <div>
                      <span className="eyebrow">A LITTLE LETTER. A LITTLE LOVE.</span>
                      <h2>
                        Good skin days, <em>in your inbox.</em>
                      </h2>
                      <p>Fresh drops, skin wisdom, and 10% off your first order.</p>
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        try {
                          const { subscribeNewsletter } = await import(
                            "@/services/newsletter"
                          )
                          await subscribeNewsletter(email)
                          setSubscribed(true)
                        } catch (err) {
                          console.error("Newsletter signup failed", err)
                          setSubscribed(true)
                        }
                      }}
                    >
                      <label htmlFor="email" className="sr-only">
                        Email address
                      </label>
                      <div className="newsletter-field">
                        <input
                          id="email"
                          type="email"
                          placeholder="Your email address"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            setSubscribed(false)
                          }}
                          required
                        />
                        <button type="submit" aria-label="Join the derma aura newsletter">
                          <Icon name={subscribed ? "check" : "arrow"} />
                        </button>
                      </div>
                      <small aria-live="polite">
                        {subscribed
                          ? "Demo complete. Your welcome code: GLOW10."
                          : "Only the good stuff. Pinky promise."}
                      </small>
                    </form>
                  </section>
                </main>
              )}
              <footer>
                <div className="footer-main section-shell">
                  <div className="footer-brand">
                    <a href="#/" className="logo">
                      derma aura<span>®</span>
                    </a>
                    <p>
                      Skincare, with soul.
                      <br />
                      Made for your skin. And your everyday.
                    </p>
                    <div className="socials">
                      <button
                        aria-label="Instagram"
                        onClick={() => setInfo("Our story")}
                      >
                        <Icon name="instagram" size={19} />
                      </button>
                      <button
                        aria-label="Pinterest"
                        onClick={() => setInfo("Our story")}
                      >
                        p
                      </button>
                      <button
                        aria-label="Facebook"
                        onClick={() => setInfo("Our story")}
                      >
                        f
                      </button>
                    </div>
                  </div>
                  <div className="footer-column">
                    <h3>Shop</h3>
                    {[
                      "All skincare",
                      "Bestsellers",
                      "Routine combos",
                      "New arrivals",
                    ].map((s) => (
                      <button key={s} onClick={shop}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="footer-column">
                    <h3>By concern</h3>
                    {[
                      "Dullness & pigmentation",
                      "Dryness & dehydration",
                      "Acne & blemishes",
                      "Sun protection",
                    ].map((s, i) => (
                      <button
                        key={s}
                        onClick={() => {
                          navigate(
                            `concerns?concern=${["dullness", "dryness", "acne", "sun"][i]}`,
                          )
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="footer-column">
                    <h3>Here to help</h3>
                    {["Shipping", "Returns", "FAQ", "Contact"].map((s) => (
                      <button key={s} onClick={() => setInfo(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="footer-column">
                    <h3>The derma aura way</h3>
                    {["Our story", "Our ingredients", "Our community"].map((s, i) => (
                      <button
                        key={s}
                        onClick={() =>
                          i === 0
                            ? setInfo(s)
                            : route === "home"
                              ? document
                                  .getElementById(i === 1 ? "ingredients" : "reviews")
                                  ?.scrollIntoView({ behavior: "smooth" })
                              : (window.location.hash =
                                  i === 1 ? "ingredients" : "reviews")
                        }
                      >
                        {s}
                      </button>
                    ))}
                    <span className="made-india">Thoughtfully made in India.</span>
                  </div>
                </div>
                <div className="footer-bottom section-shell">
                  <span>
                    © {new Date().getFullYear()} derma aura skincare. A little care goes a
                    long way.
                  </span>
                  <div>
                    <button onClick={() => setInfo("Privacy & terms")}>Privacy</button>
                    <button onClick={() => setInfo("Privacy & terms")}>Terms</button>
                  </div>
                  <div className="payments">
                    <span>UPI</span>
                    <span>VISA</span>
                    <span className="mastercard">
                      <i />
                      <i />
                    </span>
                    <span>COD</span>
                    <Icon name="shield" size={15} />
                  </div>
                </div>
              </footer>
              <button
                className="whatsapp"
                aria-label="Open skincare help"
                onClick={() => setInfo("Need a little skin guidance?")}
              >
                <Icon name="chat" size={25} />
              </button>
              {notice && (
                <div className="toast" role="status">
                  <Icon name="check" size={18} />
                  {notice}
                </div>
              )}
              {(panel || info) && (
                <div
                  className="modal-overlay"
                  onClick={() => {
                    setPanel(null)
                    setInfo(null)
                  }}
                >
                  <section
                    ref={dialogRef}
                    className="dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-label={info || "Find your skincare"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="icon-button dialog-close"
                      aria-label="Close dialog"
                      onClick={() => {
                        setPanel(null)
                        setInfo(null)
                      }}
                    >
                      <Icon name="close" />
                    </button>
                    {info ? (
                      <>
                        <span className="eyebrow">THE DERMA AURA WAY</span>
                        <h2>{info}</h2>
                        <p className="info-text">
                          {infoCopy[info] ||
                            (info === "Privacy & terms"
                              ? "This is a demonstration storefront. No payment or personal account data is collected. Newsletter entries are sent to Supabase and stored in the newsletter_subscribers table."
                              : "Let’s keep it simple: cleanse gently, treat thoughtfully, moisturise daily, and always wear SPF. New to actives? Start with our Vitamin C serum two or three mornings a week and patch test first.")}{" "}
                        </p>
                        <Button
                          onClick={() => {
                            setInfo(null)
                            shop()
                          }}
                        >
                          Find your essentials
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="eyebrow">LET’S FIND YOUR EVERYDAY</span>
                        <h2>A little care, just for you.</h2>
                        <div className="search-field">
                          <Icon name="search" />
                          <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Try serum, hydration, sunscreen…"
                          />
                        </div>
                        <div className="search-tags">
                          {["All", "Serum", "Cleanser", "Sunscreen", "Moisturiser"].map(
                            (tag) => (
                              <button
                                className={
                                  query === tag || (!query && tag === "All")
                                    ? "selected"
                                    : ""
                                }
                                key={tag}
                                onClick={() => setQuery(tag === "All" ? "" : tag)}
                              >
                                {tag}
                              </button>
                            ),
                          )}
                        </div>
                        <div className="search-results">
                          {products
                            .filter((p) =>
                              `${p.name} ${p.type}`
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                            )
                            .map((p) => (
                              <div className="search-result" key={p.id}>
                                <div className={`search-thumb art-${p.color}`}>
                                  <Bottle
                                    color={p.color}
                                    kind={p.kind}
                                    label={p.name.split(" ").slice(0, 2).join(" ")}
                                  />
                                </div>
                                <div>
                                  <h3>{p.name}</h3>
                                  <span>₹{p.price}</span>
                                </div>
                                <button className="add-button" onClick={() => handleAdd(p)}>
                                  <Icon name="plus" size={14} /> Add
                                </button>
                              </div>
                            ))}
                          {!products.some((p) =>
                            `${p.name} ${p.type}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          ) && (
                            <p className="no-results">
                              No matches just yet. Try “serum” or explore all
                              essentials.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </>
  )
}
