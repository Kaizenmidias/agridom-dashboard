const axios = require('axios');

async function debugSidebar() {
  try {
    console.log('=== DEBUG SIDEBAR - Verificando dados do usuário ===\n');
    
    // 1. Fazer login
    console.log('1. Fazendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'agenciakaizendesign@gmail.com',
      password: 'Beatriz@2908'
    });
    
    if (loginResponse.data.user && loginResponse.data.token) {
      console.log('✅ Login realizado com sucesso');
      console.log('Token:', loginResponse.data.token);
      
      const user = loginResponse.data.user;
      console.log('\n2. Dados do usuário:');
      console.log('ID:', user.id);
      console.log('Nome:', user.full_name);
      console.log('Email:', user.email);
      
      console.log('\n3. Permissões do usuário:');
      console.log('can_access_dashboard:', user.can_access_dashboard);
      console.log('can_access_projects:', user.can_access_projects);
      console.log('can_access_briefings:', user.can_access_briefings);
      console.log('can_access_codes:', user.can_access_codes);
      console.log('can_access_expenses:', user.can_access_expenses);
      console.log('can_access_crm:', user.can_access_crm);
      console.log('can_access_users:', user.can_access_users);
      
      console.log('\n4. Verificando quais itens do menu devem aparecer:');
      const allItems = [
        { title: "Dashboard", permission: "can_access_dashboard" },
        { title: "Projetos", permission: "can_access_projects" },
        { title: "Briefings", permission: "can_access_briefings" },
        { title: "Códigos", permission: "can_access_codes" },
        { title: "Despesas", permission: "can_access_expenses" },
        { title: "CRM", permission: "can_access_crm" },
        { title: "Usuários", permission: "can_access_users" },
      ];
      
      const visibleItems = allItems.filter(item => {
        const hasPermission = user[item.permission] === true || user[item.permission] === 1;
        console.log(`- ${item.title}: ${hasPermission ? '✅ VISÍVEL' : '❌ OCULTO'} (${item.permission}: ${user[item.permission]})`);
        return hasPermission;
      });
      
      console.log(`\n5. Total de itens visíveis: ${visibleItems.length}`);
      
      if (visibleItems.length === 0) {
        console.log('\n⚠️  PROBLEMA: Nenhum item do menu será exibido!');
        console.log('Isso pode ser porque:');
        console.log('- As permissões não estão sendo retornadas como boolean true');
        console.log('- O filtro no frontend está verificando === true mas recebendo números');
      } else {
        console.log('\n✅ Itens que devem aparecer no menu:');
        visibleItems.forEach(item => console.log(`  - ${item.title}`));
      }
      
    } else {
      console.log('❌ Falha no login:', loginResponse.data.message);
      console.log('Resposta completa:', JSON.stringify(loginResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Dados da resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugSidebar();