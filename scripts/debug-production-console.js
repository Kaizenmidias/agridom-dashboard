// Script para executar no console do navegador em PRODUÇÃO
// Abra DevTools (F12) > Console e cole este código

console.log('🚀 INICIANDO DEBUG DE PRODUÇÃO');
console.log('==========================================');

// 1. Verificar se estamos em produção
console.log('\n1. VERIFICANDO AMBIENTE:');
console.log('URL atual:', window.location.href);
console.log('Host:', window.location.host);
console.log('Protocol:', window.location.protocol);

// 2. Tentar acessar as variáveis de ambiente
console.log('\n2. VERIFICANDO VARIÁVEIS DE AMBIENTE:');
try {
  // Estas variáveis só existem durante o build, não em runtime
  console.log('⚠️ IMPORTANTE: import.meta.env só existe durante o build!');
  console.log('Em produção, as variáveis são "baked in" no código compilado.');
} catch (e) {
  console.log('❌ import.meta.env não disponível em runtime:', e.message);
}

// 3. Verificar se o cliente Supabase foi inicializado
console.log('\n3. VERIFICANDO CLIENTE SUPABASE:');
try {
  // Tentar acessar o módulo Supabase
  const supabaseModule = await import('/assets/index-DwkcV7sV.js');
  console.log('✅ Módulo principal carregado');
} catch (e) {
  console.log('❌ Erro ao carregar módulo:', e.message);
  
  // Tentar método alternativo
  try {
    // Verificar se há alguma referência global ao Supabase
    console.log('🔍 Procurando referências globais...');
    console.log('window.supabase:', window.supabase);
    console.log('window.__SUPABASE__:', window.__SUPABASE__);
    
    // Verificar se há logs do Supabase no console
    console.log('\n4. VERIFICANDO LOGS ANTERIORES:');
    console.log('Procure nos logs acima por mensagens que começam com:');
    console.log('- 🚀 MAIN.TSX');
    console.log('- 🔍 SUPABASE.TS');
    console.log('- 🔍 CRUD.TS');
    console.log('- 🔍 SUPABASE-CLIENT');
    
  } catch (e2) {
    console.log('❌ Erro no método alternativo:', e2.message);
  }
}

// 4. Verificar Network tab
console.log('\n5. VERIFICANDO NETWORK:');
console.log('Abra DevTools > Network e filtre por:');
console.log('- "supabase" para ver chamadas para o Supabase');
console.log('- "qwbpruywwfjadkudegcj" para ver chamadas específicas');
console.log('- "rest/v1" para ver chamadas da API REST');

// 5. Tentar fazer uma chamada manual
console.log('\n6. TESTE MANUAL DE CHAMADA:');
console.log('Se você não vir chamadas para o Supabase, tente:');
console.log('1. Navegar para uma página (ex: /projects)');
console.log('2. Recarregar a página');
console.log('3. Verificar se aparecem logs de debug');

// 6. Verificar se há erros JavaScript
console.log('\n7. VERIFICANDO ERROS:');
console.log('Verifique se há erros JavaScript na aba Console');
console.log('Erros comuns:');
console.log('- "Cannot read property of undefined"');
console.log('- "Module not found"');
console.log('- "Failed to fetch"');

console.log('\n==========================================');
console.log('✅ DEBUG CONCLUÍDO');
console.log('Analise os logs acima e na aba Network para identificar o problema.');

// 7. Função helper para monitorar chamadas
window.monitorSupabase = function() {
  console.log('🔍 Iniciando monitoramento de chamadas...');
  
  // Override do fetch para capturar chamadas
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('supabase')) {
      console.log('📡 CHAMADA SUPABASE DETECTADA:', url);
      console.log('📊 Argumentos:', args);
    }
    return originalFetch.apply(this, args);
  };
  
  console.log('✅ Monitoramento ativo. Navegue pela aplicação para ver chamadas.');
};

console.log('\n💡 DICA: Execute window.monitorSupabase() para monitorar chamadas em tempo real.');