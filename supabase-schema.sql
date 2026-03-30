-- 1. Create Employees Table
CREATE TABLE public.employees (
    uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "fullName" TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "phoneNumber" TEXT,
    position TEXT,
    department TEXT,
    status TEXT CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
    role TEXT CHECK (role IN ('Admin', 'Manager', 'Employee', 'Creator', 'Approver Level 1', 'Approver Level 2')) DEFAULT 'Employee',
    permissions TEXT[] DEFAULT '{"View"}',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Templates Table
CREATE TABLE public.templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    content TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Documents Table
CREATE TABLE public.documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    "templateId" TEXT REFERENCES public.templates(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Draft',
    "currentStage" INTEGER DEFAULT 0,
    workflow JSONB DEFAULT '[]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Clients Table
CREATE TABLE public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status TEXT DEFAULT 'Active',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Settings Table (Singleton)
CREATE TABLE public.settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    name TEXT DEFAULT 'Company Name',
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#4f46e5',
    departments TEXT[] DEFAULT '{"General", "HR", "Finance", "Operation", "Public"}',
    "documentTypes" TEXT[] DEFAULT '{"Contract", "Invoice", "Report", "Memo", "Other"}',
    "loginBgUrl" TEXT,
    "loginLogoUrl" TEXT,
    "logoTop" NUMERIC,
    "logoLeft" NUMERIC,
    "address" TEXT,
    phone TEXT,
    email TEXT,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    "loginCompanyNameLine1" TEXT,
    "loginCompanyNameLine2" TEXT,
    "loginSloganLine1" TEXT,
    "loginSloganLine2" TEXT,
    "loginCertifications" JSONB DEFAULT '[]'::jsonb
);

-- Insert default settings row
INSERT INTO public.settings (id, name) VALUES ('global', 'Company Name') ON CONFLICT (id) DO NOTHING;

-- 6. Create Activity Logs Table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    details TEXT,
    "userId" TEXT,
    "userName" TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 8. Create basic RLS policies (Allow all for authenticated users for now)
-- You can restrict these later based on roles
CREATE POLICY "Allow all actions for authenticated users on employees" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on templates" ON public.templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on documents" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated users on activity_logs" ON public.activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime for all tables
alter publication supabase_realtime add table public.employees;
alter publication supabase_realtime add table public.templates;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.activity_logs;
