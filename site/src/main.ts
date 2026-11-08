// The site is one page with two views, chosen by the address's hash: `#/flags/country/chile` is one
// flag, and `#/` the browse view, whose filters stay in the hash after a flag's path so the way back
// keeps them (common.ts has the forms). Links between the views change the address without loading
// a page, and Back returns to the browse view as it was, scrolled where it was. The real query
// string isn't used.

import { browseQuery, setUpBrowse, showBrowse } from "./browse.js";
import { el, type Entry, esc, type Manifest, readAddress, release, repoUrl, setUpTheme, shownFor, useManifest } from "./common.js";
import { showFlag } from "./flag.js";

let flags: Entry[] = [];
let byPath = new Map<string, Entry>();
let view: "browse" | "flag" | null = null;

const description = document.querySelector('meta[name="description"]')!;
const browseDescription = description.getAttribute("content")!;

/** Shows the view the address asks for. `moved` is false only for the page's first view. */
async function route(moved: boolean): Promise<void> {
	shownFor.hash = location.hash;
	const { path, query: q } = readAddress();
	if (path === null) {
		const was = view;
		view = "browse";
		el("flag-view").hidden = true;
		el("browse-view").hidden = false;
		el("nav-flags").setAttribute("aria-current", "page");
		document.title = "Vexyl flags";
		description.setAttribute("content", browseDescription);
		showBrowse(q);
		if (moved) {
			scrollTo(0, (history.state as { scroll?: number } | null)?.scroll ?? 0);
			if (was !== "browse") {
				el("hero-h").focus({ preventScroll: true });
			}
		}
		return;
	}
	view = "flag";
	el("browse-view").hidden = true;
	el("flag-view").hidden = false;
	el("nav-flags").removeAttribute("aria-current");
	const entry = byPath.get(path);
	document.title = `${entry?.name ?? "No such flag"}, in Vexyl flags`;
	description.setAttribute("content", entry ? `The flag of ${entry.name}, as a Vexyl file: its construction, sources, colors and source.` : browseDescription);
	const shown = showFlag(path, entry, flags, browseQuery(readBrowse(q)));
	if (moved) {
		scrollTo(0, 0);
		el("flag-h").focus({ preventScroll: true });
	}
	const name = await shown;
	if (name !== null && view === "flag" && readAddress().path === path) {
		document.title = `${name}, in Vexyl flags`;
		if (moved) {
			el("flag-h").focus({ preventScroll: true });
		}
	}
}

/** The browse query to carry along, as the browse view would write it. */
function readBrowse(q: URLSearchParams): Parameters<typeof browseQuery>[0] {
	return { kind: q.get("kind") ?? "hand", family: q.get("family") ?? "all", tier: q.get("tier") ?? "any", q: q.get("q") ?? "", sort: q.get("sort") ?? "name", show: Number(q.get("show")) || 48 };
}

/** Follows a link within the page, remembering where the browse view was scrolled to. */
function go(href: string): void {
	history.replaceState({ ...(history.state as object | null), scroll: scrollY }, "");
	history.pushState(null, "", href);
	void route(true);
}

/** The footer says which build of the collection this is. */
function showBuild(): void {
	const short = release.commit.slice(0, 7);
	let text = "";
	if (release.tag === "edge") {
		text = repoUrl ? `Built from <a href="${esc(repoUrl)}/commit/${esc(release.commit)}">edge, ${esc(short)}</a>` : `Built from edge, ${esc(short)}`;
	} else if (release.tag !== "") {
		text = repoUrl ? `Collection <a href="${esc(repoUrl)}/releases/tag/${esc(encodeURIComponent(release.tag))}">${esc(release.tag)}</a>` : `Collection ${esc(release.tag)}`;
	} else if (short !== "") {
		text = `Built from ${esc(short)}`;
	}
	el("build").innerHTML = text;
}

async function start(): Promise<void> {
	setUpTheme();
	history.scrollRestoration = "manual";
	let manifest: Manifest;
	try {
		const r = await fetch("manifest.json");
		if (!r.ok) {
			throw new Error(`the server answered ${r.status}`);
		}
		manifest = await r.json();
	} catch (e) {
		el("problem").innerHTML = `The list of flags couldn’t be loaded: ${esc((e as Error).message)}.` + (repoUrl ? ` The flags are also in <a href="${esc(repoUrl)}">the collection’s repository on GitHub</a>.` : "");
		el("problem").hidden = false;
		return;
	}
	useManifest(manifest);
	showBuild();
	flags = manifest.flags;
	byPath = new Map(flags.map((f) => [f.path, f]));
	setUpBrowse(flags);

	document.addEventListener("click", (e) => {
		const a = (e.target as Element).closest?.("a[data-nav]") as HTMLAnchorElement | null;
		if (a === null || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
			return;
		}
		e.preventDefault();
		go(a.getAttribute("href")!);
	});
	// Going Back or Forward, or editing the hash by hand, gives a popstate and then a hashchange,
	// or only one of them, so the view is shown for whichever comes first.
	const moved = (): void => {
		if (location.hash !== shownFor.hash) {
			void route(true);
		}
	};
	addEventListener("popstate", moved);
	addEventListener("hashchange", moved);
	await route(false);
}

void start();
