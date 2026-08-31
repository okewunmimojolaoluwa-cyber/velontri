$src = "C:\Users\USER PC\Desktop\velontri\frontend\src"
$files = Get-ChildItem -Path $src -Recurse -Include "*.tsx","*.ts"
$n = 0
foreach ($f in $files) {
  $t = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $t
  $t = [regex]::Replace($t, '(?<![a-zA-Z0-9_])BarChart3(?![a-zA-Z0-9_])', 'ChartBar')
  $t = [regex]::Replace($t, '(?<![a-zA-Z0-9_])Activity(?![a-zA-Z0-9_])', 'Pulse')
  $t = [regex]::Replace($t, '(?<![a-zA-Z0-9_])UserCog(?![a-zA-Z0-9_])', 'UserGear')
  $t = [regex]::Replace($t, '(?<![a-zA-Z0-9_])ClipboardList(?![a-zA-Z0-9_])', 'ClipboardText')
  if ($t -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $t, [System.Text.Encoding]::UTF8)
    $n++
    Write-Output $f.Name
  }
}
Write-Output "Fixed: $n files"
