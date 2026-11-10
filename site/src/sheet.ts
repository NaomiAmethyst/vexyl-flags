// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Naomi Persephone Amethyst <naomi@amethyst.name>

// The construction view: a flag's construction sheet, drawn by Vexyl's library with every size
// worked out from the file, with how it's drawn, and saved as SVG or PNG, or printed.

import { constructionSvg, type ConstructionOptions, type Flag, type SheetFont, type SheetForm } from "vexyl";
import { el, esc, save } from "./common.js";
import { cappedNote, pngForPaper, svgToPng } from "./png.js";

interface SheetPrefs {
	units: "grid" | "hoist" | "mm";
	hoistMm: number;
	/** Paper or dark, or null to follow the site's theme until someone chooses. */
	theme: "paper" | "dark" | null;
	paper: "a4" | "letter" | "fit";
	dpi: 150 | 300 | 600;
	/** "flag", "reverse", or "variant:" and a variant's name. One a flag doesn't have draws the flag itself. */
	form: string;
}

const prefsKey = "vexyl-flags-sheet";

function readPrefs(): SheetPrefs {
	let v: Record<string, unknown> = {};
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(prefsKey) ?? "{}");
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
			v = parsed as Record<string, unknown>;
		}
	} catch {
		// Nothing kept that can be read, so the defaults.
	}
	const one = <T>(x: unknown, list: readonly T[], fallback: T): T => (list.includes(x as T) ? (x as T) : fallback);
	const mm = v.hoistMm;
	return {
		units: one(v.units, ["grid", "hoist", "mm"] as const, "grid"),
		hoistMm: typeof mm === "number" && Number.isFinite(mm) && mm > 0 && mm <= 1e6 ? mm : 1000,
		theme: one(v.theme, ["paper", "dark", null] as const, null),
		paper: one(v.paper, ["a4", "letter", "fit"] as const, "a4"),
		dpi: one(v.dpi, [150, 300, 600] as const, 300),
		form: typeof v.form === "string" && v.form.length <= 300 && /^(flag|reverse|variant:.+)$/s.test(v.form) ? v.form : "flag",
	};
}

function keep(prefs: SheetPrefs): void {
	try {
		localStorage.setItem(prefsKey, JSON.stringify(prefs));
	} catch {
		// Storage can be off or full. The choice still holds for this visit.
	}
}

const unitHelp = {
	grid: "Grid units, as the file writes them.",
	hoist: "Parts of the hoist, H, the way many laws give them.",
	mm: "Millimetres, for making a flag of a given size.",
};

const seg = (id: string, label: string, options: [string, string][]): string =>
	`<div class="nx-seg" role="group" aria-label="${esc(label)}" id="${id}">${options.map(([v, text]) => `<button type="button" data-value="${esc(v)}" aria-pressed="false">${esc(text)}</button>`).join("")}</div>`;

/** The forms a sheet can be drawn for: the flag, its reverse, and each of its variants. */
const formsOf = (variants: readonly string[]): [string, string][] => [["flag", "Flag"], ["reverse", "Reverse"], ...variants.map((v): [string, string] => [`variant:${v}`, v.charAt(0).toUpperCase() + v.slice(1)])];

/** A form as the library's options name it, or the flag itself for one this flag doesn't have. */
function formOf(flag: Flag, id: string): SheetForm {
	if (id === "reverse") {
		return { side: "reverse" };
	}
	const name = id.startsWith("variant:") ? id.slice("variant:".length) : null;
	return name !== null && Object.hasOwn(flag.variants, name) ? { variant: name } : {};
}

