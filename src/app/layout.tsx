import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";
import "./globals.css";
import "./journal.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "A private, friendly food memory journal. Remember your meals and keep your personal observations close.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f8f7f2" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
