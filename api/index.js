import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      // Buscar usuário no Supabase
      const { data: user, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (queryError || !user) {
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

      return res.json({ 
        message: 'Login realizado com sucesso',
        user: authUser, 
        token 
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message
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
      
      // Buscar dados atualizados do usuário no banco
      const { data: user, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .eq('is_active', true)
        .single();

      if (queryError || !user) {
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
          return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }

        return res.json(data || []);
      }

      if (req.method === 'POST') {
        // Criar nova despesa
        const { description, value, category, date, billing_type, project_id, notes } = req.body;

        // Validação básica
        if (!description || !value || !date) {
          return res.status(400).json({ error: 'Campos obrigatórios: description, value, date' });
        }

        const expenseData = {
          description,
          value: parseFloat(value),
          category: category || null,
          date,
          billing_type: billing_type || 'unica',
          project_id: project_id || null,
          user_id: userId,
          notes: notes || null
        };

        const { data, error } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: 'Erro ao criar despesa', details: error.message });
        }

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
        // Deletar despesa
        const expenseId = req.query.id || req.body.id;
        if (!expenseId) {
          return res.status(400).json({ error: 'ID da despesa é obrigatório' });
        }

        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId)
          .eq('user_id', userId);

        if (error) {
          return res.status(500).json({ error: 'Erro ao deletar despesa', details: error.message });
        }

        return res.json({ message: 'Despesa deletada com sucesso' });
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
  
  return res.status(404).json({ error: 'Rota não encontrada', url: req.url });
}