@echo off
setlocal
cd /d "%~dp0.."
echo === START %DATE% %TIME% > verify.log
echo CWD=%CD% >> verify.log

if exist node_modules (
  echo Removing node_modules... >> verify.log
  rmdir /s /q node_modules >> verify.log 2>&1
)

echo Running npm install... >> verify.log
call npm.cmd install --no-audit --no-fund >> verify.log 2>&1
echo NPM_INSTALL_EXIT=%ERRORLEVEL% >> verify.log
if errorlevel 1 goto :done

echo Linking workspace packages via junctions... >> verify.log
call node scripts\link-workspaces.cjs >> verify.log 2>&1
echo LINK_EXIT=%ERRORLEVEL% >> verify.log

echo Building packages/apps... >> verify.log
call npm.cmd run build >> verify.log 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> verify.log

echo Running foundation tests... >> verify.log
call npm.cmd run test:foundation >> verify.log 2>&1
echo TEST_EXIT=%ERRORLEVEL% >> verify.log

echo Running typecheck... >> verify.log
call npm.cmd run typecheck >> verify.log 2>&1
echo TYPECHECK_EXIT=%ERRORLEVEL% >> verify.log

:done
echo === END %DATE% %TIME% >> verify.log
endlocal
