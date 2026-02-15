# Script para agregar Node.js al PATH del usuario (solo esta sesion o permanente)
# Ejecuta este script UNA VEZ para que npx funcione en cualquier terminal.

$nodePath = "C:\Program Files\nodejs"
if (-not (Test-Path "$nodePath\node.exe")) {
    $nodePath = "${env:LOCALAPPDATA}\Programs\node"
}
if (-not (Test-Path "$nodePath\node.exe")) {
    Write-Host "No se encontro Node.js en las rutas habituales." -ForegroundColor Red
    Write-Host "Instala Node.js desde https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$nodePath*") {
    [Environment]::SetEnvironmentVariable("Path", "$nodePath;$currentPath", "User")
    Write-Host "Node.js agregado al PATH del usuario: $nodePath" -ForegroundColor Green
    Write-Host "Cierra TODAS las ventanas de PowerShell y Cursor y vuelve a abrirlas." -ForegroundColor Yellow
} else {
    Write-Host "Node.js ya esta en el PATH." -ForegroundColor Green
}
Write-Host ""
Write-Host "Para que tome efecto, cierra esta ventana y abre una nueva terminal." -ForegroundColor Cyan
