// Script para debugar a API em produção
const https = require('https');

// Função para fazer requisição de teste
function testAPI(endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'agridom-dashboard.vercel.app',
      port: 443,
      path: endpoint,
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Debug-Script/1.0'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Testes
async function runTests() {
  console.log('🔍 Testando API em produção...');
  
  try {
    // Teste 1: Verificar variáveis de ambiente
    console.log('\n1. Testando variáveis de ambiente...');
    const envTest = await testAPI('/api/test-env');
    console.log('Status:', envTest.status);
    console.log('Response:', envTest.data);
    
    // Teste 2: Teste simples de login
    console.log('\n2. Testando rota de teste...');
    const testLogin = await testAPI('/api/test-login', { test: 'data' });
    console.log('Status:', testLogin.status);
    console.log('Response:', testLogin.data);
    
    // Teste 3: Login real
    console.log('\n3. Testando login real...');
    const loginTest = await testAPI('/api/auth/login', {
      email: 'agenciakaizendesign@gmail.com',
      password: '123456'
    });
    console.log('Status:', loginTest.status);
    console.log('Response:', loginTest.data);
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

runTests();