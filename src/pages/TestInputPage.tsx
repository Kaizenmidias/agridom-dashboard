import React, { useState } from 'react';

const TestInputPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    addLog(`Email alterado: "${e.target.value}"`);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    addLog(`Senha alterada: "${'*'.repeat(e.target.value.length)}"`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addLog(`Formulário enviado - Email: "${email}", Senha: "${'*'.repeat(password.length)}"`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🧪 Teste de Input React</h1>
      <p>Este é um teste simples para verificar se os inputs funcionam no React.</p>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="testEmail" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Email:
          </label>
          <input
            type="email"
            id="testEmail"
            value={email}
            onChange={handleEmailChange}
            onClick={() => addLog('Email: Click')}
            onFocus={() => addLog('Email: Focus')}
            onBlur={() => addLog('Email: Blur')}
            onKeyDown={(e) => addLog(`Email: KeyDown - ${e.key}`)}
            placeholder="Digite seu email"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="testPassword" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Senha:
          </label>
          <input
            type="password"
            id="testPassword"
            value={password}
            onChange={handlePasswordChange}
            onClick={() => addLog('Senha: Click')}
            onFocus={() => addLog('Senha: Focus')}
            onBlur={() => addLog('Senha: Blur')}
            onKeyDown={(e) => addLog(`Senha: KeyDown - ${e.key}`)}
            placeholder="Digite sua senha"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Testar Envio
        </button>
      </form>
      
      <div style={{
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
        maxHeight: '300px',
        overflowY: 'auto',
        border: '1px solid #ddd'
      }}>
        <strong>Log de Eventos:</strong><br />
        {logs.length === 0 ? (
          <span style={{ color: '#666' }}>Nenhum evento registrado ainda...</span>
        ) : (
          logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))
        )}
      </div>
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
        <h3>📋 Instruções:</h3>
        <ol>
          <li>Clique nos campos de input acima</li>
          <li>Digite algum texto</li>
          <li>Observe se os eventos são registrados no log</li>
          <li>Se os eventos não aparecerem, há um problema específico do React</li>
        </ol>
        
        <h3>📊 Estado Atual:</h3>
        <p><strong>Email:</strong> "{email}"</p>
        <p><strong>Senha:</strong> "{'*'.repeat(password.length)}"</p>
        <p><strong>Total de eventos:</strong> {logs.length}</p>
      </div>
    </div>
  );
};

export default TestInputPage;