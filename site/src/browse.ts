// The browse view: filters, search and sort over the manifest, cards in pages of 48, and each
// card's picture drawn from its file once the card is on or near the screen. The filters live in
// the address's hash, so a filtered view can be linked, and Back steps through them.

import { parse, svg } from "vexyl";
import { browseHref, el, type Entry, fileText, flagHref, fmt, fold, imageOf, label, shownFor, svgUrl } from "./common.js";

const page = 48;
const fetchesAtOnce = 6;

interface State {
	kind: string;
	family: string;
	tier: string;
	q: string;
	sort: string;
	show: number;
}

const defaults: State = { kind: "hand", family: "all", tier: "any", q: "", sort: "name", show: page };
const tierWords: Record<string, string> = { A: "Tier A", B: "Tier B", C: "Tier C", "-": "Not graded" };
const tierHelp: Record<string, string> = {
	any: "Every hand-written flag",
	A: "The defining source was read, and it covers the geometry, proportion included",
	B: "The defining source was read, and gaps were filled from labeled secondary sources",
	C: "The defining source wasn’t read",
	"-": "Written before evidence tiers, and not graded yet",
};

let flags: (Entry & { folded: string })[] = [];
let state: State = { ...defaults };

// --- The address

/** The browse view's state, from the query in an address's hash. */
export function readState(q: URLSearchParams): State {
	const s = { ...defaults };
	for (const key of ["kind", "family", "tier", "q", "sort"] as const) {
		const v = q.get(key);
		if (v !== null) {
			s[key] = v;
		}
	}
	if (!["hand", "imported", "all"].includes(s.kind)) {
		s.kind = defaults.kind;
	}
	if (!["name", "family", "ratio"].includes(s.sort)) {
		s.sort = defaults.sort;
	}
	if (!["any", "A", "B", "C", "-"].includes(s.tier)) {
		s.tier = defaults.tier;
	}
	const show = Number(q.get("show"));
	s.show = Number.isInteger(show) && show > page ? show : page;
	return s;
}

/** The query for a browse state, with only what differs from the defaults. */
export function browseQuery(s: State = state): string {
	const q = new URLSearchParams();
	for (const key of ["kind", "family", "tier", "q", "sort", "show"] as const) {
		if (s[key] !== defaults[key] && !(key === "tier" && s.kind !== "hand")) {
			q.set(key, String(s[key]));
		}
	}
	return q.toString();
}

/** Changes the view. A change of filter is a step Back can undo; typing and Show more aren't. */
function change(next: Partial<State>, how: "push" | "replace" = "push"): void {
	state = { ...state, ...next };
	const hash = browseHref(browseQuery(state));
	if (hash !== (location.hash || "#/")) {
		history[how === "push" ? "pushState" : "replaceState"](history.state, "", location.pathname + hash);
	}
	shownFor.hash = location.hash;
	render();
}

// --- Filtering

const inKind = (f: Entry, kind: string): boolean => kind === "all" || f.kind === kind;

function matching(s: State): typeof flags {
	const q = fold(s.q.trim());
	return flags.filter((f) =>
		inKind(f, s.kind) &&
		(s.family === "all" || f.family === s.family) &&
		(s.kind !== "hand" || s.tier === "any" || f.tier === s.tier) &&
		(q === "" || f.folded.includes(q)));
}

function sorted(list: typeof flags, how: string): typeof flags {
	const byName = (a: Entry, b: Entry): number => a.name.localeCompare(b.name, "en") || a.path.localeCompare(b.path);
	const byRatio = (a: Entry, b: Entry): number => (a.value ?? Infinity) - (b.value ?? Infinity) || byName(a, b);
	const byFamily = (a: Entry, b: Entry): number => a.family.localeCompare(b.family) || byName(a, b);
	return list.slice().sort(how === "family" ? byFamily : how === "ratio" ? byRatio : byName);
}

// --- The controls

