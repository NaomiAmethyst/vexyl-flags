// The flag view: everything about one flag, read from its file with Vexyl's library. It draws the
// flag with its variants and sides, and saves what's asked for, one view as SVG or PNG or every view
// as a zip, or the file itself. Its other view is the flag's construction sheet, in sheet.ts.

import { locate, model, parse, shareEncode, svg, type Flag } from "vexyl";
import {
	browseHref, editorUrl, el, type Entry, esc, fileText, flagHref, githubFile, imageOf, label, ratioText, repo, repoUrl, release, save,
	svgSize, svgUrl,
} from "./common.js";
import { cappedNote, pngForHeight, svgOwnSize, svgToPng } from "./png.js";
import { leaveSheet, sheetHtml, wireSheet } from "./sheet.js";
import { zip } from "./zip.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Plain = any;

/** A share link longer than this is likely to be cut short by chat programs and mail clients. It's
 * the length past which Vexyl web's own Share page warns. */
const shareMost = 8 * 1024;

const tierMeaning: Record<string, string> = {
	A: "The defining source was read, and it covers the flag’s geometry, proportion included.",
	B: "The defining source was read, and gaps were filled from labeled secondary sources.",
	C: "The defining source wasn’t read.",
	"-": "Written before evidence tiers, and not graded yet.",
};

/** Which of a flag's two views is shown: the flag, or its construction sheet. */
export type Mode = "flag" | "construction";

/** Whether pictures download as SVG or PNG, which is remembered for every flag. */
const formatKey = "vexyl-flags-format";

function savedFormat(): "svg" | "png" {
	try {
		return localStorage.getItem(formatKey) === "png" ? "png" : "svg";
	} catch {
		return "svg";
	}
}

interface View {
	variant: string | null;
	side: "obverse" | "reverse";
	label: string;
	caption: string;
}

// --- Reading the file

/** `//` lines as paragraphs, with an empty comment line between paragraphs. */
function commentBlock(lines: string[]): string[] {
	const paragraphs: string[] = [];
	let current: string[] = [];
	for (const line of lines) {
		const text = line.trim().slice(2).trim();
		if (text !== "") {
			current.push(text);
		} else if (current.length > 0) {
			paragraphs.push(current.join(" "));
			current = [];
		}
	}
	if (current.length > 0) {
		paragraphs.push(current.join(" "));
	}
	return paragraphs;
}

/** The file's opening comment lines, which say how the flag is built. */
function leadingComment(lines: string[]): string[] {
	const end = lines.findIndex((l) => !l.trim().startsWith("//"));
	return commentBlock(lines.slice(0, end < 0 ? lines.length : end));
}

/** The comment lines directly above line `n` (from 1), which are a variant's own notes. */
function commentAbove(lines: string[], n: number): string[] {
	let start = n - 1;
	while (start > 0 && lines[start - 1]!.trim().startsWith("//")) {
		start--;
	}
	return commentBlock(lines.slice(start, n - 1));
}

// --- Words for what the file says

const number = (n: number): string => String(n);

function and(items: string[]): string {
	return items.length === 1 ? items[0]! : items.slice(0, -1).join(", ") + " and " + items.at(-1);
}

const ccPattern = /^CC-(BY(?:-NC)?(?:-SA|-ND)?)-(\d\.\d)$/;

function spdxName(id: string): string {
	const m = ccPattern.exec(id);
	if (m) {
		return `CC ${m[1]} ${m[2]}`;
	}
	if (id === "CC0-1.0") {
		return "CC0 1.0";
	}
	return ({ "LicenseRef-Public-Domain": "Public domain", "LicenseRef-Copyrighted-Free-Use": "Copyrighted, free use" } as Record<string, string>)[id] ?? id;
}

/** A license as a link to its text, or as plain text where it has none. */
function spdxLink(id: string): string {
	const m = ccPattern.exec(id);
	let url: string;
	if (m) {
		url = `https://creativecommons.org/licenses/${m[1]!.toLowerCase()}/${m[2]}/`;
	} else if (id === "CC0-1.0") {
		url = "https://creativecommons.org/publicdomain/zero/1.0/";
	} else if (id.startsWith("LicenseRef-") || !/^[A-Za-z0-9.+-]+$/.test(id)) {
		return esc(spdxName(id));
	} else {
		url = `https://spdx.org/licenses/${id}.html`;
	}
	return `<a href="${esc(url)}">${esc(spdxName(id))}</a>`;
}

