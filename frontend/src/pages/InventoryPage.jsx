import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Boxes, 
  Search, 
  Filter, 
  PlusCircle, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  X
} from 'lucide-react';

export default function InventoryPage() {
  const { canManageInventory } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modals state
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);

  // Adjust form
  const [adjustForm, setAdjustForm] = useState({
    item_id: '',
    location_id: '',
    batch_number: 'BATCH-2026-A',
    physical_quantity_delta: 10,
    reason: 'Routine stock replenishment',
  });
  const [adjustError, setAdjustError] = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, locRes, itemRes] = await Promise.all([
        api.get('/inventory', {
          params: {
            location_id: selectedLocation || undefined,
            category: selectedCategory || undefined,
            search: search || undefined,
          },
        }),
        api.get('/locations'),
        api.get('/items'),
      ]);
      setInventory(invRes.data);
      setLocations(locRes.data);
      setItems(itemRes.data);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedLocation, selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const loadTransactions = async () => {
    try {
      const res = await api.get('/inventory/transactions');
      setTransactions(res.data);
      setIsHistoryOpen(true);
    } catch (err) {
      console.error('Failed to load transaction history:', err);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjustError('');
    setAdjustSuccess('');
    setSubmitting(true);
    try {
      await api.post('/inventory/adjust', {
        item_id: Number(adjustForm.item_id),
        location_id: Number(adjustForm.location_id),
        batch_number: adjustForm.batch_number.trim() || 'DEFAULT',
        physical_quantity_delta: Number(adjustForm.physical_quantity_delta),
        reason: adjustForm.reason,
      });
      setAdjustSuccess('Inventory updated successfully!');
      fetchData();
      setTimeout(() => {
        setIsAdjustOpen(false);
        setAdjustSuccess('');
      }, 1200);
    } catch (err) {
      setAdjustError(err.response?.data?.detail || 'Failed to adjust inventory');
    } finally {
      setSubmitting(false);
    }
  };

  // Categories list
  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-7 h-7 text-indigo-400" />
            Inventory Management
          </h1>
          <p className="text-sm text-slate-400">
            Real-time physical, reserved, and available stock levels across warehouse locations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTransactions}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-colors"
          >
            <History className="w-4 h-4 text-slate-400" />
            <span>Audit Trail</span>
          </button>

          {canManageInventory && (
            <button
              onClick={() => {
                if (items.length && locations.length) {
                  setAdjustForm((prev) => ({
                    ...prev,
                    item_id: items[0].id,
                    location_id: locations[0].id,
                  }));
                }
                setAdjustError('');
                setAdjustSuccess('');
                setIsAdjustOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Stock Adjustment</span>
            </button>
          )}

          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Item Name, SKU, or Batch..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </form>

        <div className="flex gap-2">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Item & SKU</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4 text-right">Physical</th>
                <th className="px-6 py-4 text-right">Reserved</th>
                <th className="px-6 py-4 text-right">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading inventory records...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                inventory.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">
                      <div>{row.item_name}</div>
                      <div className="text-xs font-mono text-slate-400">{row.item_sku}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div>{row.location_name}</div>
                      <div className="text-xs font-mono text-slate-500">{row.location_code}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-indigo-300">
                      {row.batch_number}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-200">
                      {row.physical_quantity}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-amber-400">
                      {row.reserved_quantity}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          row.available_quantity > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {row.available_quantity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {isAdjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                Adjust Stock Quantity
              </h3>
              <button
                onClick={() => setIsAdjustOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            {adjustSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{adjustSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Item</label>
                <select
                  value={adjustForm.item_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, item_id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Location</label>
                <select
                  value={adjustForm.location_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, location_id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={adjustForm.batch_number}
                    onChange={(e) => setAdjustForm({ ...adjustForm, batch_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Quantity Delta</label>
                  <input
                    type="number"
                    required
                    value={adjustForm.physical_quantity_delta}
                    onChange={(e) => setAdjustForm({ ...adjustForm, physical_quantity_delta: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-semibold"
                    placeholder="+50 or -10"
                  />
                  <span className="text-[10px] text-slate-400">Use positive to add, negative to deduct</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="e.g. Audit reconciliation or shipment arrival"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {submitting ? 'Applying...' : 'Apply Stock Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                Inventory Transaction Audit Log
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-800">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No transactions logged yet.</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="py-3 text-xs flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-mono">
                          {tx.transaction_type}
                        </span>
                        <span>Ref: {tx.reference_code}</span>
                      </div>
                      <div className="text-slate-400 mt-1">{tx.notes}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono font-bold text-slate-200">
                        {tx.physical_delta !== 0 && (
                          <span className={tx.physical_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {tx.physical_delta > 0 ? `+${tx.physical_delta}` : tx.physical_delta} Phys{' '}
                          </span>
                        )}
                        {tx.reserved_delta !== 0 && (
                          <span className="text-amber-400">
                            {tx.reserved_delta > 0 ? `+${tx.reserved_delta}` : tx.reserved_delta} Rsv
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
