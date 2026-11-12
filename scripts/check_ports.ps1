$pids = (Get-Process -Name sqlservr).Id
Get-NetTCPConnection | Where-Object { $pids -contains $_.OwningProcess -and $_.State -eq 'Listen' } | Select-Object LocalAddress, LocalPort, OwningProcess
