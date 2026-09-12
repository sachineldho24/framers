/**
 * Renders an exported design image from a (signed) URL.
 * Uses a plain <img> because the source is a short-lived Supabase signed URL on
 * a dynamic host, which next/image's remotePatterns can't easily allow-list.
 */
export function DesignPreview({
  url,
  alt = "Your design",
  className = "",
}: {
  url: string;
  alt?: string;
  className?: string;
}) {
  return (
    <div
      className={`border-2 border-border-high-contrast bg-surface-lowest ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="h-auto w-full" />
    </div>
  );
}
