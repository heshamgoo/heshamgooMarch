import React from 'react';
import { Bell, Search, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { profile, user } = useAuthStore();

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 print:hidden">
      <div className="flex items-center flex-1">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="p-2 mr-2 md:hidden text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        <div className="relative w-full max-w-xs md:w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="w-4 h-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="p-2 text-slate-400 hover:text-slate-600 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-6 w-px bg-slate-200 mx-2"></div>
        
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{profile?.fullName || user?.email}</p>
            <p className="text-xs text-slate-500">{profile?.role || 'User'}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
            {(profile?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
