// 🔍 Login Diagnostic Script
// Copy and paste this entire script into your browser console on the Vercel app

console.log('🔍 Starting Login Diagnostics...\n');

// Test 1: Check Environment Variables
console.log('📋 Test 1: Environment Variables');
console.log('================================');
const apiUrl = import.meta.env.VITE_API_URL || 'NOT SET';
const wsUrl = import.meta.env.VITE_WS_URL || 'NOT SET';
console.log('VITE_API_URL:', apiUrl);
console.log('VITE_WS_URL:', wsUrl);
console.log('');

// Test 2: Check Backend Health
console.log('📋 Test 2: Backend Health Check');
console.log('================================');
const backendUrl = apiUrl.replace('/api/v1', '');
console.log('Testing:', backendUrl + '/health');

fetch(backendUrl + '/health')
  .then(response => {
    console.log('Status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('✅ Backend is UP:', data);
    console.log('');
    
    // Test 3: Test Login Endpoint
    console.log('📋 Test 3: Login Endpoint Test');
    console.log('================================');
    console.log('Testing:', apiUrl + '/auth/login');
    console.log('⚠️  This will fail with 422 (expected - no credentials)');
    
    return fetch(apiUrl + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' })
    });
  })
  .then(response => {
    console.log('Status:', response.status);
    if (response.status === 401) {
      console.log('✅ Login endpoint is working (401 = wrong credentials)');
    } else if (response.status === 422) {
      console.log('✅ Login endpoint is working (422 = validation error)');
    } else {
      console.log('⚠️  Unexpected status code');
    }
    return response.text();
  })
  .then(text => {
    console.log('Response:', text);
    console.log('');
    console.log('📊 DIAGNOSIS COMPLETE');
    console.log('====================');
    console.log('If you see ✅ marks above, your setup is correct!');
    console.log('If login still fails, check:');
    console.log('1. Are you using correct credentials?');
    console.log('2. Does the user exist in database?');
    console.log('3. Check Network tab for actual error');
  })
  .catch(error => {
    console.error('❌ ERROR:', error);
    console.log('');
    console.log('🔧 POSSIBLE FIXES:');
    console.log('==================');
    
    if (error.message.includes('CORS')) {
      console.log('❌ CORS Error Detected');
      console.log('Fix: Update CORS_ORIGINS in Render backend');
      console.log('Add: https://secure-messaging-app-omega.vercel.app');
    } else if (error.message.includes('Failed to fetch')) {
      console.log('❌ Network Error');
      console.log('Possible causes:');
      console.log('1. Backend is down');
      console.log('2. Backend is sleeping (wait 60 seconds)');
      console.log('3. Wrong backend URL');
    } else {
      console.log('❌ Unknown Error');
      console.log('Check browser console for more details');
    }
  });
