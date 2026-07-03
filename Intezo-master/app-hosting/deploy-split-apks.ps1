param(
    [string]$ProjectId = 'tawakkalna-3ffc6',
    [string]$BaseUrl = 'https://tawakkalna-3ffc6.web.app',
    [string]$ArtifactBaseUrl = 'https://apk.intezo.online',
    [string]$R2BucketName = $env:INTEZO_R2_BUCKET,
    [string]$R2EndpointUrl = $env:INTEZO_R2_ENDPOINT,
    [switch]$FirebaseBlaze,
    [switch]$SkipBuild,
    [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$hostingRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $hostingRoot '..'))
$mobileRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot 'mobile_app-intezo'))
$publicRoot = [IO.Path]::GetFullPath((Join-Path $hostingRoot 'public'))
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $publicRoot 'releases'))
$externalArtifactRoot = [IO.Path]::GetFullPath((Join-Path $hostingRoot 'artifacts\releases'))
$outputRoot = Join-Path $mobileRoot 'build\app\outputs\flutter-apk'
$symbolsRoot = Join-Path $mobileRoot 'build\symbols\android'

if (-not $releaseRoot.StartsWith($publicRoot + [IO.Path]::DirectorySeparatorChar)) {
    throw "Unsafe release directory: $releaseRoot"
}

if (-not $externalArtifactRoot.StartsWith($hostingRoot + [IO.Path]::DirectorySeparatorChar)) {
    throw "Unsafe external artifact directory: $externalArtifactRoot"
}

if (-not (Test-Path (Join-Path $mobileRoot 'android\key.properties'))) {
    throw 'android/key.properties is missing. Configure the release keystore before building.'
}

if (-not $SkipDeploy -and -not $FirebaseBlaze) {
    if ([string]::IsNullOrWhiteSpace($R2BucketName) -or [string]::IsNullOrWhiteSpace($R2EndpointUrl)) {
        throw @'
Firebase Spark forbids APK files. The default release flow therefore stores APKs
in Cloudflare R2 and deploys only the selector page and manifest to Firebase.
Set INTEZO_R2_BUCKET and INTEZO_R2_ENDPOINT first, or use -FirebaseBlaze only
after upgrading the Firebase project to the Blaze plan.
'@
    }
}

$pubspec = Get-Content (Join-Path $mobileRoot 'pubspec.yaml') -Raw
$versionMatch = [regex]::Match($pubspec, '(?m)^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)\s*$')
if (-not $versionMatch.Success) {
    throw 'Unable to read version name and build number from pubspec.yaml.'
}

$versionName = $versionMatch.Groups[1].Value
$versionCode = [int]$versionMatch.Groups[2].Value
$releaseName = "$versionName+$versionCode"
$BaseUrl = $BaseUrl.TrimEnd('/')
$ArtifactBaseUrl = $ArtifactBaseUrl.TrimEnd('/')

if ($FirebaseBlaze) {
    $artifactRoot = $releaseRoot
    $artifactUrl = $BaseUrl
} else {
    $artifactRoot = $externalArtifactRoot
    $artifactUrl = $ArtifactBaseUrl
}

$versionReleaseRoot = Join-Path $artifactRoot $releaseName

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE."
    }
}

