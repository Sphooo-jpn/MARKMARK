param([int]$Delay = 12)
Start-Sleep -Seconds $Delay

Write-Output "=== install location ==="
$roots = @("$env:LOCALAPPDATA\Programs", "$env:PROGRAMFILES", "${env:ProgramFiles(x86)}")
$exe = $null
foreach ($r in $roots) {
  if (Test-Path $r) {
    Get-ChildItem $r -Recurse -Filter MARKMARK.exe -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Output $_.FullName
      if (-not $exe) { $exe = $_.FullName }
    }
  }
}
Write-Output ("EXE=" + $exe)

Write-Output ""
Write-Output "=== .md OpenWithProgIds (HKCU\Software\Classes\.md) ==="
$k = "HKCU:\Software\Classes\.md\OpenWithProgIds"
if (Test-Path $k) { (Get-Item $k).Property | ForEach-Object { Write-Output "  $_" } } else { Write-Output "  (none)" }

Write-Output ""
Write-Output "=== ProgIDs referencing MARKMARK + their open command ==="
Get-ChildItem "HKCU:\Software\Classes" -ErrorAction SilentlyContinue |
  Where-Object { $_.PSChildName -like "*MARKMARK*" } | ForEach-Object {
    $id = $_.PSChildName
    $cmd = (Get-ItemProperty "HKCU:\Software\Classes\$id\shell\open\command" -ErrorAction SilentlyContinue).'(default)'
    Write-Output ("  {0}  =>  {1}" -f $id, $cmd)
  }

Write-Output ""
Write-Output "=== .markdown assoc ==="
$k2 = "HKCU:\Software\Classes\.markdown\OpenWithProgIds"
if (Test-Path $k2) { (Get-Item $k2).Property | ForEach-Object { Write-Output "  $_" } } else { Write-Output "  (none)" }

Write-Output ""
Write-Output "=== Uninstall entry ==="
foreach ($base in @("HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall")) {
  Get-ChildItem $base -ErrorAction SilentlyContinue | ForEach-Object {
    $dn = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName
    if ($dn -like "*MARKMARK*") { Write-Output ("  " + $dn + "  @ " + $_.PSChildName) }
  }
}
