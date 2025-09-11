// Script para diagnosticar problemas de interação com inputs
console.log('🔍 Iniciando diagnóstico avançado de interação com inputs...');

// Função para testar interação com inputs
function testInputInteraction() {
  console.log('🔍 Procurando campos de input...');
  
  // Procurar por diferentes seletores
  const emailInput = document.querySelector('input[type="email"]') || 
                    document.querySelector('input[name="email"]') ||
                    document.querySelector('#email');
                    
  const passwordInput = document.querySelector('input[type="password"]') || 
                       document.querySelector('input[name="password"]') ||
                       document.querySelector('#password');
  
  const allInputs = document.querySelectorAll('input');
  
  console.log('📊 Total de inputs encontrados:', allInputs.length);
  console.log('📧 Campo de email encontrado:', emailInput);
  console.log('🔒 Campo de senha encontrado:', passwordInput);
  
  // Listar todos os inputs
  allInputs.forEach((input, index) => {
    console.log(`Input ${index + 1}:`, {
      type: input.type,
      name: input.name,
      id: input.id,
      className: input.className,
      disabled: input.disabled,
      readOnly: input.readOnly,
      value: input.value
    });
  });
  
  // Testar cada input
  allInputs.forEach((input, index) => {
    console.log(`\n🧪 Testando Input ${index + 1}:`);
    
    const style = getComputedStyle(input);
    console.log('- pointerEvents:', style.pointerEvents);
    console.log('- userSelect:', style.userSelect);
    console.log('- zIndex:', style.zIndex);
    console.log('- position:', style.position);
    console.log('- display:', style.display);
    console.log('- visibility:', style.visibility);
    console.log('- opacity:', style.opacity);
    
    // Verificar se o elemento está visível
    const rect = input.getBoundingClientRect();
    console.log('- boundingRect:', rect);
    console.log('- offsetParent:', input.offsetParent);
    
    // Verificar o que está no ponto do input
    if (rect.width > 0 && rect.height > 0) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      
      console.log('- elementFromPoint:', elementAtPoint);
      console.log('- é o próprio input?', elementAtPoint === input);
      console.log('- está dentro do input?', input.contains(elementAtPoint));
      
      if (elementAtPoint && elementAtPoint !== input && !input.contains(elementAtPoint)) {
        console.log('⚠️ PROBLEMA: Elemento cobrindo o input:', elementAtPoint);
        console.log('- tagName:', elementAtPoint.tagName);
        console.log('- className:', elementAtPoint.className);
        console.log('- id:', elementAtPoint.id);
        
        const coveringStyle = getComputedStyle(elementAtPoint);
        console.log('- pointerEvents do elemento cobrindo:', coveringStyle.pointerEvents);
        console.log('- zIndex do elemento cobrindo:', coveringStyle.zIndex);
      }
    }
    
    // Adicionar event listeners para teste
    const testEvents = ['click', 'mousedown', 'mouseup', 'focus', 'blur', 'input', 'change'];
    testEvents.forEach(eventType => {
      input.addEventListener(eventType, (e) => {
        console.log(`✅ Evento ${eventType} disparado no input ${index + 1}`);
      }, { once: true });
    });
    
    // Tentar focar programaticamente
    try {
      input.focus();
      console.log('✅ Focus programático funcionou');
    } catch (e) {
      console.log('❌ Erro ao focar:', e);
    }
  });
  
  // Verificar se há overlays globais
  console.log('\n🔍 Verificando overlays globais...');
  const suspiciousElements = document.querySelectorAll('[style*="position: fixed"], [style*="position: absolute"], .fixed, .absolute');
  
  suspiciousElements.forEach((el, index) => {
    const style = getComputedStyle(el);
    const zIndex = parseInt(style.zIndex) || 0;
    
    if (zIndex > 0 || style.position === 'fixed' || style.position === 'absolute') {
      console.log(`Elemento suspeito ${index + 1}:`, {
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        zIndex: zIndex,
        position: style.position,
        pointerEvents: style.pointerEvents,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity
      });
    }
  });
  
  // Verificar se há modais ou dialogs abertos
  console.log('\n🔍 Verificando modais/dialogs...');
  const modals = document.querySelectorAll('[role="dialog"], .modal, [data-state="open"]');
  modals.forEach((modal, index) => {
    console.log(`Modal ${index + 1}:`, {
      tagName: modal.tagName,
      className: modal.className,
      role: modal.getAttribute('role'),
      dataState: modal.getAttribute('data-state'),
      style: getComputedStyle(modal).display
    });
  });
}

// Executar teste quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', testInputInteraction);
} else {
  testInputInteraction();
}

// Também executar após um delay
setTimeout(testInputInteraction, 2000);

// Adicionar listener para cliques globais
document.addEventListener('click', (e) => {
  console.log('🖱️ Click global detectado em:', e.target);
  console.log('- tagName:', e.target.tagName);
  console.log('- className:', e.target.className);
  console.log('- id:', e.target.id);
});

console.log('✅ Script de diagnóstico avançado carregado.');
console.log('\n📋 INSTRUÇÕES:');
console.log('1. Abra o Console (F12)');
console.log('2. Tente clicar nos campos de input');
console.log('3. Observe as mensagens de evento');
console.log('4. Procure por elementos suspeitos listados acima');
console.log('5. Se nenhum evento for disparado, há algo bloqueando a interação');

// Função para remover overlays suspeitos (para teste)
window.removeOverlays = function() {
  const overlays = document.querySelectorAll('[style*="z-index"]');
  overlays.forEach(el => {
    const zIndex = parseInt(getComputedStyle(el).zIndex) || 0;
    if (zIndex > 1000) {
      console.log('🗑️ Removendo overlay suspeito:', el);
      el.style.display = 'none';
    }
  });
  console.log('✅ Overlays removidos. Teste os inputs agora.');
};

console.log('\n🛠️ Para remover overlays suspeitos, execute: removeOverlays()');