#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIRECTORY="${1:-./backups/mongo}"
RETENTION_DAYS="${2:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$OUTPUT_DIRECTORY/tribetalk-$TIMESTAMP"
mkdir -p "$TARGET"

docker compose exec -T mongo mongodump --archive --gzip > "$TARGET/mongo.archive.gz"
find "$OUTPUT_DIRECTORY" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "MongoDB backup created at $TARGET"

