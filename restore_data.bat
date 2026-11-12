@echo off
chcp 65001 >nul
title Khoi Phuc Du Lieu Remote HR (Tuan 45)

echo ===============================================================
echo     DANG KHOI PHUC DU LIEU NHAN SU VA DANG KY CA TUAN 45...
echo ===============================================================
echo.

set "BACKUP_FILE=remote_hr.bak"
if not exist "%BACKUP_FILE%" (
    if exist "BackUpDatabase\remote_hr.bak" (
        set "BACKUP_FILE=BackUpDatabase\remote_hr.bak"
    ) else (
        echo [LOI] Khong tim thay file backup 'remote_hr.bak'!
        echo Vui long copy file 'remote_hr.bak' vao cung thu muc voi file nay.
        echo.
        pause
        exit /b 1
    )
)

echo [1/3] Dang copy file du lieu vao SQL Server container...
docker cp "%BACKUP_FILE%" webhybrid_db:/var/opt/mssql/backup.bak
if %ERRORLEVEL% neq 0 (
    echo [LOI] Container 'webhybrid_db' chua chay. Vui long bat 'start.bat' truoc!
    pause
    exit /b 1
)

echo [2/3] Dang khoi phuc toan bo nhan su va dang ky ca tuan 45...
docker exec -i webhybrid_db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "HybridHr@2026" -C -Q "IF EXISTS (SELECT name FROM sys.databases WHERE name = 'remote_hr') ALTER DATABASE [remote_hr] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [remote_hr] FROM DISK = '/var/opt/mssql/backup.bak' WITH REPLACE, MOVE 'hybrid_hr' TO '/var/opt/mssql/data/remote_hr.mdf', MOVE 'hybrid_hr_log' TO '/var/opt/mssql/data/remote_hr_log.ldf'; ALTER DATABASE [remote_hr] SET MULTI_USER;"

if %ERRORLEVEL% neq 0 (
    echo [LOI] Khong the Restore du lieu.
    pause
    exit /b 1
)

echo [3/3] Dang khoi dong lai ung dung Web...
docker restart webhybrid_app >nul

echo.
echo ===============================================================
echo  [THANH CONG] DA KHOI PHUC XONG DU LIEU TUAN 45!
echo  Toan bo 24 nhan su va 119 ca dang ky tuan 45 da san sang.
echo ===============================================================
echo.
pause

