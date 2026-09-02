import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import InventoryPage from './pages/InventoryPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import TransfersPage from './pages/TransfersPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import { RefreshCw } from 'lucide-react';

function Dashboard() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [transferPrefill, setTransferPrefill] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleInitiateTransfer = (prefill) => {
    setTransferPrefill(prefill);
    setActiveTab('transfers');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'inventory' && <InventoryPage />}
        {activeTab === 'work-orders' && (
          <WorkOrdersPage onInitiateTransfer={handleInitiateTransfer} />
        )}
        {activeTab === 'transfers' && (
          <TransfersPage
            prefillData={transferPrefill}
            onClearPrefill={() => setTransferPrefill(null)}
          />
        )}
        {activeTab === 'orders' && <CustomerOrdersPage />}
      </main>
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        Mini Operations ERP · Production Full-Stack Architecture · FastAPI + React + SQLAlchemy
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
