# 05 — Component Tree

All components live in `src/components/`. Page-level components live in `src/app/`. Server Components (SC) fetch their own data; Client Components (CC) receive all data as props and manage local state/interactions.

Design system rules that apply everywhere: 0px border radius, no box-shadow, Montserrat headlines in all-caps, Hanken Grotesk body, Space Grotesk labels, 8px base spacing unit.

---

## Shared / Global Components

```
src/components/
│
├── Navbar (CC)
│   │   Responsibility: top navigation bar, auth state, "My Orders" link
│   │   Props: none (reads Supabase session via hook internally)
│   ├── NavLogo (SC)
│   │     Responsibility: brand wordmark, links to /
│   │     Props: none
│   └── NavAuthButton (CC)
│         Responsibility: shows "My Orders" + avatar if authed, "Sign In" if not
│         Props: none (reads session internally)
│
├── FrameCard (SC)
│   │   Responsibility: renders one frame in the catalogue grid
│   │   Props: { id, name, slug, widthMm, heightMm, pricePaise, imageUrl? }
│   └── FrameCardCTA (CC)
│         Responsibility: "Design This Frame" button — handles auth redirect logic
│         Props: { frameSlug, frameId }
│
├── OrderStatusBadge (SC)
│   │   Responsibility: coloured pill for order status text
│   │   Props: { status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' }
│   └── (no children)
│
├── DesignPreview (CC)
│   │   Responsibility: shows the exported PNG design with a loading skeleton while the signed URL resolves
│   │   Props: { storagePath: string }
│   └── (no children)
│
├── TrackingInput (CC)
│   │   Responsibility: admin form fields for tracking number + courier; controlled inputs
│   │   Props: { orderId, initialTracking?, initialCourier?, onSave: () => void }
│   └── (no children)
│
└── PriceDisplay (SC)
      Responsibility: formats paise to "₹X,XXX" string
      Props: { amountPaise: number }
```

---

## HomePage (`/`)

```
app/page.tsx (SC)
│   Fetches: frames (active, ordered)
│
├── Navbar (CC)
│
├── HeroSection (SC)
│   │   Responsibility: brand headline, subheadline, single CTA
│   │   Props: none (static content)
│   └── HeroCTA (CC)
│         Responsibility: "Browse Frames" smooth-scroll button
│         Props: { targetId: string }
│
├── FrameGrid (SC)
│   │   Responsibility: responsive 2→4 column grid layout
│   │   Props: { frames: Frame[] }
│   └── FrameCard[] (SC) — one per frame
│         └── FrameCardCTA (CC)
│
└── Footer (SC)
      Responsibility: Instagram link, contact email, © line
      Props: none
```

---

## Frame Detail Page (`/frames/[slug]`)

```
app/frames/[slug]/page.tsx (SC)
│   Fetches: single frame by slug
│
├── Navbar (CC)
│
├── FrameDetailHeader (SC)
│   │   Responsibility: frame name, physical dimensions, price
│   │   Props: { name, widthMm, heightMm, pricePaise }
│   └── PriceDisplay (SC)
│
├── FrameImageCarousel (CC)
│   │   Responsibility: scrollable gallery of sample poster images from /posterx_posters/
│   │   Props: { images: string[] }
│   └── (no sub-components)
│
├── FrameDescription (SC)
│   │   Responsibility: renders frame description text
│   │   Props: { description: string }
│
└── DesignCTASection (CC)
      Responsibility: "Design Your Frame" button + Canva flow initiation
      Props: { frameId: string, frameSlug: string }
      Internal state: loading, error
      On click: calls /api/canva/create-design; on success redirects to editUrl;
                on no-token response redirects to /api/canva/auth with returnTo stored
```

---

## Design Review Page (`/design/[designId]`)

```
app/design/[designId]/page.tsx (CC)
│   No server data fetch — all state managed client-side
│
├── Navbar (CC)
│
├── ExportController (CC)
│   │   Responsibility: manages the full export state machine
│   │   Props: { designId: string, frameId: string }
│   │   States: idle | exporting | success | error
│   │
│   ├── ExportIdleView (SC)
│   │     Responsibility: "Export My Design" button + instruction copy
│   │     Props: { onExport: () => void }
│   │
│   ├── ExportProgressView (CC)
│   │     Responsibility: animated progress bar + status text during polling
│   │     Props: { attempt: number, maxAttempts: number }
│   │
│   ├── ExportSuccessView (SC)
│   │     Responsibility: shows preview + checkout CTA + "edit again" link
│   │     Props: { previewUrl, designId, frameId, printPath }
│   │     └── DesignPreview (CC)
│   │
│   └── ExportErrorView (CC)
│         Responsibility: error message + retry button + Canva edit link
│         Props: { onRetry: () => void, designId: string }
│
└── (Navbar only other element)
```

