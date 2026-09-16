/**
 * The new-order alert an operator reads on the framing bench.
 *
 * String-building only, kept apart from `new-order-alert.ts` on purpose: that
 * module exists to talk to Supabase and the mail provider, which is exactly the
 * part that cannot be unit-tested. Everything a test can pin down lives here.
 */

import { formatDateTime, formatPaise, shortOrderId } from "@/lib/format";

/** Field separator. ASCII on purpose: this text travels through providers. */
const SEP = " | ";

export interface NewOrderAlertContext {
  orderId: string;
  /** Customer-facing reference (`A1B2C3D4`). */
  reference: string;
  /** ISO timestamp the order row was created. */
  placedAt: string;
  amountPaise: number;
  paymentId: string | null;
  frameName: string;
  frameSizeMm: { widthMm: number; heightMm: number } | null;
  frameStyle: {
    name: string;
    material: string;
    color: string;
    moldingWidthMm: number;
  } | null;
  finishName: string | null;
  designSource: string;
  designSessionId: string | null;
  crop: { x: number; y: number; scale: number } | null;
  customer: { name: string; phone: string; email: string | null };
  addressLines: string[];
  files: { print: string | null; mockup: string | null; preview: string | null };
  adminUrl: string;
  notes: string | null;
}

export interface AlertMessage {
  subject: string;
  text: string;
  html: string;
  /** The customer, so hitting Reply on the alert answers them, not us. */
  replyTo: string | null;
}

/**
 * "300x400 mm" as one measurement rather than two numbers with a space between
 * them: the operator reads this line to pull a size off the shelf.
 */
export function formatSizeMm(size: {
  widthMm: number;
  heightMm: number;
}): string {
  return `${size.widthMm}x${size.heightMm} mm`;
}

/**
 * The parenthetical after a style name - `(Wood | Walnut | 30mm moulding)` - or
 * `null` when the order predates styles (migration 0006).
 */
export function describeStyle(
  style: NewOrderAlertContext["frameStyle"]
): string | null {
  if (!style) return null;
  const parts = [style.material, style.color]
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return `(${[...parts, `${style.moldingWidthMm}mm moulding`].join(SEP)})`;
}

/** `#A1B2C3D4` from either the stored `short_ref` or the order id. */
export function referenceFor(order: {
  id: string;
  short_ref?: string | null;
}): string {
  return order.short_ref ?? shortOrderId(order.id);
}

/** Customer-supplied text goes into HTML - escape it rather than trust it. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function composeNewOrderAlert(ctx: NewOrderAlertContext): AlertMessage {
  const size = ctx.frameSizeMm ? formatSizeMm(ctx.frameSizeMm) : null;
  const style = describeStyle(ctx.frameStyle);
  const amount = formatPaise(ctx.amountPaise);

  // Reference first, then the two things that decide what gets made: it reads
  // as a subject line and as a phone notification.
  const subject = [
    `New order #${ctx.reference}`,
    ...(ctx.frameStyle ? [ctx.frameStyle.name] : []),
    ...(size ? [size] : []),
    amount,
  ].join(SEP);

  const rows: Array<[string, string]> = [
    ["Order", `#${ctx.reference}`],
    ["Placed", `${formatDateTime(ctx.placedAt)} IST`],
    ["Paid", `${amount}${ctx.paymentId ? `${SEP}${ctx.paymentId}` : ""}`],
    ["Frame", [ctx.frameName, size].filter(Boolean).join(SEP)],
    ["Style", ctx.frameStyle ? `${ctx.frameStyle.name} ${style}` : "-"],
    ["Finish", ctx.finishName ?? "-"],
    ["Design", describeDesign(ctx)],
    ["Ship to", describeAddress(ctx)],
  ];
  if (ctx.notes) rows.push(["Note", ctx.notes]);

  const files = (
    [
      ["Print file", ctx.files.print],
      ["Framed mockup", ctx.files.mockup],
      ["Design preview", ctx.files.preview],
    ] as Array<[string, string | null]>
  ).filter((entry): entry is [string, string] => Boolean(entry[1]));

  const text = [
    ctx.customer.email
      ? `Reply to this email to reach ${ctx.customer.email}.`
      : "This account has no email address - call the number below.",
    "",
    ...rows.map(([label, value]) => `${label.padEnd(10)} ${value}`),
    ...(files.length
      ? ["", ...files.map(([label, url]) => `${label.padEnd(10)} ${url}`)]
      : []),
    "",
    `Admin      ${ctx.adminUrl}`,
    `Order id   ${ctx.orderId}`,
  ].join("\n");

  return {
    subject,
    text,
    html: composeHtml(ctx, rows, files),
    replyTo: ctx.customer.email,
  };
}

function describeDesign(ctx: NewOrderAlertContext): string {
  const crop = ctx.crop
    ? `crop ${ctx.crop.x.toFixed(2)}/${ctx.crop.y.toFixed(2)} @${ctx.crop.scale.toFixed(2)}`
    : null;
  return [ctx.designSource, ctx.designSessionId?.slice(0, 8), crop]
    .filter(Boolean)
    .join(SEP);
}

function describeAddress(ctx: NewOrderAlertContext): string {
  return [
    ctx.customer.name,
    ...ctx.addressLines,
    ctx.customer.phone,
  ]
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

const TH =
  "border:2px solid #000;background:#000;color:#fff;padding:8px 12px;text-transform:uppercase;letter-spacing:.06em;font-size:12px;vertical-align:top;white-space:nowrap";
const TD =
  "border:2px solid #000;padding:8px 12px;vertical-align:top;white-space:pre-wrap";
const SUBHEAD =
  "margin:24px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em";

function composeHtml(
  ctx: NewOrderAlertContext,
  rows: Array<[string, string]>,
  files: Array<[string, string]>
): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="${TH}">${esc(label)}</th><td style="${TD}">${esc(value)}</td></tr>`
    )
    .join("");

  const fileBlock = files
    .map(
      ([label, url]) =>
        `<li style="margin:4px 0"><a href="${esc(url)}" style="color:#000">${esc(label)}</a></li>`
    )
    .join("");

  return `<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;line-height:1.5;color:#000;background:#fff;max-width:720px">
  <table role="presentation" style="border-collapse:collapse;width:100%;border:2px solid #000">${body}</table>
  ${
    fileBlock
      ? `<div style="${SUBHEAD}">Files</div>
  <ul role="list" style="margin:0;padding-left:20px">${fileBlock}</ul>`
      : ""
  }
  <div style="${SUBHEAD}">Next</div>
  <p style="margin:0"><a href="${esc(ctx.adminUrl)}" style="color:#000">Open this order in admin</a></p>
  <p style="margin:16px 0 0;color:#555;font-size:12px">Order id ${esc(ctx.orderId)}${ctx.customer.email ? ` - reply to reach ${esc(ctx.customer.email)}` : ""}</p>
</div>`;
}
