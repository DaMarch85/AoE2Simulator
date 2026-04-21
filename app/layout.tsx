import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AoE2 Build Lab",
  description: "Web MVP scaffold for build order and economy simulation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="container-shell py-6">{children}</div>
      </body>
    </html>
  );
}
