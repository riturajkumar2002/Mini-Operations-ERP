import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeftRight, 
  PlusCircle, 
  Send, 
  PackageCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  RefreshCw,
  X
} from 'lucide-react';

export default function TransfersPage({ prefillData, onClearPrefill }) {
  const { canManageTransfers } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    source_location_id: '',
    destination_location_id: '',
    item_id: '',
    batch_number: 'DEFAULT',
    quantity: 40,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trRes, locRes, itemRes] = await Promise.all([
        api.get('/transfers'),
        api.get('/locations'),
        api.get('/items'),
      ]);
      setTransfers(trRes.data);
      setLocations(locRes.data);
      setItems(itemRes.data);
    } catch (err) {
      console.error('Failed to load transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle prefill from Work Orders shortage trigger
  useEffect(() => {
    if (prefillData && locations.length && items.length) {
      setForm({
        source_location_id: String(prefillData.source_location_id),
        destination_location_id: String(prefillData.destination_location_id),
        item_id: String(prefillData.item_id),
        batch_number: 'BATCH-CH-002',
        quantity: prefillData.quantity || 40,
      });
      setIsOpen(true);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillData, locations, items]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/transfers', {
        source_location_id: Number(form.source_location_id),
        destination_location_id: Number(form.destination_location_id),
        item_id: Number(form.item_id),
        batch_number: form.batch_number.trim() || 'DEFAULT',
        quantity: Number(form.quantity),
      });
      setIsOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create internal transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (id) => {
    setActionError('');
    try {
      await api.post(`/transfers/${id}/dispatch`);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to dispatch transfer');
    }
  };

  const handleReceive = async (id) => {
    setActionError('');
    try {
      await api.post(`/transfers/${id}/receive`);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to receive transfer');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Requested
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
            <Send className="w-3.5 h-3.5 text-cyan-400" /> Dispatched (In Transit)
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Received
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-100 to-cyan-200 bg-clip-text text-transparent">
              Internal Stock Transfers
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inter-facility logistics pipeline with atomic dispatch, transit isolation, and receipt validation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManageTransfers && (
            <button
              onClick={() => {
                if (locations.length >= 2 && items.length) {
                  setForm({
                    source_location_id: locations[1].id,
                    destination_location_id: locations[0].id,
                    item_id: items[0].id,
                    batch_number: 'BATCH-CH-002',
                    quantity: 40,
                  });
                }
                setError('');
                setIsOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 border border-cyan-300/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Stock Transfer</span>
            </button>
          )}

          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2.5 rounded-xl bg-[#0d1424] hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Transfers List */}
      <div className="bg-[#0d1424]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#070b14]/70 text-xs uppercase font-bold text-cyan-400/90 border-b border-slate-800 tracking-wider">
              <tr>
                <th className="px-6 py-4">Transfer Code</th>
                <th className="px-6 py-4">Route (Source → Destination)</th>
                <th className="px-6 py-4">Item & Batch</th>
                <th className="px-6 py-4 text-right">Quantity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Pipeline Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Querying transfer orders...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No transfers found. Click "New Stock Transfer" to initiate one.
                  </td>
                </tr>
              ) : (
                transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-cyan-300">
                      {tr.transfer_code}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-200">
                        <span className="font-medium">{tr.source_location_name}</span>
                        <ArrowRight className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="font-bold text-white">{tr.destination_location_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{tr.item_name}</div>
                      <div className="text-xs font-mono text-cyan-400/80">
                        {tr.item_sku} · {tr.batch_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-cyan-300 text-base">
                      {tr.quantity}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(tr.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {canManageTransfers ? (
                        <div className="flex items-center justify-center gap-2">
                          {tr.status === 'REQUESTED' && (
                            <button
                              onClick={() => handleDispatch(tr.id)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Dispatch</span>
                            </button>
                          )}

                          {tr.status === 'DISPATCHED' && (
                            <button
                              onClick={() => handleReceive(tr.id)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Receive</span>
                            </button>
                          )}

                          {tr.status === 'RECEIVED' && (
                            <span className="text-xs text-slate-500 font-medium italic">
                              Completed & Stored
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">View Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0d1424] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
                Initiate Stock Transfer
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Source Facility</label>
                <select
                  value={form.source_location_id}
                  onChange={(e) => setForm({ ...form, source_location_id: e.target.value })}
                  required
                  className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm"
                >
                  <option value="">Select source facility</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Destination Facility</label>
                <select
                  value={form.destination_location_id}
                  onChange={(e) => setForm({ ...form, destination_location_id: e.target.value })}
                  required
                  className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm"
                >
                  <option value="">Select destination facility</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Item to Transfer</label>
                <select
                  value={form.item_id}
                  onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                  required
                  className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={form.batch_number}
                    onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Request Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
