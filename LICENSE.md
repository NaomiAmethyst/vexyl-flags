# Licenses

This repository has no single license. Each part says what it's under.

## The flags

Every flag file states its own terms in its `meta`, and those are the terms it's under:

- `license` covers the file. Hand-written files are mostly
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Imported files take theirs from
  the Wikimedia Commons page they were converted from.
- `render-license`, where it's given, covers images rendered from the file. It's usually
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), so those images ask for nothing.
  Without it, images fall under `license`.
- `adapted-from` names a drawing the file is made from, with its author and license. Its material
  keeps that license.

The README's [Rights](README.md#rights) section explains these fields, and what they don't cover.
In short: none of them covers a flag's design. Some designers set terms for using their designs,
many countries restrict how their flags and emblems are used, and some organization flags are
trademarks. Nobody has legally reviewed any of this, so check before relying on it.

## The code

The website in [`site/`](site), the checks in [`tools/`](tools) and the workflows in
[`.github/`](.github) are under the [Apache License 2.0](LICENSE-APACHE).

## The bookkeeping

[`evidence.tsv`](evidence.tsv), [`map.tsv`](map.tsv) and the reports in [`imported/`](imported)
(`report.tsv` and `left-out.tsv`) are under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
