$regPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.SQLEXPRESS01\MSSQLServer\SuperSocketNetLib\Tcp\IPAll"
Get-ItemProperty $regPath | Format-List TcpPort, TcpDynamicPorts
