import Image from "next/image";

/** Supplied horizontal wordmark, with white lettering for the black site theme. */
export function BrandLogo({
  className = "w-[156px]",
  preload = false,
}: {
  className?: string;
  preload?: boolean;
}) {
  return (
    <Image
      src="/brand/framers-lab-wordmark.png"
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
