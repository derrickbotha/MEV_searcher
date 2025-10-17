@echo off
echo Checking Visual Studio C++ Build Tools Installation...
echo.

REM Check if cl.exe exists
where cl.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: cl.exe not found in PATH
    echo Please ensure Visual Studio C++ build tools are properly installed
    goto :error
) else (
    echo ✓ MSVC compiler (cl.exe) found
)

REM Check if cmake is available
where cmake >nul 2>nul
if %errorlevel% neq 0 (
    echo WARNING: cmake not found - you may need to install it separately
) else (
    echo ✓ CMake found
)

REM Check if node-gyp can find VS
echo Testing node-gyp Visual Studio detection...
call npx node-gyp list
if %errorlevel% neq 0 (
    echo ERROR: node-gyp cannot find Visual Studio
    echo Please check your Visual Studio installation
    goto :error
)

echo.
echo ✓ Visual Studio C++ build tools appear to be properly installed!
echo You can now try: npm run build:cpp:release
echo.
goto :end

:error
echo.
echo Installation check failed. Please verify your Visual Studio installation.
pause
exit /b 1

:end
pause