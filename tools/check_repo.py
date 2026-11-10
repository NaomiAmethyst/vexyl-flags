#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Naomi Persephone Amethyst <naomi@amethyst.name>
# Checks the repo's bookkeeping, which the format's own check can't see: every hand-written flag
# has one evidence tier, map.tsv names real flags, and an import that a hand-written flag replaces
# is gone. Problems are printed as GitHub annotations, and any problem fails the run.
import csv
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
problems = 0

# Written before evidence tiers, and not graded yet. Remove each as it gets a tier.
ungraded = {
    "afghanistan-2013-2021", "norway-state", "wiphala", "european-union", "nail-and-gear",
    "bisexual", "progress-pride", "transgender", "ics-alfa", "ics-november", "ics-zulu",
    "colorado",
}


def problem(path, line, message):
    global problems
    problems += 1
    print(f"::error file={path},line={line}::{message}")


def rows(path):
    with open(os.path.join(root, path), newline="", encoding="utf-8") as f:
        for n, row in enumerate(csv.reader(f, delimiter="\t"), 1):
            if n > 1 and row:
                yield n, row


def kdl(folder):
    found = {}
    for family in sorted(os.listdir(os.path.join(root, folder))):
        if os.path.isdir(os.path.join(root, folder, family)):
            for name in sorted(os.listdir(os.path.join(root, folder, family))):
                if name.endswith(".kdl"):
                    found.setdefault(name[:-4], []).append(family)
                elif not name.startswith("."):
                    problem(f"{folder}/{family}/{name}", 1, "only .kdl files belong here")
    return found


hand = kdl("flags")
imported = kdl("imported")

for name, families in hand.items():
    if len(families) > 1:
        for family in families:
            problem(f"flags/{family}/{name}.kdl", 1, f"another hand-written flag is also named {name}, in {', '.join(f for f in families if f != family)}")

tiers = {}
for n, row in rows("evidence.tsv"):
    if len(row) != 2:
        problem("evidence.tsv", n, "needs two columns, a name and a tier")
        continue
    name, tier = row
    if tier not in ("A", "B", "C"):
        problem("evidence.tsv", n, f"tier {tier!r} isn't A, B or C")
    if name in tiers:
        problem("evidence.tsv", n, f"{name} already has a tier, on line {tiers[name]}")
    elif name not in hand:
        problem("evidence.tsv", n, f"there's no hand-written flag named {name}")
    tiers.setdefault(name, n)

for name, families in hand.items():
    if name not in tiers and name not in ungraded:
        problem(f"flags/{families[0]}/{name}.kdl", 1, "needs an evidence tier in evidence.tsv")
for name in sorted(ungraded):
    if name in tiers or name not in hand:
        problem("tools/check_repo.py", 1, f"{name} is listed as ungraded, but it {'has a tier' if name in tiers else 'is gone'}")

for n, row in rows("map.tsv"):
    if len(row) != 3:
        problem("map.tsv", n, "needs three columns: name, family, and the imports it replaces")
        continue
    name, family, replaces = row
    if family not in hand.get(name, []):
        problem("map.tsv", n, f"there's no flags/{family}/{name}.kdl")
    for old in filter(None, replaces.split(",")):
        old_family, _, old_name = old.partition("/")
        if old_family in imported.get(old_name, []):
            problem(f"imported/{old}.kdl", 1, f"flags/{family}/{name}.kdl replaces this import, so it should be removed (map.tsv line {n})")

if problems:
    print(f"{problems} problems")
    sys.exit(1)
print(f"{len(hand)} hand-written flags and {sum(map(len, imported.values()))} imports are in order")
