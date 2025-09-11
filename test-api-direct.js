// Teste direto da API para verificar os cálculos

const axios = require('axios');

async function testAPI() {
  try {
    console.log('🔍 Testando API diretamente...');
    
    // Teste 1: Janeiro 2025
    console.log('\n📅 Testando Janeiro 2025:');
    const response1 = await axios.get('http://localhost:3001/api/dashboard/stats?period=monthly&year=2025&month=1');
    console.log(`Resposta: ${JSON.stringify(response1.data, null, 2)}`);
    
    // Teste 2: Fevereiro 2025
    console.log('\n📅 Testando Fevereiro 2025:');
    const response2 = await axios.get('http://localhost:3001/api/dashboard/stats?period=monthly&year=2025&month=2');
    console.log(`Resposta: ${JSON.stringify(response2.data, null, 2)}`);
    
    // Teste 3: Anual 2025
    console.log('\n📅 Testando Anual 2025:');
    const response3 = await axios.get('http://localhost:3001/api/dashboard/stats?period=annual&year=2025');
    console.log(`Resposta: ${JSON.stringify(response3.data, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAPI();