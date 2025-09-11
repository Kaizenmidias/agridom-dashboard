require('dotenv').config({ path: '.env.production' });
const http = require('http');

function testDashboardAPI() {
  console.log('🧪 Testando API do Dashboard...');
  
  // Simular um token JWT válido
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MDdmZDIyOC05YTBjLTRmYjUtYWE4Ny03ZWE3OGU2MDdlNGEiLCJlbWFpbCI6ImFnZW5jaWFrYWl6ZW5kZXNpZ25AZ21haWwuY29tIiwiaWF0IjoxNzM2NTU5NjAwfQ.example';
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/dashboard/stats?startDate=2025-09-01&endDate=2025-09-30',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        
        console.log('📊 Resposta da API:', {
          status: res.statusCode,
          data: jsonData
        });
        
        if (jsonData.despesas !== undefined) {
          console.log('✅ Campo despesas encontrado:', jsonData.despesas);
        } else {
          console.log('❌ Campo despesas não encontrado na resposta');
        }
      } catch (error) {
        console.error('❌ Erro ao parsear JSON:', error.message);
        console.log('📄 Resposta bruta:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Erro na requisição:', error.message);
  });
  
  req.end();
}

testDashboardAPI();