function chip(text: string, on: boolean, pick: () => void, count: number, extra: { seg?: boolean; dot?: string; title?: string } = {}): HTMLButtonElement {
	const b = document.createElement("button");
	b.type = "button";
	b.setAttribute("aria-pressed", String(on));
	b.classList.toggle(extra.seg ? "active" : "on", on);
	b.addEventListener("click", pick);
	if (extra.dot !== undefined) {
		const dot = document.createElement("span");
		dot.className = "dot " + extra.dot;
		dot.setAttribute("aria-hidden", "true");
		b.append(dot);
	}
	const n = document.createElement("span");
	n.className = extra.seg ? "seg-n" : "n";
	n.textContent = fmt(count);
	b.append(text + (extra.seg ? " " : ""), n);
	if (extra.title !== undefined) {
		b.title = extra.title;
	}
	return b;
}

function renderControls(): number {
	const s = state;
	const query = el("query") as HTMLInputElement;
	if (document.activeElement !== query) {
		query.value = s.q;
	}
	(el("sort") as HTMLSelectElement).value = s.sort;

	el("kinds").replaceChildren(...[["hand", "Hand-written"], ["imported", "Imported"], ["all", "All"]].map(([id, text]) =>
		chip(text!, s.kind === id, () => change({ kind: id!, family: "all", tier: "any", show: page }), flags.filter((f) => inKind(f, id!)).length, { seg: true })));

	const counts = new Map<string, number>();
	for (const f of flags) {
		if (inKind(f, s.kind)) {
			counts.set(f.family, (counts.get(f.family) ?? 0) + 1);
		}
	}
	const families = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	if (s.family !== "all" && !counts.has(s.family)) {
		families.push([s.family, 0]);
	}
	const total = [...counts.values()].reduce((a, b) => a + b, 0);
	el("families").replaceChildren(
		chip("All", s.family === "all", () => change({ family: "all", show: page }), total),
		...families.map(([id, n]) => chip(label(id), s.family === id, () => change({ family: id, show: page }), n)));

	el("tier-group").hidden = s.kind !== "hand";
	if (s.kind === "hand") {
		const pool = flags.filter((f) => f.kind === "hand" && (s.family === "all" || f.family === s.family));
		const tiers: [string, string, number][] = [["any", "Any", pool.length], ...["A", "B", "C", "-"].map((t): [string, string, number] =>
			[t, t === "-" ? "Not graded" : t, pool.filter((f) => f.tier === t).length])];
		el("tiers").replaceChildren(...tiers
			.filter(([id, , n]) => n > 0 || id === s.tier || id === "any")
			.map(([id, text, n]) => chip(text, s.tier === id, () => change({ tier: id, show: page }), n, { dot: id === "any" ? "any" : id, title: tierHelp[id] })));
	}
	return total;
}

// --- The cards

function card(f: Entry): HTMLLIElement {
	const li = document.createElement("li");
	const a = document.createElement("a");
	a.className = "card-link";
	a.href = flagHref(f.path, browseQuery());
	a.dataset.nav = "";
	const pic = document.createElement("div");
	pic.className = "check card-pic";
	pic.dataset.path = f.path;
	pic.dataset.name = f.name;
	const name = document.createElement("span");
	name.className = "card-name";
	name.textContent = f.name;
	const tier = document.createElement("span");
	tier.className = "tier";
	tier.innerHTML = `<span class="dot ${f.tier ?? ""}" aria-hidden="true"></span>`;
	tier.append(f.kind === "imported" ? "Imported" : tierWords[f.tier ?? "-"]!);
	const sep = document.createElement("span");
	sep.setAttribute("aria-hidden", "true");
	sep.textContent = "·";
	const fam = document.createElement("span");
	fam.className = "fam";
	fam.textContent = label(f.family);
	const ratio = document.createElement("span");
	ratio.className = "mono";
	ratio.textContent = f.ratio;
	const meta = document.createElement("div");
	meta.className = "card-meta";
	meta.append(tier, sep, fam, ratio);
	const text = document.createElement("div");
	text.className = "card-text";
	text.append(name, meta);
	a.append(pic, text);
	li.append(a);
	const known = pictures.get(f.path);
	if (known?.done) {
		showPicture(pic, known);
	} else {
		observer.observe(pic);
	}
	return li;
}

