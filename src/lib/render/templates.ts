/**
 * SVG slide templates (1080x1350, 4:5 portrait). Rendered to PNG with sharp.
 * Three built-in templates: minimal, bold, gradient.
 */

export type TemplateId = "minimal" | "bold" | "gradient";

export interface BrandConfig {
  template: TemplateId;
  bg: string;
  fg: string;
  accent: string;
  handle: string;
}

export interface Slide {
  heading: string;
  body: string;
}

export const DEFAULT_BRAND: BrandConfig = {
  template: "minimal",
  bg: "#0f172a",
  fg: "#f8fafc",
  accent: "#38bdf8",
  handle: "",
};

export function normalizeBrand(raw: unknown): BrandConfig {
  const b = (raw ?? {}) as Partial<BrandConfig>;
  const template: TemplateId = ["minimal", "bold", "gradient"].includes(b.template as string)
    ? (b.template as TemplateId)
    : "minimal";
  return {
    template,
    bg: b.bg || DEFAULT_BRAND.bg,
    fg: b.fg || DEFAULT_BRAND.fg,
    accent: b.accent || DEFAULT_BRAND.accent,
    handle: b.handle || "",
  };
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word wrap; truncates with an ellipsis if maxLines is exceeded. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

const W = 1080;
const H = 1350;
const PAD = 96;
const FONT = "DejaVu Sans, Arial, Helvetica, sans-serif";

function textBlock(
  lines: string[],
  x: number,
  y: number,
  size: number,
  fill: string,
  weight = 400,
  anchor: "start" | "middle" = "start"
): string {
  const lh = size * 1.3;
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * lh}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(l)}</text>`
    )
    .join("\n");
}

export function renderSlideSVG(
  slide: Slide,
  index: number,
  total: number,
  brandRaw: Partial<BrandConfig> | unknown
): string {
  const brand = normalizeBrand(brandRaw);
  const isTitle = index === 0;
  const isCta = index === total - 1;

  const headingSize = isTitle ? 84 : 60;
  const headingLines = wrapText(slide.heading, isTitle ? 18 : 26, 5);
  const bodyLines = wrapText(slide.body, 42, 12);

  let background = "";
  let headingColor = brand.fg;
  let bodyColor = brand.fg;
  let headingY = PAD + headingSize;

  if (brand.template === "gradient") {
    background = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${brand.bg}"/>
        <stop offset="100%" stop-color="${brand.accent}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  } else if (brand.template === "bold") {
    const bandH = isTitle ? 620 : 460;
    background = `
    <rect width="${W}" height="${H}" fill="${brand.bg}"/>
    <rect width="${W}" height="${bandH}" fill="${brand.accent}"/>`;
    headingColor = brand.bg;
    headingY = PAD + headingSize;
  } else {
    // minimal
    background = `
    <rect width="${W}" height="${H}" fill="${brand.bg}"/>
    <rect x="${PAD}" y="${PAD - 24}" width="140" height="14" rx="7" fill="${brand.accent}"/>`;
    headingY = PAD + headingSize + 40;
  }

  if (isTitle && brand.template !== "bold") {
    headingY = 420;
  }

  const bodyY =
    headingY + headingLines.length * headingSize * 1.3 + (isTitle ? 60 : 48);

  const ctaBadge = isCta
    ? `<rect x="${PAD}" y="${H - 340}" width="330" height="86" rx="43" fill="${brand.accent}"/>
       <text x="${PAD + 165}" y="${H - 284}" font-family="${FONT}" font-size="36" font-weight="700" fill="${brand.template === "gradient" ? brand.bg : brand.bg}" text-anchor="middle">FOLLOW FOR MORE</text>`
    : "";

  const swipeHint =
    isTitle && total > 1
      ? `<text x="${W - PAD}" y="${H - 120}" font-family="${FONT}" font-size="34" fill="${brand.template === "bold" ? brand.fg : brand.accent}" text-anchor="end">Swipe →</text>`
      : "";

  const footer = `
    <text x="${PAD}" y="${H - 60}" font-family="${FONT}" font-size="30" fill="${brand.fg}" opacity="0.75">${escapeXml(brand.handle)}</text>
    <text x="${W - PAD}" y="${H - 60}" font-family="${FONT}" font-size="30" fill="${brand.fg}" opacity="0.75" text-anchor="end">${index + 1}/${total}</text>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${background}
  ${textBlock(headingLines, PAD, headingY, headingSize, headingColor, 700)}
  ${textBlock(bodyLines, PAD, bodyY, 42, bodyColor, 400)}
  ${ctaBadge}
  ${swipeHint}
  ${footer}
</svg>`;
}
