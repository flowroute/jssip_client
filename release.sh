#!/bin/bash
set -x
set -e

export VERSION=$1
if [ -z "$1" ]; then
    exit 1
fi

npm run build:umd
git add releases/
git commit -m "Artifacts for v$VERSION"

npm version $1
