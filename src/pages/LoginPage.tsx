import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, KeyRound, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Carregar credenciais salvas se "lembrar senha" estava ativo
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    const savedPassword = localStorage.getItem('remembered_password');
    const wasRemembered = localStorage.getItem('remember_me') === 'true';
    
    if (wasRemembered && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
      if (savedPassword) {
        setPassword(savedPassword);
      }
    }
  }, []);

  // Aguardar carregamento da autenticação antes de redirecionar
  // Só redirecionar se não está carregando E tem usuário autenticado
  // Adicionar throttle para evitar navegações muito rápidas
  const [hasRedirected, setHasRedirected] = React.useState(false);
  
  React.useEffect(() => {
    if (!authLoading && user && !hasRedirected) {
      setHasRedirected(true);
      // Pequeno delay para evitar throttling
      setTimeout(() => {
        console.log('Usuário já autenticado, redirecionando para dashboard');
        window.location.replace('/');
      }, 100);
    }
  }, [authLoading, user, hasRedirected]);
  
  if (!authLoading && user && hasRedirected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Função para obter mensagem de erro específica
  const getErrorMessage = (errorMessage: string, userEmail: string = '') => {
    const message = errorMessage.toLowerCase();
    
    // Validação de formato de email
    if (userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      return "E-mail inválido";
    }
    
    // Credenciais inválidas (senha incorreta)
    if (message.includes('email ou senha inválidos') || message.includes('invalid credentials') || message.includes('credenciais inválidas')) {
      return "E-mail ou senha inválida";
    }
    
    // Usuário não encontrado
    if (message.includes('usuário não encontrado') || message.includes('user not found')) {
      return "E-mail ou senha inválida";
    }
    
    // Senha específica inválida
    if (message.includes('senha inválida') || message.includes('invalid password')) {
      return "Senha inválida";
    }
    
    // Conta desativada
    if (message.includes('conta desativada') || message.includes('account disabled')) {
      return "Conta desativada. Entre em contato com o administrador.";
    }
    
    // Muitas tentativas
    if (message.includes('muitas tentativas') || message.includes('too many attempts')) {
      return "Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.";
    }
    
    // Erro de conexão
    if (message.includes('conexão') || message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return "Erro de conexão. Verifique sua internet e tente novamente.";
    }
    
    // Erro genérico
    return "Ocorreu um erro inesperado";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpar mensagem de erro anterior
    setErrorMessage('');
    
    if (!email || !password) {
      setErrorMessage('Por favor, preencha o email e a senha para continuar.');
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('E-mail inválido');
      return;
    }

    setLoading(true);
    
    try {
      await login({ email, password });
      
      // Gerenciar "lembrar senha"
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
        localStorage.setItem('remembered_password', password);
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('remembered_email');
        localStorage.removeItem('remembered_password');
        localStorage.removeItem('remember_me');
      }
      
      toast({
        title: "Login Realizado",
        description: `Bem-vindo de volta! Redirecionando para o dashboard...`,
      });
    } catch (error: any) {
      const errorMsg = getErrorMessage(error.message, email);
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Faça login em sua conta
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Acesse o dashboard de gestão agrícola
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Login
            </CardTitle>
            <CardDescription>
              Digite suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={loading}
                />
                <Label 
                  htmlFor="remember-me" 
                  className="text-sm font-normal cursor-pointer"
                >
                  Lembrar minhas credenciais
                </Label>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              
              {/* Mensagem de erro abaixo do botão */}
              {errorMessage && (
                <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">
                    {errorMessage}
                  </p>
                </div>
              )}
            </form>
            
            <div className="mt-4 text-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Esqueceu sua senha?
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;