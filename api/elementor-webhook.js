const { createClient } = require('@supabase/supabase-js')

const allowedOrigins = new Set([
  'https://agridom-dashboard.vercel.app',
  'https://briefing.kaizenmidias.com'
])

module.exports = async function handler(req, res) {
  const origin = req.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://agridom-dashboard.vercel.app')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.statusCode = 200
    return res.end(JSON.stringify({ success: true }))
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    return res.end(JSON.stringify({ success: false, message: 'Apenas método POST é permitido' }))
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const briefingUserId = Number(process.env.SUPABASE_BRIEFING_USER_ID || 0)

    if (!supabaseUrl || !supabaseKey) {
      res.statusCode = 500
      return res.end(JSON.stringify({ success: false, message: 'Supabase não configurado no servidor' }))
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = req.body || {}
    const title = body.title || body.subject || 'Novo Briefing via Site'
    const clientName = body.client_name || body.name || null
    const content = body.content || body.message || (body.Briefing ? String(body.Briefing) : '') || JSON.stringify(body)
    const projectType = body.project_type || null
    const status = body.status || 'new'
    const priority = body.priority || 'medium'
    const userId = Number(body.user_id || briefingUserId || 0) || null
    const fields = body.fields || null
    const subject = body.subject || null

    const richPayload = {
      title,
      content,
      subject,
      client_name: clientName,
      project_type: projectType,
      status,
      priority,
      user_id: userId,
      fields
    }

    let insertResult = await supabase.from('briefings').insert([richPayload]).select().single()

    if (insertResult.error) {
      const minimalPayload = {
        title,
        client: clientName || 'Cliente não identificado',
        description: content,
        status: ['pending', 'in_progress', 'completed', 'cancelled'].includes(status) ? status : 'pending',
        priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
        user_id: userId || 1
      }

      insertResult = await supabase.from('briefings').insert([minimalPayload]).select().single()
    }

    if (insertResult.error) {
      res.statusCode = 500
      return res.end(JSON.stringify({ success: false, error: insertResult.error.message }))
    }

    res.statusCode = 200
    return res.end(JSON.stringify({ success: true, message: 'Briefing criado com sucesso', data: insertResult.data }))
  } catch (error) {
    res.statusCode = 500
    return res.end(JSON.stringify({ success: false, message: error?.message || 'Erro interno no servidor' }))
  }
}
