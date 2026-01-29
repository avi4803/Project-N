require('dotenv').config();
const { Novu } = require('@novu/node');

console.log('--- Debug Environment ---');
const key = process.env.NOVU_API_KEY;
if (key) {
    console.log(`NOVU_API_KEY is loaded. Length: ${key.length}`);
    console.log(`First 4 chars: ${key.substring(0, 4)}`);
    console.log(`Last 4 chars: ${key.substring(key.length - 4)}`);
} else {
    console.log('❌ NOVU_API_KEY is undefined or empty');
}

async function testConnection() {
    try {
        console.log('\n--- Testing Novu Connection ---');
        const novu = new Novu(key);
        // Try to get notification groups or something simple to verify auth
        const result = await novu.notificationGroups.get();
        console.log('✅ Connection Successful! Retrieved notification groups.');
    } catch (error) {
        console.error('❌ Connection Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        }
    }
}

testConnection();
