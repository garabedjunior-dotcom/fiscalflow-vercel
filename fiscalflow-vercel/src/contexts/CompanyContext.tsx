import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';
import { useAuth } from './AuthContext';

interface Company {
  id: string;
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
  certificates?: {
    id: string;
    fingerprint: string;
    subject_name: string;
    valid_from: string;
    valid_to: string;
  }[];
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  isLoading: boolean;
  refreshCompanies: () => Promise<void>;
  createCompany: (data: { cnpj: string; legal_name: string; trade_name?: string }) => Promise<any>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCompanies = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(`*, certificates (id, fingerprint, subject_name, valid_from, valid_to)`)
        .order('created_at', { ascending: false });

      const list = data || [];
      setCompanies(list);
      if (!selectedCompany && list.length > 0) setSelectedCompany(list[0]);
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createCompany = async (companyData: { cnpj: string; legal_name: string; trade_name?: string }) => {
    return apiPost('/api/companies/create', companyData);
  };

  useEffect(() => {
    if (isAuthenticated) refreshCompanies();
    else { setCompanies([]); setSelectedCompany(null); }
  }, [isAuthenticated]);

  return (
    <CompanyContext.Provider value={{ companies, selectedCompany, setSelectedCompany, isLoading, refreshCompanies, createCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) throw new Error('useCompany deve ser usado dentro de um CompanyProvider');
  return context;
}
