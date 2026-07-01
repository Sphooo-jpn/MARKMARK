$id = "Markdown Document"
$cmd = (Get-ItemProperty "HKCU:\Software\Classes\$id\shell\open\command" -ErrorAction SilentlyContinue).'(default)'
$icon = (Get-ItemProperty "HKCU:\Software\Classes\$id\DefaultIcon" -ErrorAction SilentlyContinue).'(default)'
$fn = (Get-ItemProperty "HKCU:\Software\Classes\$id" -ErrorAction SilentlyContinue).FriendlyTypeName
Write-Output ("ProgID '$id'")
Write-Output ("  open command : " + $cmd)
Write-Output ("  default icon : " + $icon)
Write-Output ("  friendly     : " + $fn)

Write-Output ""
Write-Output "=== all HKCU classes whose open-command references markmark ==="
Get-ChildItem "HKCU:\Software\Classes" -ErrorAction SilentlyContinue | ForEach-Object {
  $p = "HKCU:\Software\Classes\$($_.PSChildName)\shell\open\command"
  $c = (Get-ItemProperty $p -ErrorAction SilentlyContinue).'(default)'
  if ($c -like "*markmark*") { Write-Output ("  {0}  =>  {1}" -f $_.PSChildName, $c) }
}
