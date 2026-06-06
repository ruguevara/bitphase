if ($env:EMSDK) {
    $envScript = Join-Path $env:EMSDK "emsdk_env.ps1"
    if (Test-Path $envScript) { & $envScript }
}

$emccArgs = "external/ayumi/ayumi.c", "-o", "public/ayumi.wasm", "-O3",
    "-s", "WASM=1",
    "-s", "EXPORTED_FUNCTIONS=`"[\`"_ayumi_configure\`", \`"_ayumi_set_pan\`", \`"_ayumi_set_tone\`", \`"_ayumi_set_noise\`", \`"_ayumi_set_mixer\`", \`"_ayumi_set_volume\`", \`"_ayumi_set_sid\`", \`"_ayumi_set_sid_pwm\`", \`"_ayumi_set_sid_waveform\`", \`"_ayumi_sid_reset\`", \`"_ayumi_get_sid_active_period\`", \`"_ayumi_set_syncbuzzer\`", \`"_ayumi_set_syncbuzzer_pwm\`", \`"_ayumi_set_syncbuzzer_waveform\`", \`"_ayumi_syncbuzzer_reset\`", \`"_ayumi_struct_size\`", \`"_ayumi_set_envelope\`", \`"_ayumi_set_envelope_shape\`", \`"_ayumi_process\`", \`"_ayumi_remove_dc\`", \`"_malloc\`", \`"_free\`"]`"",
    "-s", "ALLOW_MEMORY_GROWTH=1", "-s", "INITIAL_MEMORY=16777216", "-s", "MAXIMUM_MEMORY=16777216",
    "-s", "ENVIRONMENT=web", "-s", "STANDALONE_WASM=1", "--no-entry"

$python = $null
foreach ($name in @('python', 'python3')) {
    $c = Get-Command $name -EA SilentlyContinue
    if ($c) { $python = $c.Source; break }
}
if (-not $python) {
    $paths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
        "$env:ProgramFiles\Python*\python.exe",
        "${env:ProgramFiles(x86)}\Python*\python.exe"
    )
    foreach ($p in $paths) {
        $f = Get-ChildItem $p -EA SilentlyContinue | Select-Object -First 1
        if ($f) { $python = $f.FullName; break }
    }
}

if (-not $env:EMSDK) {
    $try = @("$env:USERPROFILE\emsdk", "${env:ProgramFiles}\emsdk", "C:\emsdk")
    foreach ($d in $try) {
        $py = Join-Path $d "upstream\emscripten\emcc.py"
        if (Test-Path $py) {
            $env:EMSDK = $d
            $envScript = Join-Path $d "emsdk_env.ps1"
            if (Test-Path $envScript) { & $envScript }
            break
        }
    }
}
if (-not $env:EMSDK) {
    Write-Host "Error: EMSDK not set. Set EMSDK to your Emscripten install path (e.g. $env:USERPROFILE\emsdk)." -ForegroundColor Red
    exit 1
}

$emccPy = Join-Path $env:EMSDK "upstream\emscripten\emcc.py"
if (-not (Test-Path $emccPy)) {
    Write-Host "Error: emcc.py not found at $emccPy" -ForegroundColor Red
    exit 1
}

if (-not $python) {
    Write-Host "Error: Python not found. Add Python to PATH or install from https://www.python.org/" -ForegroundColor Red
    exit 1
}

& $python $emccPy @emccArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
