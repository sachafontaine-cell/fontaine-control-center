#!/bin/sh
# Usage: ./bump.sh 0.1.11 — sets the version in app.js, sw.js and README.md, then checks nothing got emptied.
set -e
NEW="$1"; [ -n "$NEW" ] || { echo "usage: ./bump.sh X.Y.Z"; exit 1; }
OLD=$(sed -n "s/^const VERSION = '\(.*\)';/\1/p" app.js)
sed -i "s/^const VERSION = '$OLD';/const VERSION = '$NEW';/" app.js sw.js
sed -i "s/v$OLD ↻/v$NEW ↻/" README.md
for f in app.js sw.js README.md index.html app.css manifest.webmanifest; do [ -s "$f" ] || { echo "ERROR: $f is empty"; exit 1; }; done
grep -q "VERSION = '$NEW'" sw.js && grep -q "VERSION = '$NEW'" app.js || { echo "ERROR: version not set in both files"; exit 1; }
echo "v$OLD -> v$NEW"
