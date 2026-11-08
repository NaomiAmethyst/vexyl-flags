// What both views share: the build's settings, the manifest's shape, fetching files, and small
// helpers for text and pictures.

declare const __REPO__: string;
declare const __EDITOR_URL__: string;
declare const __KDL_BASE__: string;

/** The repository as owner/name, or empty when the build didn't say. */
export const repo = __REPO__;
export const repoUrl = repo === "" ? "" : `https://github.com/${repo}`;
export const editorUrl = __EDITOR_URL__;

/** The release the manifest was made for: its tag, and its commit, which every fetched file and
 * GitHub link is pinned to. */
export const release = { tag: "", commit: "" };
/** Where files are fetched from, as a prefix of each one's path in the repo: the build's own
 * setting if it has one, or else raw.githubusercontent.com at the release's commit. */
let kdlBase = "";

export interface Manifest {
	tag: string;
	commit: string;
	flags: Entry[];
}

export function useManifest(m: Manifest): void {
	release.tag = m.tag;
	release.commit = m.commit;
	const base = __KDL_BASE__ !== "" ? __KDL_BASE__ : repo !== "" && m.commit !== "" ? `https://raw.githubusercontent.com/${repo}/${m.commit}/` : "";
	kdlBase = base === "" ? "" : new URL(base, document.baseURI).href;
}

/** One flag, as manifest.json lists it. `path` is its file's path without `.kdl`. */
export interface Entry {
	path: string;
	name: string;
	family: string;
	kind: "hand" | "imported";
	/** A, B or C, or "-" for a hand-written flag that isn't graded. Imports have none. */
	tier?: string;
	/** Hoist to fly in lowest terms, or "shaped" for a flag with an outline. */
	ratio: string;
	/** Fly divided by hoist, for sorting, except for a shaped flag. */
	value?: number;
	series?: string;
	/** When this version was current, for a flag in a series. */
	when?: string;
}

export const el = (id: string): HTMLElement => document.getElementById(id)!;
export const fmt = (n: number): string => n.toLocaleString("en-US");

/** A family's or variant's name as words: hyphens become spaces, except between digits. */
export function label(word: string): string {
	if (word === "us") {
		return "US";
	}
	const words = word.replace(/(?<!\d)-|-(?!\d)/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Text for comparing, without case or accents. */
export const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function esc(text: unknown): string {
	return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A path for the address bar, readable rather than escaped where it can be. */
export function pathParam(path: string): string {
	return encodeURIComponent(path).replaceAll("%2F", "/");
}

/** A file's text, fetched once and kept. A fetch that fails is forgotten, so it can be tried again. */
const texts = new Map<string, Promise<string>>();

export function fileText(path: string): Promise<string> {
	let text = texts.get(path);
	if (text === undefined) {
		if (kdlBase === "") {
			return Promise.reject(new Error("this site wasn't told where the files are"));
		}
		text = fetch(new URL(path.split("/").map(encodeURIComponent).join("/") + ".kdl", kdlBase)).then((r) => {
			if (!r.ok) {
				throw new Error(r.status === 404 ? "there’s no such file" : `the server answered ${r.status}`);
			}
			return r.text();
		});
		text.catch(() => texts.delete(path));
		texts.set(path, text);
	}
	return text;
}

/** The file's page on GitHub, at the commit the site was built from. */
export function githubFile(path: string): string {
	return repoUrl === "" ? "" : `${repoUrl}/blob/${release.commit || "HEAD"}/${path}.kdl`;
}

/** An address for an SVG document, for as long as the page is open. Shown in an <img>, nothing
 * in it can run, and each is its own document, so IDs in different flags can't collide. */
export function svgUrl(svgText: string): string {
	return URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
}

export function imageOf(url: string, alt: string): HTMLImageElement {
	const img = new Image();
	img.decoding = "async";
	img.alt = alt;
	img.src = url;
	return img;
}

/** The SVG's width and height in its own units, from its viewBox. */
export function svgSize(svgText: string): { width: number; height: number } | null {
	const head = svgText.slice(0, svgText.indexOf(">") + 1);
	const box = /\sviewBox="[-0-9.e]+ [-0-9.e]+ ([0-9.e]+) ([0-9.e]+)"/.exec(head);
	return box ? { width: Number(box[1]), height: Number(box[2]) } : null;
}

/** Height to width in lowest terms, as the pages show a proportion, or to three figures. */
export function ratioText(width: number, height: number): string {
	const q = height / width;
	for (let d = 1; d <= 1000; d++) {
		const n = Math.round(q * d);
		if (n > 0 && n <= 1000 && Math.abs(q - n / d) < 1e-9 * Math.max(1, q)) {
			return `${n}:${d}`;
		}
	}
	return `1:${Number((width / height).toPrecision(3))}`;
}

/** Saves a file the person asked for. */
export function save(name: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** The theme button switches between dark and light, and remembers the choice where it can. */
export function setUpTheme(): void {
	const button = el("theme");
	const show = (): void => {
		const dark = document.documentElement.dataset.theme !== "light";
		button.setAttribute("aria-label", dark ? "Use the light theme" : "Use the dark theme");
	};
	button.addEventListener("click", () => {
		const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem("vexyl-flags-theme", next);
		} catch {
			// Storage can be off or full. The theme still changes for this visit.
		}
		show();
	});
	show();
}
