const { Pool } = require('pg');
const sqlite = require('./sqlite');
const { createClient } = require('@supabase/supabase-js');

// Configuração do banco de dados
let pool;
let useSQLite = false;
let useSupabaseAPI = false;
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
  if (!pool && !useSQLite) {
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
        console.log('🔄 Usando SQLite como fallback...');
        useSQLite = true;
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
          console.log('🔄 Usando SQLite como fallback...');
          useSQLite = true;
        }
        pool = null;
        return;
      }
      release();
      console.log('✅ Server Pool de conexão PostgreSQL criado');
    });
  }
  
  if (useSupabaseAPI) {
    console.log('🌐 Usando Supabase API como banco de dados');
    const client = getSupabaseClient();
    return {
      query: async (text, params = []) => {
        console.log('🔍 Executando query via Supabase API:', text, params);
        console.log('🔍 Checking conditions:', {
          hasCountProjects: text.includes('COUNT(*) as total_projects'),
          hasCoalesceSum: text.includes('COALESCE(SUM(project_value), 0)'),
          bothConditions: text.includes('COUNT(*) as total_projects') && text.includes('COALESCE(SUM(project_value), 0)')
        });
        try {
          console.log('🔍 Query recebida:', text.substring(0, 100) + '...');
          console.log('📝 Query recebida:', text);
          console.log('🔍 Checking conditions:', {
            hasCountProjects: text.includes('COUNT(*) as total_projects'),
            hasCoalesceSum: text.includes('COALESCE(SUM(project_value), 0)'),
            hasPaidValue: text.includes('COALESCE(SUM(paid_value), 0)'),
            bothConditions: text.includes('COUNT(*) as total_projects') && text.includes('COALESCE(SUM(project_value), 0)')
          });
          console.log('🔍 Query text for debugging:', JSON.stringify(text));
          // Para queries de projetos
          console.log('🔍 Verificando se query inclui projetos:', text.includes('FROM projects'), text.includes('projects'));
          console.log('🔍 Query completa:', text);
          
          if (text.includes('FROM projects') || text.includes('projects')) {
            console.log('🔍 Buscando projetos para user_id:', params[0]);
            console.log('🔍 Query executada:', text);
            console.log('🔍 Parâmetros da query:', params);
            
            let query = client
              .from('projects')
              .select('*')
              .eq('user_id', params[0]);
            
            // Aplicar filtros de data se existirem
            if (text.includes('DATE(created_at) BETWEEN') && params.length >= 3) {
              const startDate = params[1] + 'T00:00:00.000Z';
              const endDate = params[2] + 'T23:59:59.999Z';
              console.log('🗓️ Aplicando filtros de data BETWEEN:', { startDate, endDate });
              query = query
                .gte('created_at', startDate)
                .lte('created_at', endDate);
            }
            // Aplicar filtros de ano e mês se existirem
            else if (text.includes('EXTRACT(year FROM created_at)') && text.includes('EXTRACT(month FROM created_at)') && params.length >= 3) {
              const year = params[1];
              const month = params[2];
              const startDate = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00.000Z`;
              const endDate = new Date(year, month, 0).toISOString(); // Último dia do mês
              console.log('🗓️ Aplicando filtros de ano e mês:', { year, month, startDate, endDate });
              query = query
                .gte('created_at', startDate)
                .lte('created_at', endDate);
            }
            // Aplicar filtro apenas de ano se existir
            else if (text.includes('EXTRACT(year FROM created_at)') && params.length >= 2) {
              const year = params[1];
              const startDate = `${year}-01-01T00:00:00.000Z`;
              const endDate = `${year}-12-31T23:59:59.999Z`;
              console.log('🗓️ Aplicando filtro de ano:', { year, startDate, endDate });
              query = query
                .gte('created_at', startDate)
                .lte('created_at', endDate);
            }
            
            const { data, error } = await query;
            
            console.log('📊 Dados retornados do Supabase:', data);
            console.log('❌ Erro do Supabase:', error);
            
            if (error) throw error;
            
            // Simular resultado PostgreSQL
            const result = {
              rows: data || [],
              rowCount: data ? data.length : 0
            };
            
            // Calcular estatísticas manualmente
            // Normalizar a query removendo quebras de linha e espaços extras
            const normalizedText = text.replace(/\s+/g, ' ').trim();
            console.log('🔍 Query normalizada:', normalizedText);
            
            const hasCount = normalizedText.includes('COUNT(*) as total_projects');
            const hasProjectValue = normalizedText.includes('COALESCE(SUM(project_value), 0)');
            const hasPaidValue = normalizedText.includes('COALESCE(SUM(paid_value), 0)');
            const shouldCalculateStats = hasCount && hasProjectValue && hasPaidValue;
            
            console.log('🔍 Verificando condições para estatísticas:');
            console.log('  - hasCount:', hasCount);
            console.log('  - hasProjectValue:', hasProjectValue);
            console.log('  - hasPaidValue:', hasPaidValue);
            console.log('  - shouldCalculateStats:', shouldCalculateStats);
            
            if (shouldCalculateStats) {
              console.log('✅ Calculando estatísticas manualmente...');
              const stats = {
                total_projects: data.length,
                active_projects: data.filter(p => p.status === 'active').length,
                completed_projects: data.filter(p => p.status === 'completed').length,
                paused_projects: data.filter(p => p.status === 'paused').length,
                total_project_value: data.reduce((sum, p) => sum + (parseFloat(p.project_value) || 0), 0),
                total_paid_value: data.reduce((sum, p) => sum + (parseFloat(p.paid_value) || 0), 0)
              };
              result.rows = [stats];
              result.rowCount = 1;
              console.log('📊 Estatísticas calculadas:', stats);
            }
            
            // Para queries de período anterior (paid_value)
            if (text.includes('total_paid_value') && text.includes('DATE(created_at) BETWEEN')) {
              const totalPaidValue = data.reduce((sum, p) => sum + (parseFloat(p.paid_value) || 0), 0);
              result.rows = [{ total_paid_value: totalPaidValue }];
              result.rowCount = 1;
              console.log('💰 Total paid value calculado:', totalPaidValue);
            }
            
            // Para queries de valores a receber
            if (text.includes('total_receivable')) {
              const activeProjects = data.filter(p => p.status === 'active');
              const totalReceivable = activeProjects.reduce((sum, p) => {
                const projectValue = parseFloat(p.project_value) || 0;
                const paidValue = parseFloat(p.paid_value) || 0;
                return sum + Math.max(0, projectValue - paidValue);
              }, 0);
              result.rows = [{ total_receivable: totalReceivable }];
              result.rowCount = 1;
              console.log('📈 Total receivable calculado:', totalReceivable);
            }
            
            return result;
          }
          
          // Para queries de despesas
          if (text.includes('FROM expenses')) {
            console.log('💸 Buscando despesas para user_id:', params[0]);
            const { data, error } = await client
              .from('expenses')
              .select('*')
              .eq('user_id', params[0]);
            
            console.log('💸 Despesas encontradas:', data);
            if (error) {
              console.error('❌ Erro ao buscar despesas:', error);
              throw error;
            }
            
            return {
              rows: data || [],
              rowCount: data ? data.length : 0
            };
          }
          
          // Para outras queries, retornar vazio
          return { rows: [], rowCount: 0 };
        } catch (error) {
          console.error('Erro na query Supabase API:', error);
          return { rows: [], rowCount: 0 };
        }
      },
      supabase: client,
      connect: (callback) => callback(null, {}, () => {}),
      end: () => Promise.resolve()
    };
  }
  
  if (useSQLite) {
    console.log('📱 Usando SQLite como banco de dados');
    return {
      query: sqlite.query,
      connect: (callback) => callback(null, {}, () => {}),
      end: () => Promise.resolve()
    };
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
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Conexão com o banco de dados estabelecida:', result.rows[0].current_time);
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
  getPool
};