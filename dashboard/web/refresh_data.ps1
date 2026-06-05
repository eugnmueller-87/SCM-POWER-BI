# Refresh the dashboard's live data snapshot.
# Run:  powershell -ExecutionPolicy Bypass -File dashboard\web\refresh_data.ps1
$base = "https://scm-master-production.up.railway.app"
$tok  = Invoke-RestMethod -Uri "$base/api/v1/auth/login" -Method Post `
        -Body @{ username = "admin@example.com"; password = "admin" } `
        -ContentType "application/x-www-form-urlencoded"
$h = @{ Authorization = "Bearer $($tok.access_token)" }

$out = [ordered]@{}
$out.generated_at      = (Get-Date -Format "yyyy-MM-dd HH:mm")
$out.spend_by_category = Invoke-RestMethod -Uri "$base/api/v1/analytics/spend/by-category" -Headers $h
$out.spend_by_supplier = Invoke-RestMethod -Uri "$base/api/v1/analytics/spend/by-supplier" -Headers $h
$out.spend_by_product  = Invoke-RestMethod -Uri "$base/api/v1/analytics/spend/by-product"  -Headers $h
$out.spend_total       = Invoke-RestMethod -Uri "$base/api/v1/analytics/spend"             -Headers $h
$out.inventory         = Invoke-RestMethod -Uri "$base/api/v1/planning/inventory"          -Headers $h
$out.insights          = Invoke-RestMethod -Uri "$base/api/v1/agent/insights"              -Headers $h
$out.forecast          = (Invoke-RestMethod -Uri "$base/api/v1/analytics/exports/forecast-accuracy.csv" -Headers $h) | ConvertFrom-Csv

$json = $out | ConvertTo-Json -Depth 6
$enc  = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "data.json"), $json, $enc)
# Also write data.js (inlined) so index.html works when opened directly (file://)
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "data.js"), "window.SCM_DATA = $json;", $enc)
Write-Host "Refreshed data.json + data.js  ($($out.forecast.Count) forecast rows)" -ForegroundColor Green
