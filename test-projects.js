const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI2LCJlbWFpbCI6ImFnZW5jaWFrYWl6ZW5kZXNpZ25AZ21haWwuY29tIiwiZXhwIjoxNzU3NDc0NjczLCJpYXQiOjE3NTczODgyNzN9.XOEgpgBkx1DZFs-ZBZfJfz8LAFRUq6hgj4Zc_QppjoI';

const options = {
  hostname: 'agridom-dashboard.vercel.app',
  port: 443,
  path: '/api/projects',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log('\nProjetos encontrados:', parsed.data ? parsed.data.length : 0);
      if (parsed.data && parsed.data.length > 0) {
        console.log('Primeiro projeto:', JSON.stringify(parsed.data[0], null, 2));
      }
    } catch (e) {
      console.log('Erro ao fazer parse da resposta');
    }
  });
});

req.on('error', (error) => {
  console.error('Erro:', error);
});

req.end();