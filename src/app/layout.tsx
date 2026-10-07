import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Tomorrow } from "next/font/google";
import { Toaster } from "@/ui/kit/sonner";
import { messages } from "@/ui/messages";
import { ThemeProvider } from "@/ui/theme/ThemeProvider";
import { TimeZoneSync } from "@/ui/time-zone/TimeZoneSync";
import "./globals.css";

// next/font has no metrics for the Atkinson faces to size a fallback with.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});

// Tomorrow is not variable: every weight and style is its own preloaded file,
// so each call asks only for what is used.
const tomorrow = Tomorrow({
  variable: "--font-tomorrow",
  weight: ["500", "600"],
  subsets: ["latin"],
});

const tomorrowWordmark = Tomorrow({
  variable: "--font-tomorrow-wordmark",
  weight: "700",
  style: "italic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages set only their own title; the app name is appended once, here.
  title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
  description: messages.app.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class on <html> before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${atkinson.variable} ${atkinsonMono.variable} ${tomorrow.variable} ${tomorrowWordmark.variable} h-full antialiased`}
    >
      <body className="app-bg flex min-h-full flex-col">
        <div className="app-skin" aria-hidden="true" />
        <ThemeProvider>
          <TimeZoneSync />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
