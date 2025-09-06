import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
console.log('🔍 [DEBUG] Configuração Supabase:', {
  url: supabaseUrl ? 'Presente' : 'Ausente',
  key: supabaseKey ? 'Presente' : 'Ausente'
});
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  console.log('🔍 [DEBUG] Handler chamado:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Middleware para parsing do body JSON no Vercel
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body && req.headers['content-type']?.includes('application/json')) {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          req.body = JSON.parse(body);
        } catch (e) {
          req.body = {};
        }
      });
      // Aguardar o parsing do body
      await new Promise(resolve => {
        req.on('end', resolve);
      });
    }
  }

  const { url } = req;
  
  if (url.includes('/api/simple-test')) {
    return res.json({ 
      message: 'Teste simples funcionando', 
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  }
  
  // Teste de login simples
  if (url.includes('/api/test-login')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }
    
    try {
      console.log('🧪 [TEST-LOGIN] Headers:', req.headers);
      console.log('🧪 [TEST-LOGIN] Body type:', typeof req.body);
      console.log('🧪 [TEST-LOGIN] Body:', req.body);
      
      return res.json({ 
        message: 'Teste de login funcionando',
        bodyReceived: req.body,
        bodyType: typeof req.body,
        headers: req.headers
      });
    } catch (error) {
      console.error('🧪 [TEST-LOGIN] Erro:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  if (url.includes('/api/testdb')) {
    try {
      // Buscar todos os usuários ativos
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, name, role, is_active')
        .eq('is_active', true);

      if (error) {
        return res.status(500).json({ 
          error: 'Erro ao consultar banco de dados',
          details: error.message 
        });
      }

      return res.json({ 
        message: 'Conexão com banco OK',
        users: users || [],
        count: users ? users.length : 0
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Erro interno',
        details: error.message 
      });
    }
  }
  
  if (url.includes('/api/reset-admin-password')) {
    try {
      // Resetar senha do admin para 'admin123'
      const newPassword = 'admin123';
      const hashedPassword = crypto.createHash('sha256').update(newPassword + 'agridom_salt').digest('hex');
      
      const { data, error } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('email', 'agenciakaizendesign@gmail.com')
        .select();

      if (error) {
        return res.status(500).json({ 
          error: 'Erro ao atualizar senha',
          details: error.message 
        });
      }

      return res.json({ 
        message: 'Senha do admin resetada para admin123',
        updated: data
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Erro interno',
        details: error.message 
      });
    }
  }
  
  if (url.includes('/api/auth/login') || url.includes('/auth/login') || url.includes('/api/login')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      console.log('🔍 [LOGIN] Iniciando processo de login');
      console.log('🔍 [LOGIN] Headers:', req.headers);
      console.log('🔍 [LOGIN] Tipo do body:', typeof req.body);
      console.log('🔍 [LOGIN] Body raw:', req.body);
      
      // Teste simples primeiro
      if (!req.body) {
        console.log('❌ [LOGIN] Body está vazio ou undefined');
        return res.status(400).json({ error: 'Body da requisição está vazio' });
      }
      
      // Parse do body da requisição
      let body;
      if (typeof req.body === 'string') {
        console.log('🔍 [LOGIN] Fazendo parse do body string');
        try {
          body = JSON.parse(req.body);
        } catch (parseError) {
          console.log('❌ [LOGIN] Erro ao fazer parse do JSON:', parseError.message);
          return res.status(400).json({ error: 'JSON inválido' });
        }
      } else {
        console.log('🔍 [LOGIN] Body já é objeto');
        body = req.body;
      }
      
      console.log('🔍 [LOGIN] Body parseado:', body);
      const { email, password } = body;
      console.log('🔍 [LOGIN] Email extraído:', email);
      console.log('🔍 [LOGIN] Password presente:', !!password);

      if (!email || !password) {
        console.log('🔍 [LOGIN] Email ou senha ausentes');
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      // Buscar usuário no Supabase - tentar profiles primeiro, depois users
      console.log('🔍 [LOGIN] Tentando buscar usuário:', email);
      
      let user = null;
      let queryError = null;
      
      // Tentar buscar na tabela profiles primeiro
      const { data: profileUser, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();
      
      if (profileUser && !profileError) {
        console.log('🔍 [LOGIN] Usuário encontrado na tabela profiles');
        user = profileUser;
      } else {
        console.log('🔍 [LOGIN] Erro na tabela profiles:', profileError?.message || 'Usuário não encontrado');
        
        // Se não encontrou em profiles, tentar na tabela users
        const { data: usersUser, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .eq('is_active', true)
          .single();
        
        if (usersUser && !usersError) {
          console.log('🔍 [LOGIN] Usuário encontrado na tabela users');
          user = usersUser;
        } else {
          console.log('🔍 [LOGIN] Erro na tabela users:', usersError?.message || 'Usuário não encontrado');
          queryError = usersError;
        }
      }

      if (queryError || !user) {
        console.log('🔍 [LOGIN] Credenciais inválidas - usuário não encontrado');
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      // Verificar senha
      const hashedPassword = crypto.createHash('sha256').update(password + 'agridom_salt').digest('hex');
      if (hashedPassword !== user.password) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      // Gerar token JWT
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // Retornar dados do usuário
      const authUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        permissions: {
          can_access_dashboard: user.can_access_dashboard,
          can_access_projects: user.can_access_projects,
          can_access_briefings: user.can_access_briefings,
          can_access_codes: user.can_access_codes,
          can_access_expenses: user.can_access_expenses,
          can_access_crm: user.can_access_crm,
          can_access_users: user.can_access_users
        }
      };

      console.log('🔍 [LOGIN] Login realizado com sucesso para:', email);
      return res.json({ 
        message: 'Login realizado com sucesso',
        user: authUser, 
        token 
      });
    } catch (error) {
      console.error('❌ [LOGIN] Erro no processo de login:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message,
        errorName: error.name
      });
    }
  }
  
  if (url.includes('/api/auth/verify') || url.includes('/auth/verify')) {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido' });
      }

      const token = authHeader.substring(7);
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      
      // Verificar e decodificar o token
      const decoded = jwt.verify(token, jwtSecret);
      
      // Buscar dados atualizados do usuário no banco - tentar profiles primeiro, depois users
      console.log('🔍 [VERIFY] Tentando buscar usuário:', decoded.userId);
      
      let user = null;
      let queryError = null;
      
      // Tentar buscar na tabela profiles primeiro
      const { data: profileUser, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', decoded.userId)
        .eq('is_active', true)
        .single();
      
      if (profileUser && !profileError) {
        console.log('🔍 [VERIFY] Usuário encontrado na tabela profiles');
        user = profileUser;
      } else {
        console.log('🔍 [VERIFY] Erro na tabela profiles:', profileError?.message || 'Usuário não encontrado');
        
        // Se não encontrou em profiles, tentar na tabela users
        const { data: usersUser, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('id', decoded.userId)
          .eq('is_active', true)
          .single();
        
        if (usersUser && !usersError) {
          console.log('🔍 [VERIFY] Usuário encontrado na tabela users');
          user = usersUser;
        } else {
          console.log('🔍 [VERIFY] Erro na tabela users:', usersError?.message || 'Usuário não encontrado');
          queryError = usersError;
        }
      }

      if (queryError || !user) {
        console.log('🔍 [VERIFY] Usuário não encontrado ou inativo');
        return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
      }

      // Retornar dados atualizados do usuário
      const authUser = {
        id: user.id,
        email: user.email,
        full_name: user.name,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        is_admin: user.is_admin || false,
        position: user.position,
        bio: user.bio,
        can_access_dashboard: user.can_access_dashboard,
        can_access_projects: user.can_access_projects,
        can_access_briefings: user.can_access_briefings,
        can_access_codes: user.can_access_codes,
        can_access_expenses: user.can_access_expenses,
        can_access_crm: user.can_access_crm,
        can_access_users: user.can_access_users
      };

      return res.json(authUser);
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }
  
  // Rota para projetos
  if (url.includes('/api/projects') || url.includes('/projects')) {
    try {
      // Verificar autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido' });
      }

      const token = authHeader.substring(7);
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      const decoded = jwt.verify(token, jwtSecret);
      
      // GET - Listar projetos
      if (req.method === 'GET') {
        const { data: projects, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', decoded.userId)
          .order('created_at', { ascending: false });

        if (error) {
          return res.status(500).json({ error: 'Erro ao buscar projetos', details: error.message });
        }

        return res.json(projects || []);
      }
      
      // POST - Criar projeto
      if (req.method === 'POST') {
        const { name, client, project_type, status, description, project_value, paid_value, delivery_date } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Nome do projeto é obrigatório' });
        }
        
        const projectData = {
          user_id: decoded.userId,
          name,
          client: client || null,
          project_type: project_type || 'website',
          status: status || 'active',
          description: description || null,
          project_value: project_value ? parseFloat(project_value) : null,
          paid_value: paid_value ? parseFloat(paid_value) : 0,
          delivery_date: delivery_date || null
        };
        
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single();
          
        if (error) {
          return res.status(500).json({ error: 'Erro ao criar projeto', details: error.message });
        }
        
        return res.status(201).json(data);
      }
      
      // PUT - Atualizar projeto
      if (req.method === 'PUT') {
        const projectId = req.query.id || req.body.id;
        if (!projectId) {
          return res.status(400).json({ error: 'ID do projeto é obrigatório' });
        }
        
        const { name, client, project_type, status, description, project_value, paid_value, delivery_date, completion_date } = req.body;
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (client !== undefined) updateData.client = client;
        if (project_type !== undefined) updateData.project_type = project_type;
        if (status !== undefined) updateData.status = status;
        if (description !== undefined) updateData.description = description;
        if (project_value !== undefined) updateData.project_value = project_value ? parseFloat(project_value) : null;
        if (paid_value !== undefined) updateData.paid_value = paid_value ? parseFloat(paid_value) : 0;
        if (delivery_date !== undefined) updateData.delivery_date = delivery_date;
        if (completion_date !== undefined) updateData.completion_date = completion_date;
        updateData.updated_at = new Date().toISOString();
        
        const { data, error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId)
          .eq('user_id', decoded.userId)
          .select()
          .single();
          
        if (error) {
          return res.status(500).json({ error: 'Erro ao atualizar projeto', details: error.message });
        }
        
        if (!data) {
          return res.status(404).json({ error: 'Projeto não encontrado' });
        }
        
        return res.json(data);
      }
      
      // DELETE - Deletar projeto
      if (req.method === 'DELETE') {
        const projectId = req.query.id || req.body.id;
        if (!projectId) {
          return res.status(400).json({ error: 'ID do projeto é obrigatório' });
        }
        
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId)
          .eq('user_id', decoded.userId);
          
        if (error) {
          return res.status(500).json({ error: 'Erro ao deletar projeto', details: error.message });
        }
        
        return res.json({ message: 'Projeto deletado com sucesso' });
      }
      
      return res.status(405).json({ error: 'Método não permitido' });
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }
  
  // Rota para despesas (expenses)
  if (url.includes('/api/expenses') || url.includes('/expenses')) {
    console.log('=== DEBUG EXPENSES ROUTE ===');
    console.log('Method:', req.method);
    console.log('URL:', url);
    console.log('Body:', req.body);
    
    try {
      // Verificar autenticação
      const authHeader = req.headers.authorization;
      console.log('Auth header present:', !!authHeader);
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Missing or invalid auth header');
        return res.status(401).json({ error: 'Token de acesso requerido' });
      }

      const token = authHeader.substring(7);
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      
      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
        console.log('Token decoded successfully, userId:', decoded.userId);
      } catch (jwtError) {
        console.log('Token verification failed:', jwtError.message);
        return res.status(401).json({ error: 'Token inválido' });
      }
      
      const userId = decoded.userId;

      if (req.method === 'GET') {
        console.log('Processing GET request for expenses');
        // Listar despesas do usuário
        const { data, error } = await supabase
          .from('expenses')
          .select(`
            id, description, value, category, date, billing_type, 
            project_id, user_id, notes, created_at, updated_at,
            projects(name)
          `)
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (error) {
          console.log('GET expenses error:', error);
          return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }

        console.log('GET expenses success, count:', data?.length || 0);
        return res.json(data || []);
      }

      if (req.method === 'POST') {
        console.log('Processing POST request for expenses');
        console.log('POST /api/expenses - Body recebido:', JSON.stringify(req.body));
        
        const { description, value, amount, category, date, billing_type, project_id, notes } = req.body;
        
        // Aceitar tanto 'value' quanto 'amount'
        const expenseValue = value !== undefined ? value : amount;
        
        console.log('POST /api/expenses - Campos extraídos:', {
          description, value, amount, expenseValue, category, date, billing_type, project_id, notes
        });

        // Validação básica
        if (!description || expenseValue === undefined || expenseValue === null || !category || !date) {
          console.log('POST /api/expenses - Erro de validação:', {
            description: !!description,
            expenseValue: expenseValue,
            category: !!category,
            date: !!date
          });
          return res.status(400).json({ 
            error: 'Campos obrigatórios: description, value/amount, category, date',
            received: { description: !!description, expenseValue: expenseValue, category: !!category, date: !!date }
          });
        }
        
        // Validar valor numérico
        const numericValue = parseFloat(expenseValue);
        if (isNaN(numericValue) || numericValue <= 0) {
          console.log('Invalid value:', value);
          return res.status(400).json({ error: 'Valor deve ser um número positivo' });
        }
        
        // Validar billing_type
        const validBillingTypes = ['unica', 'semanal', 'mensal', 'anual'];
        if (billing_type && !validBillingTypes.includes(billing_type)) {
          console.log('Invalid billing_type:', billing_type, 'Valid types:', validBillingTypes);
          return res.status(400).json({ 
            error: 'Tipo de cobrança inválido', 
            validTypes: validBillingTypes,
            received: billing_type
          });
        }
        
        console.log('POST /api/expenses - Validação passou, userId:', userId);

        const expenseData = {
          description: description.trim(),
          value: numericValue,
          category: category.trim(),
          date,
          billing_type: billing_type || 'unica',
          project_id: project_id || null,
          user_id: userId,
          notes: notes || null
        };
        
        console.log('Inserting expense data:', JSON.stringify(expenseData));

        const { data, error } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select()
          .single();

        if (error) {
          console.log('Supabase error:', error);
          return res.status(500).json({ error: 'Erro ao criar despesa', details: error.message });
        }

        console.log('Expense created successfully:', data);
        return res.status(201).json(data);
      }

      if (req.method === 'PUT') {
        // Atualizar despesa
        const expenseId = req.query.id || req.body.id;
        if (!expenseId) {
          return res.status(400).json({ error: 'ID da despesa é obrigatório' });
        }

        const { description, value, category, date, billing_type, notes } = req.body;
        const updateData = {};

        if (description !== undefined) updateData.description = description;
        if (value !== undefined) updateData.value = parseFloat(value);
        if (category !== undefined) updateData.category = category;
        if (date !== undefined) updateData.date = date;
        if (billing_type !== undefined) updateData.billing_type = billing_type;
        if (notes !== undefined) updateData.notes = notes;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('expenses')
          .update(updateData)
          .eq('id', expenseId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: 'Erro ao atualizar despesa', details: error.message });
        }

        if (!data) {
          return res.status(404).json({ error: 'Despesa não encontrada' });
        }

        return res.json(data);
      }

      if (req.method === 'DELETE') {
        console.log('Processing DELETE request for expenses');
        // Deletar despesa - extrair ID da URL
        let expenseId = req.query.id || req.body.id;
        
        // Se não encontrou o ID nos query params ou body, extrair da URL
        if (!expenseId) {
          const urlParts = url.split('/');
          const expensesIndex = urlParts.findIndex(part => part === 'expenses');
          if (expensesIndex !== -1 && urlParts[expensesIndex + 1]) {
            expenseId = urlParts[expensesIndex + 1];
          }
        }
        
        console.log('Expense ID to delete:', expenseId);
        console.log('URL:', url);
        console.log('Query params:', req.query);
        console.log('Body:', req.body);
        
        if (!expenseId) {
          console.log('Missing expense ID');
          return res.status(400).json({ error: 'ID da despesa é obrigatório' });
        }

        console.log('Deleting expense with ID:', expenseId, 'for user:', userId);
        const { data, error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId)
          .eq('user_id', userId)
          .select();

        if (error) {
          console.log('Delete error:', error);
          return res.status(500).json({ error: 'Erro ao deletar despesa', details: error.message });
        }

        if (!data || data.length === 0) {
          console.log('No expense found to delete');
          return res.status(404).json({ error: 'Despesa não encontrada ou não pertence ao usuário' });
        }

        console.log('Expense deleted successfully:', data);
        return res.json({ message: 'Despesa deletada com sucesso', deleted: data[0] });
      }

      return res.status(405).json({ error: 'Método não permitido' });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
  }
  
  // Rota para códigos (codes)
  if (url.includes('/api/codes') || url.includes('/codes')) {
    try {
      // Verificar autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
      }

      const token = authHeader.substring(7);
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      const decoded = jwt.verify(token, jwtSecret);
      
      const userId = decoded.userId;

      if (req.method === 'GET') {
        // Listar códigos do usuário
        const { data, error } = await supabase
          .from('codes')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }

        return res.json(data || []);
      }

      if (req.method === 'POST') {
        // Criar novo código
        console.log('POST /api/codes - Body:', req.body);
        console.log('POST /api/codes - UserId:', userId);
        
        const { title, language, code_content, description } = req.body;

        // Validação básica
        if (!title || !language || !code_content) {
          console.log('Validação falhou - campos obrigatórios');
          return res.status(400).json({ error: 'Campos obrigatórios: title, language, code_content' });
        }

        // Validar linguagem
        const validLanguages = ['css', 'html', 'javascript'];
        if (!validLanguages.includes(language)) {
          console.log('Validação falhou - linguagem inválida:', language);
          return res.status(400).json({ error: 'Linguagem deve ser: css, html ou javascript' });
        }

        const codeData = {
          title,
          language,
          code_content,
          description: description || null,
          user_id: userId
        };
        
        console.log('Dados para inserir:', codeData);

        const { data, error } = await supabase
          .from('codes')
          .insert(codeData)
          .select()
          .single();

        if (error) {
          console.log('Erro do Supabase:', error);
          return res.status(500).json({ error: 'Erro ao criar código', details: error.message });
        }
        
        console.log('Código criado com sucesso:', data);

        return res.status(201).json(data);
      }

      if (req.method === 'PUT') {
        // Atualizar código
        const codeId = req.query.id || req.body.id;
        if (!codeId) {
          return res.status(400).json({ error: 'ID do código é obrigatório' });
        }

        const { title, language, code_content, description } = req.body;
        const updateData = {};

        if (title !== undefined) updateData.title = title;
        if (language !== undefined) {
          const validLanguages = ['css', 'html', 'javascript'];
          if (!validLanguages.includes(language)) {
            return res.status(400).json({ error: 'Linguagem deve ser: css, html ou javascript' });
          }
          updateData.language = language;
        }
        if (code_content !== undefined) updateData.code_content = code_content;
        if (description !== undefined) updateData.description = description;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('codes')
          .update(updateData)
          .eq('id', codeId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: 'Erro ao atualizar código', details: error.message });
        }

        if (!data) {
          return res.status(404).json({ error: 'Código não encontrado' });
        }

        return res.json(data);
      }

      if (req.method === 'DELETE') {
        // Deletar código
        const codeId = req.query.id || req.body.id;
        if (!codeId) {
          return res.status(400).json({ error: 'ID do código é obrigatório' });
        }

        const { error } = await supabase
          .from('codes')
          .delete()
          .eq('id', codeId)
          .eq('user_id', userId);

        if (error) {
          return res.status(500).json({ error: 'Erro ao deletar código', details: error.message });
        }

        return res.json({ message: 'Código deletado com sucesso' });
      }

      return res.status(405).json({ error: 'Método não permitido' });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
  }
  
  // Rota para estatísticas do dashboard
  if (url.includes('/api/dashboard/stats') || url.includes('/dashboard/stats')) {
    console.log('🔍 [DEBUG] Rota /api/dashboard/stats acessada');
    try {
      // Verificar autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
      }

      const token = authHeader.substring(7);
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      
      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (jwtError) {
        return res.status(401).json({ error: 'Token inválido' });
      }
      
      const userId = decoded.userId;

      if (req.method === 'GET') {
        // Buscar projetos do usuário
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId);

        if (projectsError) {
          console.log('Erro ao buscar projetos:', projectsError);
          return res.status(500).json({ error: 'Erro ao buscar projetos' });
        }

        // Buscar despesas do usuário
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId);

        if (expensesError) {
          console.log('Erro ao buscar despesas:', expensesError);
          return res.status(500).json({ error: 'Erro ao buscar despesas' });
        }

        // Calcular estatísticas
        const totalRevenue = projects.reduce((sum, project) => sum + (parseFloat(project.project_value) || 0), 0);
        const totalPaid = projects.reduce((sum, project) => sum + (parseFloat(project.paid_value) || 0), 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + (parseFloat(expense.value) || 0), 0);
        const totalReceivable = totalRevenue - totalPaid;
        const totalProfit = totalRevenue - totalExpenses;

        // Calcular receita por mês
        const revenueByMonth = {};
        projects.forEach(project => {
          if (project.created_at) {
            const date = new Date(project.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!revenueByMonth[monthKey]) {
              revenueByMonth[monthKey] = 0;
            }
            revenueByMonth[monthKey] += parseFloat(project.project_value) || 0;
          }
        });

        // Converter para array ordenado
        const revenueByMonthArray = Object.entries(revenueByMonth)
          .map(([month, revenue]) => ({ month, revenue }))
          .sort((a, b) => a.month.localeCompare(b.month));

        // Calcular despesas por categoria
        const expensesByCategory = {};
        expenses.forEach(expense => {
          const category = expense.category || 'Sem categoria';
          if (!expensesByCategory[category]) {
            expensesByCategory[category] = 0;
          }
          expensesByCategory[category] += parseFloat(expense.value) || 0;
        });

        // Converter para array ordenado
        const expensesByCategoryArray = Object.entries(expensesByCategory)
          .map(([category, total_amount]) => ({ category, total_amount }))
          .sort((a, b) => b.total_amount - a.total_amount);

        const stats = {
          projects: {
            total: projects.length,
            active: projects.filter(p => p.status === 'active').length,
            completed: projects.filter(p => p.status === 'completed').length,
            paused: projects.filter(p => p.status === 'paused').length,
            total_value: totalRevenue,
            total_paid: totalPaid
          },
          expenses: {
            total: expenses.length,
            total_amount: totalExpenses
          },
          currentPeriod: {
            revenue: totalRevenue,
            expenses: totalExpenses,
            receivable: totalReceivable,
            profit: totalProfit
          },
          previousPeriod: {
            revenue: 0,
            expenses: totalExpenses,
            receivable: totalReceivable
          },
          current_receivable: totalReceivable,
          revenue_by_month: revenueByMonthArray,
          expenses_by_category: expensesByCategoryArray
        };

        return res.json(stats);
      }

      return res.status(405).json({ error: 'Método não permitido' });
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error);
      return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
  }

  // Rota para usuários
  if (url.includes('/api/users') || url.includes('/users')) {
    console.log('🔍 [DEBUG] Rota /api/users acessada');
    try {
      // Verificar autenticação
      const authHeader = req.headers.authorization;
      console.log('🔍 [DEBUG] Auth header:', authHeader ? 'Presente' : 'Ausente');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ [DEBUG] Token de acesso requerido');
        return res.status(401).json({ error: 'Token de acesso requerido' });
      }

      const token = authHeader.substring(7);
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      console.log('🔍 [DEBUG] JWT Secret:', jwtSecret ? 'Presente' : 'Ausente');
      
      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
        console.log('🔍 [DEBUG] Token decodificado com sucesso, userId:', decoded.userId);
      } catch (jwtError) {
        console.log('❌ [DEBUG] Erro ao decodificar token:', jwtError.message);
        return res.status(401).json({ error: 'Token inválido' });
      }
      
      const userId = decoded.userId;

      if (req.method === 'GET') {
        console.log('🔍 [DEBUG] Método GET - buscando usuários do banco...');
        
        try {
          // Primeiro, verificar se a tabela existe
          console.log('🔍 [DEBUG] Testando conexão com tabela users...');
          
          // Tentar buscar da tabela 'profiles' primeiro, depois 'users'
          let users, usersError;
          
          // Primeiro tentar 'profiles'
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, name, role, created_at')
            .order('created_at', { ascending: false });
            
          if (!profilesError) {
            console.log('✅ Dados encontrados na tabela profiles');
            users = profilesData;
            usersError = null;
          } else {
            console.log('❌ Erro na tabela profiles, tentando users:', profilesError.message);
            // Se falhar, tentar 'users'
            const { data: usersData, error: usersTableError } = await supabase
              .from('users')
              .select('id, email, name, role, created_at')
              .order('created_at', { ascending: false });
              
            users = usersData;
            usersError = usersTableError;
          }

          if (usersError) {
            console.log('❌ Erro detalhado ao buscar usuários:', {
              message: usersError.message,
              details: usersError.details,
              hint: usersError.hint,
              code: usersError.code
            });
            return res.status(500).json({ 
              error: 'Erro ao buscar usuários', 
              details: usersError.message,
              supabaseError: usersError
            });
          }

          console.log('✅ Usuários encontrados:', users?.length || 0);
          return res.json(users || []);
        } catch (catchError) {
          console.log('❌ Erro de exceção no GET users:', catchError);
          return res.status(500).json({ 
            error: 'Erro interno no GET users', 
            details: catchError.message 
          });
        }
      }

      if (req.method === 'PUT') {
        console.log('🔍 [DEBUG] Método PUT - atualizando permissões de usuário...');
        
        // Extrair ID do usuário da URL
        const urlParts = url.split('/');
        const userIdToUpdate = urlParts[urlParts.length - 1];
        
        if (!userIdToUpdate || isNaN(userIdToUpdate)) {
          return res.status(400).json({ error: 'ID do usuário inválido' });
        }
        
        try {
          const body = JSON.parse(req.body);
          const {
            can_access_dashboard,
            can_access_projects,
            can_access_briefings,
            can_access_codes,
            can_access_expenses,
            can_access_crm,
            can_access_users
          } = body;
          
          console.log('🔍 [DEBUG] Atualizando permissões para usuário:', userIdToUpdate);
          console.log('🔍 [DEBUG] Novas permissões:', body);
          
          // Tentar atualizar na tabela 'profiles' primeiro, depois 'users'
          let updateResult, updateError;
          
          // Primeiro tentar 'profiles'
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .update({
              can_access_dashboard,
              can_access_projects,
              can_access_briefings,
              can_access_codes,
              can_access_expenses,
              can_access_crm,
              can_access_users
            })
            .eq('id', userIdToUpdate)
            .select();
            
          if (!profilesError) {
            console.log('✅ Permissões atualizadas na tabela profiles');
            updateResult = profilesData;
            updateError = null;
          } else {
            console.log('❌ Erro na tabela profiles, tentando users:', profilesError.message);
            // Se falhar, tentar 'users'
            const { data: usersData, error: usersTableError } = await supabase
              .from('users')
              .update({
                can_access_dashboard,
                can_access_projects,
                can_access_briefings,
                can_access_codes,
                can_access_expenses,
                can_access_crm,
                can_access_users
              })
              .eq('id', userIdToUpdate)
              .select();
              
            updateResult = usersData;
            updateError = usersTableError;
          }

          if (updateError) {
            console.log('❌ Erro detalhado ao atualizar permissões:', {
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint,
              code: updateError.code
            });
            return res.status(500).json({ 
              error: 'Erro ao atualizar permissões', 
              details: updateError.message,
              supabaseError: updateError
            });
          }

          console.log('✅ Permissões atualizadas com sucesso:', updateResult?.[0]);
          return res.json(updateResult?.[0] || { success: true });
        } catch (catchError) {
          console.log('❌ Erro de exceção no PUT users:', catchError);
          return res.status(500).json({ 
            error: 'Erro interno no PUT users', 
            details: catchError.message 
          });
        }
      }

          console.log('✅ Usuários encontrados:', users?.length || 0);
          return res.json(users || []);
        } catch (catchError) {
          console.log('❌ Erro de exceção no GET users:', catchError);
          return res.status(500).json({ 
            error: 'Erro interno no GET users', 
            details: catchError.message 
          });
        }
      }

      if (req.method === 'POST') {
        console.log('🔍 [DEBUG] Método POST - criando novo usuário...');
        
        try {
          const { name, email, password, role, position } = req.body;
          console.log('🔍 [DEBUG] Dados recebidos:', { name, email, role, position, hasPassword: !!password });
          
          // Validar dados obrigatórios
          if (!name || !email || !password) {
            console.log('❌ Validação falhou - campos obrigatórios');
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
          }
          
          console.log('🔍 [DEBUG] Verificando se email já existe...');
           // Verificar se email já existe - tentar profiles primeiro
           let existingUser, checkError;
           
           const { data: existingProfile, error: profileCheckError } = await supabase
             .from('profiles')
             .select('id')
             .eq('email', email)
             .single();
             
           if (!profileCheckError || profileCheckError.code === 'PGRST116') {
             existingUser = existingProfile;
             checkError = profileCheckError;
           } else {
             console.log('❌ Erro ao verificar profiles, tentando users:', profileCheckError.message);
             const { data: existingUserData, error: userCheckError } = await supabase
               .from('users')
               .select('id')
               .eq('email', email)
               .single();
               
             existingUser = existingUserData;
             checkError = userCheckError;
           }
            
          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.log('❌ Erro ao verificar email existente:', checkError);
            return res.status(500).json({ 
              error: 'Erro ao verificar email', 
              details: checkError.message 
            });
          }
            
          if (existingUser) {
            console.log('❌ Email já existe');
            return res.status(400).json({ error: 'Email já está em uso' });
          }
          
          console.log('🔍 [DEBUG] Gerando hash da senha...');
          // Hash da senha
          const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
          
          const userData = {
            name,
            email,
            password: hashedPassword,
            role: role || 'user'
          };
          
          console.log('🔍 [DEBUG] Inserindo usuário:', { ...userData, password: '[HIDDEN]' });
           
           // Criar usuário - tentar profiles primeiro
           let newUser, createError;
           
           const { data: newProfile, error: profileCreateError } = await supabase
             .from('profiles')
             .insert(userData)
             .select('id, email, name, role, created_at')
             .single();
             
           if (!profileCreateError) {
             console.log('✅ Usuário criado na tabela profiles');
             newUser = newProfile;
             createError = null;
           } else {
             console.log('❌ Erro ao criar em profiles, tentando users:', profileCreateError.message);
             const { data: newUserData, error: userCreateError } = await supabase
               .from('users')
               .insert(userData)
               .select('id, email, name, role, created_at')
               .single();
               
             newUser = newUserData;
             createError = userCreateError;
           }
            
          if (createError) {
            console.log('❌ Erro detalhado ao criar usuário:', {
              message: createError.message,
              details: createError.details,
              hint: createError.hint,
              code: createError.code
            });
            return res.status(500).json({ 
              error: 'Erro ao criar usuário', 
              details: createError.message,
              supabaseError: createError
            });
          }
          
          console.log('✅ Usuário criado com sucesso:', newUser?.id);
          return res.status(201).json(newUser);
        } catch (catchError) {
          console.log('❌ Erro de exceção no POST users:', catchError);
          return res.status(500).json({ 
            error: 'Erro interno no POST users', 
            details: catchError.message 
          });
        }
      }

      return res.status(405).json({ error: 'Método não permitido' });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
  }
  
  return res.status(404).json({ error: 'Rota não encontrada', url: req.url });
}