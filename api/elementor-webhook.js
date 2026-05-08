import { createClient } from '@supabase/supabase-client'

// Configurações do Supabase extraídas do ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qwbpruywwfjadkudegcj.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // Permitir apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Apenas método POST é permitido' })
  }

  try {
    const formData = req.body;
    
    // Mapeamento dos campos do Elementor para o Banco de Dados
    // O Elementor envia os campos com os IDs definidos no formulário
    const briefingData = {
      title: formData.title || formData.subject || 'Novo Briefing via Site',
      client_name: formData.name || formData.client_name || 'Cliente não identificado',
      content: formData.message || formData.content || JSON.stringify(formData),
      status: 'new',
      priority: 'medium',
      user_id: 25 // ID padrão do Ricardo
    }

    const { data, error } = await supabase
      .from('briefings')
      .insert([briefingData])
      .select()

    if (error) {
      console.error('Erro ao gravar no Supabase:', error)
      return res.status(500).json({ success: false, error: error.message })
    }

    return res.status(200).json({ success: true, message: 'Briefing criado com sucesso', data })
  } catch (error) {
    console.error('Erro no processamento do Webhook:', error)
    return res.status(500).json({ success: false, message: 'Erro interno no servidor' })
  }
}
