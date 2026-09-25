/**
 * Database row types. Mirrors plan/03-supabase-schema.md.
 * Hand-maintained for v1; can be replaced by `supabase gen types typescript` once
 * the project is linked to a live Supabase instance.
 */

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "created" | "paid" | "failed" | "refunded";

export type DesignSource = "upload";

export type FinishOverlay = "none" | "gloss" | "glass";

export type Frame = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  width_px: number;
  height_px: number;
  width_mm: number;
  height_mm: number;
  price_paise: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type FrameStyle = {
  id: string;
  name: string;
  slug: string;
  material: string;
  color: string;
  molding_color: string;
  molding_width_mm: number;
  texture_url: string | null;
  price_modifier_paise: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Finish = {
  id: string;
  name: string;
  slug: string;
  overlay_kind: FinishOverlay;
  price_modifier_paise: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type DesignSession = {
  id: string;
  user_id: string;
  frame_id: string | null;
  frame_style_id: string | null;
  finish_id: string | null;
  design_source: DesignSource;
  upload_path: string | null;
  mockup_path: string | null;
  crop_x: number;
  crop_y: number;
  crop_scale: number;
  /**
   * Studio document JSON — added by migration 0008. Typed `unknown` because it
   * comes from the database untrusted; run it through `migrateDocument()` before
   * using it. Optional so the app still typechecks (and runs) before 0008.
   */
  document?: unknown;
  document_version?: number;
  title?: string | null;
  thumbnail_path?: string | null;
  print_path?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A studio starting point saved by an admin (migration 0013, simplified in
 * 0014). `document` is typed `unknown` for the same reason as
 * `DesignSession.document`: it comes from the database untrusted and must go
 * through `migrateDocument()` before use, even though the write path already
 * ran it through there once.
 */
export type Template = {
  id: string;
  name: string;
  document: unknown;
  thumbnail_path: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** One photo in a user's library (0015). See `src/lib/uploadLibrary.ts`. */
export type UserUpload = {
  id: string;
  user_id: string;
  path: string;
  sha256: string;
  name: string;
  width: number;
  height: number;
  bytes: number;
  content_type: string;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  frame_id: string;
  design_source: DesignSource;
  design_preview_path: string | null;
  design_print_path: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount_paise: number;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  status: OrderStatus;
  tracking_number: string | null;
  courier: string | null;
  notes: string | null;
  frame_style_id: string | null;
  finish_id: string | null;
  design_session_id: string | null;
  mockup_path: string | null;
  crop_x: number | null;
  crop_y: number | null;
  crop_scale: number | null;
  /**
   * Customer-facing reference (`A1B2C3D4`) — a STORED GENERATED column added by
   * migration 0009 so the admin queue can search on what customers actually
   * quote. Optional so the app still typechecks before 0009 is run, and omitted
   * from Insert/Update below because Postgres rejects writes to it.
   */
  short_ref?: string | null;
  created_at: string;
  updated_at: string;
};

/** Order joined with its frame name — used by order history and admin list. */
export type OrderWithFrame = Order & {
  frame_name: string;
};

/**
 * What an `order_events` row is about. 'status' is fulfilment progress,
 * 'payment' is money, 'tracking' is the consignment, 'note' is free text.
 */
export type OrderEventKind = "status" | "payment" | "tracking" | "note";

/**
 * One immutable entry in an order's timeline (migration 0009). Rows are never
 * updated or deleted, so a corrected status leaves both events on the record.
 * `actor_id` is null when the system wrote it (webhook / verify route).
 */
export type OrderEvent = {
  id: string;
  order_id: string;
  kind: OrderEventKind;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

/**
 * Minimal Supabase Database type for the generic client.
 * Provides table row typing without the full generated schema.
 * NOTE: row types MUST be `type` aliases (not `interface`) so they carry an
 * implicit index signature and satisfy supabase-js's GenericTable constraint.
 */
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      templates: {
        Row: Template;
        Insert: Partial<Template>;
        Update: Partial<Template>;
        Relationships: [];
      };
      user_uploads: {
        Row: UserUpload;
        Insert: Omit<UserUpload, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<UserUpload, "id" | "user_id">>;
        Relationships: [];
      };
      frames: {
        Row: Frame;
        Insert: Omit<Frame, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Frame, "id">>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        // Columns with DB defaults or nullable values are optional on insert.
        Insert: Omit<
          Order,
          | "id"
          | "created_at"
          | "updated_at"
          | "payment_status"
          | "status"
          | "razorpay_payment_id"
          | "address_line2"
          | "tracking_number"
          | "courier"
          | "notes"
          | "design_preview_path"
          | "frame_style_id"
          | "finish_id"
          | "design_session_id"
          | "mockup_path"
          | "crop_x"
          | "crop_y"
          | "crop_scale"
          // Generated column: Postgres errors on any attempt to write it.
          | "short_ref"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          payment_status?: PaymentStatus;
          status?: OrderStatus;
          razorpay_payment_id?: string | null;
          address_line2?: string | null;
          tracking_number?: string | null;
          courier?: string | null;
          notes?: string | null;
          design_preview_path?: string | null;
          frame_style_id?: string | null;
          finish_id?: string | null;
          design_session_id?: string | null;
          mockup_path?: string | null;
          crop_x?: number | null;
          crop_y?: number | null;
          crop_scale?: number | null;
        };
        Update: Partial<Omit<Order, "id" | "short_ref">>;
        Relationships: [];
      };
      order_events: {
        Row: OrderEvent;
        // Append-only: there is no Update path by design, but the shape is
        // required by GenericTable, so it mirrors Insert.
        Insert: Omit<OrderEvent, "id" | "created_at" | "kind"> & {
          id?: string;
          created_at?: string;
          kind?: OrderEventKind;
        };
        Update: Partial<Omit<OrderEvent, "id">>;
        Relationships: [];
      };
      frame_styles: {
        Row: FrameStyle;
        Insert: Omit<FrameStyle, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<FrameStyle, "id">>;
        Relationships: [];
      };
      finishes: {
        Row: Finish;
        Insert: Omit<Finish, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Finish, "id">>;
        Relationships: [];
      };
      design_sessions: {
        Row: DesignSession;
        Insert: Omit<
          DesignSession,
          | "id"
          | "created_at"
          | "updated_at"
          | "frame_id"
          | "frame_style_id"
          | "finish_id"
          | "upload_path"
          | "mockup_path"
          | "crop_x"
          | "crop_y"
          | "crop_scale"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          frame_id?: string | null;
          frame_style_id?: string | null;
          finish_id?: string | null;
          upload_path?: string | null;
          mockup_path?: string | null;
          crop_x?: number;
          crop_y?: number;
          crop_scale?: number;
        };
        Update: Partial<Omit<DesignSession, "id">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
