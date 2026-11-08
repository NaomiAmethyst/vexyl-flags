// Builds the collection's website into one folder: the page, its script with Vexyl's TypeScript
// library bundled in, its styles and fonts, and manifest.json, which lists every flag. Nothing is
// drawn here and no flag's file is copied in: the page fetches each file when it's needed.
//
//   node site/build.mjs VEXYL [OUT] [--dev]
//
// VEXYL is a checkout of the Vexyl repo with `npm ci` run in its ts/ and web/ folders, whose
// esbuild, library and fonts this uses. OUT is where the site goes, by default _site/. These come
// from the environment:
//
//   GITHUB_REPOSITORY  This repo, as owner/name, for links to GitHub and fetching its files.
//   RELEASE_TAG        The release the site is built for, such as edge or v1, shown in its footer.
//   GITHUB_SHA         The commit that files are fetched at, or else this checkout's HEAD.
//   EDITOR_URL         Vexyl web's address, for links that open each flag there. Empty or unset
//                      means https://vexyl.amethyst.name/.
//   KDL_BASE_URL       Where files are fetched from instead of raw.githubusercontent.com.
//
// --dev is for trying the site locally: it links this repo's flags/ and imported/ into OUT as _repo/
// and fetches the files from there, so it needs no network.
//
// The output depends only on these and the files, so building twice gives the same site.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const args = process.argv.slice(2).filter((a) => a !== "--dev");
const dev = process.argv.includes("--dev");
if (args.length < 1) {
	console.error("usage: node site/build.mjs VEXYL [OUT] [--dev]");
	process.exit(2);
}
const vexyl = resolve(args[0]);
const out = resolve(args[1] ?? join(root, "_site"));
const { build } = createRequire(join(vexyl, "web", "package.json"))("esbuild");

const env = process.env;
const repo = env.GITHUB_REPOSITORY ?? "";
const tag = env.RELEASE_TAG ?? "";
const commit = env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const editorUrl = env.EDITOR_URL || "https://vexyl.amethyst.name/";
const kdlBase = env.KDL_BASE_URL || (dev ? "_repo/" : "");

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "fonts"), { recursive: true });

// The library's sources, with its dependencies from its own node_modules, or else web/'s, which pin the same.
const shared = {
	bundle: true,
	minify: true,
	format: "esm",
	target: ["es2022"],
	legalComments: "none",
	logLevel: "warning",
	alias: { vexyl: join(vexyl, "ts", "src", "index.ts") },
	nodePaths: [join(vexyl, "ts", "node_modules"), join(vexyl, "web", "node_modules")],
};

await build({
	...shared,
	entryPoints: [join(here, "src", "main.ts")],
	outfile: join(out, "app.js"),
	platform: "browser",
	banner: { js: "/* Vexyl flags. It includes Vexyl's TypeScript library, Apache-2.0, https://github.com/NaomiAmethyst/vexyl, with @bgotink/kdl and fflate, both MIT. */" },
	define: {
		__REPO__: JSON.stringify(repo),
		__EDITOR_URL__: JSON.stringify(editorUrl),
		__KDL_BASE__: JSON.stringify(kdlBase),
	},
});

// The manifest, written by site/manifest.ts with the same library, run by node.
const work = mkdtempSync(join(tmpdir(), "vexyl-flags-"));
try {
	await build({ ...shared, minify: false, entryPoints: [join(here, "manifest.ts")], outfile: join(work, "manifest.mjs"), platform: "node" });
	execFileSync(process.execPath, [join(work, "manifest.mjs"), root, join(out, "manifest.json"), tag, commit], { stdio: "inherit" });
} finally {
	rmSync(work, { recursive: true, force: true });
}

// The page, with the links that need the repo or the editor filled in, or left out.
const attr = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const page = readFileSync(join(here, "index.html"), "utf8")
	.replace(/<!--if repo-->(.*?)<!--end-->/gs, repo ? "$1" : "")
	.replace(/<!--if editor-->(.*?)<!--end-->/gs, editorUrl ? "$1" : "")
	.replaceAll("{{repo-url}}", attr(`https://github.com/${repo}`))
	.replaceAll("{{editor-url}}", attr(editorUrl));
writeFileSync(join(out, "index.html"), page);
copyFileSync(join(here, "site.css"), join(out, "site.css"));
copyFileSync(join(vexyl, "docs", "logo", "vexyl.svg"), join(out, "favicon.svg"));
writeFileSync(join(out, ".nojekyll"), "");

// The fonts, from Vexyl web's own packages.
const fonts = [
	["Geist", "geist-sans", 400, "normal"], ["Geist", "geist-sans", 500, "normal"], ["Geist", "geist-sans", 600, "normal"], ["Geist", "geist-sans", 700, "normal"],
	["Geist Mono", "geist-mono", 400, "normal"], ["Geist Mono", "geist-mono", 500, "normal"],
	["Instrument Serif", "instrument-serif", 400, "normal"], ["Instrument Serif", "instrument-serif", 400, "italic"],
];
let css = "";
for (const [family, pack, weight, style] of fonts) {
	const name = `${pack}-latin-${weight}-${style}.woff2`;
	copyFileSync(join(vexyl, "web", "node_modules", "@fontsource", pack, "files", name), join(out, "fonts", name));
	css += `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url("fonts/${name}") format("woff2"); }\n`;
}
for (const pack of ["geist-sans", "geist-mono", "instrument-serif"]) {
	copyFileSync(join(vexyl, "web", "node_modules", "@fontsource", pack, "LICENSE"), join(out, "fonts", `LICENSE-${pack}.txt`));
}
writeFileSync(join(out, "fonts.css"), css);

if (dev) {
	mkdirSync(join(out, "_repo"));
	for (const folder of ["flags", "imported"]) {
		symlinkSync(join(root, folder), join(out, "_repo", folder));
	}
}
console.log(`built ${out}${dev ? ", fetching files from _repo/" : ""}`);
