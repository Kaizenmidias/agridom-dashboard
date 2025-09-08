
import * as React from "react"
import { addDays, format } from "date-fns"
import { pt } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
  className?: string
  align?: "center" | "start" | "end"
  placeholderText?: string
  presets?: { label: string; days: number }[]
}

export function DatePickerWithRange({
  date,
  setDate,
  className,
  align = "start",
  placeholderText = "Selecionar período",
  presets = [
    { label: "7 dias", days: 7 },
    { label: "30 dias", days: 30 },
    { label: "90 dias", days: 90 }
  ]
}: DatePickerWithRangeProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd/MM/yyyy", { locale: pt })} -{" "}
                  {format(date.to, "dd/MM/yyyy", { locale: pt })}
                </>
              ) : (
                format(date.from, "dd/MM/yyyy", { locale: pt })
              )
            ) : (
              <span>{placeholderText}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={pt}
          />
          <div className="flex justify-end gap-2 p-3 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDate(undefined)}
              className="text-xs"
            >
              Limpar
            </Button>
            {presets.map((preset, i) => (
              <Button 
                key={i}
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Usar UTC para evitar problemas de fuso horário
                  const today = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')
                  const fromDate = new Date(today)
                  fromDate.setUTCDate(today.getUTCDate() - preset.days)
                  
                  setDate({
                    from: fromDate,
                    to: today,
                  })
                }}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
