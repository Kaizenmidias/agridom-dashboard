import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { authAPI } from '@/api/api-client';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email necess?rio",
        description: "Por favor, digite seu email para receber o link de redefini??o.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const result = await authAPI.forgotPassword(email);
      
      if (result.success) {
        setShowSuccessMessage(true);
        setEmail('');
        toast({
          title: "Email enviado!",
          description: result.message || "Verifique sua caixa de entrada para redefinir sua senha.",
        });
      } else {
        throw new Error(result.error || 'Erro ao enviar email de recupera??o');
      }
    } catch (error: any) {
      console.error('Erro no forgot password:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao enviar email de recupera??o',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Redefinir senha
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Digite seu email para receber um link de redefini??o de senha
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Recupera??o de senha
            </CardTitle>
            <CardDescription>
              Enviaremos um link de redefini??o para seu email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              handleSubmit(e);
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                onClick={(e) => {
                  // N?o prevenir o default aqui, deixar o form handle
                }}
              >
                {loading ? "Enviando..." : "Enviar e-mail de redefini??o"}
              </Button>
            </form>
            
            {showSuccessMessage && (
              <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#D4EDDA', color: '#27673C' }}>
                <p className="text-sm font-medium">
                  Se houver uma conta para esse e-mail, um link de redefini??o de senha foi enviado. Se voc? n?o recebeu o e-mail, verifique se digitou seu e-mail corretamente.
                </p>
              </div>
            )}
            
            <div className="mt-6 text-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleBackToLogin}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para o login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
