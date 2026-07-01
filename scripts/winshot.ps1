param(
  [string]$Title = 'MARKMARK',
  [string]$Out = 'shot.png',
  [int]$Delay = 0
)
if ($Delay -gt 0) { Start-Sleep -Seconds $Delay }

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$Title*" }
foreach ($pr in $procs) { Write-Output ("proc {0} name={1} handle={2} title=[{3}]" -f $pr.Id, $pr.ProcessName, $pr.MainWindowHandle, $pr.MainWindowTitle) }

$p = $procs | Select-Object -First 1

if ($p -and $p.MainWindowHandle -ne 0) {
  [W]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  [W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 700
  $r = New-Object 'W+RECT'
  [W]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
  $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
  Write-Output ("window rect L={0} T={1} {2}x{3}" -f $r.Left, $r.Top, $w, $h)
  if ($w -gt 0 -and $h -gt 0) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
    $bmp.Save($Out); $g.Dispose(); $bmp.Dispose()
    Write-Output ("saved window shot {0}" -f $Out)
    exit 0
  }
}

$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
$bmp.Save($Out); $g.Dispose(); $bmp.Dispose()
Write-Output ("no matching window; saved full screen {0} ({1}x{2})" -f $Out, $b.Width, $b.Height)
