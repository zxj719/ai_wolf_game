---
name: patch-codex-fast
description: Patch Codex App to enable Fast/Speed mode and Plugins when using API key mode instead of OAuth login. Supports macOS and Windows, with backup, rollback, and auto-discovery guidance for version updates.
---

# Patch Codex Fast

Use this skill when the user asks to patch the local Codex App so API key mode can access Speed/Fast mode, the Plugins sidebar, plugin installation, or connectors.

Do not run the patch automatically just because this skill loads. First identify the OS and Codex install path, confirm the user wants to modify the installed app, and make a backup. This workflow modifies installed application files and Electron fuses.

## What It Changes

- Enables Speed/Fast mode when `authMethod` is `apikey`.
- Enables the Plugins sidebar when using API key mode.
- Allows plugin installation and connector availability in API key mode.
- Extracts `app.asar` into an `app/` folder and renames the original asar so Electron loads the unpacked app.
- Disables Electron fuses that otherwise force asar loading or integrity validation.

## Requirements

- Node.js and `npx`.
- Python 3.
- macOS: permission to modify `/Applications/Codex.app` and re-sign the app.
- Windows: permission to modify `%LOCALAPPDATA%\Programs\Codex`.

## Safety Rules

1. Always create `app.asar.bak` before patching if it does not already exist.
2. Keep rollback commands ready before applying patches.
3. Kill Codex before modifying resources.
4. If no patterns are patched, stop and report the changed patterns instead of guessing blindly.
5. If Codex crashes after patching, run the rollback for the OS.
6. Do not patch a different app path unless the user explicitly confirms it is the Codex App install.

## macOS Rollback

```bash
cd /Applications/Codex.app/Contents/Resources
rm -rf app
[ -f app.asar1 ] && mv app.asar1 app.asar
[ -f app.asar.bak ] && cp app.asar.bak app.asar
codesign --force --deep --sign - /Applications/Codex.app
echo "Rolled back to original"
```

## macOS Patch

