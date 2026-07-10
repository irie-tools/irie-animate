import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Irie Animate",
  description: "Turn any public website into a cinematic animated site with local image-to-video motion."
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
