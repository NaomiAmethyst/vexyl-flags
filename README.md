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

`reviewed/` holds flags written by hand, where the importer's reading of a sovereign flag was
poor, or copied from the Vexyl repo's own checked flags. They replace their imports in
`flags/`, as `reviewed/map.tsv` records. Each was compared with its source too.

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

Each file's `license` and `encoder` come from its Commons page, and its `source` links
there. Where Commons credits the author only in a page's file history, the file has no
`encoder`, and the page has the credit. Nobody has legally reviewed these fields.

They cover the drawings. Designs can have their own terms: some pride flags' designers set
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
  America. Some are illegal to display in some countries. This is a judgment call about what this collection publishes,
  rather than a claim about their history. They were found by name, and by looking through
  the German and period flags. Other families weren't all viewed, so some could remain, and
  corrections are welcome.
- **What can't be carried:** drawings relying on real text, filters or embedded images,
  which can't be reproduced faithfully in a self-contained file.

`left-out.tsv` lists each one, with why.
