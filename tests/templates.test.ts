import { describe, expect, it } from "vitest";
import { escapeXml, renderSlideSVG, wrapText, normalizeBrand } from "../src/lib/render/templates";
import { svgToPng } from "../src/lib/render/renderer";

describe("templates", () => {
  it("escapes XML entities", () => {
    expect(escapeXml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&apos;");
  });

  it("wraps and truncates text", () => {
    const lines = wrapText("one two three four five six seven eight", 10, 2);
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("normalizes unknown brand config to defaults", () => {
    const b = normalizeBrand({ template: "nonsense" });
    expect(b.template).toBe("minimal");
    expect(b.bg).toBeTruthy();
  });

  it("renders every template to valid SVG containing the copy", () => {
    for (const template of ["minimal", "bold", "gradient"] as const) {
      const svg = renderSlideSVG(
        { heading: "Money & <growth>", body: "Save more each month." },
        0,
        7,
        { template, bg: "#111", fg: "#eee", accent: "#3af", handle: "@test" }
      );
      expect(svg).toContain("<svg");
      expect(svg).toContain("Money &amp; &lt;growth&gt;");
      expect(svg).toContain("@test");
      expect(svg).toContain("1/7");
    }
  });

  it("rasterizes SVG to a PNG buffer", async () => {
    const svg = renderSlideSVG({ heading: "Test slide", body: "Body copy" }, 1, 3, {});
    const png = await svgToPng(svg);
    // PNG magic bytes
    expect(png.subarray(0, 4).toString("hex")).toBe("89504e47");
  });
});
