-- Run this in your Supabase SQL Editor to add the missing columns to the settings table

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS "loginBgUrl" TEXT,
ADD COLUMN IF NOT EXISTS "loginLogoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "logoTop" NUMERIC,
ADD COLUMN IF NOT EXISTS "logoLeft" NUMERIC,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS "loginCompanyNameLine1" TEXT,
ADD COLUMN IF NOT EXISTS "loginCompanyNameLine2" TEXT,
ADD COLUMN IF NOT EXISTS "loginSloganLine1" TEXT,
ADD COLUMN IF NOT EXISTS "loginSloganLine2" TEXT,
ADD COLUMN IF NOT EXISTS "loginCertifications" JSONB DEFAULT '[]'::jsonb;

-- Add missing columns to templates table
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS prefix TEXT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS fields JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "headerContent" TEXT,
ADD COLUMN IF NOT EXISTS "footerContent" TEXT,
ADD COLUMN IF NOT EXISTS "bodyContent" TEXT;

-- Add missing columns to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS "templateType" TEXT,
ADD COLUMN IF NOT EXISTS "serialNumber" TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS "creatorId" TEXT,
ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]'::jsonb;

-- Add missing columns to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS "contactPerson" TEXT,
ADD COLUMN IF NOT EXISTS "telPoBox" TEXT,
ADD COLUMN IF NOT EXISTS trn TEXT;
