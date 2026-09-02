import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ShoppingCart, 
  PlusCircle, 
  AlertCircle, 
  CheckCircle2, 
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
    batch_number: '',
    quantity: 20,
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

  // Filter available batches for selected location & item
  const availableBatches = inventory.filter(
    (inv) =>
      inv.location_id === Number(form.location_id) &&
      inv.item_id === Number(form.item_id) &&
      inv.available_quantity > 0
  );

  // Auto-select first matching batch when location or item changes
  useEffect(() => {
    if (form.location_id && form.item_id && inventory.length > 0) {
      const matching = inventory.filter(
        (inv) =>
          inv.location_id === Number(form.location_id) &&
          inv.item_id === Number(form.item_id) &&
          inv.available_quantity > 0
      );
      if (matching.length > 0) {
        if (!matching.some((m) => m.batch_number === form.batch_number)) {
          setForm((prev) => ({ ...prev, batch_number: matching[0].batch_number }));
        }
      } else {
        setForm((prev) => ({ ...prev, batch_number: '' }));
      }
    }
  }, [form.location_id, form.item_id, inventory]);

  const handleOpenModal = () => {
    if (locations.length && items.length) {
      const defaultLoc = locations[0]?.id;
      const defaultItem = items[0]?.id;
      const match = inventory.find(
        (inv) =>
          inv.location_id === defaultLoc &&
          inv.item_id === defaultItem &&
          inv.available_quantity > 0
      );
      setForm({
        customer_name: 'Apex Industrial Dynamics',
        location_id: String(defaultLoc),
        item_id: String(defaultItem),
        batch_number: match ? match.batch_number : '',
        quantity: 20,
      });
    }
    setError('');
    setIsOpen(true);
  };

  const getAvailableStockInForm = () => {
    if (!form.item_id || !form.location_id || !form.batch_number) return null;
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

    if (!form.batch_number) {
      setError('Please select a valid batch with available stock at this facility.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/orders', {
        customer_name: form.customer_name.trim(),
        location_id: Number(form.location_id),
        item_id: Number(form.item_id),
        batch_number: form.batch_number.trim(),
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-700 dark:from-white dark:via-slate-100 dark:to-cyan-200 bg-clip-text text-transparent">
              Customer Orders & Stock Reservation
            </span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Atomic stock reservation with concurrency protection to prevent inventory overbooking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canCreateOrder && (
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 border border-cyan-300/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Order & Reserve Stock</span>
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

      {/* Orders List */}
      <div className="bg-white dark:bg-[#0d1424]/80 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/90 dark:bg-[#070b14]/70 text-xs uppercase font-bold text-slate-700 dark:text-cyan-400/90 border-b border-slate-200 dark:border-slate-800 tracking-wider">
              <tr>
                <th className="px-6 py-4">Order Code</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Reserved Item & Batch</th>
                <th className="px-6 py-4">Fulfillment Facility</th>
                <th className="px-6 py-4 text-right">Reserved Quantity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                    Querying customer orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No customer orders created yet. Click "New Order" to place one.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-cyan-800 dark:text-cyan-300">
                      {ord.order_code}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {ord.customer_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{ord.item_name}</div>
                      <div className="text-xs font-mono text-cyan-700 dark:text-cyan-400/80">
                        {ord.item_sku} · {ord.batch_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {ord.location_name}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-amber-600 dark:text-amber-400 text-base">
                      {ord.quantity} units
                    </td>
                    <td className="px-6 py-4">
                      {ord.status === 'RESERVED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Stock Reserved
                        </span>
                      )}
                      {ord.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80">
                          <Ban className="w-3.5 h-3.5 text-slate-500" /> Cancelled (Released)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {ord.status === 'RESERVED' && canCreateOrder ? (
                        <button
                          onClick={() => handleCancelOrder(ord.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-2.5 py-1 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 inline-flex items-center gap-1.5 transition-all"
                        >
                          <Ban className="w-3.5 h-3.5" /> Cancel & Release
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                Customer Order & Stock Reservation
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Acme Industrial Corp"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fulfillment Facility</label>
                <select
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select facility</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Item</label>
                <select
                  value={form.item_id}
                  onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Batch Selector based on actual inventory at facility */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Available Batch
                  </label>
                  {availableBatches.length > 0 ? (
                    <select
                      value={form.batch_number}
                      onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                      required
                      className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                    >
                      {availableBatches.map((b) => (
                        <option key={b.id} value={b.batch_number}>
                          {b.batch_number} ({b.available_quantity} avail)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[11px] p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300">
                      No stock at facility
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Order Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Real-time Available Stock Preview Indicator */}
              {formAvailableStock !== null && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between shadow-inner">
                  <span className="text-slate-600 dark:text-slate-400">Available in this Batch:</span>
                  <span
                    className={`font-mono font-bold px-2.5 py-0.5 rounded-md ${
                      formAvailableStock >= Number(form.quantity)
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/40'
                        : 'text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800/40'
                    }`}
                  >
                    {formAvailableStock} units available
                  </span>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || availableBatches.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 disabled:opacity-50"
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
