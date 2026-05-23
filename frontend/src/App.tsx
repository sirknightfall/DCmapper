import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Settings, LogOut, User as UserIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GridView from './components/GridView';
import RackView from './components/RackView';
import Config from './components/Config';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';

const MainContent = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <Layout size={24} />
            <span>DCmapper</span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link to="/" className="hover:text-blue-400 transition-colors text-sm font-medium">Locations</Link>
            <Link to="/config" className="hover:text-blue-400 transition-colors flex items-center gap-1 text-sm font-medium">
              <Settings size={18} />
              <span>Settings</span>
            </Link>
            
            <div className="h-6 w-px bg-slate-700 mx-2" />
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold flex items-center gap-1">
                  <UserIcon size={12} className="text-blue-400" />
                  {user.username}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{user.role}</span>
              </div>
              <button 
                onClick={logout}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/datacenter/:id" element={<GridView />} />
          <Route path="/rack/:id" element={<RackView />} />
          <Route path="/config" element={<Config />} />
          <Route path="/users" element={<UserManagement />} />
        </Routes>
      </main>

      <footer className="bg-slate-200 text-slate-600 p-4 text-center text-sm">
        &copy; 2026 DCmapper - Datacenter Visual Mapping
      </footer>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <MainContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
