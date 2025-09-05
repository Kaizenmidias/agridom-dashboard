// Script para gerar hashes das senhas
const crypto = require('crypto');

// Função simples para gerar hash (não é bcrypt, mas funciona para teste)
function simpleHash(password) {
  return crypto.createHash('sha256').update(password + 'agridom_salt').digest('hex');
}

const lucasHash = simpleHash('Agridom@2024');
const ricardoHash = simpleHash('Agridom@2024');

console.log('Lucas hash:', lucasHash);
console.log('Ricardo hash:', ricardoHash);

// SQL com os hashes corretos
console.log('\n-- SQL para inserir usuários:');
console.log(`INSERT INTO users (name, email, password, is_active) VALUES`);
console.log(`('Lucas', 'lucas@agridom.com.br', '${lucasHash}', true),`);
console.log(`('Ricardo', 'ricardo@agridom.com.br', '${ricardoHash}', true)`);
console.log(`ON CONFLICT (email) DO NOTHING;`);