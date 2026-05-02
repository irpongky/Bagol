const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const providers = ["mangoporn", "xxxparodyhd", "pornwatch"];
const target = process.argv[2];
const toBuild = target ? [target] : providers;

(async () => {
  for (const name of toBuild) {
    const entryPoint = path.join(__dirname, "src", name, "index.js");
    const outfile = path.join(__dirname, "providers", `${name}.js`);

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile,
      minify: false,
      external: ["cheerio-without-node-native"],
    });

    console.log(`Built: providers/${name}.js`);
  }
})();
