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
  created_at: string;
  updated_at: string;
};

/** Order joined with its frame name — used by order history and admin list. */
export type OrderWithFrame = Order & {
  frame_name: string;
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
        Update: Partial<Omit<Order, "id">>;
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
