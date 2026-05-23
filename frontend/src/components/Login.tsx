import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as loginApi, getMe } from '../api';
import { Layout, Lock, User, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const tokenData = await loginApi(params);
      localStorage.setItem('token', tokenData.access_token);
      
      const userData = await getMe();
      login(tokenData.access_token, userData);
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl border w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-slate-900 text-white p-3 rounded-xl mb-4">
            <Layout size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">DCmapper Login</h1>
          <p className="text-slate-500 text-sm">Sign in to manage your datacenters</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm flex items-center gap-2 border border-red-200">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <User size={18} />
              </span>
              <input 
                type="text"
                required
                disabled={isSubmitting}
                className="w-full pl-10 border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock size={18} />
              </span>
              <input 
                type="password"
                required
                disabled={isSubmitting}
                className="w-full pl-10 border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-blue-400 transition-colors shadow-lg shadow-blue-200"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-xs text-slate-400 italic">
            Default credentials: <br/>
            <strong>admin / admin</strong> (Editor) <br/>
            <strong>viewer / viewer</strong> (View only)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
