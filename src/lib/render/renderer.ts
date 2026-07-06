import sharp from "sharp";

/** Rasterize an SVG slide to PNG (1080x1350). */
export async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}
