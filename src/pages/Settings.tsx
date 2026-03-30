import React, { useState, useEffect, useRef } from 'react';
import { useSettingsStore, LoginCertification } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Save, Loader2, Building2, Image as ImageIcon, MapPin, Phone, Mail, Upload, ShieldCheck, Award, Anchor, CheckCircle2, Lock, Star, FileText, Plus, Trash2 } from 'lucide-react';

const AVAILABLE_ICONS = [
  { id: 'ShieldCheck', icon: ShieldCheck, label: 'Security Shield' },
  { id: 'Award', icon: Award, label: 'Award Badge' },
  { id: 'Anchor', icon: Anchor, label: 'Anchor' },
  { id: 'CheckCircle2', icon: CheckCircle2, label: 'Check Circle' },
  { id: 'Lock', icon: Lock, label: 'Lock' },
  { id: 'Star', icon: Star, label: 'Star' },
  { id: 'FileText', icon: FileText, label: 'Document' },
  { id: 'Building2', icon: Building2, label: 'Building' }
];

export function Settings() {
  const { settings, updateSettings, isLoading } = useSettingsStore();
  const { isAdmin } = useAuthStore();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loginBgUrl, setLoginBgUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoTop, setLogoTop] = useState(0);
  const [logoLeft, setLogoLeft] = useState(5);
  
  // Login Page Settings
  const [loginLogoUrl, setLoginLogoUrl] = useState('');
  const [loginCompanyNameLine1, setLoginCompanyNameLine1] = useState('');
  const [loginCompanyNameLine2, setLoginCompanyNameLine2] = useState('');
  const [loginSloganLine1, setLoginSloganLine1] = useState('');
  const [loginSloganLine2, setLoginSloganLine2] = useState('');
  const [loginCertifications, setLoginCertifications] = useState<LoginCertification[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loginBgInputRef = useRef<HTMLInputElement>(null);

  const loginLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setName(settings.name || '');
      setLogoUrl(settings.logoUrl || '');
      setLoginBgUrl(settings.loginBgUrl || '');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setEmail(settings.email || '');
      setLogoTop(settings.logoTop ?? 0);
      setLogoLeft(settings.logoLeft ?? 5);
      
      setLoginLogoUrl(settings.loginLogoUrl || '');
      setLoginCompanyNameLine1(settings.loginCompanyNameLine1 || 'Porto Marine');
      setLoginCompanyNameLine2(settings.loginCompanyNameLine2 || 'Services L.L.C');
      setLoginSloganLine1(settings.loginSloganLine1 || 'Leading With');
      setLoginSloganLine2(settings.loginSloganLine2 || 'Passion');
      setLoginCertifications(settings.loginCertifications || [
        { title: 'Enterprise-Grade Security', description: 'End-to-end encrypted connection', icon: 'ShieldCheck' },
        { title: 'ISO 9001:2015 Certified', description: 'Global standard for quality management', icon: 'Award' }
      ]);
    }
  }, [settings]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view this page.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit for base64
        alert('Image is too large. Please use an image smaller than 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoginBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) { // 800KB limit for background
        alert('Image is too large. Please use an image smaller than 800KB, or paste a direct URL for higher quality.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLoginBgUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCertification = () => {
    setLoginCertifications([...loginCertifications, { title: 'New Certification', description: 'Description here', icon: 'Award' }]);
  };

  const handleRemoveCertification = (index: number) => {
    setLoginCertifications(loginCertifications.filter((_, i) => i !== index));
  };

  const handleUpdateCertification = (index: number, field: keyof LoginCertification, value: string) => {
    const updated = [...loginCertifications];
    updated[index] = { ...updated[index], [field]: value };
    setLoginCertifications(updated);
  };

  const handleLoginLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Image is too large. Please use an image smaller than 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLoginLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      await updateSettings({ 
        name, logoUrl, loginBgUrl, address, phone, email, logoTop, logoLeft,
        loginLogoUrl, loginCompanyNameLine1, loginCompanyNameLine2, loginSloganLine1, loginSloganLine2, loginCertifications
      });
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to save settings';
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) {
          errorMessage = parsed.error;
        }
      } catch (e) {
        // Not a JSON error
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-gray-500 mt-1">Manage your company profile, branding, and departments</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border"
                    placeholder="Acme Corp"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border"
                    placeholder="123 Business St, City"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Phone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border"
                    placeholder="contact@company.com"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                <div className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-32 object-contain mb-4" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Upload className="w-12 h-12 mb-2" />
                      <span className="text-sm">Click to upload logo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-2">Recommended: PNG or JPG, max 500KB</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Login Background Image</label>
                
                {/* URL Input for High Quality */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={loginBgUrl}
                    onChange={(e) => setLoginBgUrl(e.target.value)}
                    className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border"
                    placeholder="Paste a high-quality image URL here (Recommended for HD/4K)"
                  />
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase tracking-wider">OR UPLOAD FILE</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <div className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => loginBgInputRef.current?.click()}>
                  {loginBgUrl && loginBgUrl.startsWith('data:image') ? (
                    <img src={loginBgUrl} alt="Login Background" className="h-32 object-cover rounded mb-4 w-full" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Upload className="w-12 h-12 mb-2" />
                      <span className="text-sm">Click to upload background</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={loginBgInputRef}
                    onChange={handleLoginBgUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">Max 800KB due to database limits.<br/>For better quality, paste an image URL above instead.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo Top (mm)</label>
                  <input
                    type="number"
                    value={logoTop}
                    onChange={(e) => setLogoTop(Number(e.target.value))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo Left (mm)</label>
                  <input
                    type="number"
                    value={logoLeft}
                    onChange={(e) => setLogoLeft(Number(e.target.value))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Login Page Customization</h2>
              <p className="text-sm text-gray-500 mt-1">Customize the text and badges shown on the login screen</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Login Page Logo</h3>
                <div className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => loginLogoInputRef.current?.click()}>
                  {loginLogoUrl ? (
                    <img src={loginLogoUrl} alt="Login Logo" className="h-24 object-contain mb-4" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Upload className="w-12 h-12 mb-2" />
                      <span className="text-sm">Click to upload login page logo (Optional)</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={loginLogoInputRef}
                    onChange={handleLoginLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-2">If not provided, the main company logo will be used.</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Company Name</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Line 1 (e.g., Porto Marine)</label>
                  <input
                    type="text"
                    value={loginCompanyNameLine1}
                    onChange={(e) => setLoginCompanyNameLine1(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Line 2 (e.g., Services L.L.C)</label>
                  <input
                    type="text"
                    value={loginCompanyNameLine2}
                    onChange={(e) => setLoginCompanyNameLine2(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border px-3"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Slogan</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Line 1 (e.g., Leading With)</label>
                  <input
                    type="text"
                    value={loginSloganLine1}
                    onChange={(e) => setLoginSloganLine1(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Line 2 (e.g., Passion)</label>
                  <input
                    type="text"
                    value={loginSloganLine2}
                    onChange={(e) => setLoginSloganLine2(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 border px-3"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Certifications & Badges</h3>
                <button
                  type="button"
                  onClick={handleAddCertification}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Badge
                </button>
              </div>
              
              <div className="space-y-3">
                {loginCertifications.map((cert, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveCertification(index)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="w-1/4">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
                      <select
                        value={cert.icon}
                        onChange={(e) => handleUpdateCertification(index, 'icon', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 border px-2"
                      >
                        {AVAILABLE_ICONS.map(icon => (
                          <option key={icon.id} value={icon.id}>{icon.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-1/3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                      <input
                        type="text"
                        value={cert.title}
                        onChange={(e) => handleUpdateCertification(index, 'title', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 border px-2"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                      <input
                        type="text"
                        value={cert.description}
                        onChange={(e) => handleUpdateCertification(index, 'description', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 border px-2"
                      />
                    </div>
                  </div>
                ))}
                {loginCertifications.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No badges added yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
