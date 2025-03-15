// test-api.js
const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testEndpoints() {
  try {
    // Test system health endpoint
    console.log('Testing /api/system/health endpoint...');
    const healthResponse = await makeRequest('/api/system/health');
    console.log(`Status code: ${healthResponse.statusCode}`);
    console.log(JSON.stringify(healthResponse.data, null, 2));
    console.log('-'.repeat(50));

    // Test agents list endpoint
    console.log('Testing /api/agents endpoint...');
    const agentsResponse = await makeRequest('/api/agents');
    console.log(`Status code: ${agentsResponse.statusCode}`);
    console.log(JSON.stringify(agentsResponse.data, null, 2));
    console.log('-'.repeat(50));

    // Test content endpoint
    console.log('Testing /api/content endpoint...');
    const contentResponse = await makeRequest('/api/content');
    console.log(`Status code: ${contentResponse.statusCode}`);
    console.log(JSON.stringify(contentResponse.data, null, 2));
    console.log('-'.repeat(50));

  } catch (error) {
    console.error('Error testing API endpoints:', error);
  }
}

testEndpoints();