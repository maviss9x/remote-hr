@echo off
echo ===================================================
echo   REMOTE HR - PRODUCTION BUILD SCRIPT FOR WINDOWS
echo ===================================================
echo.

if not exist .env (
    echo [ERROR] Khong tim thay file .env!
    echo Vui long copy file .env.example thanh .env va cau hinh DATABASE_URL truoc.
    pause
    exit /b 1
)

echo [1/4] Dang cai dat dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Loi cai dat dependencies.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/4] Dang sinh Prisma Client...
call npm run prisma:generate
if %errorlevel% neq 0 (
    echo [ERROR] Loi sinh Prisma Client.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/4] Dang dong bo cau truc bang vao SQL Server...
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ERROR] Loi dong bo SQL Server. Kiem tra lai DATABASE_URL trong .env.
    pause
    exit /b %errorlevel%
)

echo.
echo [4/4] Dang build Next.js Production...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Loi build Next.js.
    pause
    exit /b %errorlevel%
)

echo.
echo ===================================================
echo   BUILD HOAN TAT THANH CONG!
echo   Khoi chay he thong bang lenh: npm run start
echo   Hoac khoi dong bang PM2 tren IIS.
echo ===================================================
pause
