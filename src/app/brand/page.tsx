import { readdirSync } from "node:fs";
import { join } from "node:path";
import BrandGuide from "./BrandGuide";

// Generated visuals land in public/brand (see scripts/brand/generate-visuals.ts).
// The page is static; it lists whatever exists at build time.
function listBrandImages(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "brand"))
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

export default function BrandPage() {
  return <BrandGuide images={listBrandImages()} />;
}
