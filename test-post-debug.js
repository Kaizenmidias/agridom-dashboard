const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_BASE = 'https://agridom-dashboard.vercel.app/api';

async function testPostOperations() {
  console.log('🔍 Testando operações POST com debug detalhado...');
  
  try {
    // 1. Login
    console.log('\n1️⃣ Fazendo login...');
    const loginResponse = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@agridom.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Status do login:', loginResponse.status);
    
    if (!loginData.success) {
      console.error('❌ Erro no login:', loginData);
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Login bem-sucedido! Token obtido.');
    
    // 2. Teste POST Despesa
    console.log('\n2️⃣ Testando POST despesa...');
    const expenseData = {
      description: 'Teste Despesa API',
      value: 250.50,
      category: 'teste',
      date: '2025-01-15',
      billing_type: 'mensal',
      notes: 'Despesa criada via teste POST'
    };
    
    console.log('📤 Enviando dados da despesa:', JSON.stringify(expenseData, null, 2));
    
    const expenseResponse = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(expenseData)
    });
    
    const expenseResult = await expenseResponse.json();
    console.log('Status criação despesa:', expenseResponse.status);
    console.log('Resposta completa:', JSON.stringify(expenseResult, null, 2));
    
    // 3. Teste POST Código
    console.log('\n3️⃣ Testando POST código...');
    const codeData = {
      title: 'Função de Teste',
      description: 'Código criado via teste POST',
      code: 'function teste() { return "Hello World"; }',
      language: 'javascript',
      category: 'teste'
    };
    
    console.log('📤 Enviando dados do código:', JSON.stringify(codeData, null, 2));
    
    const codeResponse = await fetch(`${API_BASE}/codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(codeData)
    });
    
    const codeResult = await codeResponse.json();
    console.log('Status criação código:', codeResponse.status);
    console.log('Resposta completa:', JSON.stringify(codeResult, null, 2));
    
    // 4. Verificar se os dados foram criados
    console.log('\n4️⃣ Verificando dados criados...');
    
    // Buscar despesas
    const getExpensesResponse = await fetch(`${API_BASE}/expenses`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const expensesData = await getExpensesResponse.json();
    console.log('Despesas encontradas:', expensesData.data?.length || 0);
    
    // Buscar códigos
    const getCodesResponse = await fetch(`${API_BASE}/codes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const codesData = await getCodesResponse.json();
    console.log('Códigos encontrados:', codesData.data?.length || 0);
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

testPostOperations();