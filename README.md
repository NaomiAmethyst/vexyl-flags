# Vexyl flags

A collection of flags in the [Vexyl](https://github.com/NaomiAmethyst/vexyl) format.

**These files describe drawings.** Except where a file says otherwise, they haven't been
checked against any official construction, and their accuracy is whatever their source's
is. For flags written by hand and checked against laws and other sources, see `flags/` in
the Vexyl repo.

## Contents

| Folder | Holds |
|---|---|
| `flags/country/` | Sovereign states and some others |
| `flags/pride/` | Pride flags |
| `flags/territories/`, `us/`, `russia/`, `germany/`, `japan/`, `india/`, `brazil/`, `mexico/`, `spain/`, `swiss/`, `europe/` | Regional flags, by the family they were found in |
| `flags/historical/`, `ethnic/`, `orgs/`, `signal/` | Historical, ethnic and organization flags, and signal flags |

`reviewed/` holds flags written by hand, or copied from the Vexyl repo's own checked flags.
They replace their imports in `flags/`, as `reviewed/map.tsv` records. Each was compared with
its source too, though a law can rightly disagree with a drawing.

Flags written from their laws say in their notes where each value comes from, and
`reviewed/evidence.tsv` gives each an evidence tier:

| Tier | Meaning |
|---|---|
| `A` | A law was read, and it covers the flag's geometry |
| `B` | A law was read, and gaps were filled from labeled secondary sources |
| `C` | No law was read |

Even in tier A, a flag's screen colors usually come from elsewhere, because few laws give them.
None of this is legal advice, and a law read here could have changed since.

## How they were made

Most were converted mechanically from SVG files on
[Wikimedia Commons](https://commons.wikimedia.org/) by the importer in the Vexyl repo's
`tools/`, which recognizes flag vocabulary and keeps long runs of detail, such as seals, as
inline SVG. It then restates each flag as a specification would, on the smallest grid that
keeps its structure in whole numbers and with simple sizes, keeping its exact values if that
changes how it looks. Each result was rasterized with resvg and compared with its source.
That makes them read like specifications, but they still only describe their sources.
[`report.tsv`](report.tsv) lists every flag's result.

The `vocabulary` column there says what each flag needed:

| Value | Meaning |
|---|---|
| `named` | Only flag vocabulary |
| `polygon` | Also some shapes drawn by their points |
| `path` | Also some curved shapes |
| `artwork` | Also inline SVG, such as a seal or emblem |

Reviewed flags say `reviewed:` first. Their comparisons were made separately, so the report
leaves those columns blank.

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

`left-out.tsv` lists each one, with why.
