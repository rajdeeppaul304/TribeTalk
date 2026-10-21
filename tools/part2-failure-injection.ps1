param(
  [ValidateSet("redis", "elasticsearch", "backend-1", "backend-2")]
  [string]$Target = "redis",
  [switch]$RunArtillery
)

$compose = @("-f", "docker-compose.yml", "-f", "docker-compose.local-scale.yml")
$service = $Target

Write-Host "Stopping $service for the local Part 2 failure-injection scenario..."
docker compose @compose stop $service

try {
  if ($RunArtillery) {
    Write-Host "Run Artillery from another terminal while $service is stopped."
    npx artillery run tools/artillery/socketio.yml
  } else {
    Write-Host "$service is stopped. Exercise the app or run the Artillery scenario now."
    Read-Host "Press Enter to restore $service"
  }
}
finally {
  Write-Host "Restoring $service..."
  docker compose @compose start $service
}
