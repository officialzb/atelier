import type { Metadata } from "next";
import {
  Instrument_Serif,
  Inter_Tight,
  JetBrains_Mono,
  Fraunces,
  Inter,
  IBM_Plex_Mono,
  Newsreader,
  Instrument_Sans,
  Space_Mono,
} from "next/font/google";
import "./brand.css";

// Pairing 1: Instrument (recommended)
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

// Pairing 2: Fraunces
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter-body",
  subsets: ["latin"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// Pairing 3: Newsreader
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yolodex brand",
  description:
    "Living brand guidelines for Yolodex: blueprint, voice, team, colour, type and the annotated-ad device.",
};

const fontVars = [
  instrumentSerif.variable,
  interTight.variable,
  jetbrainsMono.variable,
  fraunces.variable,
  inter.variable,
  plexMono.variable,
  newsreader.variable,
  instrumentSans.variable,
  spaceMono.variable,
].join(" ");

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <div className={fontVars}>{children}</div>;
}
