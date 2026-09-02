import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Boxes, 
  Search, 
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

  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
              <Boxes className="w-6 h-6" />
            </div>
            <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-700 dark:from-white dark:via-slate-100 dark:to-cyan-200 bg-clip-text text-transparent">
              Inventory Ledger & Stock Levels
            </span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Real-time physical, reserved, and available stock levels across warehouse facilities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTransactions}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0d1424] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700/80 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 border border-cyan-300/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Stock Adjustment</span>
            </button>
          )}

          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2.5 rounded-xl bg-white dark:bg-[#0d1424] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700/80 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search bar */}
      <div className="bg-white dark:bg-[#0d1424]/85 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 shadow-sm dark:shadow-xl transition-colors duration-300">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-cyan-500/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Item Name, SKU, or Batch number..."
            className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
        </form>

        <div className="flex gap-2.5">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-300 focus:outline-none focus:border-cyan-500 transition-all"
          >
            <option value="">All Facilities</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-300 focus:outline-none focus:border-cyan-500 transition-all"
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
      <div className="bg-white dark:bg-[#0d1424]/80 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/90 dark:bg-[#070b14]/70 text-xs uppercase font-bold text-slate-700 dark:text-cyan-400/90 border-b border-slate-200 dark:border-slate-800 tracking-wider">
              <tr>
                <th className="px-6 py-4">Item & SKU</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4 text-right">Physical Stock</th>
                <th className="px-6 py-4 text-right">Reserved</th>
                <th className="px-6 py-4 text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                    Querying inventory records...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No inventory records found matching your filters.
                  </td>
                </tr>
              ) : (
                inventory.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{row.item_name}</div>
                      <div className="text-xs font-mono text-cyan-700 dark:text-cyan-400/80">{row.item_sku}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{row.location_name}</div>
                      <div className="text-xs font-mono text-slate-400 dark:text-slate-500">{row.location_code}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-indigo-700 dark:text-indigo-300">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40">
                        {row.batch_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-100 text-base">
                      {row.physical_quantity}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-amber-600 dark:text-amber-400 text-base">
                      {row.reserved_quantity > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                          {row.reserved_quantity}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-block px-3 py-1 rounded-xl text-xs font-black tracking-wide ${
                          row.available_quantity > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 shadow-sm'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                        }`}
                      >
                        {row.available_quantity} units
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                Adjust Stock Quantity
              </h3>
              <button
                onClick={() => setIsAdjustOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{adjustError}</span>
              </div>
            )}

            {adjustSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{adjustSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Item</label>
                <select
                  value={adjustForm.item_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, item_id: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Location</label>
                <select
                  value={adjustForm.location_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, location_id: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={adjustForm.batch_number}
                    onChange={(e) => setAdjustForm({ ...adjustForm, batch_number: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity Delta</label>
                  <input
                    type="number"
                    required
                    value={adjustForm.physical_quantity_delta}
                    onChange={(e) => setAdjustForm({ ...adjustForm, physical_quantity_delta: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-cyan-500"
                    placeholder="+50 or -10"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Positive adds, negative deducts</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Audit reconciliation"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                Inventory Transaction Audit Log
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-200 dark:divide-slate-800/80">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No transactions logged yet.</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="py-3 text-xs flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#070b14] border border-slate-200 dark:border-cyan-900/40 text-cyan-700 dark:text-cyan-300 font-mono">
                          {tx.transaction_type}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">Ref: {tx.reference_code}</span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-1">{tx.notes}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {tx.physical_delta !== 0 && (
                          <span className={tx.physical_delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {tx.physical_delta > 0 ? `+${tx.physical_delta}` : tx.physical_delta} Phys{' '}
                          </span>
                        )}
                        {tx.reserved_delta !== 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {tx.reserved_delta > 0 ? `+${tx.reserved_delta}` : tx.reserved_delta} Rsv
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 dark:text-slate-500 text-[10px]">
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
