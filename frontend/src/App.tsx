import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GridView from './components/GridView';
import RackView from './components/RackView';
import Config from './components/Config';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <header className="bg-slate-900 text-white p-4 shadow-md">
          <div className="container mx-auto flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold">
              <Layout size={24} />
              <span>DCmapper</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/" className="hover:text-blue-400 transition-colors">Locations</Link>
              <Link to="/config" className="hover:text-blue-400 transition-colors flex items-center gap-1">
                <Settings size={18} />
                <span>Settings</span>
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 container mx-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/datacenter/:id" element={<GridView />} />
            <Route path="/rack/:id" element={<RackView />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </main>

        <footer className="bg-slate-200 text-slate-600 p-4 text-center text-sm">
          &copy; 2026 DCmapper - Datacenter Visual Mapping
        </footer>
      </div>
    </Router>
  );
}

export default App;
