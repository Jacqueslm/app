import { Resvg } from "@resvg/resvg-js";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";

const src = "cards";
const out = "cards-png";
const fonts = [
  "tools/fonts/Lato-Regular.ttf",
  "tools/fonts/Lato-Bold.ttf",
];

await mkdir(out, { recursive: true });
const files = (await readdir(src)).filter((f) => f.endsWith(".svg")).sort();

for (const f of files) {
  const svg = await readFile(join(src, f), "utf8");
  const r = new Resvg(svg, {
    font: {
      fontFiles: fonts,
      loadSystemFonts: false,
      defaultFontFamily: "Lato",
      defaultFontSize: 24,
    },
    fitTo: { mode: "width", value: 1080 },
  });
  const png = r.render().asPng();
  const name = f.replace(/\.svg$/, ".png");
  await writeFile(join(out, name), png);
  console.log("OK", name);
}

console.log("done:", files.length, "files ->", out);
