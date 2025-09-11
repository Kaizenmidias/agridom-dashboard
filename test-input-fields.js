// Script para testar problemas nos campos de input
console.log('🔍 DIAGNÓSTICO DOS CAMPOS DE INPUT');
console.log('=====================================');

// Aguardar o DOM carregar
setTimeout(() => {
  console.log('\n1. VERIFICANDO CAMPOS DE INPUT:');
  
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  
  if (!emailInput) {
    console.log('❌ Campo de email não encontrado');
  } else {
    console.log('✅ Campo de email encontrado');
    console.log('   - Disabled:', emailInput.disabled);
    console.log('   - ReadOnly:', emailInput.readOnly);
    console.log('   - TabIndex:', emailInput.tabIndex);
    console.log('   - Style display:', getComputedStyle(emailInput).display);
    console.log('   - Style visibility:', getComputedStyle(emailInput).visibility);
    console.log('   - Style pointer-events:', getComputedStyle(emailInput).pointerEvents);
  }
  
  if (!passwordInput) {
    console.log('❌ Campo de senha não encontrado');
  } else {
    console.log('✅ Campo de senha encontrado');
    console.log('   - Disabled:', passwordInput.disabled);
    console.log('   - ReadOnly:', passwordInput.readOnly);
    console.log('   - TabIndex:', passwordInput.tabIndex);
    console.log('   - Style display:', getComputedStyle(passwordInput).display);
    console.log('   - Style visibility:', getComputedStyle(passwordInput).visibility);
    console.log('   - Style pointer-events:', getComputedStyle(passwordInput).pointerEvents);
  }
  
  console.log('\n2. VERIFICANDO EVENTOS:');
  
  // Testar se os campos respondem a eventos
  if (emailInput) {
    emailInput.addEventListener('focus', () => {
      console.log('✅ Campo de email recebeu foco');
    });
    
    emailInput.addEventListener('input', () => {
      console.log('✅ Campo de email recebeu input');
    });
    
    emailInput.addEventListener('keydown', (e) => {
      console.log('✅ Campo de email recebeu keydown:', e.key);
    });
  }
  
  if (passwordInput) {
    passwordInput.addEventListener('focus', () => {
      console.log('✅ Campo de senha recebeu foco');
    });
    
    passwordInput.addEventListener('input', () => {
      console.log('✅ Campo de senha recebeu input');
    });
    
    passwordInput.addEventListener('keydown', (e) => {
      console.log('✅ Campo de senha recebeu keydown:', e.key);
    });
  }
  
  console.log('\n3. VERIFICANDO OVERLAYS E Z-INDEX:');
  
  // Verificar se há elementos sobrepostos
  const allElements = document.querySelectorAll('*');
  let overlayElements = [];
  
  allElements.forEach(el => {
    const style = getComputedStyle(el);
    const zIndex = parseInt(style.zIndex);
    
    if (zIndex > 1000 || style.position === 'fixed' || style.position === 'absolute') {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        overlayElements.push({
          element: el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : ''),
          zIndex: zIndex,
          position: style.position,
          display: style.display
        });
      }
    }
  });
  
  if (overlayElements.length > 0) {
    console.log('⚠️ Elementos com posicionamento especial encontrados:');
    overlayElements.forEach(el => {
      console.log(`   - ${el.element} (z-index: ${el.zIndex}, position: ${el.position})`);
    });
  } else {
    console.log('✅ Nenhum elemento sobreposto detectado');
  }
  
  console.log('\n4. VERIFICANDO FORMULÁRIO:');
  
  const form = document.querySelector('form');
  if (form) {
    console.log('✅ Formulário encontrado');
    console.log('   - Action:', form.action);
    console.log('   - Method:', form.method);
    console.log('   - Disabled:', form.disabled);
  } else {
    console.log('❌ Formulário não encontrado');
  }
  
  console.log('\n💡 INSTRUÇÕES PARA TESTE:');
  console.log('========================');
  console.log('1. Tente clicar nos campos de email e senha');
  console.log('2. Tente digitar algo nos campos');
  console.log('3. Verifique se aparecem mensagens de evento no console');
  console.log('4. Se não funcionar, verifique se há erros JavaScript no console');
  
}, 2000);

// Verificar erros JavaScript
window.addEventListener('error', (e) => {
  console.error('❌ ERRO JAVASCRIPT DETECTADO:', e.message, 'em', e.filename, 'linha', e.lineno);
});

console.log('\n⏳ Aguardando 2 segundos para carregar a página...');