/** The view's HTML, which `wireSheet` then fills in. */
export function sheetHtml(name: string, variants: readonly string[]): string {
	return `<div class="sheet-layout">
    <aside class="sheet-options" aria-label="Sheet options">
      <section class="card" aria-labelledby="sh-form-h">
        <h2 id="sh-form-h" class="nx-label">Form</h2>
        ${seg("sh-form", "Form", formsOf(variants))}
        <p class="small" id="sh-form-help"></p>
      </section>
      <section class="card" aria-labelledby="sh-units-h">
        <h2 id="sh-units-h" class="nx-label">Sizes in</h2>
        ${seg("sh-units", "Sizes in", [["grid", "Grid"], ["hoist", "Hoist"], ["mm", "mm"]])}
        <p class="small" id="sh-units-help"></p>
        <label class="field" id="sh-mm-field">Hoist in millimetres
          <input class="nx-input" id="sh-mm" type="number" min="1" max="1000000" step="1" inputmode="numeric">
        </label>
      </section>
      <section class="card" aria-labelledby="sh-look-h">
        <h2 id="sh-look-h" class="nx-label">Sheet</h2>
        ${seg("sh-theme", "Sheet", [["paper", "Paper"], ["dark", "Dark"]])}
        <p class="small" id="sh-theme-help"></p>
      </section>
      <section class="card" aria-labelledby="sh-paper-h">
        <h2 id="sh-paper-h" class="nx-label">Paper</h2>
        ${seg("sh-paper", "Paper", [["a4", "A4"], ["letter", "Letter"], ["fit", "Fit the flag"]])}
        ${seg("sh-dpi", "PNG resolution", [["150", "150 dpi"], ["300", "300 dpi"], ["600", "600 dpi"]])}
        <p class="small" id="sh-png-note" aria-live="polite"></p>
        <div class="actions">
          <button type="button" class="nx-btn" id="sh-svg">Download SVG</button>
          <button type="button" class="nx-ghost" id="sh-png">Download PNG</button>
          <button type="button" class="nx-ghost" id="sh-print">Print</button>
        </div>
        <p class="small">Print makes a PDF too, through the browser’s own printing, on paper the size of the sheet.</p>
        <p class="small status" id="sh-status" aria-live="polite"></p>
      </section>
    </aside>
    <section class="sheet-view" aria-label="The construction sheet">
      <div class="sheet-frame" id="sh-frame"><p class="no-picture">Drawing…</p></div>
      <p class="small">Every number on ${esc(name)}’s sheet comes from its file, worked out exactly. Nothing is measured from the drawing.</p>
    </section>
  </div>`;
}

/** The sheet's fonts, from this site, read once, for a PNG, since a browser drawing an SVG loads none. */
const fontFiles: [string, number, string][] = [
	["Geist", 400, "geist-sans-latin-400-normal"], ["Geist", 500, "geist-sans-latin-500-normal"],
	["Geist Mono", 400, "geist-mono-latin-400-normal"], ["Geist Mono", 500, "geist-mono-latin-500-normal"],
];
let fontsLoading: Promise<SheetFont[]> | null = null;

function sheetFonts(): Promise<SheetFont[]> {
	fontsLoading ??= Promise.all(fontFiles.map(async ([family, weight, file]) => {
		const r = await fetch(`fonts/${file}.woff2`);
		if (!r.ok) {
			throw new Error("the sheet’s fonts couldn’t be loaded");
		}
		return { family, weight, woff2: new Uint8Array(await r.arrayBuffer()) };
	}));
	fontsLoading.catch(() => (fontsLoading = null));
	return fontsLoading;
}

