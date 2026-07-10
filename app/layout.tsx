import type { Metadata } from "next";
import { Baloo_Tamma_2, Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const baloo = Baloo_Tamma_2({ subsets: ["kannada", "latin"], variable: "--font-baloo", weight: ["500", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Vedike — Kannada Community Platform", template: "%s · Vedike" },
  description: "A modern digital stage for Kannada community events, competitions, submissions and voting.",
  openGraph: { title: "Vedike", description: "Where culture meets community.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${bricolage.variable} ${instrument.variable} ${baloo.variable}`}><body>{children}</body></html>;
}
