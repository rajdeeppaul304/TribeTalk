param(
  [string]$OutputDirectory = "./backups/mongo",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDirectory "tribetalk-$timestamp"
New-Item -ItemType Directory -Force -Path $target | Out-Null

docker compose exec -T mongo mongodump --archive --gzip > (Join-Path $target "mongo.archive.gz")
if ($LASTEXITCODE -ne 0) { throw "mongodump failed" }

Get-ChildItem -Path $OutputDirectory -Directory |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Recurse -Force

Write-Host "MongoDB backup created at $target"

