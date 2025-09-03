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
  const { login, user } = useAuth();
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

  // Se já estiver logado, redirecionar para dashboard
  if (user) {
    return <Navigate to="/" replace />;
  }

  // Função para obter mensagem de erro específica
  const getErrorMessage = (errorMessage: string) => {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('email ou senha inválidos') || message.includes('invalid credentials')) {
      return {
        title: "Credenciais Inválidas",
        description: "O email ou senha informados estão incorretos. Verifique os dados e tente novamente."
      };
    }
    
    if (message.includes('usuário não encontrado') || message.includes('user not found')) {
      return {
        title: "Usuário Não Encontrado",
        description: "Não existe uma conta associada a este email. Verifique o email ou entre em contato com o administrador."
      };
    }
    
    if (message.includes('conta desativada') || message.includes('account disabled')) {
      return {
        title: "Conta Desativada",
        description: "Sua conta foi desativada. Entre em contato com o administrador para reativá-la."
      };
    }
    
    if (message.includes('muitas tentativas') || message.includes('too many attempts')) {
      return {
        title: "Muitas Tentativas",
        description: "Muitas tentativas de login falharam. Aguarde alguns minutos antes de tentar novamente."
      };
    }
    
    if (message.includes('conexão') || message.includes('network') || message.includes('fetch')) {
      return {
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente."
      };
    }
    
    return {
      title: "Erro no Login",
      description: errorMessage || "Ocorreu um erro inesperado. Tente novamente em alguns instantes."
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Campos Obrigatórios",
        description: "Por favor, preencha o email e a senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Email Inválido",
        description: "Por favor, digite um endereço de email válido.",
        variant: "destructive",
      });
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
      const errorInfo = getErrorMessage(error.message);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
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