---

## Checkout Page (`/checkout`)

```
app/checkout/page.tsx (CC)
│   Reads session storage for { designId, frameId, previewPath, printPath }
│   Fetches frame price from /api/payments/create-order on submit
│
├── Navbar (CC)
│
├── CheckoutLayout (SC)
│   │   Responsibility: two-column layout (form left, summary right) collapsing to single on mobile
│   │   Props: { children }
│   │
│   ├── OrderSummaryPanel (SC)
│   │   │   Responsibility: shows what the user is buying
│   │   │   Props: { frameName, pricePaise, previewPath }
│   │   └── DesignPreview (CC)
│   │       PriceDisplay (SC)
│   │
│   └── DeliveryForm (CC)
│         Responsibility: controlled form for all address fields + phone
│         Props: { onSubmit: (formData) => void, isLoading: boolean }
│         Fields: name, phone, address_line1, address_line2, city, state, pincode
│
└── PaymentButton (CC)
      Responsibility: calls create-order, opens Razorpay modal, handles callback
      Props: { frameId, formData, previewPath, printPath, designId }
      Internal state: loading, error
```

---

## Order History Page (`/orders`)

```
app/orders/page.tsx (SC)
│   Fetches: orders for current user (id, status, frame name, amount, date)
│
├── Navbar (CC)
│
├── OrdersTable (SC)
│   │   Responsibility: renders the list of orders
│   │   Props: { orders: OrderSummary[] }
│   └── OrderRow[] (SC)
│         Responsibility: one row — order ID, frame, date, amount, status badge, link
│         Props: { order: OrderSummary }
│         └── OrderStatusBadge (SC)
│
└── OrdersEmptyState (SC)
      Responsibility: shown when orders array is empty
      Props: none
```

---

## Order Detail Page (`/orders/[orderId]`)

```
app/orders/[orderId]/page.tsx (SC)
│   Fetches: single order by id (RLS enforces ownership)
│
├── Navbar (CC)
│
├── OrderStatusStepper (SC)
│   │   Responsibility: visual 4-step progress line
│   │   Props: { currentStatus: string }
│
├── DesignPreview (CC)
│     Props: { storagePath }
│
├── OrderMetaPanel (SC)
│   │   Responsibility: order ID, date, amount, frame name
│   │   Props: { order }
│   └── PriceDisplay (SC)
│
└── TrackingPanel (SC)
      Responsibility: shows tracking number + courier when status = shipped/delivered; else "not shipped yet"
      Props: { trackingNumber?, courier?, status }
```

---

## Admin Dashboard (`/admin`)

```
app/admin/page.tsx (SC)
│   Fetches: all orders joined with frame names
│
├── Navbar (CC)
│
├── AdminStatusTabs (CC)
│   │   Responsibility: filter tabs (All / Pending / Processing / Shipped / Delivered)
│   │   Props: { counts: Record<status, number>, activeTab, onTabChange }
│
└── AdminOrdersTable (SC)
      │   Responsibility: table of all orders
      │   Props: { orders: AdminOrderSummary[] }
      └── AdminOrderRow[] (SC)
            Responsibility: one row — ID, customer, frame, amount, status badge, "View" link
            Props: { order: AdminOrderSummary }
            └── OrderStatusBadge (SC)
```

---

## Admin Order Detail Page (`/admin/orders/[orderId]`)

```
app/admin/orders/[orderId]/page.tsx (SC)
│   Fetches: single order (all fields) joined with frame name
│
├── Navbar (CC)
│
├── DesignPreview (CC)
│     Props: { storagePath }
│
├── DownloadDesignButton (CC)
│     Responsibility: calls /api/admin/orders/[id]/download, opens signed URL in new tab
│     Props: { orderId }
│
├── CustomerInfoPanel (SC)
│   │   Responsibility: displays name, phone, full address read-only
│   │   Props: { order }
│
└── OrderUpdateForm (CC)
      Responsibility: status dropdown + tracking inputs + save button
      Props: { orderId, initialStatus, initialTracking?, initialCourier?, initialNotes? }
      Internal state: status, trackingNumber, courier, notes, saving, error
      On save: calls PATCH /api/admin/orders/[orderId]
      └── TrackingInput (CC)
```