```bash
pkill -x Codex 2>/dev/null; sleep 1

cd /Applications/Codex.app/Contents/Resources

[ ! -f app.asar.bak ] && cp app.asar app.asar.bak && echo "Backed up app.asar -> app.asar.bak"

rm -rf app

npx @electron/asar e ./app.asar app

mv ./app.asar ./app.asar1

python3 << 'PYTHON'
import os, glob, re, sys

base = '/Applications/Codex.app/Contents/Resources/app/webview/assets'
patched_count = 0

FAST_AUTH_PATTERNS = [
    'return!(r?.authMethod!==\\x60chatgpt\\x60||i?.requirements?.featureRequirements?.fast_mode===!1)',
    'return!(r?.authMethod!==`chatgpt`||i?.requirements?.featureRequirements?.fast_mode===!1)',
]

FAST_MODELS_PATTERNS = [
    'l?.modelsByType.models.some(F)??!1',
    'l?.modelsByType.models.some(F)??false',
]

for f in glob.glob(os.path.join(base, 'permissions-mode-helpers-*.js')):
    with open(f, 'r') as fh:
        content = fh.read()
    original = content

    for pat in FAST_AUTH_PATTERNS:
        if pat in content:
            content = content.replace(pat, 'return true')
            print(f'[PATCHED] {os.path.basename(f)}: fast auth check -> return true')
            break
    else:
        if 'authMethod' in content and 'fast_mode' in content:
            print(f'[WARN] {os.path.basename(f)}: has authMethod+fast_mode but pattern changed. Manual fix needed.')
            idx = content.find('fast_mode')
            if idx >= 0:
                print(f'  Context: ...{content[max(0,idx-80):idx+80]}...')

    for pat in FAST_MODELS_PATTERNS:
        if pat in content:
            content = content.replace(pat, 'true')
            print(f'[PATCHED] {os.path.basename(f)}: models.some(F) -> true')
            break
    else:
        if 'modelsByType.models.some' in content:
            print(f'[WARN] {os.path.basename(f)}: has modelsByType.models.some but pattern changed.')
            idx = content.find('modelsByType.models.some')
            if idx >= 0:
                print(f'  Context: ...{content[max(0,idx-20):idx+80]}...')

    if content != original:
        with open(f, 'w') as fh:
            fh.write(content)
        patched_count += 1

if patched_count == 0:
    print('[WARN] permissions-mode-helpers-*.js not found. Searching all JS files...')
    for f in glob.glob(os.path.join(base, '*.js')):
        with open(f, 'r') as fh:
            content = fh.read()
        if 'authMethod' in content and 'fast_mode' in content and 'modelsByType' in content:
            print(f'[FOUND] Fast mode logic likely in: {os.path.basename(f)}')
            break

PLUGIN_PATTERNS = [
    ('D?(0,$.jsx)(Sl,{tooltipContent:(0,$.jsx)(Y,{id:\\x60sidebarElectron.pluginsDisabledTooltip\\x60', 'D?', '0?'),
]

for f in glob.glob(os.path.join(base, 'index-*.js')):
    with open(f, 'r') as fh:
        content = fh.read()
    original = content

    for full_pat, old_part, new_part in PLUGIN_PATTERNS:
        if full_pat in content:
            content = content.replace(full_pat, full_pat.replace(old_part, new_part, 1), 1)
            print(f'[PATCHED] {os.path.basename(f)}: plugins {old_part} -> {new_part} (always enabled)')
            break
    else:
        if 'pluginsDisabledTooltip' in content:
            idx = content.find('pluginsDisabledTooltip')
            before = content[max(0, idx-200):idx]
            m = re.search(r'([A-Z])\\?\\(0,\\$\\.jsx\\)\\(Sl,\\{tooltipContent', before + content[idx:idx+100])
            if m:
                gate_var = m.group(1)
                old_str = f'{gate_var}?(0,$.jsx)(Sl,{{tooltipContent'
                new_str = f'0?(0,$.jsx)(Sl,{{tooltipContent'
                if old_str in content:
                    content = content.replace(old_str, new_str, 1)
                    print(f'[PATCHED] {os.path.basename(f)}: plugins {gate_var}? -> 0? (fuzzy match)')

    if content != original:
        with open(f, 'w') as fh:
            fh.write(content)
        patched_count += 1

APIKEY_GATE_PATTERNS = [
    'function e(e){return e===`apikey`}',
    'function e(e){return e===\\x60apikey\\x60}',
]

for f in glob.glob(os.path.join(base, 'gradient-*.js')):
    with open(f, 'r') as fh:
        content = fh.read()
    original = content

    for pat in APIKEY_GATE_PATTERNS:
        if pat in content:
            content = content.replace(pat, 'function e(e){return false}')
            print(f'[PATCHED] {os.path.basename(f)}: apikey gate -> return false')
            break
    else:
        if 'apikey' in content:
            print(f'[WARN] {os.path.basename(f)}: has apikey ref but pattern changed.')

    if content != original:
        with open(f, 'w') as fh:
            fh.write(content)
        patched_count += 1

if not glob.glob(os.path.join(base, 'gradient-*.js')):
    for f in glob.glob(os.path.join(base, '*.js')):
        with open(f, 'r') as fh:
            c = fh.read()
        for pat in APIKEY_GATE_PATTERNS:
            if pat in c:
                print(f'[FOUND] apikey gate in: {os.path.basename(f)}')
                break

CONNECTOR_PATTERNS = [
    ('(i=`connector-unavailable`)', 'false&&(i=`connector-unavailable`)'),
    ('(i=\\x60connector-unavailable\\x60)', 'false&&(i=\\x60connector-unavailable\\x60)'),
]

for f in glob.glob(os.path.join(base, 'use-plugin-install-flow-*.js')):
    with open(f, 'r') as fh:
        content = fh.read()
    original = content

    for old_pat, new_pat in CONNECTOR_PATTERNS:
        if old_pat in content and 'false&&' + old_pat not in content:
            idx = content.find(old_pat)
            before = content[max(0,idx-20):idx]
            if 'false&&' not in before:
                content = content.replace(old_pat, new_pat, 1)
                print(f'[PATCHED] {os.path.basename(f)}: connector gate -> false&&(...)')
                break

    if content != original:
        with open(f, 'w') as fh:
            fh.write(content)
        patched_count += 1

if patched_count == 0:
    print('[ERROR] No patches applied! Patterns may have changed in this Codex version.')
    print('  Check webview/assets/ for files containing:')
    print('    - "authMethod" + "fast_mode"')
    print('    - "pluginsDisabledTooltip"')
    print('    - "apikey" in gradient-*.js')
    print('    - "connector-unavailable" in use-plugin-install-flow-*.js')
    sys.exit(1)
else:
    print(f'\\nAll {patched_count} patch(es) applied successfully.')
PYTHON

npx @electron/fuses write --app /Applications/Codex.app OnlyLoadAppFromAsar=off
npx @electron/fuses write --app /Applications/Codex.app EnableEmbeddedAsarIntegrityValidation=off
npx @electron/fuses write --app /Applications/Codex.app GrantFileProtocolExtraPrivileges=off
npx @electron/fuses write --app /Applications/Codex.app EnableCookieEncryption=off

codesign --force --deep --sign - /Applications/Codex.app

echo ""
echo "=== Patch Complete (macOS) ==="
echo "  Fast/Speed mode: enabled for API key mode"
echo "  Plugins sidebar: enabled for API key mode"
echo ""
echo "Open Codex.app to verify. If it crashes, run rollback."
```

