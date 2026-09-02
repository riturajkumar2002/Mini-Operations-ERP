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
  X
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
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Assigned
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-indigo-400" />
            Work Orders & Material Stock Check
          </h1>
          <p className="text-sm text-slate-400">
            Track manufacturing and operational orders with automatic location shortage detection.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Work Order</span>
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

      {/* Work Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Loading work orders...
          </div>
        ) : workOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            No work orders found. Click "Create Work Order" to create one.
          </div>
        ) : (
          workOrders.map((wo) => {
            const sc = wo.stock_check;
            const hasShortage = sc && sc.shortage > 0;

            return (
              <div
                key={wo.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-white bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
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
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
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
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Required Material</div>
                      <div className="font-semibold text-white">{wo.item_name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{wo.item_sku}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-300">
                    <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Production Location</div>
                      <div className="font-semibold text-white">{wo.location_name}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Quantity Demanded</div>
                      <div className="font-bold text-indigo-300 text-base">{wo.required_quantity} units</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-300">
                    <UserIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Assigned To</div>
                      <div className="font-semibold text-white">{wo.assigned_user_name}</div>
                    </div>
                  </div>
                </div>

                {/* Stock Check & Shortage Panel (Case Study Requirement) */}
                {sc && (
                  <div
                    className={`rounded-xl p-4 border ${
                      hasShortage
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-emerald-950/20 border-emerald-500/30'
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
                              <span className="text-rose-400">Material Shortage Detected (-{sc.shortage} units)</span>
                            ) : (
                              <span className="text-emerald-400">Sufficient Material in Stock</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-4">
                            <span>Required: <strong className="text-slate-200">{sc.required_quantity}</strong></span>
                            <span>Available at {sc.location_name}: <strong className="text-slate-200">{sc.available_at_location}</strong></span>
                            <span>Shortage: <strong className={hasShortage ? 'text-rose-400 font-mono' : 'text-slate-200 font-mono'}>{sc.shortage}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Surplus Locations & Direct Transfer Bridge */}
                      {hasShortage && sc.surplus_locations.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-xs text-slate-300">
                            <span className="text-amber-400 font-semibold">Surplus Available: </span>
                            {sc.surplus_locations.map((loc) => (
                              <span key={loc.location_id} className="ml-1 font-mono text-slate-200">
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
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all whitespace-nowrap"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                Create New Work Order
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Location</label>
                <select
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
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

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Required Item</label>
                <select
                  value={form.item_id}
                  onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Required Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.required_quantity}
                  onChange={(e) => setForm({ ...form, required_quantity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assigned User</label>
                <select
                  value={form.assigned_user_id}
                  onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
