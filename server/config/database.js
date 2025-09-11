const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Configuração do banco de dados
let pool;
let useSupabaseAPI = true; // Ativar Supabase API desde o início
let supabaseClient;

// Inicializar cliente Supabase
function getSupabaseClient() {
  if (!supabaseClient && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('🔗 Cliente Supabase API inicializado');
  }
  return supabaseClient;
}

function getPool() {
  // Se estiver usando Supabase API, retornar objeto com cliente Supabase
  if (useSupabaseAPI) {
    // Usando Supabase API como banco de dados
    const client = getSupabaseClient();
    const supabasePool = {
      supabase: client,  // Adicionar o cliente Supabase como propriedade
      query: async (text, params = []) => {
        // Executando query via Supabase API
        try {
          
          if (text.includes('FROM projects') || text.includes('projects')) {
            // Query de projetos detectada
            
            // Verificar se é uma query de estatísticas (com COUNT e SUM)
            const normalizedText = text.replace(/\s+/g, ' ').toLowerCase();
            // Texto normalizado
            
            if (normalizedText.includes('count(*) as total_projects') && normalizedText.includes('coalesce(sum(project_value), 0)')) {
              // Query de estatísticas detectada
              
              // Buscar todos os projetos
              const { data: projects, error } = await client
                .from('projects')
                .select('project_value, paid_value');
              
              if (error) {
                console.error('❌ Erro ao buscar projetos:', error);
                throw error;
              }
              
              // Projetos encontrados
              
              // Calcular estatísticas
              const totalProjects = projects?.length || 0;
              const totalValue = projects?.reduce((sum, p) => sum + (parseFloat(p.project_value) || 0), 0) || 0;
              const totalPaid = projects?.reduce((sum, p) => sum + (parseFloat(p.paid_value) || 0), 0) || 0;
              const totalReceivable = totalValue - totalPaid;
              
              // Estatísticas calculadas
              
              return {
                rows: [{
                  total_projects: totalProjects,
                  total_value: totalValue,
                  total_paid: totalPaid,
                  total_receivable: totalReceivable
                }],
                rowCount: 1
              };
            }
            
            // Query normal de projetos
            let query = client.from('projects').select('*');
            
            if (text.includes('where user_id =')) {
              query = query.eq('user_id', params[0]);
              if (text.includes('order by created_at desc')) {
                query = query.order('created_at', { ascending: false });
              }
              if (text.includes('limit 1')) {
                query = query.limit(1);
              }
            } else if (text.includes('where id =')) {
              query = query.eq('id', params[0]);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return { rows: data || [], rowCount: data?.length || 0 };
          }
          
          if (text.includes('from expenses')) {
            const { data, error } = await client
              .from('expenses')
              .select('*');
            if (error) throw error;
            return { rows: data || [], rowCount: data?.length || 0 };
          }
          
          if (text.toLowerCase().includes('from users')) {
            // Seção de users
            let query = client.from('users').select('*');
            
            if (text.toLowerCase().includes('where email =')) {
              // Aplicando filtro de email
              query = query.eq('email', params[0]);
              if (text.toLowerCase().includes('and is_active')) {
                // Aplicando filtro is_active
                // Converter 1 para true, 0 para false
                const isActiveValue = params[1] === 1 || params[1] === '1' ? true : false;
                // Valor convertido is_active
                query = query.eq('is_active', isActiveValue);
              }
            } else if (text.includes('limit 1')) {
              query = query.limit(1);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return { rows: data || [], rowCount: data?.length || 0 };
          }
          
          if (text.includes('from codes')) {
            let query = client.from('codes').select('*');
            
            if (text.includes('where id =')) {
              query = query.eq('id', params[0]);
            } else if (text.includes('where 1=1')) {
              // Query com filtros opcionais
              let paramIndex = 0;
              
              if (text.includes('and content like')) {
                query = query.ilike('code_content', params[paramIndex]);
                paramIndex++;
              }
              
              if (text.includes('and type =')) {
                query = query.eq('language', params[paramIndex]);
                paramIndex++;
              }
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return { rows: data || [], rowCount: data?.length || 0 };
          }
          
          // Para outras queries, tentar executar diretamente
          console.log('⚠️ Query não reconhecida, tentando execução direta');
          throw new Error(`Query não suportada pela API Supabase: ${text}`);
          
        } catch (error) {
          console.error('❌ Erro na query Supabase:', error);
          throw error;
        }
      },
      connect: (callback) => callback(null, {}, () => {}),
      end: () => Promise.resolve(),
      on: () => {},
      removeListener: () => {}
    };
    return supabasePool;
  }
  
  if (!pool) {
    // Detectar se está usando Supabase Online
    const isSupabaseOnline = process.env.POSTGRES_HOST && process.env.POSTGRES_HOST.includes('supabase.co');
    const isSupabaseLocal = process.env.POSTGRES_HOST === 'localhost' && process.env.POSTGRES_PORT === '54322';
    const environment = isSupabaseOnline ? 'Supabase Online' : isSupabaseLocal ? 'Supabase Local' : 'Produção/Remoto';
    
    console.log(`🌍 Ambiente detectado: ${environment}`);
    
    // Tentar configuração manual sem SSL
    let poolConfig;
    
    if (process.env.POSTGRES_URL) {
      // Usar URL completa mas forçar SSL como false para desenvolvimento local
      const url = new URL(process.env.POSTGRES_URL);
      poolConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1),
        user: url.username,
        password: url.password,
        ssl: isSupabaseLocal ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };
    } else {
      // Configuração manual com variáveis individuais
      poolConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        ssl: isSupabaseLocal ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };
    }
    
    console.log('🔗 Configuração do pool (server):', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      ssl: poolConfig.ssl,
      environment: environment
    });
    
    pool = new Pool(poolConfig);
    
    pool.on('error', (err, client) => {
      console.error('❌ Erro inesperado no cliente do banco:', err);
      console.log('🔄 Tentando usar Supabase API como fallback...');
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        useSupabaseAPI = true;
        getSupabaseClient();
      } else {
        throw new Error('Configurações do Supabase não encontradas');
      }
      pool = null;
    });
    
    // Testar conexão
    pool.connect((err, client, release) => {
      if (err) {
        console.error('❌ Erro ao conectar PostgreSQL:', err.message);
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          console.log('🔄 Usando Supabase API como fallback...');
          useSupabaseAPI = true;
          getSupabaseClient();
        } else {
          throw new Error('Configurações do Supabase não encontradas');
        }
        pool = null;
        return;
      }
      release();
      // Pool de conexão PostgreSQL criado
    });
  }

  

  
  return pool;
}

