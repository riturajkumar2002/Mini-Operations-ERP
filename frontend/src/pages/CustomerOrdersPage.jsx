import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ShoppingCart, 
  PlusCircle, 
  AlertCircle, 
  CheckCircle2, 
  UserCheck, 
  Package, 
  MapPin, 
  Layers, 
  Ban, 
  RefreshCw,
  X
} from 'lucide-react';

export default function CustomerOrdersPage() {
  const { canCreateOrder } = useAuth();
  const [orders, setOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    customer_name: 'Stark Manufacturing Industries',
    location_id: '',
    item_id: '',
    batch_number: 'BATCH-ST-001',
    quantity: 60,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordRes, locRes, itemRes, invRes] = await Promise.all([
        api.get('/orders'),
        api.get('/locations'),
        api.get('/items'),
        api.get('/inventory'),
      ]);
      setOrders(ordRes.data);
      setLocations(locRes.data);
      setItems(itemRes.data);
      setInventory(invRes.data);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute available stock for currently selected item and location in form
  const getAvailableStockInForm = () => {
    if (!form.item_id || !form.location_id) return null;
    const match = inventory.find(
      (inv) =>
        inv.item_id === Number(form.item_id) &&
        inv.location_id === Number(form.location_id) &&
        inv.batch_number === form.batch_number
    );
    return match ? match.available_quantity : 0;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/orders', {
        customer_name: form.customer_name.trim(),
        location_id: Number(form.location_id),
        item_id: Number(form.item_id),
        batch_number: form.batch_number.trim() || 'DEFAULT',
        quantity: Number(form.quantity),
      });
      setIsOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reserve customer order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order and release reserved stock?')) return;
    try {
      await api.post(`/orders/${orderId}/cancel`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const formAvailableStock = getAvailableStockInForm();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-indigo-400" />
            Customer Orders & Stock Reservation
          </h1>
          <p className="text-sm text-slate-400">
            Create sales customer orders with atomic inventory reservation and double-booking prevention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreateOrder && (
            <button
              onClick={() => {
                if (locations.length && items.length) {
                  setForm({
                    customer_name: 'Global Dynamics Corp',
                    location_id: locations[0].id,
                    item_id: items[0].id,
                    batch_number: 'BATCH-ST-001',
                    quantity: 60,
                  });
                }
                setError('');
                setIsOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Order & Reserve Stock</span>
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

      {/* Orders List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Order Code</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Reserved Item & Batch</th>
                <th className="px-6 py-4">Fulfillment Location</th>
                <th className="px-6 py-4 text-right">Reserved Quantity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No customer orders created yet.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      {ord.order_code}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {ord.customer_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{ord.item_name}</div>
                      <div className="text-xs font-mono text-slate-400">
                        {ord.item_sku} · {ord.batch_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {ord.location_name}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-amber-400 text-base">
                      {ord.quantity}
                    </td>
                    <td className="px-6 py-4">
                      {ord.status === 'RESERVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Stock Reserved
                        </span>
                      )}
                      {ord.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <Ban className="w-3.5 h-3.5" /> Cancelled (Released)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {ord.status === 'RESERVED' && canCreateOrder ? (
                        <button
                          onClick={() => handleCancelOrder(ord.id)}
                          className="text-xs font-medium text-rose-400 hover:text-rose-300 hover:underline inline-flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" /> Cancel & Release
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                New Customer Order & Stock Reservation
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
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
                <label className="block text-xs font-medium text-slate-300 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="e.g. Apex Industrial Solutions"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Fulfillment Location</label>
                <select
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Select location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Item</label>
                <select
                  value={form.item_id}
                  onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Select item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
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
                    value={form.batch_number}
                    onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Order Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Real-time Available Stock Preview Indicator */}
              {formAvailableStock !== null && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-400">Available in this Batch/Location:</span>
                  <span
                    className={`font-mono font-bold ${
                      formAvailableStock >= Number(form.quantity)
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formAvailableStock} units
                  </span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {submitting ? 'Reserving...' : 'Place Order & Reserve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
