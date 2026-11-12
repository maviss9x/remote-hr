# Kiểm tra cấu hình Registry của SQLEXPRESS01
$regPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.SQLEXPRESS01\MSSQLServer\SuperSocketNetLib\Tcp"
if (Test-Path $regPath) {
    Get-ItemProperty $regPath | Select-Object Enabled
    Get-ItemProperty "$regPath\IPAll" | Select-Object TcpPort, TcpDynamicPorts
} else {
    Write-Host "Registry path not found at $regPath, searching..."
    Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server" | Select-Object Name
}
