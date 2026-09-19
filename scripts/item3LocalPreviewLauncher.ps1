param(
  [Parameter(Mandatory = $true)]
  [string]$PackageDirectory
)

$ErrorActionPreference = "Stop"

try {
  $packageRoot = [IO.Path]::GetFullPath($PackageDirectory)
  $recordPath = Join-Path $packageRoot "_lab-studio-build.json"
  $record = Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
  if ($record.launch.url -ne "http://127.0.0.1:4180/") {
    throw "The build record does not target the required loopback URL."
  }

  $node = (Get-Command node -ErrorAction Stop).Source
  $logDirectory = Join-Path $packageRoot "logs"
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

  $arguments = @(
    "_lab-studio-preview-server.mjs",
    "--port",
    "4180",
    "--expected-build-id",
    [string]$record.buildId,
    "--state-file",
    "logs\preview-state.json",
    "--log-file",
    "logs\preview.log"
  )
  $process = Start-Process `
    -FilePath $node `
    -ArgumentList $arguments `
    -WorkingDirectory $packageRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDirectory "preview-process.stdout.log") `
    -RedirectStandardError (Join-Path $logDirectory "preview-process.stderr.log") `
    -PassThru

  if (-not $process) {
    throw "Windows did not return a preview process handle."
  }
  Write-Output $process.Id
}
catch {
  Write-Error $_
  exit 1
}
