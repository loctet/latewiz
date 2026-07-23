const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "public/logo-mark.svg"));

async function render(file, size) {
  await sharp(svg, { density: Math.max(72, size * 3) })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log("wrote", path.relative(root, file), size);
}

(async () => {
  await render(path.join(root, "public/favicon-16x16.png"), 16);
  await render(path.join(root, "public/favicon-32x32.png"), 32);
  await render(path.join(root, "public/apple-touch-icon.png"), 180);
  await render(path.join(root, "public/android-chrome-192x192.png"), 192);
  await render(path.join(root, "public/android-chrome-512x512.png"), 512);
  await render(path.join(root, "public/logo.png"), 512);
  fs.copyFileSync(
    path.join(root, "public/logo-mark.svg"),
    path.join(root, "public/icon.svg")
  );
  fs.copyFileSync(
    path.join(root, "public/logo-mark.svg"),
    path.join(root, "src/app/icon.svg")
  );
  execFileSync(
    "python",
    [
      "-c",
      "from PIL import Image; img=Image.open('public/favicon-32x32.png').convert('RGBA'); img.save('src/app/favicon.ico', format='ICO', sizes=[(16,16),(32,32)]); img.save('public/favicon.ico', format='ICO', sizes=[(16,16),(32,32)]); print('wrote favicon.ico')",
    ],
    { cwd: root, stdio: "inherit" }
  );
})();
