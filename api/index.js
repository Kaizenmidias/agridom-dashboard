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
      return sendResponse(200, { 
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
            return sendResponse(401, {
              success: false,
              message: 'Credenciais inválidas'
            });
          }

          // Verificar senha
          const isValidPassword = await bcrypt.compare(password, user.password);
          
          if (!isValidPassword) {
            return sendResponse(401, {
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

    // Função utilitária para calcular despesas de um mês específico
    function calculateMonthlyExpenses(expenses, year, month) {
      if (!expenses || expenses.length === 0) return 0;
      
      return expenses.reduce((sum, expense) => {
        const billingType = expense.billing_type || 'unica';
        let monthlyValue = 0;
        
        if (billingType === 'mensal') {
          // Para despesas mensais, usar monthly_value se disponível, senão amount
          monthlyValue = parseFloat(expense.monthly_value) || parseFloat(expense.amount) || 0;
        } else if (billingType === 'semanal') {
          // Calcular quantas vezes o dia da semana da despesa ocorre no mês específico
          // Usar UTC para evitar problemas de fuso horário
          const expenseDate = new Date(expense.date + 'T12:00:00.000Z');
          const targetDayOfWeek = expenseDate.getUTCDay(); // 0 = domingo, 1 = segunda, etc.
          
          // Calcular ocorrências do dia da semana no mês específico
          const daysInMonth = new Date(year, month, 0).getDate();
          let occurrences = 0;
          
          for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // month - 1 porque Date usa 0-11
            if (currentDate.getUTCDay() === targetDayOfWeek) {
              occurrences++;
            }
          }
          
          monthlyValue = (parseFloat(expense.amount) || 0) * occurrences;
        } else if (billingType === 'anual') {
          // Para despesas anuais, dividir por 12 para obter valor mensal
          monthlyValue = (parseFloat(expense.amount) || 0) / 12;
        } else {
          // Para despesas únicas, verificar se a despesa pertence ao mês específico
          const expenseDate = new Date(expense.date);
          const expenseYear = expenseDate.getFullYear();
          const expenseMonth = expenseDate.getMonth() + 1; // +1 porque getMonth() retorna 0-11
          
          if (expenseYear === year && expenseMonth === month) {
            monthlyValue = parseFloat(expense.amount) || 0;
          } else {
            monthlyValue = 0;
          }
        }
        
        return sum + monthlyValue;
      }, 0);
    }

    // Função para calcular despesas anuais (soma dos 12 meses)
    function calculateAnnualExpenses(expenses, year) {
      let totalAnnual = 0;
      
      for (let month = 1; month <= 12; month++) {
        totalAnnual += calculateMonthlyExpenses(expenses, year, month);
      }
      
      return totalAnnual;
    }

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
            faturamento: 0,
            aReceber: 0,
            despesas: 0,
            lucro: 0
          });
        }
        
        // Buscar o ID numérico do usuário baseado no email
        let numericUserId;
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', decoded.email)
            .single();
            
          if (userError || !userData) {
            console.error('❌ [API] Erro ao buscar usuário:', userError);
            // Fallback para tentar buscar pelo ID se for numérico
            if (!isNaN(decoded.userId)) {
              numericUserId = parseInt(decoded.userId);
            } else {
              return sendResponse(404, {
                success: false,
                error: 'Usuário não encontrado'
              });
            }
          } else {
            numericUserId = userData.id;
          }
        } catch (err) {
          console.error('❌ [API] Erro na consulta de usuário:', err);
          // Fallback se falhar
          numericUserId = 25; // ID padrão do Ricardo como última opção
        }
        
        // Parse dos query params para filtros de data
        const url = new URL(req.url, `http://${req.headers.host}`);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        
        // Determinar o período para despesas
        let period = 'monthly';
        let year = new Date().getFullYear();
        let month = new Date().getMonth() + 1;
        
        if (startDate && endDate) {
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);
          
          // Detectar filtro anual: mesmo ano e período de janeiro a dezembro
          const isYearlyFilter = startDateObj.getFullYear() === endDateObj.getFullYear() && 
                                startDateObj.getMonth() === 0 && 
                                endDateObj.getMonth() === 11;
          
          if (isYearlyFilter) {
            period = 'annual';
            year = startDateObj.getFullYear();
          } else {
            period = 'monthly';
            year = startDateObj.getFullYear();
            month = startDateObj.getMonth() + 1;
          }
        }
        
        console.log('📊 [API] Dashboard stats - Filtros:', {
          startDate,
          endDate,
          period,
          year,
          month,
          numericUserId
        });
        
        // Buscar TODOS os projetos do usuário (sem filtro de data por enquanto para garantir que pegamos tudo)
        // O filtro de data será aplicado via código para maior flexibilidade
        let projectsQuery = supabase
          .from('projects')
          .select('id, name, project_value, paid_value, status, created_at')
          .eq('user_id', numericUserId);
        
        const { data: projects, error: projectsError } = await projectsQuery;
        
        if (projectsError) {
          console.error('❌ [API] Erro ao buscar projetos:', projectsError);
          return sendResponse(500, { success: false, error: 'Erro ao buscar projetos' });
        }
        
        // Filtrar projetos por data no código se necessário
        let filteredProjects = projects || [];
        if (startDate && endDate) {
          filteredProjects = (projects || []).filter(p => {
            if (!p.created_at) return false;
            try {
              const createdAt = p.created_at.split('T')[0];
              return createdAt >= startDate && createdAt <= endDate;
            } catch (e) {
              return false;
            }
          });
        }
        
        console.log(`📊 [API] Projetos filtrados (${filteredProjects.length}/${projects?.length || 0})`);
        
        // Buscar todas as despesas do usuário
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('id, description, amount, billing_type, date, monthly_value')
          .eq('user_id', numericUserId);
        
        if (expensesError) {
          console.error('❌ [API] Erro ao buscar despesas:', expensesError);
        }
        
        const safeExpenses = expenses || [];
        
        // Calcular faturamento (soma de paid_value) e aReceber (soma de project_value - paid_value)
        const faturamento = filteredProjects.reduce((sum, p) => sum + (parseFloat(p.paid_value) || 0), 0);
        const aReceber = filteredProjects.reduce((sum, p) => {
          const projectVal = parseFloat(p.project_value) || 0;
          const paidVal = parseFloat(p.paid_value) || 0;
          const diff = projectVal - paidVal;
          return sum + (diff > 0 ? diff : 0);
        }, 0);
        
        // Calcular despesas do período com proteção contra erros
        let despesas = 0;
        try {
          if (period === 'annual') {
            despesas = calculateAnnualExpenses(safeExpenses, parseInt(year));
          } else {
            despesas = calculateMonthlyExpenses(safeExpenses, parseInt(year), parseInt(month));
          }
        } catch (calcError) {
          console.error('❌ [API] Erro no cálculo de despesas:', calcError);
          despesas = 0;
        }
        
        const lucro = faturamento - despesas;
        
        console.log('📈 [API] Resultado:', { faturamento, aReceber, despesas, lucro });
        
        return sendResponse(200, {
          faturamento,
          aReceber,
          despesas,
          lucro,
          total_projects: filteredProjects.length,
          active_projects: filteredProjects.filter(p => p.status === 'active').length,
          completed_projects: filteredProjects.filter(p => p.status === 'completed').length,
          paused_projects: filteredProjects.filter(p => p.status === 'paused').length
        });
        
      } catch (error) {
        console.error('❌ [API] Erro fatal:', error);
        return sendResponse(401, { success: false, error: error.message });
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