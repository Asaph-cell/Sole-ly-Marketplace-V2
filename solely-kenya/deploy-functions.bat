@echo off
REM ================================================================
REM SOLELY KENYA - DEPLOYMENT SCRIPT
REM ================================================================
REM Run this script to deploy all Edge Functions to Supabase
REM Make sure Supabase CLI is installed and you're logged in
REM ================================================================

echo.
echo ================================================================
echo SOLELY KENYA - Edge Functions Deployment
echo ================================================================
echo.

REM Check if npx is installed
where npx >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npx not found!
    echo.
    echo Please install Node.js first.
    echo.
    pause
    exit /b 1
)

echo [INFO] npx found
echo.

REM Confirmation bypassed for automated deployment
echo Proceeding with deployment...
echo.
echo ================================================================
echo DEPLOYING EMAIL NOTIFICATION FUNCTIONS (10/20)
echo ================================================================
echo.

echo [1/12] Deploying notify-buyer-order-placed (no-verify-jwt, called by intasend-webhook)...
call npx supabase functions deploy notify-buyer-order-placed --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [2/12] Deploying notify-buyer-order-accepted (no-verify-jwt)...
call npx supabase functions deploy notify-buyer-order-accepted --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [3/12] Deploying notify-buyer-order-shipped (no-verify-jwt)...
call npx supabase functions deploy notify-buyer-order-shipped --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [4/12] Deploying notify-buyer-order-declined (no-verify-jwt)...
call npx supabase functions deploy notify-buyer-order-declined --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [5/12] Deploying notify-vendor-new-order (no-verify-jwt, called by intasend-webhook)...
call npx supabase functions deploy notify-vendor-new-order --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [6/12] Deploying notify-buyer-order-arrived (no-verify-jwt)...
call npx supabase functions deploy notify-buyer-order-arrived --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [7/12] Deploying notify-buyer-order-completed (no-verify-jwt)...
call npx supabase functions deploy notify-buyer-order-completed --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [8/12] Deploying notify-buyer-pickup-ready (no-verify-jwt)...
call npx supabase functions deploy notify-buyer-pickup-ready --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [9/12] Deploying notify-dispute-update (no-verify-jwt)...
call npx supabase functions deploy notify-dispute-update --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [10/12] Deploying notify-dispute-filed (no-verify-jwt)...
call npx supabase functions deploy notify-dispute-filed --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [11/12] Deploying notify-vendor-welcome (no-verify-jwt)...
call npx supabase functions deploy notify-vendor-welcome --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [12/12] Deploying notify-order-completed (no-verify-jwt)...
call npx supabase functions deploy notify-order-completed --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo.
echo ================================================================
echo DEPLOYING AUTO-MANAGEMENT FUNCTIONS (8/15)
echo ================================================================
echo.

echo [1/6] Deploying auto-cancel-stale-orders...
call npx supabase functions deploy auto-cancel-stale-orders
if %errorlevel% neq 0 goto :error

echo [2/6] Deploying auto-release-escrow...
call npx supabase functions deploy auto-release-escrow
if %errorlevel% neq 0 goto :error

echo [3/6] Deploying auto-refund-unshipped...
call npx supabase functions deploy auto-refund-unshipped
if %errorlevel% neq 0 goto :error

echo [4/6] Deploying generate-delivery-otp...
call npx supabase functions deploy generate-delivery-otp
if %errorlevel% neq 0 goto :error

echo [5/6] Deploying verify-delivery-otp...
call npx supabase functions deploy verify-delivery-otp
if %errorlevel% neq 0 goto :error

echo [6/6] Deploying send-announcement...
call npx supabase functions deploy send-announcement
if %errorlevel% neq 0 goto :error

echo.
echo ================================================================
echo DEPLOYING PAYMENT FUNCTIONS (15/15)
echo ================================================================
echo.

echo [1/5] Deploying intasend-webhook...
call npx supabase functions deploy intasend-webhook --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [2/5] Deploying vendor-withdraw...
call npx supabase functions deploy vendor-withdraw
if %errorlevel% neq 0 goto :error

echo [3/5] Deploying create-vendor-wallet (no-verify-jwt, internal only)...
call npx supabase functions deploy create-vendor-wallet --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [4/5] Deploying transfer-to-vendor-wallet (no-verify-jwt, internal only)...
call npx supabase functions deploy transfer-to-vendor-wallet --no-verify-jwt
if %errorlevel% neq 0 goto :error

echo [5/5] Deploying create-order...
call npx supabase functions deploy create-order
if %errorlevel% neq 0 goto :error

echo.
echo ================================================================
echo SUCCESS! All Edge Functions Deployed
echo ================================================================
echo.
echo Next steps:
echo 1. Set environment secrets (see setup-secrets.bat)
echo 2. Run cron job SQL in Supabase Dashboard
echo 3. Deploy frontend build
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] Deployment failed!
echo Please check the error message above and try again.
echo.
pause
exit /b 1
