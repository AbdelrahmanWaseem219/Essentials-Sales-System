@echo off
REM ===== Optional: public tunnel so Shopify/Bosta webhooks reach your PC =====
REM Only needed if you want NEW Shopify orders to auto-sync while running locally.
REM The free ngrok URL changes each time — when it does, update the webhook URLs
REM in Shopify (Settings -> Notifications) and Bosta to the new https URL shown below.
echo Starting public tunnel to the API (port 4000)...
echo After it opens, copy the https://...ngrok-free.dev URL.
"%LOCALAPPDATA%\Microsoft\WinGet\Links\ngrok.exe" http 4000
pause