// Função para executar queries
async function query(text, params = []) {
  const start = Date.now();
  try {
    const currentPool = getPool();
    
    // Se estiver usando Supabase API, usar a função query customizada
    if (useSupabaseAPI && currentPool.query) {
      const res = await currentPool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Executed Supabase API query:', { text, duration, rows: res.rowCount });
      }
      
      return res;
    }
    
    // Caso contrário, usar PostgreSQL normal
    const res = await currentPool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed PostgreSQL query:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    
    // Se falhar e não estiver usando Supabase API ainda, tentar como fallback
    if (!useSupabaseAPI && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🔄 Tentando Supabase API como fallback após erro...');
      useSupabaseAPI = true;
      pool = null;
      return await query(text, params); // Tentar novamente com Supabase API
    }
    
    throw error;
  }
}

// Função para testar a conexão
async function testConnection() {
  try {
    // Usar uma query simples que funcione com Supabase API
    const result = await query('SELECT * FROM users LIMIT 1');
    // Conexão com o banco de dados estabelecida via Supabase API
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco de dados:', error.message);
    return false;
  }
}

// Função para fechar a conexão
async function closeConnection() {
  try {
    if (pool) {
      await pool.end();
      pool = null;
      console.log('🔌 Conexão com o banco de dados fechada');
    }
  } catch (error) {
    console.error('Erro ao fechar conexão:', error);
  }
}

module.exports = {
  query,
  testConnection,
  closeConnection,
  getPool,
  getSupabaseClient
};