const https = require('https');

const data = JSON.stringify({
  email: 'agenciakaizendesign@gmail.com',
  password: '123456'
});

const options = {
  hostname: 'agridom-dashboard.vercel.app',
  port: 443,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
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
      if (parsed.success && parsed.token) {
        console.log('\nToken obtido:', parsed.token);
      }
    } catch (e) {
      console.log('Erro ao fazer parse da resposta');
    }
  });
});

req.on('error', (error) => {
  console.error('Erro:', error);
});

req.write(data);
req.end();