/** A URL as a reader would say it: no scheme or www, and cut short if it's long. */
function shortUrl(url: string): string {
	const text = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
	return text.length <= 64 ? text : text.slice(0, 63) + "…";
}

/** A link, only if it's to a web page, so nothing in a file can make one that runs anything. */
function link(url: string, text?: string): string {
	return /^https?:\/\//.test(url) ? `<a href="${esc(url)}">${esc(text ?? shortUrl(url))}</a>` : esc(text ?? url);
}

/** What an adapted-from URL is called: a Commons file by its name, anything else by its URL. */
function workName(url: string): string {
	try {
		const u = new URL(url);
		const last = decodeURIComponent(u.pathname.replace(/\/$/, "").split("/").at(-1) ?? "");
		if (u.hostname === "commons.wikimedia.org" && last.startsWith("File:")) {
			return last.slice(5).replaceAll("_", " ") + " on Wikimedia Commons";
		}
	} catch {
		// Not a URL: say it as it's written.
	}
	return shortUrl(url);
}

/** What the file says about its rights, and nothing it doesn't. */
function licenseLine(meta: Plain): string {
	const parts: string[] = [];
	const lic: string | undefined = meta.license;
	const render: string | undefined = meta["render-license"];
	if (render) {
		parts.push(`Images of this flag are ${spdxLink(render)}${render === "CC0-1.0" ? ": use them for anything, with no credit needed" : ""}.`);
		parts.push(lic ? `The file itself is ${spdxLink(lic)}.` : "The file itself states no license.");
	} else if (lic === "LicenseRef-Public-Domain") {
		parts.push("This file is marked as public domain, and so are images made from it.");
	} else if (lic) {
		parts.push(`This file is ${spdxLink(lic)}, and so are images made from it.`);
	} else {
		parts.push("This file states no license.");
	}
	for (const work of meta["adapted-from"] ?? []) {
		let text = `It’s adapted from ${link(work.url, workName(work.url))}`;
		if (work.author?.length) {
			text += ", by " + esc(and(work.author));
		}
		if (work.license === "LicenseRef-Public-Domain") {
			text += ", marked as public domain";
		} else if (work.license) {
			text += ", under " + spdxLink(work.license);
		}
		if (work.part) {
			text += ` (for ${esc(work.part)})`;
		}
		parts.push(text + ".");
	}
	const rights: string | undefined = meta["design-rights"];
	if (rights) {
		parts.push("On rights in the design, it says: " + (/^[A-Za-z0-9.+-]+$/.test(rights) ? spdxLink(rights) : esc(rights).replace(/\.$/, "")) + ".");
	}
	for (const r of meta.restriction ?? []) {
		const sources = (r.source ?? []).map((s: string) => link(s)).join(", ");
		parts.push(`It records a restriction: ${esc(r.restriction).replace(/\.$/, "")}` + (sources ? ` (${sources}).` : "."));
	}
	parts.push("Rules about using a flag, apart from copyright, can still apply.");
	return parts.join(" ");
}

/** Every value a palette color gives besides its screen color. */
function colorMore(c: Plain): string[] {
	if (c.gradient) {
		return [`A gradient of ${and(c.gradient)}, along the ${c.along ?? "fly"}`];
	}
	const more: string[] = [];
	for (const [key, word] of [["pantone", "Pantone"], ["ncs", "NCS"], ["ral", "RAL"], ["munsell", "Munsell"], ["thread", "Thread"]]) {
		if (c[key!] !== undefined) {
			more.push(`${word} ${c[key!]}`);
		}
	}
	if (c.cmyk) {
		more.push("CMYK " + c.cmyk.map(number).join(" "));
	}
	for (const d of c.dye ?? []) {
		more.push(`Dye: ${d}`);
	}
	for (const r of c.reference ?? []) {
		more.push(`“${r.value}” in ${r.system}`);
	}
	return more;
}

/** A link that opens the flag in Vexyl web: the flag itself in the link, or for a file too long
 * for that, the editor's own link to the file on GitHub, or nothing. */
