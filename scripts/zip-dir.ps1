# 把一个目录打成 zip，条目名用正斜杠。
#
# 不能用 Compress-Archive：Windows PowerShell 5.1 的版本把嵌套路径写成
# `graderlib\checks.py`（反斜杠）。ZIP 规范要求正斜杠，Linux 的 unzip 会把
# 反斜杠当成文件名的一部分，解出来是一个叫 "graderlib\checks.py" 的普通文件，
# 而不是 graderlib/ 目录——学员在 Ubuntu 上 `import graderlib` 直接失败。
#
# 用法: powershell -File scripts/zip-dir.ps1 -Source <目录> -Destination <zip>
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$root = (Resolve-Path $Source).Path.TrimEnd('\')
if (Test-Path $Destination) { Remove-Item $Destination -Force }

$fs = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create)
try {
  $archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem -Path $root -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
      $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
      $stream = $entry.Open()
      try {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $stream.Write($bytes, 0, $bytes.Length)
      } finally { $stream.Dispose() }
    }
  } finally { $archive.Dispose() }
} finally { $fs.Dispose() }
