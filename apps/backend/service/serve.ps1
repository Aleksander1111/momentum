# Serves the harness while the user is logged on: waits for Postgres (Docker Desktop starts at logon), then runs the
# development server, which restarts the back-end and exports the web app again on every change that lands on main.
# Started hidden by the Momentum scheduled task (install.ps1); the output goes to serve.log next to this script.
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$log = Join-Path $PSScriptRoot 'serve.log'

function Wait-Postgres {
  while ($true) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $client.Connect('127.0.0.1', 5432)
      return
    } catch {
      Start-Sleep -Seconds 5
    } finally {
      $client.Dispose()
    }
  }
}

while ($true) {
  if (Test-Path $log) { Move-Item -Force $log (Join-Path $PSScriptRoot 'serve.previous.log') }
  Wait-Postgres
  Push-Location $repo
  cmd /c "pnpm dev > `"$log`" 2>&1"
  Pop-Location
  # The development server stopped: start it again after a pause
  Start-Sleep -Seconds 15
}
