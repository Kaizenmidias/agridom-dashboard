// Carregar variáveis de ambiente baseado no NODE_ENV ANTES de qualquer importação
const path = require('path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const express = require('express');
const cors = require('cors');
const { query, testConnection, closeConnection, getPool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://agridom-dashboard.vercel.app', process.env.CORS_ORIGIN].filter(Boolean)
    : ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083', 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082', 'http://127.0.0.1:8083', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Testar conexão com o banco de dados na inicialização
testConnection();

// A função query agora vem do módulo database.js

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rotas
const authRoutes = require('./routes/auth');
const crudRoutes = require('./routes/crud');
const uploadRoutes = require('./routes/upload');


// Wrapper inteligente para queries que detecta Supabase API
const smartQuery = async (text, params = []) => {
  const pool = getPool();
  
  // SmartQuery chamada
  
  // Se estiver usando Supabase API, converter query para API calls
  if (pool && pool.supabase) {
    // Usando convertSQLToSupabaseAPI
    return await convertSQLToSupabaseAPI(pool.supabase, text, params);
  }
  
  // Caso contrário, usar query SQL normal
  // Usando query SQL normal
  return await query(text, params);
};

// Função para converter SQL queries em chamadas da API Supabase
const convertSQLToSupabaseAPI = async (supabase, sqlText, params) => {
  const sql = sqlText.toLowerCase().trim();
  
  try {
    // SELECT queries
    if (sql.startsWith('select')) {
      if (sql.includes('from users')) {
        let query = supabase.from('users').select('*');
        
        
        
        if (sql.includes('where email =')) {

          query = query.eq('email', params[0]);
          if (sql.includes('and is_active')) {

    const isActiveValue = params[1] === 1 || params[1] === '1' ? true : false;
            query = query.eq('is_active', isActiveValue);
          }
        } else if (sql.includes('where id =')) {

          query = query.eq('id', params[0]);
        }
        

        const { data, error } = await query;
        if (error) {
          console.error('❌ Erro na query Supabase:', error);
          throw error;
        }
        
        const result = { rows: data || [], rowCount: data?.length || 0 };
        
        return result;
      }
      
      if (sql.includes('from expenses')) {
        let query = supabase.from('expenses').select('*');
        
        if (sql.includes('where id =') && sql.includes('and user_id =')) {
          // SELECT id FROM expenses WHERE id = ? AND user_id = ?
          query = query.eq('id', params[0]).eq('user_id', params[1]);
        } else if (sql.includes('where id =')) {
          // SELECT * FROM expenses WHERE id = ?
          query = query.eq('id', params[0]);
        } else if (sql.includes('where user_id =')) {
          // SELECT * FROM expenses WHERE user_id = ?
          query = query.eq('user_id', params[0]);
        }
        
        const { data, error } = await query;
        if (error) {
          console.error('❌ Erro na query Supabase expenses:', error);
          throw error;
        }
        
        return { rows: data || [], rowCount: data?.length || 0 };
      }
      
      if (sql.includes('from projects')) {

        // Verificar se é uma query de estatísticas (com COUNT e SUM)
        const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase();
        
        if (normalizedSql.includes('count(*) as total_projects') && normalizedSql.includes('coalesce(sum(project_value), 0)')) {

          

          const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', params[0]);
            
          if (error) throw error;
          

          const stats = {
            total_projects: projects?.length || 0,
            active_projects: projects?.filter(p => p.status === 'active').length || 0,
            completed_projects: projects?.filter(p => p.status === 'completed').length || 0,
            paused_projects: projects?.filter(p => p.status === 'paused').length || 0,
            total_project_value: projects?.reduce((sum, p) => sum + (parseFloat(p.project_value) || 0), 0) || 0,
            total_paid_value: projects?.reduce((sum, p) => sum + (parseFloat(p.paid_value) || 0), 0) || 0
          };
          

          
          return { rows: [stats], rowCount: 1 };
        }
        

        
        if (normalizedSql.includes('total_receivable') || normalizedSql.includes('project_value - paid_value')) {

          

          const { data: activeProjects, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', params[0])
            .eq('status', 'active');
            
          if (error) throw error;
          

          const totalReceivable = activeProjects?.reduce((sum, p) => {
            const receivable = (parseFloat(p.project_value) || 0) - (parseFloat(p.paid_value) || 0);
            return sum + receivable;
          }, 0) || 0;
          

          
          return { rows: [{ total_receivable: totalReceivable }], rowCount: 1 };
        }
        
        // Verificar se é uma query com filtros de data
        if (normalizedSql.includes('date(created_at) between') || normalizedSql.includes('date(delivery_date) between')) {
          console.log('📅 Detectada query de projetos com filtro de data');
          console.log('📅 Query SQL:', sqlText);
          console.log('📅 Parâmetros:', params);
          
          let query = supabase.from('projects').select('*');
          
          // Aplicar filtro de usuário
          if (params[0]) {
            query = query.eq('user_id', params[0]);
          }
          
          // Aplicar filtros de data
          if (normalizedSql.includes('date(created_at) between')) {
            const startDate = params[1];
            const endDate = params[2];
            console.log('📅 Aplicando filtro created_at entre:', startDate, 'e', endDate);
            
            // Converter datas para formato ISO e aplicar filtro
            query = query.gte('created_at', startDate + 'T00:00:00.000Z')
                         .lte('created_at', endDate + 'T23:59:59.999Z');
          }
          
          if (normalizedSql.includes('date(delivery_date) between')) {
            const startDate = params[1];
            const endDate = params[2];
            console.log('📅 Aplicando filtro delivery_date entre:', startDate, 'e', endDate);
            
            // Converter datas para formato ISO e aplicar filtro
            query = query.gte('delivery_date', startDate + 'T00:00:00.000Z')
                         .lte('delivery_date', endDate + 'T23:59:59.999Z');
          }
          
          // Verificar se há condição NOT BETWEEN para created_at
          if (normalizedSql.includes('date(created_at) not between')) {
            const startDate = params[1];
            const endDate = params[2];
            console.log('📅 Aplicando filtro created_at NOT entre:', startDate, 'e', endDate);
            
            // Para NOT BETWEEN, usar OR com lt e gt
            query = query.or(`created_at.lt.${startDate}T00:00:00.000Z,created_at.gt.${endDate}T23:59:59.999Z`);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          console.log('📅 Projetos encontrados com filtro de data:', data?.length || 0);
          console.log('📅 Dados dos projetos:', data);
          
          return { rows: data || [], rowCount: data?.length || 0 };
        }
        
        // Query normal de projetos
        let query = supabase.from('projects').select('*');
        
        if (sql.includes('where user_id =')) {
          query = query.eq('user_id', params[0]);
          if (sql.includes('order by created_at desc')) {
            query = query.order('created_at', { ascending: false });
          }
          if (sql.includes('limit 1')) {
            query = query.limit(1);
          }
        } else if (sql.includes('where id =')) {
          query = query.eq('id', params[0]);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0 };
      }
      
      if (sql.includes('from expenses')) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*');
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0 };
      }
      
      if (sql.includes('from codes')) {
        let query = supabase.from('codes').select('*');
        
        if (sql.includes('where id =')) {
          query = query.eq('id', params[0]);
        } else if (sql.includes('where 1=1')) {
          // Query com filtros opcionais
          let paramIndex = 0;
          
          if (sql.includes('and content like')) {
            query = query.ilike('code_content', params[paramIndex]);
            paramIndex++;
          }
          
          if (sql.includes('and type =')) {
            query = query.eq('language', params[paramIndex]);
            paramIndex++;
          }
        }
        
        if (sql.includes('order by created_at desc')) {
          query = query.order('created_at', { ascending: false });
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0 };
      }
    }
    
    // INSERT queries
    if (sql.startsWith('insert')) {
      if (sql.includes('into users')) {
        const userData = {
          email: params[0],
          password: params[1],
          name: params[2],
          role: params[3] || 'user',
          is_active: params[4] !== undefined ? params[4] : true,
          can_access_dashboard: params[5] !== undefined ? params[5] : true,
          can_access_briefings: params[6] !== undefined ? params[6] : true,
          can_access_codes: params[7] !== undefined ? params[7] : true,
          can_access_projects: params[8] !== undefined ? params[8] : true,
          can_access_expenses: params[9] !== undefined ? params[9] : true,
          can_access_crm: params[10] !== undefined ? params[10] : true,
          can_access_users: params[11] !== undefined ? params[11] : false
        };
        
        const { data, error } = await supabase
          .from('users')
          .insert(userData)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0, insertId: data?.[0]?.id };
      }
      
      if (sql.includes('into projects')) {
        const projectData = {
          user_id: params[0],
          name: params[1],
          client: params[2],
          project_type: params[3] || 'website',
          status: params[4] || 'active',
          description: params[5],
          project_value: params[6],
          paid_value: params[7] || 0,
          delivery_date: params[8]
        };
        
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0, insertId: data?.[0]?.id };
      }
      
      if (sql.includes('into expenses')) {
        // Ordem correta dos parâmetros conforme crud.js:
        // description, value, category, date, billing_type, project_id, user_id, notes
        
        const expenseData = {
          description: params[0],
          value: params[1],
          category: params[2],
          date: params[3],
          billing_type: params[4],
          project_id: params[5],
          user_id: params[6],
          notes: params[7],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0, insertId: data?.[0]?.id };
      }
      
      if (sql.includes('into codes')) {
        const codeData = {
          title: params[0],
          language: params[1],
          code_content: params[2],
          description: params[3],
          user_id: params[4]
        };
        
        const { data, error } = await supabase
          .from('codes')
          .insert(codeData)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0, insertId: data?.[0]?.id };
      }
    }
    
    // UPDATE queries
    if (sql.toLowerCase().startsWith('update')) {
      if (sql.toLowerCase().includes('users') && sql.toLowerCase().includes('set')) {
        // Construir objeto de atualização baseado nos parâmetros
        const updateData = {};
        
        // Mapear parâmetros para campos do Supabase
        if (params[0] !== null && params[0] !== undefined) updateData.name = params[0];
        if (params[1] !== null && params[1] !== undefined) updateData.position = params[1];
        if (params[2] !== null && params[2] !== undefined) updateData.avatar_url = params[2];
        if (params[3] !== null && params[3] !== undefined) updateData.is_active = params[3];
        if (params[4] !== null && params[4] !== undefined) updateData.role = params[4];
        if (params[5] !== null && params[5] !== undefined) updateData.can_access_dashboard = params[5];
        if (params[6] !== null && params[6] !== undefined) updateData.can_access_briefings = params[6];
        if (params[7] !== null && params[7] !== undefined) updateData.can_access_codes = params[7];
        if (params[8] !== null && params[8] !== undefined) updateData.can_access_projects = params[8];
        if (params[9] !== null && params[9] !== undefined) updateData.can_access_expenses = params[9];
        if (params[10] !== null && params[10] !== undefined) updateData.can_access_crm = params[10];
        if (params[11] !== null && params[11] !== undefined) updateData.can_access_users = params[11];
        
        // Se for uma atualização direta via API (objeto como primeiro parâmetro)
        if (typeof params[0] === 'object' && params[0] !== null) {
          Object.assign(updateData, params[0]);
        }
        
        const userId = typeof params[0] === 'object' ? params[1] : params[params.length - 1];
        
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0 };
      }
      
      if (sql.includes('expenses') && sql.includes('set')) {
        // UPDATE expenses
        const updateData = {};
        
        // Mapear parâmetros para campos do Supabase (baseado na ordem da query)
        if (params[0] !== null && params[0] !== undefined) updateData.description = params[0];
        if (params[1] !== null && params[1] !== undefined) updateData.amount = params[1];
        if (params[2] !== null && params[2] !== undefined) updateData.category = params[2];
        if (params[3] !== null && params[3] !== undefined) updateData.date = params[3];
        if (params[4] !== null && params[4] !== undefined) updateData.billing_type = params[4];
        if (params[5] !== null && params[5] !== undefined) updateData.notes = params[5];
        if (params[6] !== null && params[6] !== undefined) updateData.updated_at = params[6];
        
        const expenseId = params[7]; // O ID está no final
        
        const { data, error } = await supabase
          .from('expenses')
          .update(updateData)
          .eq('id', expenseId)
          .select(`
            id, description, amount, category, date, billing_type, notes, 
            project_id, user_id, created_at, updated_at,
            projects(name)
          `);
        if (error) throw error;
        
        // Transformar o resultado para incluir project_name
        const transformedData = data?.map(expense => ({
          ...expense,
          amount: expense.amount,
          project_name: expense.projects?.name || null
        })) || [];
        
        return { rows: transformedData, rowCount: transformedData.length };
      }
      
      if (sql.includes('codes') && sql.includes('set')) {
        const updateData = {
          title: params[0],
          language: params[1],
          code_content: params[2],
          description: params[3]
        };
        
        const codeId = params[4];
        
        const { data, error } = await supabase
          .from('codes')
          .update(updateData)
          .eq('id', codeId)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0 };
      }
      
      if (sql.includes('projects') && sql.includes('set')) {
        const updateData = {};
        // Só incluir campos que realmente foram enviados (não null, undefined ou string vazia)
        if (params[0] !== null && params[0] !== undefined && params[0] !== '') updateData.name = params[0];
        if (params[1] !== null && params[1] !== undefined && params[1] !== '') updateData.client = params[1];
        if (params[2] !== null && params[2] !== undefined && params[2] !== '') updateData.project_type = params[2];
        if (params[3] !== null && params[3] !== undefined && params[3] !== '') updateData.status = params[3];
        if (params[4] !== null && params[4] !== undefined && params[4] !== '') updateData.description = params[4];
        if (params[5] !== null && params[5] !== undefined) updateData.project_value = params[5];
        if (params[6] !== null && params[6] !== undefined) updateData.paid_value = params[6];
        if (params[7] !== null && params[7] !== undefined && params[7] !== '') updateData.delivery_date = params[7];
        if (params[8] !== null && params[8] !== undefined && params[8] !== '') updateData.completion_date = params[8];
        updateData.updated_at = new Date().toISOString();
        
        const projectId = params[9];
        const userId = params[10];
        
        const { data, error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId)
          .eq('user_id', userId)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0 };
      }
      
      if (sql.toLowerCase().includes('expenses') && sql.toLowerCase().includes('set')) {
        const updateData = {};
        if (params[0] !== null && params[0] !== undefined) updateData.description = params[0];
        if (params[1] !== null && params[1] !== undefined) updateData.amount = params[1];
        if (params[2] !== null && params[2] !== undefined) updateData.category = params[2];
        if (params[3] !== null && params[3] !== undefined) updateData.date = params[3];
        if (params[4] !== null && params[4] !== undefined) updateData.billing_type = params[4];
        if (params[5] !== null && params[5] !== undefined) updateData.notes = params[5];
        // Campos de recorrência removidos - não existem na tabela
        updateData.updated_at = new Date().toISOString();
        
        const expenseId = params[10];
        
        const { data, error } = await supabase
          .from('expenses')
          .update(updateData)
          .eq('id', expenseId)
          .select();
        if (error) throw error;
        return { rows: data || [], rowCount: data?.length || 0 };
      }
    }
    
    // DELETE queries
    if (sql.startsWith('delete')) {
      if (sql.includes('from users')) {
        const { data, error } = await supabase
          .from('users')
          .delete()
          .eq('id', params[0]);
        if (error) throw error;
        return { rows: [], rowCount: 1 };
      }
      
      if (sql.includes('from codes')) {
        const { data, error } = await supabase
          .from('codes')
          .delete()
          .eq('id', params[0]);
        if (error) throw error;
        return { rows: [], rowCount: 1 };
      }
      
      if (sql.includes('from projects')) {
        const { data, error } = await supabase
          .from('projects')
          .delete()
          .eq('id', params[0]);
        if (error) throw error;
        return { rows: [], rowCount: 1 };
      }
      
      if (sql.includes('from expenses')) {
        const { data, error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', params[0]);
        if (error) throw error;
        return { rows: [], rowCount: 1 };
      }
    }
    
    // Fallback para queries não suportadas
    console.warn('Query SQL não convertida para Supabase API:', sqlText);
    return { rows: [], rowCount: 0 };
    
  } catch (error) {
    console.error('Erro na conversão SQL para Supabase API:', error);
    throw error;
  }
};

// Disponibilizar a função query inteligente para as rotas
app.locals.query = smartQuery;

// Usar rotas
app.use('/api/auth', authRoutes);
app.use('/api', crudRoutes);
app.use('/api/upload', uploadRoutes);


// Rota de teste
app.get('/api/health', async (req, res) => {
  try {
    // Usar testConnection que já está implementada corretamente
    const isConnected = await testConnection();
    if (isConnected) {
      res.json({ status: 'OK', message: 'Conexão com banco de dados funcionando' });
    } else {
      res.status(500).json({ status: 'ERROR', message: 'Erro na conexão com banco de dados' });
    }
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Erro na conexão com banco de dados' });
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
console.log(`API disponível em ${process.env.NODE_ENV === 'production' ? process.env.BACKEND_URL : `http://localhost:${PORT}`}/api`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Configurar timeout para produção
if (process.env.NODE_ENV === 'production') {
  server.timeout = 30000; // 30 segundos
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Encerrando servidor...');
  await closeConnection();
  process.exit(0);
});