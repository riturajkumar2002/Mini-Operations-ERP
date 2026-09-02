import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, 
  PlusCircle, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRightLeft, 
  User as UserIcon, 
  MapPin, 
  Package, 
  Layers, 
  RefreshCw,
  X,
  Sparkles
} from 'lucide-react';

export default function WorkOrdersPage({ onInitiateTransfer }) {
  const { canCreateWorkOrder, isAdmin, isOperations } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Work Order Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    location_id: '',
    item_id: '',
    required_quantity: 100,
    assigned_user_id: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woRes, locRes, itemRes, usersRes] = await Promise.all([
        api.get('/work-orders'),
        api.get('/locations'),
        api.get('/items'),
        api.get('/auth/users'),
      ]);
      setWorkOrders(woRes.data);
      setLocations(locRes.data);
      setItems(itemRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to load work orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/work-orders', {
        location_id: Number(form.location_id),
        item_id: Number(form.item_id),
        required_quantity: Number(form.required_quantity),
        assigned_user_id: Number(form.assigned_user_id),
      });
      setIsCreateOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (woId, newStatus) => {
    try {
      await api.patch(`/work-orders/${woId}/status`, { status: newStatus });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ASSIGNED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            Assigned
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Completed
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
              <ClipboardList className="w-6 h-6" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-100 to-cyan-200 bg-clip-text text-transparent">
              Work Orders & Stock Shortage Check
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Production work orders with automatic material shortage detection and surplus transfer linking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canCreateWorkOrder && (
            <button
              onClick={() => {
                if (items.length && locations.length && users.length) {
                  setForm({
                    item_id: items[0].id,
                    location_id: locations[0].id,
                    required_quantity: 100,
                    assigned_user_id: users[0].id,
                  });
                }
                setError('');
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 border border-cyan-300/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Work Order</span>
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

      {/* Work Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-[#0d1424]/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
            Querying work orders...
          </div>
        ) : workOrders.length === 0 ? (
          <div className="bg-[#0d1424]/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            No work orders created yet.
          </div>
        ) : (
          workOrders.map((wo) => {
            const sc = wo.stock_check;
            const hasShortage = sc && sc.shortage > 0;

            return (
              <div
                key={wo.id}
                className="bg-[#0d1424]/85 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-2xl hover:border-cyan-500/40 transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-cyan-300 bg-[#070b14] px-3.5 py-1 rounded-xl border border-cyan-900/50 shadow-inner">
                      {wo.work_order_code}
                    </span>
                    <div>{getStatusBadge(wo.status)}</div>
                  </div>

                  {/* Status update controls */}
                  {(isAdmin || isOperations) && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Update Status:</span>
                      <select
                        value={wo.status}
                        onChange={(e) => handleStatusChange(wo.id, e.target.value)}
                        className="bg-[#070b14] border border-slate-700/80 rounded-xl px-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="ASSIGNED">Assigned</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/30 text-cyan-400">
                      <Package className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Required Item</div>
                      <div className="font-semibold text-white">{wo.item_name}</div>
                      <div className="text-[11px] font-mono text-cyan-400/80">{wo.item_sku}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-800/30 text-blue-400">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Production Facility</div>
                      <div className="font-semibold text-white">{wo.location_name}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-800/30 text-indigo-400">
                      <Layers className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Demand Quantity</div>
                      <div className="font-black text-cyan-300 text-base">{wo.required_quantity} units</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-800/30 text-purple-400">
                      <UserIcon className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Assigned Assignee</div>
                      <div className="font-semibold text-white">{wo.assigned_user_name}</div>
                    </div>
                  </div>
                </div>

                {/* Stock Check & Shortage Panel */}
                {sc && (
                  <div
                    className={`rounded-2xl p-4 border transition-all ${
                      hasShortage
                        ? 'bg-rose-950/25 border-rose-500/40 shadow-lg shadow-rose-950/20'
                        : 'bg-emerald-950/25 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {hasShortage ? (
                          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span>Automatic Stock Check:</span>
                            {hasShortage ? (
                              <span className="text-rose-400 font-extrabold">Material Shortage Detected (-{sc.shortage} units)</span>
                            ) : (
                              <span className="text-emerald-400 font-extrabold">Sufficient Material Available in Facility</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-300 mt-1.5 flex flex-wrap gap-4">
                            <span>Required: <strong className="text-white">{sc.required_quantity}</strong></span>
                            <span>Available at {sc.location_name}: <strong className="text-white">{sc.available_at_location}</strong></span>
                            <span>Shortage: <strong className={hasShortage ? 'text-rose-400 font-mono font-bold' : 'text-emerald-400 font-mono font-bold'}>{sc.shortage}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Surplus Locations & Direct Transfer Bridge */}
                      {hasShortage && sc.surplus_locations.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-[#070b14]/90 p-2.5 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-300">
                            <span className="text-amber-400 font-bold">Surplus Detected: </span>
                            {sc.surplus_locations.map((loc) => (
                              <span key={loc.location_id} className="ml-1 font-mono text-cyan-200">
                                {loc.location_name} ({loc.available_quantity} units)
                              </span>
                            ))}
                          </div>

                          {onInitiateTransfer && (
                            <button
                              onClick={() =>
                                onInitiateTransfer({
                                  source_location_id: sc.surplus_locations[0].location_id,
                                  destination_location_id: wo.location_id,
                                  item_id: wo.item_id,
                                  quantity: sc.shortage,
                                })
                              }
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 whitespace-nowrap transition-all"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Transfer Shortage ({sc.shortage})</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Work Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0d1424] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-cyan-400" />
                Create Production Work Order
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Facility</label>
                <select
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  required
                  className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Required Material</label>
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

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Required Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.required_quantity}
                  onChange={(e) => setForm({ ...form, required_quantity: e.target.value })}
                  className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Assignee</label>
                <select
                  value={form.assigned_user_id}
                  onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}
                  required
                  className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-sm"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
