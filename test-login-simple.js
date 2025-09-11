const http = require('http');

// Função para fazer requisição GET ao dashboard
function makeDashboardRequest(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/dashboard/stats?period=year',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
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

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

// Função para fazer requisição POST
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
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

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Função para testar login
async function testLogin() {
  console.log('🔍 Testando login com credenciais do banco...');
  
  // Credenciais baseadas no arquivo SQL
  const credentials = [
    { email: 'agenciakaizendesign@gmail.com', password: 'Beatriz@2908' },
    { email: 'ricardo@gmail.com', password: '@FDPfeioso90' },
    { email: 'ricardo@agridom.com.br', password: '123456' } // Fallback
  ];
  
  for (const cred of credentials) {
    try {
      console.log(`\n📧 Testando login: ${cred.email}`);
      const result = await makeRequest(cred);
      
      console.log(`📊 Status: ${result.status}`);
      
      if (result.status === 200 && result.data.token) {
        console.log('✅ LOGIN SUCESSO!');
        console.log('🔑 Token obtido:', result.data.token.substring(0, 50) + '...');
        console.log('👤 Usuário:', result.data.user?.name || result.data.user?.email);
        
        // Testar API do dashboard com o token
        await testDashboardAPI(result.data.token);
        return;
      } else {
        console.log('❌ LOGIN FALHOU:', result.data.error || result.data);
      }
    } catch (error) {
      console.log('❌ Erro na requisição:', error.message);
    }
  }
  
  console.log('\n❌ Nenhuma credencial funcionou!');
}

// Função para testar API do dashboard
async function testDashboardAPI(token) {
  console.log('\n📊 Testando API do dashboard...');
  
  try {
    const result = await makeDashboardRequest(token);
    
    console.log(`📊 Status Dashboard: ${result.status}`);
    
    if (result.status === 200) {
      console.log('✅ API Dashboard funcionando!');
      console.log('📈 Dados recebidos:', {
        revenue_by_month: result.data.revenue_by_month ? 'SIM' : 'NÃO',
        total_revenue: result.data.total_revenue || 'N/A',
        total_expenses: result.data.total_expenses || 'N/A'
      });
      
      if (result.data.revenue_by_month && result.data.revenue_by_month.length > 0) {
        console.log('📅 Exemplo de dados mensais:', result.data.revenue_by_month[0]);
      }
    } else {
      console.log('❌ API Dashboard falhou:', result.data.error || result.data);
    }
  } catch (error) {
    console.log('❌ Erro ao testar dashboard:', error.message);
  }
}

// Executar teste
testLogin();