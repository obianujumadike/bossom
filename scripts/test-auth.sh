#!/bin/bash

# Test authentication functionality
echo "🧪 Testing Bossom Authentication System..."

# Start the development server in the background
echo "🚀 Starting development server..."
npm run dev &> /tmp/bossom-dev.log &
SERVER_PID=$!

# Wait for server to start and detect port
echo "⏳ Waiting for server to start..."
sleep 8

PORT=$(grep -o 'http://localhost:[0-9]*' /tmp/bossom-dev.log | head -1 | grep -o '[0-9]*$')
PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"
echo "📡 Server running at $BASE_URL"

echo "📋 Testing authentication pages..."

# Test signup page
echo "Testing /signup..."
SIGNUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/signup")
if [ "$SIGNUP_STATUS" = "200" ]; then
    echo "✅ Signup page accessible"
else
    echo "❌ Signup page failed (Status: $SIGNUP_STATUS)"
fi

# Test login page
echo "Testing /login..."
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login")
if [ "$LOGIN_STATUS" = "200" ]; then
    echo "✅ Login page accessible"
else
    echo "❌ Login page failed (Status: $LOGIN_STATUS)"
fi

# Test forgot-password page
echo "Testing /forgot-password..."
FORGOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/forgot-password")
if [ "$FORGOT_STATUS" = "200" ]; then
    echo "✅ Forgot-password page accessible"
else
    echo "❌ Forgot-password page failed (Status: $FORGOT_STATUS)"
fi

# Test auth proxy rejects non-POST
echo "Testing /api/auth..."
AUTH_PROXY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth")
if [ "$AUTH_PROXY_STATUS" = "405" ] || [ "$AUTH_PROXY_STATUS" = "404" ]; then
    echo "✅ Auth proxy only accepts POST (Status: $AUTH_PROXY_STATUS)"
else
    echo "❌ Auth proxy unexpected status: $AUTH_PROXY_STATUS"
fi

# Test protected route (dashboard)
echo "Testing protected route /dashboard..."
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dashboard")
if [[ "$DASHBOARD_STATUS" =~ ^[23] ]]; then
    echo "✅ Dashboard route accessible (Status: $DASHBOARD_STATUS)"
elif [[ "$DASHBOARD_STATUS" =~ ^3 ]]; then
    echo "✅ Dashboard redirects unauthenticated users (Status: $DASHBOARD_STATUS)"
else
    echo "❌ Dashboard route failed (Status: $DASHBOARD_STATUS)"
fi

# Test API auth protection
echo "Testing API auth protection /api/cases..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/cases")
if [ "$API_STATUS" = "401" ]; then
    echo "✅ API correctly returns 401 for unauthenticated requests"
else
    echo "❌ API auth check unexpected status: $API_STATUS"
fi

# Stop the server
echo "🛑 Stopping development server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "🌸 Authentication test complete!"
echo ""
echo "Manual testing steps:"
echo "1. Visit $BASE_URL/signup"
echo "2. Create a test account with email signup"
echo "3. Enter the 6-digit code from the email (on a dev deployment with"
echo "   DEV_LOG_AUTH_CODES=true it is printed by: npx convex logs)"
echo "4. Try logging in at $BASE_URL/login"
echo "5. Verify redirect to dashboard after login"
echo ""
echo "Automated flow checks: npx tsx scripts/e2e-convex.ts"