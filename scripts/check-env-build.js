// Script para verificar se as variáveis de ambiente estão sendo injetadas no build
// Execute: node scripts/check-env-build.js

console.log('🔍 VERIFICANDO VARIÁVEIS DE AMBIENTE NO BUILD');
console.log('===============================================');

// Simular o que o Vite faz durante o build
const fs = require('fs');
const path = require('path');

// 1. Verificar arquivos .env
console.log('\n1. VERIFICANDO ARQUIVOS .ENV:');
const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];

envFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} existe`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.includes('VITE_SUPABASE'));
    lines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        console.log(`   ${key}=${value ? value.substring(0, 20) + '...' : 'VAZIO'}`);
      }
    });
  } else {
    console.log(`❌ ${file} não existe`);
  }
});

// 2. Verificar process.env
console.log('\n2. VERIFICANDO PROCESS.ENV:');
const viteVars = Object.keys(process.env).filter(key => key.startsWith('VITE_'));
if (viteVars.length > 0) {
  viteVars.forEach(key => {
    const value = process.env[key];
    console.log(`✅ ${key}=${value ? value.substring(0, 20) + '...' : 'VAZIO'}`);
  });
} else {
  console.log('❌ Nenhuma variável VITE_ encontrada em process.env');
}

// 3. Simular o que seria injetado no código
console.log('\n3. SIMULANDO INJEÇÃO NO CÓDIGO:');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('VITE_SUPABASE_URL:', supabaseUrl || 'UNDEFINED');
console.log('VITE_SUPABASE_ANON_KEY:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'UNDEFINED');

// 4. Verificar se as variáveis são válidas
console.log('\n4. VALIDANDO VARIÁVEIS:');
if (!supabaseUrl) {
  console.log('❌ VITE_SUPABASE_URL não definida');
} else if (!supabaseUrl.startsWith('https://')) {
  console.log('❌ VITE_SUPABASE_URL inválida (deve começar com https://)');
} else {
  console.log('✅ VITE_SUPABASE_URL válida');
}

if (!supabaseKey) {
  console.log('❌ VITE_SUPABASE_ANON_KEY não definida');
} else if (supabaseKey.length < 100) {
  console.log('❌ VITE_SUPABASE_ANON_KEY muito curta (provavelmente inválida)');
} else {
  console.log('✅ VITE_SUPABASE_ANON_KEY válida');
}

// 5. Instruções para Vercel
console.log('\n5. CONFIGURAÇÃO NA VERCEL:');
console.log('Para corrigir o problema, configure as variáveis na Vercel:');
console.log('1. Acesse: https://vercel.com/dashboard');
console.log('2. Vá para o projeto agridom-dashboard');
console.log('3. Settings > Environment Variables');
console.log('4. Adicione:');
console.log('   VITE_SUPABASE_URL = https://qwbpruywwfjadkudegcj.supabase.co');
console.log('   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
console.log('5. Redeploy o projeto');

console.log('\n===============================================');
console.log('✅ VERIFICAÇÃO CONCLUÍDA');