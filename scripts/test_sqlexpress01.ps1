try {
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=DESKTOP-6APP6KP\SQLEXPRESS01;Integrated Security=True;TrustServerCertificate=True;")
    $conn.Open()
    Write-Host "SUCCESS: Connected to DESKTOP-6APP6KP\SQLEXPRESS01 via Windows Authentication!"
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT @@VERSION as ver, SERVERPROPERTY('ServerName') as srv, SERVERPROPERTY('IsIntegratedSecurityOnly') as authMode"
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host ("Server Name: " + $reader["srv"])
        Write-Host ("Auth Mode (1 = Windows Only, 0 = Mixed Mode): " + $reader["authMode"])
        Write-Host ("Version: " + $reader["ver"])
    }
    $conn.Close()
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message)
}
