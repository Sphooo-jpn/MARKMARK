param(
  [string]$Out = "shot.png",
  [int]$Delay = 0
)
if ($Delay -gt 0) { Start-Sleep -Seconds $Delay }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
$bmp.Save($Out)
$g.Dispose(); $bmp.Dispose()
Write-Output ("saved {0} ({1}x{2})" -f $Out, $b.Width, $b.Height)
