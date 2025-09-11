const http = require('http');

// Simular um token JWT válido (mesmo formato usado anteriormente)
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOSwiaWF0IjoxNjk5OTk5OTk5fQ.test';

function testDashboardStats() {
  const postData = JSON.stringify({
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/dashboard/stats',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mockToken}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      
      try {
        const response = JSON.parse(data);
        if (response.success && response.data) {
          console.log('\n=== VALORES DOS CARDS ===');
          console.log('Faturamento:', response.data.faturamento);
          console.log('A Receber:', response.data.aReceber);
          console.log('Despesas:', response.data.despesas, '(deve ser 2184.9)');
          console.log('Lucro:', response.data.lucro);
          
          if (response.data.despesas === 2184.9) {
            console.log('\n✅ SUCESSO: Despesas agora usa valor_mensal corretamente!');
          } else {
            console.log('\n❌ ERRO: Despesas ainda não está usando valor_mensal');
          }
        }
      } catch (e) {
        console.error('Erro ao parsear JSON:', e.message);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Erro na requisição:', e.message);
  });

  req.write(postData);
  req.end();
}

console.log('🧪 Testando endpoint /api/dashboard/stats com valor_mensal...');
testDashboardStats();