## Windows Rollback

```powershell
cd "$env:LOCALAPPDATA\Programs\Codex\resources"
Remove-Item -Recurse -Force app -ErrorAction SilentlyContinue
if (Test-Path app.asar1) { Rename-Item app.asar1 app.asar }
if (Test-Path app.asar.bak) { Copy-Item app.asar.bak app.asar }
Write-Host "Rolled back to original"
```

## Windows Patch

```powershell
Stop-Process -Name "Codex" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

cd "$env:LOCALAPPDATA\Programs\Codex\resources"

if (-not (Test-Path app.asar.bak)) {
    Copy-Item app.asar app.asar.bak
    Write-Host "Backed up app.asar -> app.asar.bak"
}

Remove-Item -Recurse -Force app -ErrorAction SilentlyContinue

npx @electron/asar e ./app.asar app

Rename-Item app.asar app.asar1

python3 -c @"
import os, glob, re, sys

base = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'Codex', 'resources', 'app', 'webview', 'assets')
patched_count = 0

FAST_AUTH_PATTERNS = [
    'return!(r?.authMethod!==\\x60chatgpt\\x60||i?.requirements?.featureRequirements?.fast_mode===!1)',
    'return!(r?.authMethod!==`chatgpt`||i?.requirements?.featureRequirements?.fast_mode===!1)',
]

FAST_MODELS_PATTERNS = [
    'l?.modelsByType.models.some(F)??!1',
    'l?.modelsByType.models.some(F)??false',
]

for f in glob.glob(os.path.join(base, 'permissions-mode-helpers-*.js')):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content

    for pat in FAST_AUTH_PATTERNS:
        if pat in content:
            content = content.replace(pat, 'return true')
            print(f'[PATCHED] {os.path.basename(f)}: fast auth check -> return true')
            break
    else:
        if 'authMethod' in content and 'fast_mode' in content:
            print(f'[WARN] {os.path.basename(f)}: pattern changed. Manual fix needed.')

    for pat in FAST_MODELS_PATTERNS:
        if pat in content:
            content = content.replace(pat, 'true')
            print(f'[PATCHED] {os.path.basename(f)}: models.some(F) -> true')
            break

    if content != original:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(content)
        patched_count += 1

if patched_count == 0:
    print('[WARN] permissions-mode-helpers not found, searching all JS...')
    for f in glob.glob(os.path.join(base, '*.js')):
        with open(f, 'r', encoding='utf-8') as fh:
            content = fh.read()
        if 'authMethod' in content and 'fast_mode' in content:
            print(f'[FOUND] {os.path.basename(f)}')
            break

for f in glob.glob(os.path.join(base, 'index-*.js')):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content
    if 'pluginsDisabledTooltip' in content:
        idx = content.find('pluginsDisabledTooltip')
        before = content[max(0, idx-200):idx+100]
        m = re.search(r'([A-Z])\\?\\(0,\\$\\.jsx\\)\\(Sl,\\{tooltipContent', before)
        if m:
            gate = m.group(1)
            old_s = f'{gate}?(0,$.jsx)(Sl,{{tooltipContent'
            new_s = f'0?(0,$.jsx)(Sl,{{tooltipContent'
            if old_s in content:
                content = content.replace(old_s, new_s, 1)
                print(f'[PATCHED] {os.path.basename(f)}: plugins {gate}? -> 0?')
    if content != original:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(content)
        patched_count += 1

APIKEY_GATE_PATTERNS = [
    'function e(e){return e===`apikey`}',
    'function e(e){return e===\\x60apikey\\x60}',
]

for f in glob.glob(os.path.join(base, 'gradient-*.js')):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content
    for pat in APIKEY_GATE_PATTERNS:
        if pat in content:
            content = content.replace(pat, 'function e(e){return false}')
            print(f'[PATCHED] {os.path.basename(f)}: apikey gate -> return false')
            break
    if content != original:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(content)
        patched_count += 1

CONNECTOR_PATTERNS = [
    ('(i=`connector-unavailable`)', 'false&&(i=`connector-unavailable`)'),
    ('(i=\\x60connector-unavailable\\x60)', 'false&&(i=\\x60connector-unavailable\\x60)'),
]

for f in glob.glob(os.path.join(base, 'use-plugin-install-flow-*.js')):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content
    for old_pat, new_pat in CONNECTOR_PATTERNS:
        if old_pat in content and 'false&&' + old_pat not in content:
            idx = content.find(old_pat)
            before = content[max(0,idx-20):idx]
            if 'false&&' not in before:
                content = content.replace(old_pat, new_pat, 1)
                print(f'[PATCHED] {os.path.basename(f)}: connector gate -> false&&(...)')
                break
    if content != original:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(content)
        patched_count += 1

print(f'\\nDone. {patched_count} patch(es) applied.')
"@

$codexExe = "$env:LOCALAPPDATA\Programs\Codex\Codex.exe"
npx @electron/fuses write --app $codexExe OnlyLoadAppFromAsar=off
npx @electron/fuses write --app $codexExe EnableEmbeddedAsarIntegrityValidation=off
npx @electron/fuses write --app $codexExe GrantFileProtocolExtraPrivileges=off
npx @electron/fuses write --app $codexExe EnableCookieEncryption=off

Write-Host ""
Write-Host "=== Patch Complete (Windows) ==="
Write-Host "  Fast/Speed mode: enabled for API key mode"
Write-Host "  Plugins sidebar: enabled for API key mode"
Write-Host ""
Write-Host "Open Codex to verify."
```

