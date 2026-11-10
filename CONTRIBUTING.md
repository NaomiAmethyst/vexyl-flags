# Contributing

Corrections are the most useful thing you can send, above all a source: the law, decree, standard or
designer's own publication that defines a flag. Flags marked tier C are the ones whose defining
source couldn't be found or read, and any of them is worth a look.

## Suggesting a correction

Open an issue with the [flag correction](../../issues/new?template=flag-correction.yml) form. Each
flag's page on the website has a "Suggest a correction" link that fills in which flag it is. Say:

- which flag, and which part of it is wrong: a size, a color, a date, a source;
- what it should be;
- where that comes from, with a link. The defining source is best: a law or decree as published, a
  government's own page, or the designer's own post. A news report or Flags of the World is still
  useful, and so is a Wikipedia article for the references it cites. A drawing on Wikimedia Commons
  isn't a source on its own, because it's often what's being corrected.

You don't need to know the format. A link and a sentence is plenty.

## Adding or rewriting a flag

A pull request is welcome too. Hand-written flags go in `flags/FAMILY/NAME.kdl` and follow the
ones already there, such as [`flags/country/chile.kdl`](flags/country/chile.kdl):

- **Read the defining source yourself**, and cite exactly what you read in `source`, with a `law`
  for each real legal instrument. A designer's post is a `source`, never a `law`.
- **Say where every value comes from**, in `note`s: what the source gives, what was filled in from
  elsewhere and from where, and any arithmetic you did. Never present a drawn or derived value as
  the source's.
- **Use the smallest grid that fits** and the most specific vocabulary (`bars` with `ratio`,
  `canton`, `cross`, `charge` with `at`), keeping `polygon` and `path` for shapes with no name. The
  file's leading `//` comment shows the construction arithmetic.
- **License it** as `license "CC-BY-SA-4.0"` with `render-license "CC0-1.0"`. If it uses artwork
  from a Commons drawing, use that drawing's license instead, with an `adapted-from` naming its
  author, and no `render-license`.
- **Give it an evidence tier** in [`evidence.tsv`](evidence.tsv): `A` if the defining source was
  read and covers the geometry, `B` if it was read and gaps were filled from labeled secondary
  sources, `C` if it wasn't read.
- **If it replaces an import**, add a row to [`map.tsv`](map.tsv) and remove the import.

Then check it: build the `vexyl` command from the
[Vexyl repo](https://github.com/NaomiAmethyst/vexyl) (or install a release), run
`vexyl check` on your file, and run `python3 tools/check_repo.py`. The same checks run on every pull
request.

## What isn't taken

Flags of the Nazi party and its organizations, Germany's state flags from 1933 to 1945, neo-Nazi and
similar groups, and the Confederate States of America, including state flags that contain its
battle flag, are left out of this collection, as the README explains.

## Licenses

Code here is under the Apache License 2.0, and each flag file states its own license; see
[LICENSE.md](LICENSE.md). By contributing, you agree that your contribution is under the license
the file or code it's in states.