function editorHref(text: string, path: string): string | null {
	if (editorUrl === "") {
		return null;
	}
	const base = editorUrl.split("#")[0]!;
	// A file this long can't compress to a link of a sensible length, so it isn't tried.
	if (text.length < 1 << 20) {
		try {
			const share = shareEncode(text);
			if (base.length + 1 + share.length <= shareMost) {
				return `${base}#${share}`;
			}
		} catch {
			// Too large for a link at all.
		}
	}
	if (repo === "" || release.commit === "") {
		return null;
	}
	// The editor reads this as the file in that repository at that commit.
	const ref = `github:${repo}@${release.commit}/${path}.kdl`;
	return base.split("?")[0] + "?open=" + encodeURIComponent(ref).replaceAll("%3A", ":").replaceAll("%2F", "/").replaceAll("%40", "@");
}

// --- The view's HTML

function hoistFly(p: Plain): string {
	return ratioText(p.fly, p.hoist);
}

function viewsOf(m: Plain, variants: { name: string; notes: string[] }[]): View[] {
	const views: View[] = [
		{ variant: null, side: "obverse", label: "Flag, front", caption: "The flag seen from the front, with the hoist on the left." },
		{
			variant: null, side: "reverse", label: "Flag, back",
			caption: m.reverse ? "Seen from behind: this flag’s back has a design of its own." : "Seen from behind: the mirror image of the front, with the hoist on the right.",
		},
	];
	for (const v of variants) {
		const name = label(v.name);
		views.push({ variant: v.name, side: "obverse", label: `${name}, front`, caption: v.notes.length ? v.notes.join(" ") : `${name}.` });
		views.push({ variant: v.name, side: "reverse", label: `${name}, back`, caption: `${name}, seen from behind.` });
	}
	return views;
}

