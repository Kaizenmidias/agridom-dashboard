
import React, { createContext, useContext, useState, useEffect } from 'react';

// Types pour les différentes données statistiques
export interface YieldData {
  name: string;
  current: number;
  previous: number;
  unit: string;
}

export interface FinancialData {
  name: string;
  profitability: number;
  size: number;
  crop: string;
}

export interface CostData {
  name: string;
  value: number;
  color: string;
}

export interface EnvironmentalData {
  indicator: string;
  current: number;
  target: number;
  trend: string;
  status: 'Atingido' | 'Em progresso' | 'Atrasado';
}

interface StatisticsContextType {
  // Données de rendement
  yieldData: YieldData[];
  setYieldData: React.Dispatch<React.SetStateAction<YieldData[]>>;
  
  // Données financières
  financialData: {
    profitabilityByParcel: FinancialData[];
    costAnalysis: CostData[];
    revenueByMonth: any[];
  };
  setFinancialData: React.Dispatch<React.SetStateAction<{
    profitabilityByParcel: FinancialData[];
    costAnalysis: CostData[];
    revenueByMonth: any[];
  }>>;
  
  // Données environnementales
  environmentalData: {
    indicators: EnvironmentalData[];
    carbonFootprint: number;
    waterUsage: number;
    biodiversity: number;
  };
  setEnvironmentalData: React.Dispatch<React.SetStateAction<{
    indicators: EnvironmentalData[];
    carbonFootprint: number;
    waterUsage: number;
    biodiversity: number;
  }>>;
  
  // Données de prévision
  forecastData: any[];
  setForecastData: React.Dispatch<React.SetStateAction<any[]>>;
  
  // Période et filtres
  period: 'day' | 'week' | 'month' | 'year';
  setPeriod: React.Dispatch<React.SetStateAction<'day' | 'week' | 'month' | 'year'>>;
  cropFilter: string;
  setCropFilter: React.Dispatch<React.SetStateAction<string>>;
  
  // Fonction pour mettre à jour les données en fonction des filtres
  updateDataWithFilters: (period: string, crop: string) => void;
}

const StatisticsContext = createContext<StatisticsContextType | undefined>(undefined);

export const useStatistics = () => {
  const context = useContext(StatisticsContext);
  if (context === undefined) {
    throw new Error('useStatistics must be used within a StatisticsProvider');
  }
  return context;
};

// Données initiales
const initialYieldData: YieldData[] = [
  { name: 'Sites Desenvolvidos', current: 12, previous: 8, unit: 'sites' },
  { name: 'Campanhas Ativas', current: 25, previous: 22, unit: 'campanhas' },
  { name: 'Projetos em Andamento', current: 18, previous: 15, unit: 'projetos' },
  { name: 'Clientes Ativos', current: 45, previous: 38, unit: 'clientes' },
  { name: 'Leads Convertidos', current: 32, previous: 28, unit: 'leads' }
];

const initialProfitabilityData: FinancialData[] = [
  { name: 'Projeto Alpha', profitability: 15000, size: 3.5, crop: 'E-commerce' },
  { name: 'Projeto Beta', profitability: 8500, size: 2.0, crop: 'Landing Page' },
  { name: 'Projeto Gamma', profitability: 22000, size: 5.2, crop: 'Sistema Web' },
  { name: 'Projeto Delta', profitability: 12000, size: 2.8, crop: 'Marketing Digital' },
  { name: 'Projeto Epsilon', profitability: 18500, size: 4.1, crop: 'Aplicativo' }
];

const initialCostData: CostData[] = [
  { name: 'Hospedagem', value: 2800, color: '#4CAF50' },
  { name: 'Licenças Software', value: 4200, color: '#8D6E63' },
  { name: 'Marketing', value: 6500, color: '#FFC107' },
  { name: 'Freelancers', value: 8200, color: '#2196F3' },
  { name: 'Salários', value: 25000, color: '#673AB7' },
  { name: 'Escritório', value: 4800, color: '#E91E63' },
  { name: 'Diversos', value: 1900, color: '#9E9E9E' }
];

