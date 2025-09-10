// Script para testar a API de produção
const https = require('https');

// Função para fazer requisições HTTP
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

async function testProductionAPI() {
  console.log('🧪 Testando API de Produção...');
  
  try {
    // 1. Teste de Login
    console.log('\n1️⃣ Testando login...');
    const loginOptions = {
      hostname: 'agridom-dashboard.vercel.app',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const loginData = JSON.stringify({
      email: 'admin@agridom.com',
      password: 'admin123'
    });
    
    const loginResponse = await makeRequest(loginOptions, loginData);
    console.log('Status do login:', loginResponse.status);
    
    if (loginResponse.status === 200 && loginResponse.data.success) {
      console.log('✅ Login bem-sucedido!');
      console.log('Token:', loginResponse.data.token.substring(0, 50) + '...');
      
      // 2. Teste de busca de projetos
      console.log('\n2️⃣ Testando busca de projetos...');
      const projectsOptions = {
        hostname: 'agridom-dashboard.vercel.app',
        port: 443,
        path: '/api/projects',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`,
          'Content-Type': 'application/json'
        }
      };
      
      const projectsResponse = await makeRequest(projectsOptions);
      console.log('Status dos projetos:', projectsResponse.status);
      
      if (projectsResponse.status === 200) {
        console.log('✅ Projetos carregados com sucesso!');
        console.log('Número de projetos:', projectsResponse.data.data ? projectsResponse.data.data.length : 'Formato inesperado');
        console.log('Dados dos projetos:', JSON.stringify(projectsResponse.data, null, 2));
      } else {
        console.log('❌ Erro ao carregar projetos:', projectsResponse.data);
      }
    } else {
      console.log('❌ Erro no login:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('🚨 Erro no teste:', error);
  }
}

// Executar o teste
testProductionAPI();