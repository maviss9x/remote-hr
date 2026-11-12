try {
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=DESKTOP-6APP6KP\SQLEXPRESS01;Integrated Security=True;TrustServerCertificate=True;")
    $conn.Open()
    Write-Host "Connected via Windows Auth!"

    # 1. Bật Mixed Mode (LoginMode = 2)
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'LoginMode', REG_DWORD, 2;"
    $cmd.ExecuteNonQuery()
    Write-Host "[1/5] Da bat Mixed Mode Authentication (SQL Server and Windows Authentication)!"

    # 2. Bật TCP/IP
    $cmd.CommandText = "EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer\SuperSocketNetLib\Tcp', N'Enabled', REG_DWORD, 1;"
    $cmd.ExecuteNonQuery()
    Write-Host "[2/5] Da bat giao thuc TCP/IP!"

    # 3. Dat port co dinh 14333 cho IPAll (tranh trung cac instance khac) va xoa dynamic port
    $cmd.CommandText = "EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer\SuperSocketNetLib\Tcp\IPAll', N'TcpPort', REG_SZ, N'14333';
                        EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer\SuperSocketNetLib\Tcp\IPAll', N'TcpDynamicPorts', REG_SZ, N'';"
    $cmd.ExecuteNonQuery()
    Write-Host "[3/5] Da dat TCP Port co dinh: 14333!"

    # 4. Kich hoat tai khoan sa va dat mat khau
    $password = "HybridHr@2026"
    $cmd.CommandText = "ALTER LOGIN sa WITH PASSWORD = '$password', CHECK_POLICY = OFF; ALTER LOGIN sa ENABLE;"
    $cmd.ExecuteNonQuery()
    Write-Host "[4/5] Da kich hoat tai khoan 'sa' voi mat khau: $password"

    # 5. Tao Database hybrid_hr neu chua ton tai
    $cmd.CommandText = "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'hybrid_hr') CREATE DATABASE hybrid_hr;"
    $cmd.ExecuteNonQuery()
    Write-Host "[5/5] Da tao Database 'hybrid_hr' thanh cong!"

    $conn.Close()
    Write-Host "`n>>> CAU HINH HOAN TAT TRONG SQL ENGINE! Can Restart Service SQLEXPRESS01 de co hieu luc TCP/IP. <<<"
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message)
}
