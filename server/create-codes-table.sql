-- Criar tabela para armazenar códigos CSS, HTML e JavaScript
CREATE TABLE IF NOT EXISTS codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code_type ENUM('css', 'html', 'javascript') NOT NULL,
  code_content TEXT NOT NULL,
  description TEXT,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_name (name),
  INDEX idx_code_type (code_type),
  INDEX idx_user_id (user_id)
);

-- Inserir alguns códigos de exemplo
INSERT INTO codes (name, code_type, code_content, description) VALUES
('Reset CSS', 'css', '* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}', 'Reset básico de CSS para remover margens e paddings padrão'),
('Flexbox Center', 'css', '.center {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n}', 'Centralizar elemento usando Flexbox'),
('Modal HTML', 'html', '<div class="modal">\n  <div class="modal-content">\n    <span class="close">&times;</span>\n    <h2>Título do Modal</h2>\n    <p>Conteúdo do modal aqui...</p>\n  </div>\n</div>', 'Estrutura básica de um modal em HTML'),
('Toggle Class', 'javascript', 'function toggleClass(element, className) {\n  if (element.classList.contains(className)) {\n    element.classList.remove(className);\n  } else {\n    element.classList.add(className);\n  }\n}', 'Função para alternar classe CSS em um elemento'),
('Fetch API', 'javascript', 'async function fetchData(url) {\n  try {\n    const response = await fetch(url);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error("Erro:", error);\n  }\n}', 'Função para fazer requisições HTTP usando Fetch API');