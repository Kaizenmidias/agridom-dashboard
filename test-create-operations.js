const https = require('https');

// Função para fazer requisições HTTPS
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testCreateOperations() {
  console.log('🧪 Testando Operações de Criação na API de Produção...');
  
  try {
    // 1. Login para obter token
    console.log('\n1️⃣ Fazendo login...');
    const loginOptions = {
      hostname: 'agridom-dashboard.vercel.app',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const loginData = {
      email: 'admin@agridom.com',
      password: 'admin123'
    };
    
    const loginResult = await makeRequest(loginOptions, loginData);
    console.log('Status do login:', loginResult.status);
    
    if (loginResult.status !== 200) {
      console.log('❌ Erro no login:', loginResult.data);
      return;
    }
    
    const token = loginResult.data.token;
    console.log('✅ Login bem-sucedido!');
    
    // 2. Testar criação de projeto
    console.log('\n2️⃣ Testando criação de projeto...');
    const projectOptions = {
      hostname: 'agridom-dashboard.vercel.app',
      port: 443,
      path: '/api/projects',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    
    const projectData = {
      name: 'Projeto Teste API',
      client: 'Cliente Teste',
      project_type: 'website',
      status: 'active',
      description: 'Projeto criado via teste da API',
      project_value: 5000,
      paid_value: 0,
      delivery_date: '2025-12-31'
    };
    
    const projectResult = await makeRequest(projectOptions, projectData);
    console.log('Status criação projeto:', projectResult.status);
    console.log('Resposta:', JSON.stringify(projectResult.data, null, 2));
    
    // 3. Testar criação de despesa
    console.log('\n3️⃣ Testando criação de despesa...');
    const expenseOptions = {
      hostname: 'agridom-dashboard.vercel.app',
      port: 443,
      path: '/api/expenses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    
    const expenseData = {
      description: 'Despesa Teste API',
      amount: 100.50,
      category: 'office',
      date: '2025-01-15',
      is_recurring: false
    };
    
    const expenseResult = await makeRequest(expenseOptions, expenseData);
    console.log('Status criação despesa:', expenseResult.status);
    console.log('Resposta:', JSON.stringify(expenseResult.data, null, 2));
    
    // 4. Testar criação de código
    console.log('\n4️⃣ Testando criação de código...');
    const codeOptions = {
      hostname: 'agridom-dashboard.vercel.app',
      port: 443,
      path: '/api/codes',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    
    const codeData = {
      title: 'Código Teste API',
      description: 'Código criado via teste da API',
      code: 'console.log("Hello World");',
      language: 'javascript',
      category: 'frontend'
    };
    
    const codeResult = await makeRequest(codeOptions, codeData);
    console.log('Status criação código:', codeResult.status);
    console.log('Resposta:', JSON.stringify(codeResult.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
  }
}

testCreateOperations();