function Copy-ReleaseArtifact {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$FileName
    )

    if (-not (Test-Path $Source)) {
        throw "Expected APK was not created: $Source"
    }

    $destination = Join-Path $versionReleaseRoot $FileName
    Copy-Item -LiteralPath $Source -Destination $destination -Force
    $file = Get-Item -LiteralPath $destination
    return [ordered]@{
        url = "$artifactUrl/releases/$releaseName/$FileName"
        sizeBytes = $file.Length
        sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

if (-not $SkipBuild) {
    Push-Location $mobileRoot
    try {
        Invoke-Checked 'flutter' 'pub' 'get'
        Invoke-Checked 'flutter' 'analyze' '--no-fatal-infos'
        Invoke-Checked 'flutter' 'build' 'apk' '--release' '--split-per-abi' '--obfuscate' "--split-debug-info=$symbolsRoot"
    } finally {
        Pop-Location
    }
}

if (-not $FirebaseBlaze -and (Test-Path $releaseRoot)) {
    # Never let Firebase Spark discover a previously staged APK.
    Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}

if (Test-Path $artifactRoot) {
    Remove-Item -LiteralPath $artifactRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $versionReleaseRoot -Force | Out-Null

$downloads = [ordered]@{}
$downloads['armeabi-v7a'] = Copy-ReleaseArtifact `
    -Source (Join-Path $outputRoot 'app-armeabi-v7a-release.apk') `
    -FileName 'intezo-armeabi-v7a.apk'
$downloads['armeabi-v7a']['androidVersionCode'] = 1000 + $versionCode
$downloads['arm64-v8a'] = Copy-ReleaseArtifact `
    -Source (Join-Path $outputRoot 'app-arm64-v8a-release.apk') `
    -FileName 'intezo-arm64-v8a.apk'
$downloads['arm64-v8a']['androidVersionCode'] = 2000 + $versionCode
$downloads['x86_64'] = Copy-ReleaseArtifact `
    -Source (Join-Path $outputRoot 'app-x86_64-release.apk') `
    -FileName 'intezo-x86_64.apk'
$downloads['x86_64']['androidVersionCode'] = 4000 + $versionCode

if (-not $SkipBuild) {
    Push-Location $mobileRoot
    try {
        Invoke-Checked 'flutter' 'build' 'apk' '--release' '--obfuscate' "--split-debug-info=$symbolsRoot"
    } finally {
        Pop-Location
    }
}

$downloads['universal'] = Copy-ReleaseArtifact `
    -Source (Join-Path $outputRoot 'app-release.apk') `
    -FileName 'intezo-universal.apk'
$downloads['universal']['androidVersionCode'] = $versionCode

$manifest = [ordered]@{
    schemaVersion = 1
    appName = 'Intezo'
    packageName = 'com.intezo.qatar_app'
    versionName = $versionName
    versionCode = $versionCode
    minimumAndroidSdk = 24
    minimumNextPlayStoreVersionCode = 4001 + $versionCode
    publishedAt = (Get-Date).ToUniversalTime().ToString('o')
    downloadPage = "$BaseUrl/"
    downloads = $downloads
}

$manifestPath = Join-Path $publicRoot 'latest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host "Prepared Intezo $releaseName"
foreach ($entry in $downloads.GetEnumerator()) {
    $sizeMb = [math]::Round($entry.Value.sizeBytes / 1MB, 2)
    Write-Host "$($entry.Key): $sizeMb MB - $($entry.Value.url)"
    Write-Host "Android version code: $($entry.Value.androidVersionCode)"
    Write-Host "SHA256: $($entry.Value.sha256)"
}

Write-Warning "The first Play Store build must use version code $($manifest.minimumNextPlayStoreVersionCode) or higher so it can update every split APK."

if (-not $SkipDeploy) {
    if (-not $FirebaseBlaze) {
        $r2Destination = "s3://$R2BucketName/releases/$releaseName/"
        Invoke-Checked 'aws' 's3' 'cp' $versionReleaseRoot $r2Destination `
            '--recursive' `
            '--endpoint-url' $R2EndpointUrl `
            '--region' 'auto' `
            '--only-show-errors' `
            '--content-type' 'application/vnd.android.package-archive' `
            '--cache-control' 'public,max-age=31536000,immutable' `
            '--content-disposition' 'attachment'

        Invoke-Checked 'aws' 's3' 'cp' $manifestPath "s3://$R2BucketName/latest.json" `
            '--endpoint-url' $R2EndpointUrl `
            '--region' 'auto' `
            '--only-show-errors' `
            '--content-type' 'application/json' `
            '--cache-control' 'no-cache,no-store,must-revalidate'

        Write-Host "R2 APK release deployed: $ArtifactBaseUrl/releases/$releaseName/"
    }

    Push-Location $hostingRoot
    try {
        Invoke-Checked 'firebase.cmd' 'deploy' '--only' 'hosting' '--project' $ProjectId
    } finally {
        Pop-Location
    }
    Write-Host "Firebase download page deployed: $BaseUrl"
} else {
    Write-Host "Deployment skipped. Prepared artifacts: $versionReleaseRoot"
}
