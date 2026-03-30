import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useStore } from './store/useStore';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { DocumentCreator } from './pages/DocumentCreator';
import { DocumentViewer } from './pages/DocumentViewer';
import { Templates } from './pages/Templates';
import { TemplateBuilder } from './pages/TemplateBuilder';
import { Clients } from './pages/Clients';
import { Departments } from './pages/Departments';
import { Employees } from './pages/Employees';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { Settings } from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { init: initAuth } = useAuthStore();
  const { init: initStore } = useStore();

  useEffect(() => {
    initAuth();
    const cleanupStore = initStore();
    return () => {
      cleanupStore();
    };
  }, [initAuth, initStore]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/new" element={<DocumentCreator />} />
          <Route path="documents/:id" element={<DocumentViewer />} />
          <Route path="templates" element={<Templates />} />
          <Route path="templates/new" element={<TemplateBuilder />} />
          <Route path="templates/:id" element={<TemplateBuilder />} />
          <Route path="clients" element={<Clients />} />
          <Route path="departments" element={<Departments />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/manage" element={<EmployeeManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
