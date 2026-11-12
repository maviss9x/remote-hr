try {
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=127.0.0.1,14333;Database=hybrid_hr;User Id=sa;Password=HybridHr@2026;TrustServerCertificate=True;")
    $conn.Open()
    Write-Host "SUCCESS: Connected via TCP/IP port 14333 with user 'sa'!"
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT DB_NAME() as db, @@VERSION as ver"
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host ("Current DB: " + $reader["db"])
    }
    $conn.Close()
} catch {
    Write-Host ("ERROR connecting TCP 14333: " + $_.Exception.Message)
}
