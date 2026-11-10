/**
 * Keeps guest bags in local storage and signed-in bags in Supabase.
 * Guest items are merged into the user's Supabase bag after authentication.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/store/auth-context'
import {
  resolveCart,
  getCartItems,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  getCartSummary,
  getGuestCartSummary,
  type CartSummary,
  type GuestCartLine,
} from '@/services/cart'
import type { CartItem } from '@/lib/types'

const GUEST_CART_KEY = 'aura-guest-cart-items'

function readGuestItems(): GuestCartLine[] {
  const serialized = localStorage.getItem(GUEST_CART_KEY)
  if (!serialized) return []

  const parsed: unknown = JSON.parse(serialized)
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) =>
      !item ||
      typeof item.variantId !== 'string' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )
  ) {
    throw new Error('Saved bag data is invalid. Clear this site’s local storage and try again.')
  }
  return parsed as GuestCartLine[]
}

function saveGuestItems(items: GuestCartLine[]) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
}

const CartContext = createContext<{
  cartId: string | null
  loading: boolean
  items: CartItem[]
  summary: CartSummary | null
  addToCart: (variantId: string, quantity?: number) => Promise<void>
  setQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clear: () => Promise<void>
  refresh: () => Promise<void>
} | null>(null)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [cartId, setCartId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [guestItems, setGuestItems] = useState<GuestCartLine[]>([])
  const [summary, setSummary] = useState<CartSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshCartData = async (id: string) => {
    setLoading(true)
    try {
      const [itemsRes, summaryRes] = await Promise.all([
        getCartItems(id),
        getCartSummary(id),
      ])
      setItems(itemsRes)
      setSummary(summaryRes)
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    if (user && cartId) {
      await refreshCartData(cartId)
      return
    }

    const savedItems = readGuestItems()
    const guestSummary = await getGuestCartSummary(savedItems)
    setGuestItems(savedItems)
    setSummary(guestSummary)
  }

  useEffect(() => {
    let mounted = true
    if (authLoading) return

    setLoading(true)
    ;(async () => {
      try {
        const savedGuestItems = readGuestItems()
        if (user) {
          const id = await resolveCart(user.id)
          for (const guestItem of savedGuestItems) {
            await addToCart({
              cartId: id,
              variantId: guestItem.variantId,
              quantity: guestItem.quantity,
            })
          }
          if (savedGuestItems.length) {
            localStorage.removeItem(GUEST_CART_KEY)
          }
          if (!mounted) return
          setCartId(id)
          setGuestItems([])
          const [cartItems, cartSummary] = await Promise.all([
            getCartItems(id),
            getCartSummary(id),
          ])
          if (!mounted) return
          setItems(cartItems)
          setSummary(cartSummary)
        } else {
          const guestSummary = await getGuestCartSummary(savedGuestItems)
          if (!mounted) return
          setCartId(null)
          setItems([])
          setGuestItems(savedGuestItems)
          setSummary(guestSummary)
        }
      } catch (error) {
        console.error('Failed to initialize shopping cart', error)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [authLoading, user?.id])

  const handleAddToCart = async (variantId: string, quantity = 1) => {
    if (loading) throw new Error('Your bag is still loading. Please try again.')
    if (user) {
      if (!cartId) throw new Error('Your signed-in bag is still loading. Please try again.')
      await addToCart({ cartId, variantId, quantity })
      await refreshCartData(cartId)
      return
    }

    const existing = guestItems.find((item) => item.variantId === variantId)
    const updatedItems = existing
      ? guestItems.map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      : [...guestItems, { variantId, quantity }]
    saveGuestItems(updatedItems)
    setGuestItems(updatedItems)
    setSummary(await getGuestCartSummary(updatedItems))
  }

  const handleSetQuantity = async (itemId: string, quantity: number) => {
    if (user && cartId) {
      await updateCartItemQuantity({ itemId, quantity })
      await refreshCartData(cartId)
      return
    }

    const variantId = itemId.replace(/^guest-/, '')
    const updatedItems = quantity <= 0
      ? guestItems.filter((item) => item.variantId !== variantId)
      : guestItems.map((item) =>
          item.variantId === variantId ? { ...item, quantity } : item,
        )
    saveGuestItems(updatedItems)
    setGuestItems(updatedItems)
    setSummary(await getGuestCartSummary(updatedItems))
  }

  const handleRemoveItem = async (itemId: string) => {
    if (user && cartId) {
      await removeCartItem(itemId)
      await refreshCartData(cartId)
      return
    }

    const variantId = itemId.replace(/^guest-/, '')
    const updatedItems = guestItems.filter((item) => item.variantId !== variantId)
    saveGuestItems(updatedItems)
    setGuestItems(updatedItems)
    setSummary(await getGuestCartSummary(updatedItems))
  }

  const handleClear = async () => {
    if (user && cartId) {
      await clearCart(cartId)
      await refreshCartData(cartId)
      return
    }

    localStorage.removeItem(GUEST_CART_KEY)
    setGuestItems([])
    setSummary({ itemCount: 0, subtotal: 0, items: [] })
  }

  return (
    <CartContext.Provider
      value={{
        cartId,
        loading,
        items,
        summary,
        addToCart: handleAddToCart,
        setQuantity: handleSetQuantity,
        removeItem: handleRemoveItem,
        clear: handleClear,
        refresh,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
