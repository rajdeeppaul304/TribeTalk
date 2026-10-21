$ErrorActionPreference = "Stop"

Write-Host "TribeTalk friend demo setup" -ForegroundColor Cyan
Write-Host "This starts backend replicas, MongoDB, Redis, Elasticsearch, Prometheus, Grafana, Loki, Promtail, and an Nginx gateway." -ForegroundColor DarkGray

docker version | Out-Null
docker compose version | Out-Null

$frontendOrigin = Read-Host "Vercel frontend URL (for example https://tribetalk.rajdeep.app)"
$backendOrigin = Read-Host "Public backend URL (for example https://backend_tribetalk.rajdeep.app)"
$tunnelToken = Read-Host "Cloudflare Tunnel token (leave blank for local-only mode)"
$grafanaPassword = Read-Host "Grafana admin password"

if ([string]::IsNullOrWhiteSpace($frontendOrigin) -or [string]::IsNullOrWhiteSpace($backendOrigin)) {
    throw "Both frontend and backend URLs are required."
}
if ([string]::IsNullOrWhiteSpace($grafanaPassword)) { throw "Grafana password is required." }

$backendEnv = Join-Path $PSScriptRoot "..\..\TribetalkBackend\.env"
$backendTemplate = Join-Path $PSScriptRoot "..\..\TribetalkBackend\.env.example"
if (-not (Test-Path $backendEnv)) {
    Copy-Item $backendTemplate $backendEnv
}

function New-Secret([int] $bytes = 48) {
    $buffer = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
    return [Convert]::ToBase64String($buffer)
}

$metricsToken = New-Secret 32
$adminPassword = New-Secret 32
$backendText = Get-Content $backendEnv -Raw
$replacements = @{
    'ACCESS_TOKEN_SECRET=.*' = "ACCESS_TOKEN_SECRET=$(New-Secret)"
    'REFRESH_TOKEN_SECRET=.*' = "REFRESH_TOKEN_SECRET=$(New-Secret)"
    'METRICS_TOKEN=.*' = "METRICS_TOKEN=$metricsToken"
    'ADMIN_PASSWORD=.*' = "ADMIN_PASSWORD=$adminPassword"
    'CORS_ORIGIN=.*' = "CORS_ORIGIN=$frontendOrigin"
    'COOKIE_SECURE=.*' = 'COOKIE_SECURE=true'
    'APP_URL=.*' = "APP_URL=$frontendOrigin"
    'NODE_ENV=.*' = 'NODE_ENV=production'
}
foreach ($pattern in $replacements.Keys) {
    $backendText = [regex]::Replace($backendText, "(?m)^$pattern$", $replacements[$pattern])
}
Set-Content -Path $backendEnv -Value $backendText -NoNewline

$template = Join-Path $PSScriptRoot "prometheus.template.yml"
$generated = Join-Path $PSScriptRoot "prometheus.generated.yml"
(Get-Content $template -Raw).Replace('__METRICS_TOKEN__', $metricsToken) | Set-Content $generated -NoNewline

$env:FRONTEND_ORIGIN = $frontendOrigin
$env:BACKEND_ORIGIN = $backendOrigin
$env:GRAFANA_ADMIN_PASSWORD = $grafanaPassword
$env:CLOUDFLARE_TUNNEL_TOKEN = $tunnelToken

$files = @("-f", "docker-compose.yml", "-f", "docker-compose.local-scale.yml", "-f", "docker-compose.friend-demo.yml")
if ([string]::IsNullOrWhiteSpace($tunnelToken)) {
    docker compose @files --profile observability up -d --build
} else {
    docker compose @files --profile observability --profile tunnel up -d --build
}

Write-Host "";
Write-Host "TribeTalk demo stack is running." -ForegroundColor Green
Write-Host "Local gateway: http://localhost:8080"
Write-Host "Grafana:       $backendOrigin/grafana/"
Write-Host "Prometheus:    $backendOrigin/prometheus/"
Write-Host "Health:        $backendOrigin/api/health"
if ([string]::IsNullOrWhiteSpace($tunnelToken)) {
    Write-Host "No Cloudflare token was supplied; the gateway is local-only." -ForegroundColor Yellow
}
