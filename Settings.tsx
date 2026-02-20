import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Input, Tabs, Badge, Spinner,
} from '@/components/ui';
import { formatCNPJ, formatDate, cn } from '@/lib/utils';
import {
  User, Building2, Shield, Plus, Upload, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const SETTINGS_TABS = [
  { value: 'profile', label: 'Perfil' },
  { value: 'companies', label: 'Empresas' },
  { value: 'certificate', label: 'Certificado' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie sua conta, empresas e certificados digitais
        </p>
      </div>

      <Tabs tabs={SETTINGS_TABS} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'companies' && <CompaniesTab />}
        {activeTab === 'certificate' && <CertificateTab />}
      </Tabs>
    </div>
  );
}

/* ========== PROFILE TAB ========== */
function ProfileTab() {
  const { user } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-4.5 w-4.5 text-primary" />
          Perfil
        </CardTitle>
        <CardDescription>Informações da sua conta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input label="Nome" value={user?.user_metadata?.name || ''} disabled />
        <Input label="Email" value={user?.email || ''} disabled />
        <p className="text-xs text-muted-foreground">
          Para alterar seus dados, use as configurações de conta do Supabase Auth.
        </p>
      </CardContent>
    </Card>
  );
}

/* ========== COMPANIES TAB ========== */
function CompaniesTab() {
  const { companies, refreshCompanies, createCompany } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createCompany({
        cnpj: cnpj.replace(/\D/g, ''),
        legal_name: legalName,
        trade_name: tradeName || undefined,
      });
      await refreshCompanies();
      setShowForm(false);
      setCnpj('');
      setLegalName('');
      setTradeName('');
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-primary" />
              Empresas
            </CardTitle>
            <CardDescription>CNPJs vinculados à sua conta</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {/* Add company form */}
          {showForm && (
            <form onSubmit={handleAddCompany} className="p-4 mb-4 rounded-lg border bg-muted/20 space-y-3">
              <Input
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                required
              />
              <Input
                label="Razão Social"
                placeholder="Nome legal da empresa"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
              />
              <Input
                label="Nome Fantasia (opcional)"
                placeholder="Nome fantasia"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
              />
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? <Spinner className="h-4 w-4" /> : 'Cadastrar'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {/* Company list */}
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma empresa cadastrada. Clique em "Adicionar" para começar.
            </p>
          ) : (
            <div className="space-y-3">
              {companies.map((company) => {
                const cert = company.certificates?.[0];
                const certValid = cert && new Date(cert.valid_to) > new Date();
                return (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{company.trade_name || company.legal_name}</p>
                      <p className="text-sm text-muted-foreground">{formatCNPJ(company.cnpj)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cert ? (
                        <Badge className={certValid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {certValid ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Certificado OK</>
                          ) : (
                            <><AlertTriangle className="h-3 w-3 mr-1" /> Certificado Expirado</>
                          )}
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Sem Certificado
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ========== CERTIFICATE TAB ========== */
function CertificateTab() {
  const { selectedCompany, refreshCompanies } = useCompany();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const cert = selectedCompany?.certificates?.[0];

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !password || !selectedCompany) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Envia para Supabase Edge Function que faz o proxy para Nuvem Fiscal
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/certificates/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          company_id: selectedCompany.id,
          certificate_base64: base64,
          password: password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao enviar');

      setSuccess('Certificado enviado com sucesso para a Nuvem Fiscal!');
      setFile(null);
      setPassword('');
      await refreshCompanies();
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar certificado');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-sm text-muted-foreground text-center">
            Selecione uma empresa na sidebar para gerenciar o certificado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current certificate info */}
      {cert && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-primary" />
              Certificado Ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Titular</p>
                <p className="text-sm font-medium">{cert.subject_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fingerprint</p>
                <p className="text-sm font-mono">{cert.fingerprint}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Válido desde</p>
                <p className="text-sm">{formatDate(cert.valid_from)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Válido até</p>
                <p className={cn(
                  'text-sm font-medium',
                  new Date(cert.valid_to) < new Date() ? 'text-destructive' : 'text-emerald-600'
                )}>
                  {formatDate(cert.valid_to)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4.5 w-4.5 text-primary" />
            {cert ? 'Atualizar Certificado' : 'Enviar Certificado Digital A1'}
          </CardTitle>
          <CardDescription>
            O certificado será enviado diretamente para a Nuvem Fiscal.
            Ele não é armazenado em nossos servidores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Arquivo do Certificado (.pfx ou .p12)</label>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full h-10 text-sm file:mr-4 file:h-10 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                required
              />
            </div>

            <Input
              id="cert-password"
              label="Senha do Certificado"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <strong>Segurança:</strong> O arquivo e a senha do certificado são usados apenas para
              envio à Nuvem Fiscal e <strong>nunca são armazenados</strong> em nossos servidores.
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>
            )}

            <Button type="submit" disabled={loading || !file}>
              {loading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              Enviar Certificado
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
