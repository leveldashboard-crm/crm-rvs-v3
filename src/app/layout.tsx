import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "DelegateConnect — International CRM",
  description: "Enterprise-grade delegate management platform for international trade shows. Manage registrations, travel, hotels, flights, and daily reports.",
  keywords: ["delegate management", "CRM", "travel desk", "international trade"],
  authors: [{ name: "DelegateConnect" }],
  openGraph: {
    type: "website",
    title: "DelegateConnect — International CRM",
    description: "Enterprise delegate management platform",
  },
  twitter: {
    card: "summary_large_image",
    title: "DelegateConnect",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            style: {
              fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Inter, sans-serif",
              borderRadius: "12px",
              fontSize: "0.875rem",
            },
          }}
        />
      </body>
    </html>
  );
}
