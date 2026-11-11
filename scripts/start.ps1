$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:4317'
try {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Instale o Node.js 24 LTS em https://nodejs.org e abra este arquivo novamente.' }
    $majorVersion = [int]((& $nodeCommand.Source --version).TrimStart('v').Split('.')[0])
    if ($majorVersion -lt 24) { throw 'Este aplicativo precisa do Node.js 24 ou mais recente.' }
    $running = $false
    try {
        $health = Invoke-RestMethod -Uri "$appUrl/api/health" -TimeoutSec 2
        if ($health.app -ne 'tv-time-personal') { throw 'A porta 4317 está sendo usada por outro aplicativo.' }
        $running = $true
    } catch {
        if ($_.Exception.Message -like '*outro aplicativo*') { throw }
    }
    if (-not $running) {
        $dataPath = Join-Path $projectPath 'data'
        New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
        $serverPath = Join-Path $projectPath 'server.mjs'
        Start-Process -FilePath $nodeCommand.Source -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataPath 'server.log') -RedirectStandardError (Join-Path $dataPath 'server-error.log') | Out-Null
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Milliseconds 300
            try { if ((Invoke-RestMethod -Uri "$appUrl/api/health" -TimeoutSec 1).app -eq 'tv-time-personal') { $running = $true; break } } catch {}
        }
        if (-not $running) { throw 'Não foi possível abrir o app. Consulte data/server-error.log ou execute npm start na pasta do projeto.' }
    }
    Start-Process $appUrl
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Pressione Enter para fechar'
    exit 1
}
