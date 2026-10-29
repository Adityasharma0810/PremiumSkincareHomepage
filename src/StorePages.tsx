import { useEffect, useState, type ReactNode } from "react"
import { Bottle, Button, Icon, products, type Product } from "./storefront"

export type Route = "home" | "concerns" | "bag" | "sign-in" | "sign-up"
export type DemoUser = {
  name: string
  email: string
}
export function readRoute(): Route {
  const path = window.location.hash.split("?")[0].replace(/^#\/?/, "")
  return ["concerns", "bag", "sign-in", "sign-up"].includes(path)
    ? path as Route
    : "home"
}
export const concerns = [
  {
    id: "dullness",
    name: "Dullness & pigmentation",
    icon: "sun",
    short: "Find your glow",
  },
  {
    id: "dryness",
    name: "Dryness & dehydration",
    icon: "drop",
    short: "A little more hydration",
  },
  {
    id: "acne",
    name: "Acne & blemishes",
    icon: "leaf",
    short: "Keep things clear",
  },
  {
    id: "sensitivity",
    name: "Sensitivity & redness",
    icon: "shield",
    short: "Care, a little gentler",
  },
  {
    id: "sun",
    name: "Sun protection",
    icon: "sun",
    short: "Your everyday defence",
  },
  {
    id: "ageing",
    name: "Fine lines & texture",
    icon: "drop",
    short: "Smooth, soft, replenished",
  },
] as const
const suitability: Record<number, {
  concerns: string[]
  skin: string[]
}> = {
  1: {
    concerns: ["dullness", "ageing"],
    skin: ["dry", "normal", "combination", "oily"],
  },
  2: {
    concerns: ["dryness", "sensitivity"],
    skin: ["dry", "normal", "sensitive", "combination"],
  },
  3: {
    concerns: ["acne", "sensitivity"],
    skin: ["dry", "normal", "sensitive", "combination", "oily"],
  },
  4: {
    concerns: ["sun", "dullness"],
    skin: ["dry", "normal", "combination", "oily"],
  },
  5: { concerns: ["dryness"], skin: ["dry", "normal", "combination", "oily"] },
  6: { concerns: ["ageing", "dryness"], skin: ["dry", "normal"] },
}
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`
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

export function ConcernsPage({
  renderProduct,
}: {
  renderProduct: (p: Product) => ReactNode
}) {
  const initialConcern = () =>
    new URLSearchParams(window.location.hash.split("?")[1]).get("concern") || ""
  const [selected, setSelected] = useState<string[]>(() =>
    concerns.some((c) => c.id === initialConcern()) ? [initialConcern()] : [],
  )
  const [skin, setSkin] = useState("all")
  const [category, setCategory] = useState("all")
  const [price, setPrice] = useState("all")
  const [sort, setSort] = useState("featured")
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => {
    const sync = () => {
      const value = initialConcern()
      setSelected(concerns.some((c) => c.id === value) ? [value] : [])
    }
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])
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
  const results = products
    .filter(
      (p) =>
        (!selected.length ||
          selected.some((id) => suitability[p.id].concerns.includes(id))) &&
        (skin === "all" || suitability[p.id].skin.includes(skin)) &&
        (category === "all" || p.kind === category) &&
        (price === "all" ||
          (price === "under500"
            ? p.price < 500
            : price === "500to700"
              ? p.price >= 500 && p.price <= 700
              : p.price > 700)),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : a.id - b.id,
    )
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
          {concerns.map((c) => (
            <button
              key={c.id}
              className={
                selected.includes(c.id)
                  ? "concern-shortcut selected"
                  : "concern-shortcut"
              }
              aria-pressed={selected.includes(c.id)}
              onClick={() => toggle(c.id)}
            >
              <span className="concern-symbol">
                <Icon name={c.icon} size={23} />
              </span>
              <strong>{c.name}</strong>
              <small>{c.short}</small>
            </button>
          ))}
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
              {concerns.map((c) => (
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
                    ? concerns.find((c) => c.id === selected[0])?.name
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
                    aria-label={`Remove ${concerns.find((c) => c.id === id)?.name} filter`}
                  >
                    {concerns.find((c) => c.id === id)?.name}
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
              <div className="catalog-grid">{results.map(renderProduct)}</div>
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

type BagProps = {
  cart: Record<number, number>
  changeQuantity: (id: number, delta: number) => void
  user: DemoUser | null
  onCheckout: () => void
  coupon: boolean
  setCoupon: (value: boolean) => void
}
export function BagPage({
  cart,
  changeQuantity,
  user,
  onCheckout,
  coupon,
  setCoupon,
}: BagProps) {
  const [code, setCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const items = products.filter((p) => cart[p.id] > 0)
  const count = items.reduce((sum, p) => sum + cart[p.id], 0)
  const subtotal = items.reduce((sum, p) => sum + p.price * cart[p.id], 0)
  const discount = coupon ? Math.round(subtotal * 0.1) : 0
  const shipping = subtotal >= 499 || !subtotal ? 0 : 49
  const savings =
    items.reduce((sum, p) => sum + (p.old - p.price) * cart[p.id], 0) + discount
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
            <b>02</b> {user ? "Demo signed in" : "Sign in"}
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
                {subtotal >= 499
                  ? "A little care, on us. You’ve unlocked free shipping."
                  : `You’re ${rupees(499 - subtotal)} away from free shipping.`}
              </div>
              {items.map((p) => (
                <article className="bag-line" key={p.id}>
                  <div className={`bag-product-art art-${p.color}`}>
                    <Bottle
                      color={p.color}
                      kind={p.kind}
                      label={p.name.split(" ").slice(0, 2).join(" ")}
                    />
                  </div>
                  <div className="bag-line-details">
                    <span className="eyebrow">{p.type}</span>
                    <h3>{p.name}</h3>
                    <p>
                      {p.kind === "jar"
                        ? "50 g"
                        : p.kind === "pump"
                          ? "100 ml"
                          : "30 ml"}{" "}
                      · Everyday skin essentials
                    </p>
                    <div className="bag-line-controls">
                      <div className="quantity">
                        <button
                          aria-label={`Remove one ${p.name}`}
                          onClick={() => changeQuantity(p.id, -1)}
                        >
                          <Icon name="minus" size={14} />
                        </button>
                        <span aria-label={`Quantity ${cart[p.id]}`}>
                          {cart[p.id]}
                        </span>
                        <button
                          aria-label={`Add one ${p.name}`}
                          onClick={() => changeQuantity(p.id, 1)}
                        >
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      <button
                        className="remove-item"
                        onClick={() => changeQuantity(p.id, -cart[p.id])}
                        aria-label={`Remove ${p.name} from bag`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="bag-line-price">
                    <strong>{rupees(p.price * cart[p.id])}</strong>
                    <del>{rupees(p.old * cart[p.id])}</del>
                    {cart[p.id] > 1 && <small>{rupees(p.price)} each</small>}
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
                    <dt>GLOW10 · 10% off</dt>
                    <dd>−{rupees(discount)}</dd>
                  </div>
                )}
              </dl>
              <div className="coupon-area">
                {coupon ? (
                  <div className="coupon-applied">
                    <span>
                      <Icon name="check" size={15} /> GLOW10 applied
                    </span>
                    <button
                      onClick={() => {
                        setCoupon(false)
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
                      if (code.trim().toUpperCase() === "GLOW10") {
                        setCoupon(true)
                        setCouponError("")
                      } else
                        setCouponError(
                          "That code isn’t quite right. Try GLOW10.",
                        )
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
                    Continuing as {user.name}
                    <small>Demo session · not a real account</small>
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
              <Button onClick={onCheckout}>
                {user ? "Continue to checkout" : "Sign in to checkout"}
              </Button>
              <a className="signup-checkout" href="#/sign-up?next=bag">
                {user ? "" : "New here? Create an account"}
              </a>
              <p className="checkout-demo-note">
                Prototype only. No orders or payments are processed.
              </p>
              <div className="summary-payment">
                <span>UPI</span>
                <span>VISA</span>
                <span>Mastercard</span>
                <span>COD</span>
              </div>
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

export function AuthPage({
  mode,
  user,
  onComplete,
  onSignOut,
}: {
  mode: "sign-in" | "sign-up"
  user: DemoUser | null
  onComplete: (user: DemoUser) => void
  onSignOut: () => void
}) {
  const signup = mode === "sign-up"
  const nextBag =
    new URLSearchParams(window.location.hash.split("?")[1]).get("next") ===
    "bag"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState("")
  const [forgot, setForgot] = useState(false)
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
                <span className="eyebrow">YOUR AURA CORNER</span>
                <h1 tabIndex={-1}>
                  Hello, <em>{user.name}.</em>
                </h1>
                <p>
                  You’re signed in to this demo as <strong>{user.email}</strong>
                  . Your bag is right where you left it.
                </p>
                <div className="auth-demo-banner">
                  <Icon name="shield" size={18} />
                  <p>
                    This is a demo session, not a verified account. It ends when
                    the page is refreshed.
                  </p>
                </div>
                <a className="button" href="#/bag">
                  Back to your bag
                  <Icon name="arrow" size={17} />
                </a>
                <Button outline onClick={onSignOut}>
                  Sign out of demo
                </Button>
              </div>
            ) : (
              <>
                <div className="auth-tabs" aria-label="Account pages">
                  <a
                    href={`#/sign-in${nextBag ? "?next=bag" : ""}`}
                    aria-current={!signup ? "page" : undefined}
                  >
                    Sign in
                  </a>
                  <a
                    href={`#/sign-up${nextBag ? "?next=bag" : ""}`}
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
                    : signup
                      ? "Make yourself at home. A simpler skincare ritual starts with you."
                      : "A moment for you, and the skin you’re in."}
                </p>
                <div className="auth-demo-banner">
                  <Icon name="shield" size={18} />
                  <p>
                    <strong>Demo mode — backend coming later.</strong>Use sample
                    details, not a real password. Nothing is saved or verified.
                  </p>
                </div>
                <form
                  className="auth-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setError("")
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
                    setPassword("")
                    setConfirm("")
                    onComplete({
                      name: signup ? name.trim() : email.split("@")[0],
                      email: email.trim(),
                    })
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
                            : "Enter a sample password"
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
                      Use any sample password with 8 or more characters.
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
                        I understand this is a demo and no real account will be
                        created.
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
                      No reset needed in demo mode. Any sample email and an
                      8-character password will work. Real password recovery
                      will be connected with the backend.
                    </p>
                  )}
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="button auth-submit" type="submit">
                    {signup ? "Create demo account" : "Sign in to demo"}
                    <Icon name="arrow" size={18} />
                  </button>
                </form>
                <p className="auth-switch">
                  {signup
                    ? "Already part of the aura family?"
                    : "New to the aura family?"}{" "}
                  <a
                    href={`#/${signup ? "sign-in" : "sign-up"}${
                      nextBag ? "?next=bag" : ""
                    }`}
                  >
                    {signup ? "Sign in" : "Create an account"}
                  </a>
                </p>
                <a
                  href={nextBag ? "#/bag" : "#/concerns"}
                  className="auth-back-link"
                >
                  ← {nextBag ? "Back to your bag" : "Keep exploring"}
                </a>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
