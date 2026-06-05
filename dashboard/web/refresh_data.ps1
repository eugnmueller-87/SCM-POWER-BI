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
$path = Join-Path $PSScriptRoot "data.json"
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Refreshed -> $path  ($($out.forecast.Count) forecast rows)" -ForegroundColor Green