const initialRevenueData = [
  { month: 'Jan', revenue: 48500, expenses: 32100, profit: 16400 },
  { month: 'Fev', revenue: 52200, expenses: 35800, profit: 16400 },
  { month: 'Mar', revenue: 58800, expenses: 38400, profit: 20400 },
  { month: 'Abr', revenue: 65500, expenses: 41100, profit: 24400 },
  { month: 'Mai', revenue: 72200, expenses: 43500, profit: 28700 },
  { month: 'Jun', revenue: 68800, expenses: 39900, profit: 28900 },
  { month: 'Jul', revenue: 78500, expenses: 44200, profit: 34300 },
  { month: 'Ago', revenue: 84800, expenses: 47300, profit: 37500 },
  { month: 'Set', revenue: 76200, expenses: 46800, profit: 29400 },
  { month: 'Out', revenue: 71200, expenses: 43100, profit: 28100 },
  { month: 'Nov', revenue: 68500, expenses: 42500, profit: 26000 },
  { month: 'Dez', revenue: 82200, expenses: 48800, profit: 33400 }
];

const initialEnvironmentalIndicators: EnvironmentalData[] = [
  { indicator: 'Taxa de Conversão (%)', current: 8.5, target: 10.0, trend: '+12%', status: 'Em progresso' },
  { indicator: 'Tempo Médio de Projeto (dias)', current: 45, target: 40, trend: '-8%', status: 'Atingido' },
  { indicator: 'Satisfação do Cliente (%)', current: 92, target: 95, trend: '+5%', status: 'Em progresso' },
  { indicator: 'ROI das Campanhas (%)', current: 285, target: 300, trend: '+15%', status: 'Em progresso' },
  { indicator: 'Retenção de Clientes (%)', current: 78, target: 80, trend: '+8%', status: 'Atingido' }
];

export const StatisticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [yieldData, setYieldData] = useState<YieldData[]>(initialYieldData);
  const [financialData, setFinancialData] = useState({
    profitabilityByParcel: initialProfitabilityData,
    costAnalysis: initialCostData,
    revenueByMonth: initialRevenueData
  });
  const [environmentalData, setEnvironmentalData] = useState({
    indicators: initialEnvironmentalIndicators,
    carbonFootprint: -15,
    waterUsage: -8,
    biodiversity: 12
  });
  const [forecastData, setForecastData] = useState(initialRevenueData);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('year');
  const [cropFilter, setCropFilter] = useState('all');
  
  // Fonction pour mettre à jour les données en fonction des filtres
  const updateDataWithFilters = (period: string, crop: string) => {
    // Filtrer les données de rendement par culture si nécessaire
    if (crop !== 'all') {
      const filteredYieldData = initialYieldData.filter(item => item.name === crop);
      setYieldData(filteredYieldData);
      
      // Filtrer également les données financières par culture
      const filteredProfitabilityData = initialProfitabilityData.filter(item => item.crop === crop);
      setFinancialData(prev => ({
        ...prev,
        profitabilityByParcel: filteredProfitabilityData
      }));
    } else {
      setYieldData(initialYieldData);
      setFinancialData(prev => ({
        ...prev,
        profitabilityByParcel: initialProfitabilityData
      }));
    }
    
    // Vous pourriez également ajuster les autres données en fonction de la période
  };
  
  // Mettre à jour les données lorsque les filtres changent
  useEffect(() => {
    updateDataWithFilters(period, cropFilter);
  }, [period, cropFilter]);
  
  return (
    <StatisticsContext.Provider 
      value={{ 
        yieldData, 
        setYieldData,
        financialData,
        setFinancialData,
        environmentalData,
        setEnvironmentalData,
        forecastData,
        setForecastData,
        period,
        setPeriod,
        cropFilter,
        setCropFilter,
        updateDataWithFilters
      }}
    >
      {children}
    </StatisticsContext.Provider>
  );
};
