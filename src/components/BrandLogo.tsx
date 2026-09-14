import Image from "next/image";

/** Original wordmark with the flask mapped to the site's neon green (#CCFF00). */
export function BrandLogo({
  className = "w-[156px]",
  preload = false,
}: {
  className?: string;
  preload?: boolean;
}) {
  return (
    <Image
      src="/brand/framers-lab-wordmark-neon.svg"
      alt="Framers Lab"
      width={1200}
      height={254}
      preload={preload}
      unoptimized
      draggable={false}
      className={`block h-auto shrink-0 ${className}`}
    />
  );
}
