Get-WmiObject Win32_Service | Where-Object { $_.Name -like "*MSSQL*" } | Select-Object Name, ProcessId, State, Status
