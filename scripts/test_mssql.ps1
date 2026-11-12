try {
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Integrated Security=True;TrustServerCertificate=True;")
    $conn.Open()
    Write-Host "Connected to localhost (MSSQLSERVER default instance) successfully!"
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT @@VERSION as ver, @@SERVERNAME as srv"
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host ("Server Name: " + $reader["srv"])
        Write-Host ("Version: " + $reader["ver"])
    }
    $conn.Close()
} catch {
    Write-Host ("Error localhost: " + $_.Exception.Message)
}

# Test localhost\MSSQLSERVER01
try {
    $conn2 = New-Object System.Data.SqlClient.SqlConnection("Server=localhost\MSSQLSERVER01;Integrated Security=True;TrustServerCertificate=True;")
    $conn2.Open()
    Write-Host "Connected to localhost\MSSQLSERVER01 successfully!"
    $cmd2 = $conn2.CreateCommand()
    $cmd2.CommandText = "SELECT @@VERSION as ver, @@SERVERNAME as srv"
    $reader2 = $cmd2.ExecuteReader()
    if ($reader2.Read()) {
        Write-Host ("Server Name: " + $reader2["srv"])
        Write-Host ("Version: " + $reader2["ver"])
    }
    $conn2.Close()
} catch {
    Write-Host ("Error localhost\MSSQLSERVER01: " + $_.Exception.Message)
}
