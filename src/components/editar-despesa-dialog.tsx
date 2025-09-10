import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { updateExpense } from '@/api/crud';
import { Expense } from '@/types/database';
import { Loader2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const editarDespesaSchema = z.object({
  description: z.string().min(1, 'Despesa é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  billing_type: z.enum(['unica', 'semanal', 'mensal', 'anual']).default('unica'),
  notes: z.string().optional(),
});

type EditarDespesaFormData = z.infer<typeof editarDespesaSchema>;

interface EditarDespesaDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseUpdated?: () => void;
}

export function EditarDespesaDialog({ expense, open, onOpenChange, onExpenseUpdated }: EditarDespesaDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditarDespesaFormData>({
    resolver: zodResolver(editarDespesaSchema),
  });

  // Preencher o formulário quando a despesa mudar
  useEffect(() => {
    if (expense) {
      setValue('description', expense.description);
      setValue('amount', expense.amount ? expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00');
      
      // Melhor tratamento da data
      const expenseDate = expense.date;
      let formattedDate = new Date().toLocaleDateString('en-CA'); // Data atual como fallback
      
      if (expenseDate) {
        try {
          // Tentar diferentes formatos de data
          let dateObj;
          
          if (typeof expenseDate === 'string') {
            // Se já está no formato YYYY-MM-DD, usar diretamente
            if (/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
              formattedDate = expenseDate;
            } else {
              // Tentar converter outros formatos
              dateObj = new Date(expenseDate);
              if (!isNaN(dateObj.getTime())) {
                formattedDate = dateObj.toLocaleDateString('en-CA');
              }
            }
          } else if ((expenseDate as any) instanceof Date) {
            if (!isNaN((expenseDate as Date).getTime())) {
              formattedDate = (expenseDate as Date).toLocaleDateString('en-CA');
            }
          } else if (expenseDate) {
            // Tentar converter qualquer outro tipo para Date
            const dateObj = new Date(expenseDate as any);
            if (!isNaN(dateObj.getTime())) {
              formattedDate = dateObj.toLocaleDateString('en-CA');
            }
          }
        } catch (error) {
          console.error('Erro ao processar data:', expenseDate, error);
        }
      }
      
      setValue('date', formattedDate);
      setValue('billing_type', expense.billing_type || 'unica');
      setValue('notes', expense.notes || '');
    }
  }, [expense, setValue]);

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    
    const amount = parseInt(numericValue) / 100;
    return amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setValue('amount', formatted);
  };

  const onSubmit = async (data: EditarDespesaFormData) => {
    if (!expense) return;
    
    setIsSubmitting(true);
    
    try {
      // Converter valor de string para número
      const amount = parseFloat(data.amount.replace(/[^\d,]/g, '').replace(',', '.'));
      
      await updateExpense(expense.id, {
        description: data.description,
        amount,
        date: data.date,
        billing_type: data.billing_type,
        // status removido - não existe no tipo Expense
        notes: data.notes || '',
      });
      
      toast({
        title: "Despesa atualizada!",
        description: `A despesa "${data.description}" foi atualizada com sucesso.`,
      });

      reset();
      onOpenChange(false);
      
      // Chamar callback para atualizar a lista
      if (onExpenseUpdated) {
        onExpenseUpdated();
      }
    } catch (error) {
      console.error('Erro ao atualizar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a despesa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Despesa</DialogTitle>
          <DialogDescription>
            Atualize as informações da despesa selecionada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Despesa *</Label>
            <Input
              id="description"
              placeholder="Ex: Combustível, Fertilizante..."
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor *</Label>
            <Input
              id="amount"
              placeholder="0,00"
              {...register('amount')}
              onChange={handleAmountChange}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !watch('date') && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {watch('date') ? format(new Date(watch('date')), "dd/MM/yyyy", { locale: pt }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={watch('date') ? new Date(watch('date') + 'T12:00:00.000Z') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      // Usar UTC para evitar problemas de fuso horário
                      const year = date.getUTCFullYear();
                      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                      const day = String(date.getUTCDate()).padStart(2, '0');
                      setValue('date', `${year}-${month}-${day}`);
                    }
                  }}
                  initialFocus
                  locale={pt}
                />
              </PopoverContent>
            </Popover>
            {errors.date && (
              <p className="text-sm text-red-500">{errors.date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_type">Tipo de Cobrança *</Label>
            <Select onValueChange={(value) => setValue('billing_type', value as 'unica' | 'semanal' | 'mensal' | 'anual')} value={watch('billing_type')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unica">Única</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
            {errors.billing_type && (
              <p className="text-sm text-red-500">{errors.billing_type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais (opcional)"
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar Despesa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}