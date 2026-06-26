# start-telemetry.ps1
# PowerShell script to start the Digital Twin FM telemetry worker and simulator in the background on Windows.

Write-Host "Starting Telemetry Worker (sensor processing)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "pnpm --filter @digital-twin-fm/ingestion-service worker"

Write-Host "Starting Telemetry Simulator (generating sensor readings)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "pnpm --filter @digital-twin-fm/ingestion-service simulator"

Write-Host "`nTelemetry processes started successfully in separate windows!" -ForegroundColor Green
Write-Host "New sensor readings will populate every 10 seconds. Check the dashboard to watch the values update in real-time." -ForegroundColor Yellow
