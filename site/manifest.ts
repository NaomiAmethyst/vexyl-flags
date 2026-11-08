// Writes manifest.json, which the site loads to list the flags: each flag's path, name, family,
// kind, tier and proportion, and its series where it has one, sorted by path, with the release it
// was made for. It reads every file with Vexyl's own library, spread over worker threads.
//
// site/build.mjs bundles this for node and runs it as:
//   node manifest.mjs REPO OUT TAG COMMIT

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { model, parse } from "vexyl";

interface Entry {
	path: string;
	name: string;
	family: string;
	kind: "hand" | "imported";
	tier?: string;
	ratio: string;
	value?: number;
	series?: string;
	when?: string;
}

/** Hoist to fly in lowest terms, or to three figures where the terms would be unwieldy. */
function ratio(hoist: number, fly: number): string {
	// Proportions are written as decimals, so they're whole numbers once scaled by a power of ten.
	const places = (n: number): number => (String(n).split(".")[1] ?? "").length;
	const scale = 10 ** Math.min(9, Math.max(places(hoist), places(fly)));
	const h = Math.round(hoist * scale);
	const f = Math.round(fly * scale);
	const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
	const g = gcd(h, f);
	return h / g <= 1000 && f / g <= 1000 ? `${h / g}:${f / g}` : `1:${Number((fly / hoist).toPrecision(3))}`;
}

function entry(repo: string, path: string, tiers: Map<string, string>): Entry {
	const [folder, family, file] = path.split("/") as [string, string, string];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const m: any = model(parse(readFileSync(join(repo, path + ".kdl"), "utf8"), path + ".kdl"));
	const p = m.proportion;
	const e: Entry = { path, name: m.meta.name, family, kind: folder === "flags" ? "hand" : "imported", ratio: m.outline ? "shaped" : ratio(p.hoist, p.fly) };
	if (!m.outline) {
		e.value = Math.round((p.fly / p.hoist) * 1e6) / 1e6;
	}
	if (e.kind === "hand") {
		e.tier = tiers.get(file) ?? "-";
	}
	if (m.meta.series) {
		e.series = m.meta.series;
		e.when = (m.meta.date ?? "") + (m.meta.until ? ` to ${m.meta.until}` : "");
	}
	return e;
}

function readTiers(repo: string): Map<string, string> {
	const rows = readFileSync(join(repo, "evidence.tsv"), "utf8").split("\n").slice(1).map((l) => l.split("\t"));
	return new Map(rows.filter((r) => r.length === 2).map((r) => [r[0]!, r[1]!.trim()]));
}

if (isMainThread) {
	const [repo, out, tag, commit] = process.argv.slice(2) as [string, string, string, string];
	const paths: string[] = [];
	for (const folder of ["flags", "imported"]) {
		for (const family of readdirSync(join(repo, folder), { withFileTypes: true })) {
			if (family.isDirectory()) {
				for (const file of readdirSync(join(repo, folder, family.name))) {
					if (file.endsWith(".kdl")) {
						paths.push(`${folder}/${family.name}/${file.slice(0, -4)}`);
					}
				}
			}
		}
	}
	paths.sort();
	const threads = Math.min(availableParallelism(), 16);
	const parts = Array.from({ length: threads }, (_, i) => paths.filter((_, n) => n % threads === i));
	const results = await Promise.all(parts.map((part) => new Promise<Entry[]>((done, fail) => {
		const w = new Worker(new URL(import.meta.url), { workerData: { repo, paths: part } });
		w.once("message", done);
		w.once("error", fail);
	})));
	const flags = results.flat().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
	writeFileSync(out, JSON.stringify({ tag, commit, flags }) + "\n");
	console.log(`manifest.json: ${flags.length} flags`);
} else {
	const { repo, paths } = workerData as { repo: string; paths: string[] };
	const tiers = readTiers(repo);
	parentPort!.postMessage(paths.map((p) => entry(repo, p, tiers)));
}
