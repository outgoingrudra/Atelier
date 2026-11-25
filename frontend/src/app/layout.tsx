import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Atelier — Multiplayer Drawing & Guessing Game",
    template: "%s | Atelier",
  },
  description:
    "Atelier is a free real-time multiplayer drawing and guessing game. Create a private room, invite friends by link or code, draw secret words, and race the clock.",
  keywords: [
    "atelier",
    "atelier drawing game",
    "multiplayer drawing game",
    "drawing and guessing game",
    "online pictionary",
    "skribbl game",
    "draw and guess online",
    "browser party game",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Atelier",
    title: "Atelier — Multiplayer Drawing & Guessing Game",
    description:
      "Create a private drawing room, invite friends by code or link, and guess each other's sketches in real time.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atelier — Multiplayer Drawing & Guessing Game",
    description:
      "Create a private drawing room, invite friends by code or link, and guess each other's sketches in real time.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Atelier — The Drawing Room",
    description:
      "Free real-time multiplayer drawing and guessing game in the browser with private rooms, live canvas sync, and word hints.",
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
