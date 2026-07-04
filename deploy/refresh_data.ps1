# Regenerate the offline snapshot (deploy/data.js) from the live cockpit API.
# The live /api/data endpoint already aggregates every tab's data (spend, inventory,
# forecast, should-cost, TCO, capacity...), so we just proxy it — no per-endpoint list
# to keep in sync. Run:  powershell -ExecutionPolicy Bypass -File deploy\refresh_data.ps1
$src  = "https://scm-power-bi-production.up.railway.app/api/data"
$json = (Invoke-WebRequest -Uri $src -UseBasicParsing).Content
$enc  = New-Object System.Text.UTF8Encoding $false   # no BOM (so the browser parses it cleanly)
$body = "// Baked live snapshot for OFFLINE (file://) use. Regenerate by re-running this script.`r`n" +
        "// The cockpit prefers the live /api/data; this is only the fallback when there is no server.`r`n" +
        "window.SCM_DATA = $json;`r`n"
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "data.js"), $body, $enc)
Write-Host "Refreshed deploy/data.js ($([math]::Round($body.Length/1KB)) KB)" -ForegroundColor Green
