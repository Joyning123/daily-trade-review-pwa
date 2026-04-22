#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_FILE="$ROOT_DIR/templates/daily-review-template.md"
REVIEWS_DIR="$ROOT_DIR/reviews"
REVIEW_DATE="${1:-$(date +%F)}"
OUTPUT_FILE="$REVIEWS_DIR/$REVIEW_DATE.md"

mkdir -p "$REVIEWS_DIR"

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "Template not found: $TEMPLATE_FILE" >&2
  exit 1
fi

if [[ -f "$OUTPUT_FILE" ]]; then
  echo "$OUTPUT_FILE"
  exit 0
fi

cp "$TEMPLATE_FILE" "$OUTPUT_FILE"
sed -i '' "s/{{DATE}}/$REVIEW_DATE/g" "$OUTPUT_FILE"

echo "$OUTPUT_FILE"
