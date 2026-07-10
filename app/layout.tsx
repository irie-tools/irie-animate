import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Irie Animate",
  description: "Turn a storefront into an animated website."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
