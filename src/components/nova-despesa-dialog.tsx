import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const despesaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  valor: z.string().min(1, 'Valor é obrigatório'),
  data: z.string().min(1, 'Data é obrigatória'),
  tipoCobranca: z.string().min(1, 'Tipo de cobrança é obrigatório'),
  observacoes: z.string().optional(),
});

type DespesaFormData = z.infer<typeof despesaSchema>;

interface NovaDespesaDialogProps {
  children: React.ReactNode;
}

export function NovaDespesaDialog({ children }: NovaDespesaDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DespesaFormData>({
    resolver: zodResolver(despesaSchema),
  });

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const formattedValue = (parseInt(numericValue) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return formattedValue;
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setValue('valor', formatted);
  };

  const onSubmit = (data: DespesaFormData) => {
    console.log('Nova despesa:', data);
    
    toast({
      title: "Despesa cadastrada!",
      description: `A despesa "${data.nome}" foi cadastrada com sucesso.`,
    });

    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Despesa</DialogTitle>
          <DialogDescription>
            Cadastre uma nova despesa no sistema. Preencha todos os campos obrigatórios.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Ex: Licença Adobe Creative Suite"
                {...register('nome')}
              />
              {errors.nome && (
                <p className="text-sm text-destructive">{errors.nome.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                placeholder="R$ 0,00"
                {...register('valor')}
                onChange={handleValorChange}
              />
              {errors.valor && (
                <p className="text-sm text-destructive">{errors.valor.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                {...register('data')}
              />
              {errors.data && (
                <p className="text-sm text-destructive">{errors.data.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoCobranca">Tipo de Cobrança *</Label>
            <Select onValueChange={(value) => setValue('tipoCobranca', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de cobrança" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Única">Única</SelectItem>
                <SelectItem value="Semanal">Semanal</SelectItem>
                <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                <SelectItem value="Mensal">Mensal</SelectItem>
                <SelectItem value="Bimestral">Bimestral</SelectItem>
                <SelectItem value="Trimestral">Trimestral</SelectItem>
                <SelectItem value="Semestral">Semestral</SelectItem>
                <SelectItem value="Anual">Anual</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipoCobranca && (
              <p className="text-sm text-destructive">{errors.tipoCobranca.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais sobre a despesa..."
              rows={3}
              {...register('observacoes')}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Cadastrar Despesa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}