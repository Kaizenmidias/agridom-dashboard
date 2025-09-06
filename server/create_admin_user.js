const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAdminUser() {
  try {
    console.log('🔄 Criando usuário administrador...');
    
    // Hash da senha '123456'
    const hashedPassword = bcrypt.hashSync('123456', 10);
    console.log('Hash gerado:', hashedPassword);
    
    // Primeiro, deletar usuário existente se houver
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', 'agenciakaizendesign@gmail.com');
    
    if (deleteError) {
      console.log('⚠️ Erro ao deletar usuário existente:', deleteError.message);
    } else {
      console.log('✅ Usuário existente removido');
    }
    
    // Inserir novo usuário administrador
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: 'agenciakaizendesign@gmail.com',
          password: hashedPassword,
          name: 'Administrador',
          role: 'admin',
          is_active: true,
          can_access_dashboard: true,
          can_access_briefings: true,
          can_access_codes: true,
          can_access_projects: true,
          can_access_expenses: true,
          can_access_crm: true,
          can_access_users: true
        }
      ])
      .select();
    
    if (error) {
      console.error('❌ Erro ao criar usuário:', error);
      return;
    }
    
    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('📧 Email:', data[0].email);
    console.log('👤 Nome:', data[0].name);
    console.log('🔑 Role:', data[0].role);
    console.log('🔓 Senha: 123456');
    
    // Verificar se o usuário foi criado corretamente
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'agenciakaizendesign@gmail.com')
      .single();
    
    if (verifyError) {
      console.error('❌ Erro ao verificar usuário:', verifyError);
    } else {
      console.log('\n🔍 Verificação do usuário criado:');
      console.log('ID:', verifyData.id);
      console.log('Email:', verifyData.email);
      console.log('Nome:', verifyData.name);
      console.log('Role:', verifyData.role);
      console.log('Ativo:', verifyData.is_active);
      console.log('Permissões:');
      console.log('  Dashboard:', verifyData.can_access_dashboard);
      console.log('  Briefings:', verifyData.can_access_briefings);
      console.log('  Códigos:', verifyData.can_access_codes);
      console.log('  Projetos:', verifyData.can_access_projects);
      console.log('  Despesas:', verifyData.can_access_expenses);
      console.log('  CRM:', verifyData.can_access_crm);
      console.log('  Usuários:', verifyData.can_access_users);
    }
    
  } catch (err) {
    console.error('❌ Erro geral:', err);
  }
}

createAdminUser();