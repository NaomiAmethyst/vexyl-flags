# Vexyl flags

A collection of flags in the [Vexyl](https://github.com/NaomiAmethyst/vexyl) format.

There are two kinds of flag here:

| Folder | Holds |
|---|---|
| [`flags/`](flags) | Flags written by hand, from their laws, designers and other sources. Each says in its notes where every value comes from |
| [`imported/`](imported) | Flags converted mechanically from drawings, which describe those drawings and haven't been checked against any official construction |

Start with `flags/`. Where a flag is in both, the hand-written one replaces its import, as
[`map.tsv`](map.tsv) records, so `imported/` keeps only the rest.

Both are sorted by family:

| Family | Holds |
|---|---|
| `country/` | Sovereign states and some others |
| `pride/` | Pride flags |
| `territories/`, `us/`, `russia/`, `germany/`, `japan/`, `india/`, `brazil/`, `mexico/`, `spain/`, `swiss/`, `europe/` | Regional flags, by the family they belong to |
| `historical/`, `ethnic/`, `orgs/`, `signal/` | Historical, ethnic and organization flags, and signal flags |

[`evidence.tsv`](evidence.tsv) gives each hand-written flag an evidence tier, by what defines
it. For a national or civic flag that's its law. For a pride flag it's usually its designer's
own first publication, or the publication of a body that adopted it.

| Tier | Meaning |
|---|---|
| `A` | The defining source was read, and it covers the flag's geometry, proportion included |
| `B` | The defining source was read, and gaps were filled from labeled secondary sources |
| `C` | The defining source wasn't read |

Even in tier A, a flag's screen colors often come from elsewhere, because few laws give them.
None of this is legal advice, and a law read here could have changed since.

## How they were made

The imports were converted mechanically from SVG files on
[Wikimedia Commons](https://commons.wikimedia.org/) by the importer in the Vexyl repo's
`tools/`, which recognizes flag vocabulary and keeps long runs of detail, such as seals, as
inline SVG. It then restates each flag as a specification would, on the smallest grid that
keeps its structure in whole numbers and with simple sizes, keeping its exact values if that
changes how it looks. Each result was rasterized with resvg and compared with its source.
That makes them read like specifications, but they still only describe their sources.
[`imported/report.tsv`](imported/report.tsv) lists every import's result, and
[`imported/left-out.tsv`](imported/left-out.tsv) what was left out and why.

The `vocabulary` column there says what each flag needed:

| Value | Meaning |
|---|---|
| `named` | Only flag vocabulary |
| `polygon` | Also some shapes drawn by their points |
| `path` | Also some curved shapes |
| `artwork` | Also inline SVG, such as a seal or emblem |

## Rights

Each file states its own terms:

| Field | Covers |
|---|---|
| `license` | The file. Hand-written files are mostly CC BY-SA 4.0 |
| `render-license` | Images rendered from it. CC0 1.0 where it's given, so those renders ask for nothing. Without it, renders fall under `license` |
| `adapted-from` | A drawing the file is made from, with its author and license. Its material keeps that license |
| `design-rights` | Rights in the design itself, only where a source supports a statement. Most are empty, which means unchecked and not public domain |
| `restriction` | Rules about using a flag, apart from copyright |

Imported files take their `license` from their Commons page. Where Commons credits the author
only in a page's file history, the `adapted-from` has no `author`, and the page has the credit.
Nobody has legally reviewed any of these fields, and copyright in generated files is unsettled.

None of them covers a flag's design. Designs can have their own terms: some pride flags' designers set
conditions for using them, and many countries legally restrict how their flags and emblems
are used. Some organization flags here are logos, and may be trademarks. Check those before
using a flag.

## What's left out

- **Unidentified licenses:** flags whose licenses the importer couldn't identify.
- **The Progress Pride drawing:** its design has its own terms, covered with a note by
  `flags/progress-pride.kdl` in the Vexyl repo. Some flags here build on that design, so the
  same terms may apply to them.
- **Symbols of organized hatred:** flags of the Nazi party and its organizations, Germany's
  state flags from 1933 to 1945, neo-Nazi and similar groups, and the Confederate States of
  America, along with US state flags that include its battle flag. Some are illegal to display in some countries. This is a judgment call about what this collection publishes,
  rather than a claim about their history. They were found by name, and by looking through
  the German and period flags. Other families weren't all viewed, so some could remain, and
  corrections are welcome.
- **What can't be carried:** drawings relying on real text, filters or embedded images,
  which can't be reproduced faithfully in a self-contained file.

[`imported/left-out.tsv`](imported/left-out.tsv) lists each one, with why.

## Checks

Every push and pull request is checked by [`.github/workflows/check.yml`](.github/workflows/check.yml):

- every `.kdl` file must pass `vexyl check`, built from the Vexyl repo, with each problem shown on
  its line;
- [`tools/check_repo.py`](tools/check_repo.py) checks the bookkeeping: each hand-written flag has
  one evidence tier, `map.tsv` names real flags, and an import that a hand-written flag replaces
  has been removed.

To run them locally, build the CLI from the Vexyl repo's `go/` folder with
`go build -o vexyl ./cmd/vexyl`, then run `vexyl check` on the files and
`python3 tools/check_repo.py`.

## Website

The collection's website follows `main`. It's one page, built by [`site/build.mjs`](site/build.mjs)
with Vexyl's TypeScript library, the one Vexyl web uses, and a `manifest.json` listing every flag's
name, family, tier and proportion. Nothing is drawn in advance: the page fetches each flag's file
from `raw.githubusercontent.com`, pinned to the commit it was built from, and reads and draws it in
the browser, so the site stays under a megabyte however many flags there are. Setting the
repository variable `KDL_BASE_URL` fetches the files from elsewhere. Each flag links to Vexyl web at
`https://vexyl.amethyst.name/`, and the variable `EDITOR_URL` points those links somewhere else.
Each flag's page saves any of its views, or all of them in a zip, as SVG or as PNG, and has its
construction sheet, drawn by the library, to save as SVG or PNG or to print.

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds it:

- **Every push to `main`** moves the `edge` prerelease to that commit, attaches the build's
  `manifest.json` and `vexyl-flags-site.zip` to it, and deploys the build to Pages.
- **A release** whose tag starts with `v`, made by tagging a commit and publishing a GitHub
  release from it, gets the same two files attached, without deploying. Running the workflow by
  hand with a tag deploys that one instead, to roll back.
- **A pull request** builds the site as an artifact of its run, to look at.

The site needs Vexyl 1.2.0 or later, for construction sheets, and its build stops with an error
against anything older. To build it locally, install the Vexyl repo's dependencies with `npm ci` in its `ts/` and `web/`
folders, then run `node site/build.mjs path/to/vexyl-repo --dev` and serve `_site/`, with
`python3 -m http.server -d _site` for example. `--dev` links this repo's own files into the site
as `_site/_repo/` and reads them from there.
