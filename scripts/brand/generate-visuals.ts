/**
 * Generate the first batch of Yolodex brand visuals with Gemini's image model
 * ("Nano Banana Pro" = gemini-3-pro-image-preview).
 *
 * Usage (Node 22+, no build step). Put GEMINI_API_KEY=... in .env.local (gitignored), then:
 *   node --env-file=.env.local --experimental-strip-types scripts/brand/generate-visuals.ts
 * or pass the key inline for a one-off:
 *   GEMINI_API_KEY=... node --experimental-strip-types scripts/brand/generate-visuals.ts
 *   ... --only hero-annotated-ad,badger-mark     # subset by id
 *   ... --size 2K                                 # 1K (default) | 2K | 4K
 *   ... --model gemini-2.5-flash-image            # cheaper/faster model
 *   ... --out public/brand                        # output dir (default)
 *
 * Prompts live in docs/brand/visual-prompts.json. Each image may name a
 * `reference` file (e.g. the Yolo Badger character) that is sent alongside
 * the prompt so the model redraws from it rather than inventing a new one.
 *
 * Note: the Claude Code cloud sandbox cannot reach generativelanguage.googleapis.com
 * (proxy returns 403), so run this locally.
 */

import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";

type PromptSpec = {
  id: string;
  file: string;
  aspect: string;
  prompt: string;
  reference?: string;
};

type PromptFile = {
  style_prefix: string;
  negative: string;
  images: PromptSpec[];
};

const ROOT = resolve(import.meta.dirname, "..", "..");

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Gemini image models accept a fixed set of ratios; map the layout ratios we use.
function mapAspect(aspect: string): string {
  const supported = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]);
  if (supported.has(aspect)) return aspect;
  const [w, h] = aspect.split(":").map(Number);
  const r = w / h;
  if (r >= 2.8) return "21:9"; // 4:1 LinkedIn banner: crop after
  if (r >= 1.6) return "16:9"; // 1.91:1 OG image: crop after
  if (r >= 1.2) return "4:3";
  if (r > 0.85) return "1:1";
  if (r > 0.6) return "3:4";
  return "9:16";
}

function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  throw new Error(`Unsupported reference image type: ${path}`);
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error(
      "GEMINI_API_KEY is not set. Export it (or put it in .env.local and run with `node --env-file=.env.local ...`).",
    );
    process.exit(1);
  }

  const model = arg("model", "gemini-3-pro-image-preview")!;
  const imageSize = arg("size", "1K")!;
  const outDir = resolve(ROOT, arg("out", "public/brand")!);
  const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);

  const spec: PromptFile = JSON.parse(
    readFileSync(join(ROOT, "docs/brand/visual-prompts.json"), "utf8"),
  );
  const targets = spec.images.filter((img) => !only || only.includes(img.id));
  if (targets.length === 0) {
    console.error("No prompts matched --only", only);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const ai = new GoogleGenAI({ apiKey });

  let failures = 0;
  for (const img of targets) {
    const parts: Array<Record<string, unknown>> = [];
    if (img.reference) {
      const refPath = resolve(ROOT, img.reference);
      if (!existsSync(refPath)) {
        console.warn(`! ${img.id}: reference ${img.reference} not found, generating without it`);
      } else {
        parts.push({
          inlineData: {
            mimeType: mimeFor(refPath),
            data: readFileSync(refPath).toString("base64"),
          },
        });
        parts.push({ text: "Use the attached image as the character reference." });
      }
    }
    parts.push({
      text: `${spec.style_prefix}\n\n${img.prompt}\n\nAvoid: ${spec.negative}.`,
    });

    process.stdout.write(`→ ${img.id} (${mapAspect(img.aspect)}, ${imageSize}) ... `);
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: mapAspect(img.aspect), imageSize },
        },
      });

      const imagePart = res.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data,
      );
      if (!imagePart?.inlineData?.data) {
        failures++;
        const text = res.text ?? "(no text)";
        console.log(`no image returned. Model said: ${text.slice(0, 200)}`);
        continue;
      }
      const outPath = join(outDir, img.file);
      writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, "base64"));
      console.log(`saved ${outPath}`);
    } catch (err) {
      failures++;
      console.log(`failed: ${(err as Error).message}`);
    }
  }

  if (failures > 0) {
    console.error(`${failures} image(s) failed.`);
    process.exit(2);
  }
}

main();