function html(entry: Entry, text: string, m: Plain, views: View[], variants: { name: string }[], comment: string[], colors: string[], series: Entry[], browse: string, mode: Mode): string {
	const meta = m.meta;
	const name: string = meta.name;
	const tier = entry.tier;
	const family = label(entry.family);
	const kindQuery = entry.kind === "hand" ? "hand" : "imported";
	const p = m.proportion;
	const back = browseHref(browse);
	let out = `<nav class="crumbs" aria-label="Breadcrumb">
    <a href="${esc(back)}" data-nav>Flags</a> <span aria-hidden="true">›</span>
    <a href="${esc(browseHref((kindQuery === "hand" ? "" : `kind=${kindQuery}&`) + `family=${encodeURIComponent(entry.family)}`))}" data-nav>${esc(family)}</a> <span aria-hidden="true">›</span>
    <span aria-current="page">${esc(name)}</span>
  </nav>`;
	const tierText = tier === undefined ? "" : tier === "-" ? "Not graded" : "Tier " + tier;
	const tierFact = tier === undefined ? "" : `<span class="tier"><span class="dot ${tier}" aria-hidden="true"></span>${tierText}</span>`;
	const actions: string[] = [];
	const href = editorHref(text, entry.path);
	if (href !== null) {
		actions.push(`<a class="nx-btn" href="${esc(href)}"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg>Open in Vexyl web</a>`);
	}
	if (repoUrl !== "") {
		actions.push(`<a class="nx-ghost" href="${esc(githubFile(entry.path))}">View on GitHub</a>`);
	}
	out += `<div class="title-row">
    <div class="title-block">
      <h1 id="flag-h" tabindex="-1">${esc(name)}</h1>
      <div class="facts">${tierFact}<span>${entry.kind === "hand" ? "Hand-written" : "Imported"}</span><span>${esc(family)}</span><span class="mono">${esc(entry.path)}.kdl</span></div>
    </div>
    <div class="actions">${actions.join("")}</div>
  </div>`;

	// The flag, or its construction sheet, each with an address of its own.
	const tab = (to: Mode, text: string): string => {
		const href = flagHref(entry.path, to === "flag" ? browse : browse ? `view=construction&${browse}` : "view=construction");
		return `<a href="${esc(href)}" data-nav${to === mode ? ' aria-current="page"' : ""}>${text}</a>`;
	};
	out += `<nav class="view-tabs" aria-label="Views of this flag">${tab("flag", "Flag")}${tab("construction", "Construction sheet")}</nav>`;
	if (mode === "construction") {
		return out + sheetHtml(name, variants.map((v) => v.name));
	}

	// The stage, its switches and the caption.
	const variantSeg = variants.length === 0 ? "" : `<div class="nx-seg" role="group" aria-label="Variant" id="variants"><button type="button" data-variant="" class="active" aria-pressed="true">Flag</button>`
		+ variants.map((v) => `<button type="button" data-variant="${esc(v.name)}" aria-pressed="false">${esc(label(v.name))}</button>`).join("") + "</div>";
	out += `<div class="columns"><div class="col-main">
      <section class="card" aria-label="The flag">
        <div class="check stage" id="stage"><p class="no-picture">Drawing…</p></div>
        <div class="stage-row">
          ${variantSeg}
          <div class="nx-seg" role="group" aria-label="Side" id="sides"><button type="button" data-side="obverse" class="active" aria-pressed="true">Front</button><button type="button" data-side="reverse" aria-pressed="false">Back</button></div>
          <span class="spacer"></span>
          <span class="mono" id="view-ratio"></span>
        </div>
        <p class="caption" id="caption">${esc(views[0]!.caption)}</p>
      </section>`;

	// Download.
	out += `<section class="card" aria-labelledby="dl-h">
        <h2 id="dl-h" class="nx-label">Download</h2>
        <div class="dl-row">
          <div class="field">
            <span id="dl-what">What</span>
            <div class="nx-seg" role="group" aria-labelledby="dl-what" id="scopes"><button type="button" data-scope="view" class="active" aria-pressed="true">This view</button><button type="button" data-scope="all" aria-pressed="false">Every view</button></div>
          </div>
          <div class="field">
            <span id="dl-format">Format</span>
            <div class="nx-seg" role="group" aria-labelledby="dl-format" id="formats"><button type="button" data-format="svg" aria-pressed="false">SVG</button><button type="button" data-format="png" aria-pressed="false">PNG</button></div>
          </div>
          <label class="field">Height in pixels
            <input class="nx-input" id="height" type="number" min="16" max="8000" step="1" value="600" inputmode="numeric">
          </label>
          <span class="mono" id="size-note"></span>
          <span class="spacer"></span>
          <div class="actions">
            <button type="button" class="nx-btn" id="download"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg><span id="download-label">Download SVG</span></button>
            <button type="button" class="nx-ghost" id="download-kdl">Download the KDL file</button>
          </div>
        </div>
        <p class="small">${licenseLine(meta)}</p>
      </section>`;

	// Notes and source.
	let notes = "";
	if (meta.description) {
		notes += `<div class="block"><span class="nx-label">Description</span><p>${esc(meta.description)}</p></div>`;
	}
	if (comment.length > 0) {
		notes += `<div class="block"><span class="nx-label">How it’s built</span>${comment.map((c) => `<p>${esc(c)}</p>`).join("")}</div>`;
	}
	if (meta.note?.length) {
		notes += `<div class="block"><span class="nx-label">Notes</span><ul class="notes">${meta.note.map((n: string) => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
	}
	if (notes === "") {
		notes = `<p class="empty">This file has no notes.</p>`;
	}
	const lines = text.split(/\r\n|\r|\n/).length;
	const bytes = new TextEncoder().encode(text).length;
	out += `<section class="card" aria-label="Notes and source">
        <div class="tabs-row" role="tablist" aria-label="Notes and source">
          <button type="button" role="tab" id="tab-notes" aria-controls="panel-notes" aria-selected="true">Notes</button>
          <button type="button" role="tab" id="tab-source" aria-controls="panel-source" aria-selected="false" tabindex="-1">Source</button>
        </div>
        <div class="panel" role="tabpanel" id="panel-notes" aria-labelledby="tab-notes">${notes}</div>
        <div class="panel" role="tabpanel" id="panel-source" aria-labelledby="tab-source" hidden>
          <div class="src-head"><span class="mono">${esc(entry.path.split("/").at(-1))}.kdl · ${lines.toLocaleString("en-US")} lines · ${bytes.toLocaleString("en-US")} bytes</span><span class="spacer"></span><span class="small status" id="copied" aria-live="polite"></span><button type="button" class="nx-ghost" id="copy">Copy</button></div>
          <pre class="src" id="source" tabindex="0" aria-label="The file’s source"></pre>
        </div>
      </section>
    </div>`;

	// The side column: evidence, details, laws and sources, colors, every view.
	out += `<aside class="col-side" aria-label="About this flag">`;
	if (entry.kind === "hand") {
		const t = tier ?? "-";
		out += `<section class="card" aria-labelledby="ev-h">
        <h2 id="ev-h" class="nx-label">Evidence</h2>
        <div class="badge-row"><span class="badge ${t}" aria-hidden="true">${t === "-" ? "–" : t}</span><span class="caption"><span class="visually-hidden">${tierText}: </span>${tierMeaning[t]}</span></div>
        <p class="small">None of this is legal advice, and a law read here could have changed since.</p>
      </section>`;
	} else {
		out += `<section class="card" aria-labelledby="ev-h">
        <h2 id="ev-h" class="nx-label">Evidence</h2>
        <p class="caption">Imported: converted mechanically from a drawing, so it describes that drawing, and hasn’t been checked against any official construction.</p>
      </section>`;
	}
	const details: [string, string][] = [["Proportion", `${hoistFly(p)} <span class="quiet">(hoist ${number(p.hoist)}, fly ${number(p.fly)})</span>`
		+ (m.outline ? `, shaped by its ${esc(m.outline.form)} outline` : "")]];
	details.push(["Variants", esc(variants.map((v) => label(v.name)).join(", ") || "None")]);
	if (m.fold) {
		details.push(["Folds", esc(Object.keys(m.fold).sort().map(label).join(", "))]);
	}
	if (meta.designer?.length) {
		details.push(["Designer", esc(and(meta.designer))]);
	}
	if (meta.encoder?.length) {
		details.push(["Encoder", esc(and(meta.encoder))]);
	}
	if (meta.date || meta.until) {
		details.push(["Date", esc((meta.date ?? "?") + (meta.until ? ` to ${meta.until}` : ""))]);
	}
	if (meta.version) {
		details.push(["Version", esc(meta.version)]);
	}
	if (meta.series) {
		const others = series.filter((o) => o.path !== entry.path);
		const items = others.map((o) => `<li><a href="${esc(flagHref(o.path, browse))}" data-nav>${esc(o.name)}</a>${o.when ? ` <span class="quiet">(${esc(o.when)})</span>` : ""}</li>`).join("");
		details.push(["Series", esc(meta.series) + (items ? `<ul>${items}</ul>` : ` <span class="quiet">(no other versions here)</span>`)]);
	}
	details.push(["License", meta.license ? spdxLink(meta.license) : "None given"]);
	details.push(["Images", meta["render-license"] ? spdxLink(meta["render-license"]) : "Under the file’s license"]);
	if (meta["design-rights"]) {
		details.push(["Design rights", esc(meta["design-rights"])]);
	}
	out += `<section class="card" aria-labelledby="det-h"><h2 id="det-h" class="nx-label">Details</h2><dl class="kv">${details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></section>`;

	const laws: Plain[] = meta.law ?? [];
	const cited = new Set<string>([...laws, ...(meta.restriction ?? [])].flatMap((r: Plain) => r.source ?? []));
	const other: string[] = (meta.source ?? []).filter((s: string) => !cited.has(s));
	if (laws.length > 0 || other.length > 0) {
		out += `<section class="card" aria-labelledby="law-h">`;
		if (laws.length > 0) {
			out += `<h2 id="law-h" class="nx-label">Laws</h2><ul class="list ruled">`
				+ laws.map((law) => `<li><span>${esc(law.law)}</span>${(law.source ?? []).map((s: string) => link(s)).join("")}</li>`).join("") + "</ul>";
		}
		if (other.length > 0) {
			out += `<h2 ${laws.length ? "" : 'id="law-h" '}class="nx-label">${laws.length ? "Other sources" : "Sources"}</h2><ul class="list">${other.map((s) => `<li>${link(s)}</li>`).join("")}</ul>`;
		}
		out += "</section>";
	}

	out += `<section class="card" aria-labelledby="col-h"><h2 id="col-h" class="nx-label">Colors</h2><ul class="list colors">`;
	for (const c of colors) {
		const value = m.palette[c];
		let swatch: string;
		let hex: string;
		if (value.gradient) {
			swatch = `linear-gradient(90deg, ${value.gradient.map((g: string) => m.palette[g]?.color ?? "#000000").join(", ")})`;
			hex = "";
		} else {
			swatch = value.color;
			hex = value.color;
		}
		const more = colorMore(value);
		out += `<li><span class="swatch" aria-hidden="true" style="background: ${esc(swatch)}"></span><span class="color-text"><span>${esc(label(c))} <span class="mono">${esc(hex)}</span></span><span class="small">${esc((more.length ? more : ["No other values given"]).join(" · "))}</span></span></li>`;
	}
	out += "</ul></section>";

	out += `<section class="card" aria-labelledby="views-h"><h2 id="views-h" class="nx-label">Every view</h2><div class="thumbs" id="thumbs"></div></section>`;
	if (repoUrl !== "") {
		const title = encodeURIComponent(`Correction to ${name}`);
		const body = encodeURIComponent(`About ${entry.path}.kdl:\n\n`);
		out += `<a class="correction" href="${esc(repoUrl)}/issues/new?title=${title}&amp;body=${body}">Suggest a correction</a>`;
	}
	out += "</aside></div>";
	return out;
}

// --- Showing it

/** What the view on screen is, so a view that's been left stops changing the page. */
let shown = 0;
let urls: string[] = [];

function failure(text: string): HTMLElement {
	const p = document.createElement("p");
	p.className = "no-picture";
	p.textContent = text;
	return p;
}

/** Shows a message in place of a flag, with a way back. */
function problem(message: string, extra = ""): void {
	el("flag-view").innerHTML = `<div class="hero"><span class="nx-label">Vexyl flags</span><h1 id="flag-h" tabindex="-1">${esc(message)}</h1>${extra}<p><a href="#/" data-nav>Back to the flags</a></p></div>`;
}

/**
 * Shows one flag. `entry` is its line in the manifest, or undefined if there's no such flag, and
 * `browse` is the browse view's query, which links back keep. Gives the flag's name once it's read.
 */
export async function showFlag(path: string, entry: Entry | undefined, flags: Entry[], browse: string, mode: Mode = "flag"): Promise<string | null> {
	const me = ++shown;
	leaveSheet();
	for (const u of urls) {
		URL.revokeObjectURL(u);
	}
	urls = [];
	if (entry === undefined) {
		problem("There’s no flag at this address", "<p>It may have been renamed or removed, or the link may have been cut short.</p>");
		return null;
	}
	el("flag-view").innerHTML = `<h1 id="flag-h" tabindex="-1">${esc(entry.name)}</h1><p class="quiet">Loading its file…</p>`;
	let text: string;
	try {
		text = await fileText(entry.path);
	} catch (e) {
		if (me === shown) {
			const gh = githubFile(entry.path);
			problem(`${entry.name} couldn’t be loaded`, `<p>Its file couldn’t be fetched: ${esc((e as Error).message)}.${gh ? ` It’s also <a href="${esc(gh)}">on GitHub</a>.` : ""}</p>`);
		}
		return entry.name;
	}
	if (me !== shown) {
		return null;
	}
	let flag: Flag;
	let m: Plain;
	try {
		flag = parse(text);
		m = model(flag);
	} catch (e) {
		problem(`${entry.name} can’t be read here`, `<p>${esc((e as Error).message)}</p>`);
		return entry.name;
	}
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	const where = new Map(locate(text).map((s) => [s.path, s.line]));
	const at = (key: string): number => where.get(key) ?? Infinity;
	const variants = Object.keys(m.variant ?? {})
		.map((name) => ({ name, line: at("variant/" + name.replaceAll("%", "%25").replaceAll("/", "%2F")) }))
		.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name))
		.map((v) => ({ name: v.name, notes: Number.isFinite(v.line) ? commentAbove(lines, v.line) : [] }));
	const colors = Object.keys(m.palette).sort((a, b) => at("palette/" + a) - at("palette/" + b) || a.localeCompare(b));
	const series = m.meta.series ? flags.filter((f) => f.series === m.meta.series) : [];
	const views = viewsOf(m, variants);
	el("flag-view").innerHTML = html(entry, text, m, views, variants, leadingComment(lines), colors, series, browse, mode);
	if (mode === "construction") {
		wireSheet(flag, entry.path, entry.tier, m.meta.name, entry.path.split("/").at(-1)!, () => me === shown, (u) => urls.push(u));
		return m.meta.name;
	}
	el("source").textContent = text;
	wire(flag, text, views, entry, me);
	return m.meta.name;
}

/** Sets up the view's controls, and draws the stage and every view's thumbnail. */
function wire(flag: Flag, text: string, views: View[], entry: Entry, me: number): void {
	const stem = entry.path.split("/").at(-1)!;
	const name: string = entry.name;
	let current = views[0]!;
	let scope = "view";
	let format = savedFormat();
	const drawn = new Map<string, { svg?: string; url?: string; error?: string }>();
	const key = (v: View): string => (v.variant ?? "") + "/" + v.side;

	const draw = (view: View, height: number): string => svg(flag, view.variant === null ? { height, side: view.side } : { height, side: view.side, variant: view.variant });
	const pageSvg = (view: View): { svg?: string; url?: string; error?: string } => {
		if (!drawn.has(key(view))) {
			try {
				drawn.set(key(view), { svg: draw(view, 600) });
			} catch (e) {
				drawn.set(key(view), { error: (e as Error).message });
			}
		}
		return drawn.get(key(view))!;
	};
	const urlOf = (got: { svg?: string; url?: string }): string => {
		if (got.url === undefined) {
			got.url = svgUrl(got.svg!);
			urls.push(got.url);
		}
		return got.url;
	};
	const press = (b: Element, on: boolean): void => {
		b.setAttribute("aria-pressed", String(on));
		b.classList.toggle("active", on);
	};
	const height = (): number | null => {
		const h = Math.round(Number((el("height") as HTMLInputElement).value));
		return Number.isFinite(h) && h >= 16 && h <= 8000 ? h : null;
	};
	/** The size a view will be at a height, as a PNG, which a browser may draw smaller. */
	const pngOf = (view: View, h: number) => {
		const got = pageSvg(view);
		const d = got.svg ? svgSize(got.svg) : null;
		return d ? pngForHeight(d.width, d.height, h) : null;
	};
	const sizeNote = (): void => {
		const h = height();
		const got = pageSvg(current);
		const d = got.svg ? svgSize(got.svg) : null;
		const note = el("size-note");
		let capped = false;
		if (h === null) {
			note.textContent = "16 to 8,000";
		} else if (scope === "all") {
			capped = format === "png" && views.some((v) => pngOf(v, h)?.capped === true);
			note.textContent = `${views.length} ${format === "png" ? "PNGs" : "files"}, zipped` + (capped ? ", some smaller than asked, as a browser draws no more" : "");
		} else if (d) {
			const size = format === "png" ? pngOf(current, h) : null;
			capped = size?.capped === true;
			note.textContent = capped ? cappedNote(size!) : `${Math.round((h * d.width) / d.height)} × ${h} px`;
		} else {
			note.textContent = "";
		}
		note.classList.toggle("warn", capped);
	};
	const labelDownload = (): void => {
		el("download-label").textContent = scope === "view" ? `Download ${format.toUpperCase()}` : "Download every view";
	};
	const showView = (view: View): void => {
		current = view;
		const got = pageSvg(view);
		const alt = view === views[0] ? `The flag of ${name}` : `The flag of ${name}: ${view.label.toLowerCase()}`;
		el("stage").replaceChildren(got.svg ? imageOf(urlOf(got), alt) : failure(`This view can’t be drawn: ${got.error}`));
		const d = got.svg ? svgSize(got.svg) : null;
		el("view-ratio").textContent = d ? ratioText(d.width, d.height) : "";
		el("caption").textContent = view.caption;
		el("sides").querySelectorAll("button").forEach((b) => press(b, b.dataset.side === view.side));
		document.getElementById("variants")?.querySelectorAll("button").forEach((b) => press(b, b.dataset.variant === (view.variant ?? "")));
		el("thumbs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.key === key(view))));
		sizeNote();
	};
	const pick = (variant: string, side: string): void => {
		const view = views.find((v) => (v.variant ?? "") === variant && v.side === side);
		if (view !== undefined) {
			showView(view);
		}
	};
	const fileName = (view: View): string => stem + (view.variant !== null ? "-" + view.variant : "") + (view.side === "reverse" ? "-back" : "") + "." + format;

	el("sides").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => pick(current.variant ?? "", b.dataset.side!)));
	document.getElementById("variants")?.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => pick(b.dataset.variant!, current.side)));
	el("scopes").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
		scope = b.dataset.scope!;
		el("scopes").querySelectorAll("button").forEach((o) => press(o, o === b));
		labelDownload();
		sizeNote();
	}));
	const showFormat = (): void => el("formats").querySelectorAll("button").forEach((b) => press(b, b.dataset.format === format));
	el("formats").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
		format = b.dataset.format === "png" ? "png" : "svg";
		try {
			localStorage.setItem(formatKey, format);
		} catch {
			// Storage can be off or full. The choice still holds for this visit.
		}
		showFormat();
		labelDownload();
		sizeNote();
	}));
	showFormat();
	labelDownload();
	el("height").addEventListener("input", sizeNote);
	/** A view as a file in the chosen format, at a height. */
	const fileOf = async (view: View, h: number): Promise<Blob> => {
		const svgText = draw(view, h);
		if (format === "svg") {
			return new Blob([svgText], { type: "image/svg+xml" });
		}
		const own = svgOwnSize(svgText);
		if (own === null) {
			throw new Error("it has no size");
		}
		return svgToPng(svgText, pngForHeight(own.width, own.height, h));
	};
	el("download").addEventListener("click", async () => {
		const h = height();
		if (h === null) {
			el("height").focus();
			return;
		}
		try {
			if (scope === "view") {
				save(fileName(current), await fileOf(current, h));
				return;
			}
			const files: { name: string; data: Uint8Array<ArrayBuffer> }[] = [];
			for (const view of views) {
				try {
					files.push({ name: fileName(view), data: new Uint8Array(await (await fileOf(view, h)).arrayBuffer()) });
				} catch {
					// A view that can't be drawn is left out of the zip, as it's left blank on the page.
				}
			}
			save(stem + ".zip", zip(files));
		} catch (e) {
			el("caption").textContent = `That can’t be drawn at that height: ${(e as Error).message}`;
		}
	});
	el("download-kdl").addEventListener("click", () => save(stem + ".kdl", new Blob([text], { type: "text/plain" })));
	el("copy").addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(text);
			el("copied").textContent = "Copied";
		} catch {
			// Without clipboard access, select the source so it can be copied by hand.
			getSelection()?.selectAllChildren(el("source"));
			el("copied").textContent = "Selected: copy it with your keyboard";
		}
		setTimeout(() => (el("copied").textContent = ""), 4000);
	});
	setUpTabs();

	// The thumbnails' buttons first, then the stage, then each thumbnail's picture, with a pause
	// between, so the page answers while a large flag draws.
	const buttons = views.map((view) => {
		const b = document.createElement("button");
		b.type = "button";
		b.className = "thumb";
		b.dataset.key = key(view);
		b.setAttribute("aria-pressed", String(view === current));
		const pic = document.createElement("span");
		pic.className = "check";
		const caption = document.createElement("span");
		caption.textContent = view.label;
		b.append(pic, caption);
		b.addEventListener("click", () => showView(view));
		return b;
	});
	el("thumbs").replaceChildren(...buttons);
	const pause = (): Promise<void> => new Promise((done) => setTimeout(done, 0));
	void (async () => {
		await pause();
		if (me !== shown) {
			return;
		}
		showView(views[0]!);
		for (const [i, view] of views.entries()) {
			await pause();
			if (me !== shown) {
				return;
			}
			const got = pageSvg(view);
			(buttons[i]!.firstChild as HTMLElement).replaceChildren(got.svg ? imageOf(urlOf(got), "") : failure("Can’t be drawn"));
		}
	})();
}

function setUpTabs(): void {
	const tabs = [el("tab-notes"), el("tab-source")];
	const choose = (tab: HTMLElement, focus: boolean): void => {
		for (const t of tabs) {
			const on = t === tab;
			t.setAttribute("aria-selected", String(on));
			t.tabIndex = on ? 0 : -1;
			el(t.getAttribute("aria-controls")!).hidden = !on;
		}
		if (focus) {
			tab.focus();
		}
	};
	tabs.forEach((t, i) => {
		t.addEventListener("click", () => choose(t, false));
		t.addEventListener("keydown", (e) => {
			const step = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key];
			if (step !== undefined) {
				e.preventDefault();
				choose(tabs[(i + step + tabs.length) % tabs.length]!, true);
			} else if (e.key === "Home" || e.key === "End") {
				e.preventDefault();
				choose(tabs[e.key === "Home" ? 0 : tabs.length - 1]!, true);
			}
		});
	});
}
