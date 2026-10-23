# IEC COMUNICACIONES · Servidor local de desarrollo
$ErrorActionPreference = "Stop"
$Port = 8888
$Root = $PSScriptRoot

Set-Location $Root

Write-Host ""
Write-Host " IEC COMUNICACIONES · Servidor local" -ForegroundColor Cyan
Write-Host " Carpeta: $Root"
Write-Host " Puerto:  $Port"
Write-Host ""

$php = Get-Command php -ErrorAction SilentlyContinue
if ($php) {
  Write-Host " Modo: PHP (formularios API activos)" -ForegroundColor Green
  Write-Host " Abre en el navegador:" -ForegroundColor Green
  Write-Host "   http://127.0.0.1:$Port/index.html#faq"
  Write-Host ""
  Write-Host " Pulsa Ctrl+C para detener el servidor." -ForegroundColor DarkGray
  Write-Host ""
  & php -S "127.0.0.1:$Port" -t $Root
} else {
  Write-Host " Modo: estatico (sin PHP). Instala PHP para probar contacto/tickets." -ForegroundColor Yellow
  Write-Host " Abre en el navegador:" -ForegroundColor Green
  Write-Host "   http://127.0.0.1:$Port/index.html#faq"
  Write-Host ""
  Write-Host " Pulsa Ctrl+C para detener el servidor." -ForegroundColor DarkGray
  Write-Host ""
  & python -m http.server $Port
}
