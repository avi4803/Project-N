const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDbBcAQvMP2k0PaIFw81bzm9Pi5t_1E1jc';
const genAI = new GoogleGenerativeAI(API_KEY);

// ✅ Function to list all available Gemini models
async function listModels() {
  try {
    console.log('📋 Fetching available Gemini models...\n');
    
    // Correct endpoint with API key as query parameter
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );

    console.log('✅ Available Models:\n');
    
    if (response.data.models && response.data.models.length > 0) {
      response.data.models.forEach((model) => {
        const supportsGeneration = model.supportedGenerationMethods?.includes('generateContent');
        const supportsVision = model.name.includes('vision') || model.name.includes('1.5');
        
        console.log(`📦 ${model.name}`);
        console.log(`   Display Name: ${model.displayName || 'N/A'}`);
        console.log(`   Description: ${model.description || 'N/A'}`);
        console.log(`   Supports generateContent: ${supportsGeneration ? '✅' : '❌'}`);
        console.log(`   Vision capable: ${supportsVision ? '✅' : '❌'}`);
        console.log(`   Supported methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️ No models found');
    }
    
    return response.data.models;
  } catch (err) {
    console.error('❌ Failed to list models:', err.response?.data || err.message);
  }
}

// ✅ Function to test a specific Gemini model
async function testGeminiAPI(modelName = 'gemini-1.5-flash') {
  try {
    console.log(`\n🧪 Testing model: ${modelName}...\n`);
    
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Hello, are you working? Reply with "Yes, I am working!"');
    
    console.log(`✅ Model ${modelName} is working!`);
    console.log('Response:', result.response.text());
    console.log('');
    
    return true;
  } catch (error) {
    console.error(`❌ Model ${modelName} test failed:`, error.message);
    console.log('');
    return false;
  }
}

// ✅ Function to test vision model with image
async function testVisionModel(modelName = 'gemini-1.5-flash') {
  try {
    console.log(`\n🖼️ Testing vision model: ${modelName}...\n`);
    
    // Use direct REST API for vision test
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    // Simple test with a base64 encoded 1x1 red pixel PNG
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    const requestBody = {
      contents: [
        {
          parts: [
            { text: 'What do you see in this image?' },
            {
              inline_data: {
                mime_type: 'image/png',
                data: testImageBase64
              }
            }
          ]
        }
      ]
    };

    const response = await axios.post(apiUrl, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log(`✅ Vision model ${modelName} is working!`);
      console.log('Response:', response.data.candidates[0].content.parts[0].text);
      console.log('');
      return true;
    } else {
      console.log(`⚠️ Vision model ${modelName} returned unexpected format`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Vision model ${modelName} test failed:`, error.response?.data?.error?.message || error.message);
    console.log('');
    return false;
  }
}

// Run comprehensive tests
(async () => {
  console.log('='.repeat(60));
  console.log('🚀 GEMINI API COMPREHENSIVE TEST');
  console.log('='.repeat(60));
  console.log('');
  
  // Step 1: List all available models
  const models = await listModels();
  
  console.log('='.repeat(60));
  console.log('');
  
  // Step 2: Test common models
  const modelsToTest = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-pro-vision'
  ];
  
  console.log('📝 Testing text generation models...\n');
  
  for (const modelName of modelsToTest) {
    await testGeminiAPI(modelName);
  }
  
  console.log('='.repeat(60));
  console.log('');
  
  // Step 3: Test vision models
  const visionModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro-vision'
  ];
  
  console.log('🖼️ Testing vision models...\n');
  
  for (const modelName of visionModels) {
    await testVisionModel(modelName);
  }
  
  console.log('='.repeat(60));
  console.log('✅ TESTS COMPLETED');
  console.log('='.repeat(60));
})();