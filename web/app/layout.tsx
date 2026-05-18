import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folio — Reads any book aloud, teaches what it sees",
  description:
    "Point your camera at a textbook page. Folio reads it aloud, describes diagrams, and answers questions grounded only in your book. Powered by Gemma 4.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950 text-white">{children}</body>
    </html>
  );
}
