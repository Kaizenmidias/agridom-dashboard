// API para produção com Supabase
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = async function handler(req, res) {
  // Garantir que sempre retornamos JSON válido
  const sendResponse = (statusCode, data) => {
    try {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      const jsonString = JSON.stringify(data);
      console.log(`📤 [API] Response ${statusCode}:`, jsonString.substring(0, 200));
      return res.end(jsonString);
    } catch (error) {
      console.error('🚨 [API] Erro ao serializar resposta:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: false,
        message: 'Erro interno do servidor',
        error: 'Falha na serialização da resposta'
      }));
    }
  };

  try {
    // Configuração CORS melhorada
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://agridom-dashboard.vercel.app',
      'http://localhost:8081',
      'http://localhost:8080',
      'http://localhost:3000',
      'http://127.0.0.1:8081'
    ];
    
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://agridom-dashboard.vercel.app');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
        return sendResponse(200, { success: true, message: 'CORS preflight' });
      }

    console.log('🔍 [API] Request received:', req.method, req.url);
    console.log('🔍 [API] Headers:', {
      origin: req.headers.origin,
      'content-type': req.headers['content-type'],
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    });
    console.log('🔍 [API] Environment variables:', {
      NODE_ENV: process.env.NODE_ENV,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasJwtSecret: !!jwtSecret
    });

    // Rota de teste simples
    if (req.url === '/api/test' || req.url === '/api/test-login' || req.url === '/api/test-env') {
      return sendResponse(res, 200, { 
        success: true, 
        message: 'API funcionando!',
        timestamp: new Date().toISOString()
      });
    }

    // Parse do body para POST requests
    let body = {};
    if (req.method === 'POST') {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString();
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch (parseError) {
        console.log('Erro ao fazer parse do body:', parseError);
        body = {};
      }
    }

    // Rota de login com Supabase
    if (req.url === '/api/login' || req.url === '/api/auth/login' || req.url === '/auth/login') {
      if (req.method === 'POST') {
        try {
          const { email, password } = body;
          
          console.log('Login attempt:', { email, hasPassword: !!password });
          
          if (!email || !password) {
            return sendResponse(400, {
              success: false,
              message: 'Email e senha são obrigatórios',
              received: { email: !!email, password: !!password }
            });
          }

          if (!supabase) {
            // Fallback para credenciais de desenvolvimento
            const validCredentials = [
              { email: 'agenciakaizendesign@gmail.com', password: '123456' },
              { email: 'test@test.com', password: 'test123' },
              { email: 'admin@agridom.com', password: 'admin123' }
            ];

            const validUser = validCredentials.find(cred => 
              cred.email === email && cred.password === password
            );

            if (validUser) {
              const token = jwt.sign(
                { 
                  userId: 'fallback-user-id',
                  email: email,
                  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
                },
                jwtSecret
              );

              return sendResponse(200, {
                success: true,
                token: token,
                user: {
                  id: 'fallback-user-id',
                  email: email,
                  name: email === 'agenciakaizendesign@gmail.com' ? 'Admin Kaizen' : 'Usuário Teste'
                }
              });
            }

            return sendResponse(401, {
              success: false,
              message: 'Credenciais inválidas'
            });
          }

          // Buscar usuário no Supabase
          const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1);

          if (userError) {
            console.error('Erro ao buscar usuário:', userError);
            return sendResponse(500, {
              success: false,
              message: 'Erro interno do servidor'
            });
          }

          const user = users && users.length > 0 ? users[0] : null;

          if (!user) {
            return sendResponse(res, 401, {
              success: false,
              message: 'Credenciais inválidas'
            });
          }

          // Verificar senha
          const isValidPassword = await bcrypt.compare(password, user.password);
          
          if (!isValidPassword) {
            return sendResponse(res, 401, {
              success: false,
              message: 'Credenciais inválidas'
            });
          }

          // Gerar token JWT
          const token = jwt.sign(
            { 
              userId: user.id,
              email: user.email,
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
            },
            jwtSecret
          );

          return sendResponse(200, {
            success: true,
            token: token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name || user.email
            }
          });
        } catch (error) {
          console.error('Erro no login:', error);
          return sendResponse(500, {
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
          });
        }
      }
      return sendResponse(405, { success: false, error: 'Método não permitido' });
    }

    // Rota de registro
    if (req.url === '/api/register' || req.url === '/api/auth/register') {
      if (req.method === 'POST') {
        try {
          const { email, password, name } = body;
          
          if (!email || !password) {
            return sendResponse(400, {
              success: false,
              message: 'Email e senha são obrigatórios'
            });
          }

          if (!supabase) {
            return sendResponse(500, {
              success: false,
              message: 'Serviço indisponível'
            });
          }

          // Verificar se usuário já existe
          const { data: existingUsers } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .limit(1);

          if (existingUsers && existingUsers.length > 0) {
            return sendResponse(400, {
              success: false,
              message: 'Usuário já existe'
            });
          }

          // Hash da senha
          const hashedPassword = await bcrypt.hash(password, 10);

          // Criar usuário
          const { data: newUser, error } = await supabase
            .from('users')
            .insert({
              email,
              password: hashedPassword,
              name: name || email
            })
            .select()
            .single();

          if (error) {
            console.error('Erro ao criar usuário:', error);
            return sendResponse(500, {
              success: false,
              message: 'Erro ao criar usuário'
            });
          }

          return sendResponse(201, {
            success: true,
            user: {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name
            }
          });
        } catch (error) {
          console.error('Erro no registro:', error);
          return sendResponse(500, {
            success: false,
            message: 'Erro interno do servidor'
          });
        }
      }
      return sendResponse(405, { success: false, error: 'Método não permitido' });
    }

    // Rota de mudança de senha
    if (req.url === '/api/change-password' || req.url === '/api/auth/change-password') {
      if (req.method === 'POST') {
        try {
          const decoded = authenticateToken(req);
          const { currentPassword, newPassword } = body;
          
          if (!currentPassword || !newPassword) {
            return sendResponse(400, {
              success: false,
              message: 'Senha atual e nova senha são obrigatórias'
            });
          }

          if (!supabase) {
            return sendResponse(500, {
              success: false,
              message: 'Serviço indisponível'
            });
          }

          // Buscar usuário
          const { data: users } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .limit(1);

          const user = users && users.length > 0 ? users[0] : null;
          if (!user) {
            return sendResponse(404, {
              success: false,
              message: 'Usuário não encontrado'
            });
          }

          // Verificar senha atual
          const isValidPassword = await bcrypt.compare(currentPassword, user.password);
          if (!isValidPassword) {
            return sendResponse(400, {
              success: false,
              message: 'Senha atual incorreta'
            });
          }

          // Hash da nova senha
          const hashedNewPassword = await bcrypt.hash(newPassword, 10);

          // Atualizar senha
          const { error } = await supabase
            .from('users')
            .update({ password: hashedNewPassword })
            .eq('id', decoded.userId);

          if (error) {
            console.error('Erro ao atualizar senha:', error);
            return sendResponse(500, {
              success: false,
              message: 'Erro ao atualizar senha'
            });
          }

          return sendResponse(200, {
            success: true,
            message: 'Senha atualizada com sucesso'
          });
        } catch (error) {
          console.error('Erro na mudança de senha:', error);
          return sendResponse(500, {
            success: false,
            message: 'Erro interno do servidor'
          });
        }
      }
      return sendResponse(405, { success: false, error: 'Método não permitido' });
    }

    // Middleware de autenticação usando Supabase
    const authenticateToken = async (req) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        throw new Error('Token não fornecido');
      }
      
      if (!supabase) {
        throw new Error('Supabase não configurado');
      }
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
          throw new Error('Token inválido ou usuário não encontrado');
        }
        
        return {
          userId: user.id,
          email: user.email,
          user: user
        };
      } catch (error) {
        throw new Error('Token inválido: ' + error.message);
      }
    };

    // Rota de verificação de token
    if (req.url === '/api/verify-token' || req.url === '/auth/verify' || req.url === '/api/auth/verify') {
      try {
        const decoded = await authenticateToken(req);
        return sendResponse(200, { 
          success: true, 
          valid: true,
          user: {
            id: decoded.userId,
            email: decoded.email
          }
        });
      } catch (error) {
        return sendResponse(401, { 
          success: false, 
          valid: false,
          error: error.message 
        });
      }
    }

    // Rota de usuários
    if (req.url === '/users' || req.url === '/api/users') {
      try {
        await authenticateToken(req);
        
        if (!supabase) {
          return sendResponse(200, { 
            success: true, 
            data: [
              {
                id: 'fallback-user-id',
                email: 'agenciakaizendesign@gmail.com',
                name: 'Admin Kaizen',
                created_at: new Date().toISOString()
              }
            ]
          });
        }
        
        const { data: users, error } = await supabase
          .from('users')
          .select('id, email, name, created_at')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Erro ao buscar usuários:', error);
          return sendResponse(500, {
            success: false,
            error: 'Erro ao buscar usuários'
          });
        }
        
        return sendResponse(200, { 
          success: true, 
          data: users || []
        });
      } catch (error) {
        return sendResponse(401, { 
          success: false, 
          error: error.message 
        });
      }
    }

    // Rota de projetos
    if (req.url === '/projects' || req.url === '/api/projects') {
      try {
        const decoded = authenticateToken(req);
        
        if (!supabase) {
          return sendResponse(200, { 
            success: true, 
            data: []
          });
        }
        
        if (req.method === 'GET') {
          console.log('🔍 [API] Buscando projetos para user_id:', decoded.userId);
          
          const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', decoded.userId)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error('Erro ao buscar projetos:', error);
            return sendResponse(500, {
              success: false,
              error: 'Erro ao buscar projetos'
            });
          }
          
          console.log('📊 [API] Projetos encontrados:', projects?.length || 0);
          
          return sendResponse(200, { 
            success: true, 
            data: projects || []
          });
        }
        
        if (req.method === 'POST') {
          console.log('➕ [API] Criando novo projeto para user_id:', decoded.userId);
          console.log('📝 [API] Dados do projeto:', body);
          
          const projectData = {
            ...body,
            user_id: decoded.userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { data: newProject, error } = await supabase
            .from('projects')
            .insert([projectData])
            .select();
            
          if (error) {
            console.error('Erro ao criar projeto:', error);
            return sendResponse(500, {
              success: false,
              error: 'Erro ao criar projeto'
            });
          }
          
          console.log('✅ [API] Projeto criado:', newProject);
          
          return sendResponse(201, { 
            success: true, 
            data: newProject[0]
          });
        }
        
      } catch (error) {
        return sendResponse(401, { 
          success: false, 
          error: error.message 
        });
      }
    }

    // Rota de despesas
    if (req.url === '/expenses' || req.url === '/api/expenses') {
      try {
        const decoded = authenticateToken(req);
        
        if (!supabase) {
          return sendResponse(200, { 
            success: true, 
            data: []
          });
        }
        
        if (req.method === 'GET') {
          console.log('🔍 [API] Buscando despesas para user_id:', decoded.userId);
          
          const { data: expenses, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', decoded.userId)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error('Erro ao buscar despesas:', error);
            return sendResponse(500, {
              success: false,
              error: 'Erro ao buscar despesas'
            });
          }
          
          console.log('📊 [API] Despesas encontradas:', expenses?.length || 0);
          
          return sendResponse(200, { 
            success: true, 
            data: expenses || []
          });
        }
        
        if (req.method === 'POST') {
          console.log('➕ [API] Criando nova despesa para user_id:', decoded.userId);
          console.log('📝 [API] Dados da despesa:', body);
          
          const expenseData = {
            ...body,
            user_id: decoded.userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { data: newExpense, error } = await supabase
            .from('expenses')
            .insert([expenseData])
            .select();
            
          if (error) {
            console.error('Erro ao criar despesa:', error);
            return sendResponse(500, {
              success: false,
              error: 'Erro ao criar despesa'
            });
          }
          
          console.log('✅ [API] Despesa criada:', newExpense);
          
          return sendResponse(201, { 
            success: true, 
            data: newExpense[0]
          });
        }
        
      } catch (error) {
        return sendResponse(401, { 
          success: false, 
          error: error.message 
        });
      }
    }

    // Rota de códigos
    if (req.url === '/codes' || req.url === '/api/codes') {
      try {
        const decoded = authenticateToken(req);
        
        if (!supabase) {
          return sendResponse(200, { 
            success: true, 
            data: []
          });
        }
        
        if (req.method === 'GET') {
          console.log('🔍 [API] Buscando códigos para user_id:', decoded.userId);
          
          const { data: codes, error } = await supabase
            .from('codes')
            .select('*')
            .eq('user_id', decoded.userId)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error('Erro ao buscar códigos:', error);
            return sendResponse(500, {
              success: false,
              error: 'Erro ao buscar códigos'
            });
          }
          
          console.log('📊 [API] Códigos encontrados:', codes?.length || 0);
          
          return sendResponse(200, { 
            success: true, 
            data: codes || []
          });
        }
        
        if (req.method === 'POST') {
          console.log('➕ [API] Criando novo código para user_id:', decoded.userId);
          console.log('📝 [API] Dados do código:', body);
          
          const codeData = {
            title: body.title,
            description: body.description,
            code_content: body.code || body.content || body.code_content,
            language: body.language || 'javascript',
            user_id: decoded.userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { data: newCode, error } = await supabase
            .from('codes')
            .insert([codeData])
            .select();
            
          if (error) {
            console.error('Erro ao criar código:', error);
            return sendResponse(500, {
              success: false,
              error: 'Erro ao criar código'
            });
          }
          
          console.log('✅ [API] Código criado:', newCode);
          
          return sendResponse(201, { 
            success: true, 
            data: newCode[0]
          });
        }
      } catch (error) {
        return sendResponse(401, { 
          success: false, 
          error: error.message 
        });
      }
    }

    // Rota de estatísticas do dashboard
    if (req.url === '/dashboard/stats' || req.url === '/api/dashboard/stats' || req.url.startsWith('/api/dashboard/stats?')) {
      try {
        const decoded = await authenticateToken(req);
        
        if (!supabase) {
          return sendResponse(200, {
            success: true,
            data: {
              total_projects: 0,
              total_value: 0,
              total_paid: 0,
              total_receivable: 0,
              active_projects: 0,
              completed_projects: 0,
              total_expenses: 0,
              monthly_expenses: 0,
              current_period: {
                revenue: 0,
                expenses: 0,
                receivable: 0,
                profit: 0,
                total_projects: 0,
                total_project_value: 0
              },
              previous_period: {
                revenue: 0,
                expenses: 0,
                receivable: 0
              },
              revenue_by_month: [],
              expenses_by_category: [],
              recent_projects: []
            }
          });
        }
        
        console.log('📊 [API] Buscando estatísticas do dashboard para user_id:', decoded.userId);
        
        // Buscar projetos do usuário
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', decoded.userId);
          
        if (projectsError) {
          console.error('Erro ao buscar projetos para stats:', projectsError);
          return sendResponse(500, {
            success: false,
            error: 'Erro ao buscar projetos'
          });
        }
        
        // Buscar despesas do usuário
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', decoded.userId);
          
        if (expensesError) {
          console.error('Erro ao buscar despesas para stats:', expensesError);
        }
        
        // Calcular estatísticas
        const totalProjects = projects?.length || 0;
        const totalValue = projects?.reduce((sum, p) => sum + (parseFloat(p.project_value) || 0), 0) || 0;
        const totalPaid = projects?.reduce((sum, p) => sum + (parseFloat(p.paid_value) || 0), 0) || 0;
        const totalReceivable = totalValue - totalPaid;
        
        const activeProjects = projects?.filter(p => p.status === 'active')?.length || 0;
        const completedProjects = projects?.filter(p => p.status === 'completed')?.length || 0;
        
        const totalExpenses = expenses?.reduce((sum, e) => sum + (parseFloat(e.amount) || parseFloat(e.value) || 0), 0) || 0;
        
        // Calcular despesas do mês atual
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyExpenses = expenses?.filter(e => {
          const expenseDate = new Date(e.date || e.expense_date);
          return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        })?.reduce((sum, e) => sum + (parseFloat(e.amount) || parseFloat(e.value) || 0), 0) || 0;
        
        // Projetos recentes (últimos 5)
        const recentProjects = projects?.slice(0, 5) || [];
        
        const stats = {
          total_projects: totalProjects,
          total_value: totalValue,
          total_paid: totalPaid,
          total_receivable: totalReceivable,
          active_projects: activeProjects,
          completed_projects: completedProjects,
          total_expenses: totalExpenses,
          monthly_expenses: monthlyExpenses,
          current_period: {
            revenue: totalPaid,
            expenses: monthlyExpenses,
            receivable: totalReceivable,
            profit: totalPaid - monthlyExpenses,
            total_projects: totalProjects,
            total_project_value: totalValue
          },
          previous_period: {
            revenue: 0,
            expenses: 0,
            receivable: 0
          },
          revenue_by_month: [],
          expenses_by_category: [],
          recent_projects: recentProjects
        };
        
        console.log('📊 [API] Estatísticas calculadas:', stats);
        
        return sendResponse(200, {
          success: true,
          data: stats
        });
        
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return sendResponse(401, {
          success: false,
          error: error.message
        });
      }
    }
    
    return sendResponse(404, { 
      error: 'Rota não encontrada',
      url: req.url,
      method: req.method
    });
    
  } catch (globalError) {
    console.error('🚨 [API] Erro global:', globalError);
    return sendResponse(500, {
      success: false,
      message: 'Erro interno do servidor',
      error: globalError.message,
      stack: process.env.NODE_ENV === 'development' ? globalError.stack : undefined
    });
  }
};