/** The rule that prints a sheet on paper of its own size, which only the construction view has. */
function setPage(widthMm: number, heightMm: number): void {
	let style = document.getElementById("sheet-page") as HTMLStyleElement | null;
	if (style === null) {
		style = document.createElement("style");
		style.id = "sheet-page";
		document.head.append(style);
	}
	style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`;
}

export function leaveSheet(): void {
	document.getElementById("sheet-page")?.remove();
	redraw = null;
}

/** Draws the sheet again when the site's theme changes, for a sheet that follows it. */
let redraw: (() => void) | null = null;
document.addEventListener("vexyl-theme", () => redraw?.());

/** Sets up the view's options, and draws the sheet. `still()` says whether the view is still on screen. */
export function wireSheet(flag: Flag, path: string, tier: string | undefined, name: string, stem: string, still: () => boolean, keepUrl: (url: string) => void): void {
	const prefs = readPrefs();
	let shown: { svg: string; widthMm: number; heightMm: number } | null = null;
	const theme = (): "paper" | "dark" => prefs.theme ?? (document.documentElement.dataset.theme === "light" ? "paper" : "dark");
	const options = (): ConstructionOptions => {
		const o: ConstructionOptions = { units: prefs.units, theme: theme(), paper: prefs.paper, path: `${path}.kdl` };
		const form = formOf(flag, prefs.form);
		if (form.variant !== undefined || form.side !== undefined) {
			o.form = form;
		}
		if (prefs.units === "mm") {
			o.hoistMm = prefs.hoistMm;
		}
		if (tier !== undefined && tier !== "-") {
			o.tier = tier;
		}
		return o;
	};
	const status = (text: string): void => {
		el("sh-status").textContent = text;
	};
	const pressed = (id: string, value: string): void => {
		el(id).querySelectorAll("button").forEach((b) => {
			const on = b.dataset.value === value;
			b.setAttribute("aria-pressed", String(on));
			b.classList.toggle("active", on);
		});
	};
	const pngNote = (): void => {
		const note = el("sh-png-note");
		if (shown === null) {
			note.textContent = "";
			return;
		}
		const size = pngForPaper(shown.widthMm, shown.heightMm, prefs.dpi);
		note.textContent = size.capped ? `${cappedNote(size)}.` : `The PNG is ${size.width} × ${size.height} pixels.`;
		note.classList.toggle("warn", size.capped);
	};
	const controls = (): void => {
		const form = formsOf(Object.keys(flag.variants)).some(([id]) => id === prefs.form) ? prefs.form : "flag";
		pressed("sh-form", form);
		el("sh-form-help").textContent = form === "reverse" ? "The back, as someone behind the flag sees it." : form === "flag" ? "The flag as its file draws it." : "This variant, turned as it turns, and measured as the flag is.";
		pressed("sh-units", prefs.units);
		pressed("sh-theme", theme());
		pressed("sh-paper", prefs.paper);
		pressed("sh-dpi", String(prefs.dpi));
		el("sh-units-help").textContent = unitHelp[prefs.units];
		el("sh-mm-field").hidden = prefs.units !== "mm";
		(el("sh-mm") as HTMLInputElement).value = String(prefs.hoistMm);
		el("sh-theme-help").textContent = theme() === "dark" ? "Purple lines on a dark ground, for the screen." : "Black lines on white, for printing.";
	};
	const draw = (): void => {
		if (!still()) {
			return;
		}
		controls();
		let svg: string;
		try {
			svg = constructionSvg(flag, options());
		} catch (e) {
			shown = null;
			el("sh-frame").innerHTML = `<p class="no-picture">This sheet can’t be drawn: ${esc((e as Error).message)}</p>`;
			pngNote();
			return;
		}
		const m = /width="([0-9.]+)mm" height="([0-9.]+)mm"/.exec(svg);
		shown = { svg, widthMm: Number(m?.[1] ?? 297), heightMm: Number(m?.[2] ?? 210) };
		const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
		keepUrl(url);
		const img = new Image();
		img.className = "print-sheet";
		img.alt = `The construction sheet of ${name}, with its sizes marked`;
		img.src = url;
		const frame = el("sh-frame");
		frame.style.aspectRatio = `${shown.widthMm} / ${shown.heightMm}`;
		frame.replaceChildren(img);
		setPage(shown.widthMm, shown.heightMm);
		pngNote();
	};
	const choose = (id: string, set: (v: string) => void): void => {
		el(id).querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
			set(b.dataset.value!);
			keep(prefs);
			draw();
		}));
	};
	choose("sh-form", (v) => (prefs.form = v));
	choose("sh-units", (v) => (prefs.units = v as SheetPrefs["units"]));
	choose("sh-theme", (v) => (prefs.theme = v as "paper" | "dark"));
	choose("sh-paper", (v) => (prefs.paper = v as SheetPrefs["paper"]));
	el("sh-dpi").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
		prefs.dpi = Number(b.dataset.value) as SheetPrefs["dpi"];
		keep(prefs);
		pressed("sh-dpi", String(prefs.dpi));
		pngNote();
	}));
	el("sh-mm").addEventListener("change", () => {
		const v = Number((el("sh-mm") as HTMLInputElement).value);
		if (Number.isFinite(v) && v > 0 && v <= 1e6) {
			prefs.hoistMm = v;
			keep(prefs);
			draw();
		}
	});
	/** The file's name for the form shown: the flag's own, or with the form after it. */
	const named = (): string => {
		const form = formOf(flag, prefs.form);
		const tail = form.variant !== undefined ? `-${form.variant}${form.side === "reverse" ? "-reverse" : ""}` : form.side === "reverse" ? "-reverse" : "";
		return `${stem}${tail.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
	};
	el("sh-svg").addEventListener("click", () => {
		if (shown !== null) {
			save(`${named()}-construction.svg`, new Blob([shown.svg], { type: "image/svg+xml" }));
			status("Downloaded the sheet as SVG.");
		}
	});
	el("sh-png").addEventListener("click", async () => {
		if (shown === null) {
			return;
		}
		const size = pngForPaper(shown.widthMm, shown.heightMm, prefs.dpi);
		status("Drawing the PNG…");
		try {
			const svg = constructionSvg(flag, { ...options(), fonts: await sheetFonts() });
			save(`${named()}-construction.png`, await svgToPng(svg, size));
			status(size.capped ? `Downloaded the PNG, at ${size.width} × ${size.height}, the most a browser can draw.` : "Downloaded the sheet as PNG.");
		} catch (e) {
			status(`The PNG couldn’t be made: ${(e as Error).message}.`);
		}
	});
	el("sh-print").addEventListener("click", () => {
		if (shown !== null) {
			setPage(shown.widthMm, shown.heightMm);
			print();
		}
	});
	redraw = () => {
		if (prefs.theme === null) {
			draw();
		}
	};
	draw();
}
