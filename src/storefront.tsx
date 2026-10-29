type IconName = "search" | "user" | "bag" | "arrow" | "close" | "menu" | "plus" | "minus" | "leaf" | "drop" | "sun" | "shield" | "check" | "chat" | "instagram"
type IconProps = {
  name: IconName
  size?: number
}
export function Icon({ name, size = 22 }: IconProps) {
  const paths: Record<IconName, React.ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),
    bag: (
      <>
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15m-6-6 6 6-6 6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    plus: <path d="M5 12h14M12 5v14" />,
    minus: <path d="M5 12h14" />,
    leaf: (
      <>
        <path d="M20 3C8 1 1 8 6 16c8 5 16-2 14-13Z" />
        <path d="m4 21 11-12" />
      </>
    ),
    drop: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chat: (
      <>
        <path d="M21 11.5a9 9 0 0 1-13.5 8L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z" />
        <path d="M8 8c0 4 4 8 8 8l1-3-3-1-1 1-2-2 1-1-1-3-3 1Z" />
      </>
    ),
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17 7h.01" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
export const products = [
  {
    id: 1,
    name: "Vitamin C Glow Serum",
    type: "BRIGHTEN + REVIVE",
    price: 699,
    old: 899,
    color: "amber",
    kind: "serum",
    badge: "Bestseller",
  },
  {
    id: 2,
    name: "Barrier Repair Moisturiser",
    type: "NOURISH + STRENGTHEN",
    price: 599,
    old: 749,
    color: "sage",
    kind: "jar",
    badge: "",
  },
  {
    id: 3,
    name: "Gentle Daily Cleanser",
    type: "CLEANSE + REFRESH",
    price: 399,
    old: 499,
    color: "cream",
    kind: "pump",
    badge: "",
  },
  {
    id: 4,
    name: "Dewy Sunscreen SPF 50",
    type: "PROTECT + GLOW",
    price: 549,
    old: 699,
    color: "peach",
    kind: "tube",
    badge: "New",
  },
  {
    id: 5,
    name: "Hydra Boost Serum",
    type: "PLUMP + HYDRATE",
    price: 649,
    old: 799,
    color: "blue",
    kind: "serum",
    badge: "",
  },
  {
    id: 6,
    name: "Overnight Renewal Cream",
    type: "REST + RESTORE",
    price: 749,
    old: 949,
    color: "sage",
    kind: "jar",
    badge: "",
  },
]
export type Product = typeof products[number]
export function Bottle({
  color = "amber",
  kind = "serum",
  label = "Vitamin C",
  large = false,
}: {
  color?: string
  kind?: string
  label?: string
  large?: boolean
}) {
  return (
    <div
      className={`bottle ${kind} ${color} ${large ? "large" : ""}`}
      role="img"
      aria-label={`${label} aura skincare bottle`}
    >
      <div className="bottle-top">
        <div className="dropper-bulb" />
        <div className="bottle-cap" />
        <div className="pipette" />
      </div>
      <div className="bottle-body">
        <div className="bottle-label">
          <span className="bottle-brand">
            aura<span>®</span>
          </span>
          <span className="bottle-rule" />
          <strong>{label}</strong>
          <span className="bottle-detail">
            {kind === "serum" ? "daily glow serum" : "everyday skin essentials"}
          </span>
          <span className="bottle-volume">
            {kind === "jar" ? "50 g" : kind === "pump" ? "100 ml" : "30 ml"} /
            made with care
          </span>
        </div>
      </div>
    </div>
  )
}
export function Button({
  children,
  onClick,
  outline = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  outline?: boolean
}) {
  return (
    <button className={`button ${outline ? "outline" : ""}`} onClick={onClick}>
      {children}
      <Icon name="arrow" size={17} />
    </button>
  )
}