function render(): void {
	const s = state;
	const total = renderControls();
	const found = sorted(matching(s), s.sort);
	const shown = found.slice(0, s.show);
	const kindWord = ({ hand: "hand-written ", imported: "imported ", all: "" } as Record<string, string>)[s.kind];
	const familyTotal = s.family === "all" ? total : flags.filter((f) => inKind(f, s.kind) && f.family === s.family).length;
	el("results-h").textContent = (s.family === "all" ? "" : label(s.family) + ": ") + fmt(familyTotal) + " " + kindWord + "flags";
	el("shown").textContent = shown.length < found.length ? `${fmt(shown.length)} of ${fmt(found.length)} shown` : `${fmt(found.length)} shown`;
	wanted.clear();
	observer.disconnect();
	el("grid").replaceChildren(...shown.map(card));
	el("grid").hidden = shown.length === 0;
	el("none").hidden = shown.length > 0;
	el("more").hidden = shown.length >= found.length;
}

// --- Pictures, fetched a few at a time and drawn one at a time

interface Picture {
	done: boolean;
	promise?: Promise<Picture>;
	svg?: string;
	url?: string;
	failed?: boolean;
}

/** Each file's picture, once it's been fetched and drawn, kept for as long as the page is open. */
const pictures = new Map<string, Picture>();
const wanted = new Set<HTMLElement>();
let fetching = 0;
let drawing: Promise<unknown> = Promise.resolve();

const observer = new IntersectionObserver((entries) => {
	for (const e of entries) {
		if (e.isIntersecting) {
			wanted.add(e.target as HTMLElement);
		} else {
			wanted.delete(e.target as HTMLElement);
		}
	}
	pump();
}, { rootMargin: "400px 0px" });

function pump(): void {
	for (const pic of wanted) {
		if (fetching >= fetchesAtOnce) {
			return;
		}
		wanted.delete(pic);
		observer.unobserve(pic);
		fetching++;
		picture(pic.dataset.path!).then((p) => showPicture(pic, p)).finally(() => {
			fetching--;
			pump();
		});
	}
}

function picture(path: string): Promise<Picture> {
	const known = pictures.get(path);
	if (known !== undefined) {
		return known.promise ?? Promise.resolve(known);
	}
	const entry: Picture = { done: false };
	entry.promise = fileText(path)
		.then((text) => {
			// Drawing takes the page's attention, so one flag is drawn at a time, with a pause between.
			const turn = drawing.then(() => new Promise((done) => setTimeout(done, 0))).then(() => svg(parse(text), { height: 264 }));
			drawing = turn.catch(() => undefined);
			return turn;
		})
		.then((s) => Object.assign(entry, { done: true, svg: s }))
		.catch(() => Object.assign(entry, { done: true, failed: true }))
		.finally(() => delete entry.promise);
	pictures.set(path, entry);
	return entry.promise;
}

function showPicture(pic: HTMLElement, p: Picture): void {
	if (p.failed) {
		const note = document.createElement("span");
		note.className = "no-picture";
		note.textContent = "No picture";
		pic.replaceChildren(note);
		return;
	}
	p.url ??= svgUrl(p.svg!);
	pic.replaceChildren(imageOf(p.url, "The flag of " + pic.dataset.name));
}

// --- Starting

/** Sets the view up once, from the manifest. */
export function setUpBrowse(list: Entry[]): void {
	flags = list.map((f) => ({ ...f, folded: fold(f.name) }));
	const hand = flags.filter((f) => f.kind === "hand").length;
	el("hero-text").textContent = `Each flag here is a Vexyl file: a plain-text design you can read, check and render. ${fmt(hand)} are written by hand from laws, decrees and designers’ own words, and say where every value comes from. ${fmt(flags.length - hand)} more are imported from Wikimedia Commons drawings.`;
	el("finder").hidden = false;
	el("results").hidden = false;
	let typing: ReturnType<typeof setTimeout> | undefined;
	el("query").addEventListener("input", (e) => {
		clearTimeout(typing);
		const q = (e.target as HTMLInputElement).value;
		typing = setTimeout(() => change({ q, show: page }, "replace"), 150);
	});
	el("sort").addEventListener("change", (e) => change({ sort: (e.target as HTMLSelectElement).value }));
	el("more").addEventListener("click", () => {
		const first = state.show;
		change({ show: state.show + page }, "replace");
		// Keep the keyboard where the new cards start.
		el("grid").children[first]?.querySelector("a")?.focus({ preventScroll: true });
	});
}

/** Shows the browse view as the address's filters say. */
export function showBrowse(q: URLSearchParams): void {
	state = readState(q);
	render();
}
