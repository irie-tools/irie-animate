import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Irie Animate",
  description: "Config-driven scroll animation builder for Irie brand sites."
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