## When Codex Updates

Codex updates can change JS filenames and minified variable names. Use these searches inside `<resources>/app/webview/assets`.

Fast mode auth gate:

```bash
grep -rl "authMethod" *.js | xargs grep -l "fast_mode"
grep -o ".{0,50}authMethod.{0,100}fast_mode.{0,80}" <target_file>
```

Patch the target return value to `return true`.

Fast mode model availability:

```bash
grep -o ".{0,30}modelsByType.models.some.{0,50}" <target_file>
```

Replace the whole model availability expression with `true`.

Plugins sidebar gate:

```bash
grep -rl "pluginsDisabledTooltip" *.js
grep -o ".{0,5}pluginsDisabledTooltip" <target_file>
```

Change the gate ternary from `X?(...)` to `0?(...)`.

API key plugin detection:

```bash
grep -rl 'return e===.apikey.' *.js | grep -v locale
grep -o 'function e(e){return e===.apikey.}' <target_file>
```

Change it to `function e(e){return false}`.

Connector availability:

```bash
grep -rl "connector-unavailable" *.js | grep plugin
grep -o '.{0,10}connector-unavailable.{0,10}' <target_file>
```

Prefix the assignment with `false&&`, for example `false&&(i=\`connector-unavailable\`)`.

## Implementation Notes

| Change | Purpose |
| --- | --- |
| `OnlyLoadAppFromAsar=off` | Let Electron read the unpacked `app/` folder. |
| `EnableEmbeddedAsarIntegrityValidation=off` | Skip SHA validation on asar contents. |
| `GrantFileProtocolExtraPrivileges=off` | Disable file protocol restrictions. |
| `EnableCookieEncryption=off` | Disable cookie encryption check. |
| Rename `app.asar` to `app.asar1` | Make Electron fall back to `app/`. |
| Fast auth check -> `return true` | Bypass OAuth-only fast mode gate. |
| `models.some(F)` -> `true` | Avoid relay model metadata missing `additionalSpeedTiers`. |
| Plugin gate `X?` -> `0?` | Show enabled Plugins sidebar in API key mode. |
| API key gate -> `return false` | Avoid treating API key mode as plugin-blocked. |
| Connector gate -> `false&&(...)` | Prevent connector checks from marking connectors unavailable. |
| macOS ad-hoc codesign | Allow modified app to launch on macOS. |
