import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { messages } from "@/ui/messages";
import { TimeZoneSync } from "@/ui/time-zone/TimeZoneSync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages set only their own title; the app name is appended once, here.
  title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
  description: messages.app.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TimeZoneSync />
        {children}
      </body>
    </html>
  );
}
