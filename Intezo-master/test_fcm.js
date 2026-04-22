// Test FCM token endpoint
const axios = require('axios');

async function testFCMEndpoint() {
  try {
    console.log('Testing direct FCM token update...');
    
    // Test the direct test endpoint first
    const testResponse = await axios.post('https://api.intezo.online/api/test/fcm-token', {
      patientId: '68bb1dfa4654c0bfb6b7468b',
      fcmToken: 'test_fcm_token_123456789'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Direct FCM test successful:', testResponse.data);
    
    // Now test the authenticated endpoint
    console.log('\nTesting authenticated FCM endpoint...');
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YmIxZGZhNDY1NGMwYmZiNmI3NDY4YiIsInJvbGUiOiJwYXRpZW50IiwiaWF0IjoxNzU3MDk1OTU5LCJleHAiOjE3NTc3MDA3NTl9.AH-DRVz4omO-kGrHPtr3dYxFKZbZ3E0Xobz1TgTB4fE';
    
    const response = await axios.put('https://api.intezo.online/api/patients/fcm-token', {
      fcmToken: 'test_fcm_token_authenticated_123456789'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Authenticated FCM endpoint test successful:', response.data);
  } catch (error) {
    console.log('❌ FCM endpoint test failed:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
    console.log('URL:', error.config?.url);
  }
}

testFCMEndpoint();