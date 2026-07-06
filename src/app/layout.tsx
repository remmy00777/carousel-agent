import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SignOutButton } from "../components/SignOutButton";

export const metadata: Metadata = {
  title: "Carousel Agent",
  description: "AI-powered Instagram carousel content agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="brand">▦ Carousel Agent</Link>
          <div className="links">
            <Link href="/dashboard">Dashboard</Link>
            <SignOutButton />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
