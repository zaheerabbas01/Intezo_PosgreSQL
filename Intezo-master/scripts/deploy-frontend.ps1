param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$DistributionId,
  [string]$Region = "ap-south-1",
  [string]$ApiUrl = "https://api.intezo.online/api",
  [string]$SocketUrl = "https://api.intezo.online"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $repoRoot "frontend-intezo"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI is required and was not found in PATH."
}

Push-Location $frontend
try {
  $env:REACT_APP_API_URL = $ApiUrl
  $env:REACT_APP_SOCKET_URL = $SocketUrl
  $env:GENERATE_SOURCEMAP = "false"
  $env:CI = "true"
  npm.cmd ci
  npm.cmd run build

  aws s3 sync build "s3://$Bucket" --delete --region $Region --cache-control "no-cache, no-store, must-revalidate"
  aws s3 sync build/static "s3://$Bucket/static" --region $Region --cache-control "public,max-age=31536000,immutable"
  aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"
} finally {
  Pop-Location
}
