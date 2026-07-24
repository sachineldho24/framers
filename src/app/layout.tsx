import type { Metadata } from "next";
import {
  Montserrat,
  Hanken_Grotesk,
  Space_Grotesk,
  Fraunces,
} from "next/font/google";
import "./globals.css";

// Headlines — heavy geometric weight (DESIGN.md: display-lg / headline-lg use 800-900)
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

// Editorial display serif — used for the cinematic /world scene headlines
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// Body copy — high legibility on mobile
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// Labels & metadata — technical "spec sheet" flair
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Framers — Custom Framing, Delivered",
  description:
    "Upload any photo, poster, or print and we'll frame it by hand and ship it to your door. Custom framing made easy, across India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${hanken.variable} ${spaceGrotesk.variable} ${fraunces.variable} h-full`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
