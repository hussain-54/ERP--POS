@echo off
setlocal
cd /d "%~dp0.."
echo === START %DATE% %TIME% > verify2.log
call node scripts\link-workspaces.cjs >> verify2.log 2>&1
call npm.cmd run build >> verify2.log 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> verify2.log
call npm.cmd run test:foundation >> verify2.log 2>&1
echo TEST_EXIT=%ERRORLEVEL% >> verify2.log
call npm.cmd run typecheck >> verify2.log 2>&1
echo TYPECHECK_EXIT=%ERRORLEVEL% >> verify2.log
echo === END %DATE% %TIME% >> verify2.log
endlocal
