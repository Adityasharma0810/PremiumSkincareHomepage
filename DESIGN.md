# derma aura — skincare homepage concept

“derma aura” is the brand identity for this responsive skincare storefront.
This deliverable is a responsive React prototype, not a native Figma file.

## Responsive layouts

- Desktop target: 1440px; three editorial offer cards, centered navigation, full ingredient callouts.
- Mobile target: 390px; centered wordmark, hamburger navigation, swipeable offer cards, two-column ingredient pills.
- CSS grid and flexbox provide the equivalent responsive layout behavior of auto-layout.

## Color styles

| Token | Value |
| --- | --- |
| Beige | #F5EBDD |
| Cream | #F5EDE0 |
| Ivory | #FFF9F0 |
| Deep brown | #2E2620 |
| Terracotta | #C0714F |
| Sage | #A9B8A0 |
| Vitamin C glow | #F4A640 |
| Gold | #D9A441 |

Darkened terracotta (#AE593A / #A45436) supports readable ivory button and announcement text.
Deep brown is used for text on beige where the specified ivory/beige pairing would not meet contrast requirements.

## Text styles

- Display: Cormorant Garamond 500, with italic emphasis.
- Headings: Cormorant Garamond 500.
- Body, navigation, captions: DM Sans 400–550.
- Labels: tracked, uppercase DM Sans.
- Google Fonts wiring is in src/index.css.

## Reusable components and variants

- Button: primary and outline; Icon: shared line-icon vocabulary.
- Bottle: serum, jar, pump, tube; amber, sage, cream, peach, blue variants.
- Product cards, offer cards, review cards, ingredient pills and badges share CSS components.
- Badge variants: bestseller, new, savings.

## Prototype annotations

- Product marquee: **continuous linear loop, 40s per cycle**, right to left.
- Review marquee: continuous linear loop, 55s per cycle, left to right.
- Both pause on hover or keyboard focus.
- Reduced-motion mode disables animation and presents static, horizontally scrollable rows.
- Serum: three scroll-reactive CSS transition states: assembled, mid-explode, fully exploded.
  Dropper and pipette separate from the bottle, with ingredient droplets and glowing backdrop.
  The three controls below the feature also allow manual state selection.
  These are web animation states, not native Smart Animate frames.
- Navigation: sticky, with shadow after scrolling.
- Cards: subtle hover lift and shadow.
- Dialogs: Escape-to-close, focus containment, focus restoration and scroll lock.
- Mobile controls have 44px minimum touch areas.

## Clickable flows and demo boundaries

- Product search, category filters, add-to-bag, quantity adjustment and subtotal calculations work in memory.
- Routine combo adds three essentials; SPF and serum calls to action add their corresponding product.
- Offer countdown is illustrative and resets on page reload.
- Account, newsletter, support, social and chat surfaces are concept interactions.
- Checkout uses Razorpay Checkout; test or live behavior depends on the
  server-configured key pair. Payment orders and signature verification run in
  the `razorpay` Supabase Edge Function.
- Newsletter provides a welcome-code confirmation without storing or sending an email.
- WhatsApp-styled help opens in-app guidance; no brand phone number was supplied.
- Prices, reviews, efficacy claims and promotional copy are illustrative.
- Product, cart, authentication and order data are backed by Supabase. Payment
  processing requires deploying the Edge Function and configuring server-only
  Razorpay credentials.

## Store pages and demo account flow

- Hash-addressable routes: `#/concerns`, `#/bag`, `#/sign-in`, `#/sign-up`.
- Concerns supports multiple skin concerns (OR matching), skin type, product type,
  price ranges, price sorting, removable filter chips, clear-all and empty states.
- Footer concern links preselect a concern. Product recommendations are illustrative.
- Bag supports quantity changes, item removal, shipping calculation and the GLOW10
  discount. Its contents and coupon survive client-side page navigation.
- Checkout redirects guests to `#/sign-in?next=bag`; sign-up preserves that return
  destination. Completing the demo form returns the user to their unchanged bag.
- Demo sign-in accepts sample details and does not verify credentials, save
  passwords, create real accounts or send network requests.
- The demo user is held only in React memory and is cleared by refresh/sign-out.
- Signed-in checkout creates a server-priced pending order, opens Razorpay, and
  marks the order paid only after server-side signature and capture verification.
- The My orders page lists the signed-in customer’s eligible orders, including
  paid orders awaiting delivery, delivered orders, and cash-on-delivery orders.
  COD orders remain payment-pending until cash collection is recorded.
- Checkout collects a delivery address and stores it in the existing `addresses`
  and `orders.shipping_address_snapshot` fields. A successful payment creates a
  DTDC shipment record. Once the DTDC API key, customer code, sender address,
  hub, service, route-node, and package configuration are set as Edge Function
  secrets, the function automatically books the shipment; until then it remains pending.
  Package measurements are the fully packed outer dimensions and weight.
  Customers can request tracking for booked shipments from My orders.
- `supabase/functions/.env.example` lists local server-side Razorpay and DTDC
  placeholders. Never put these credentials in the Vite `.env`; configure deployed
  Edge Function secrets in Supabase.
- Deploy `supabase/functions/razorpay` to the linked Supabase project and set
  `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Supabase Edge Function secrets.
  Use the Razorpay test-mode key pair for simulated payments, or live-mode keys
  to accept real charges. Never expose the key secret to the browser. Deploy
  function changes with `supabase functions deploy razorpay`.
  The function verifies the Supabase access token itself, so its gateway JWT
  verification is disabled in `supabase/config.toml`. COD orders are created
  as confirmed with pending payment and request cash collection on delivery.
  DTDC booking requests carry the full order total as the COD amount.
- The account icon and mobile navigation open the sign-in/account page.
- Backend authentication and server-enforced checkout authorization remain deferred.
