Get-NetTCPConnection | Where-Object { $_.OwningProcess -eq 3612 } | Select-Object LocalAddress, LocalPort, State
