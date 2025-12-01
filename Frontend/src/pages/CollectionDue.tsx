import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Trash2, AlertTriangle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Collection {
  historyId: number;
  studentId: number;
  name: string;
  shiftTitle: string | null;
  totalFee: number;
  amountPaid: number;
  dueAmount: number;
  cash: number;
  online: number;
  remark: string;
  createdAt: string | null;
  branchId?: number;
  branchName?: string;
  paymentDate?: string | null;
}

interface PreviousDuePaidItem {
  id: number;
  historyId: number;
  studentId: number;
  studentName: string;
  branchId: number;
  branchName: string;
  amount: number;
  method: 'cash' | 'online';
  paidAt: string;
  monthTag: string;
  originalMonth: string;
}

interface PreviousDuePaidSummary {
  totalAmount: number;
  totalCash: number;
  totalOnline: number;
  items: PreviousDuePaidItem[];
}

interface Branch {
  id: number;
  name: string;
}

const CollectionDue: React.FC = () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([]);
  const [previousDuePaid, setPreviousDuePaid] = useState<PreviousDuePaidSummary | null>(null);
  const [isPrevDueModalOpen, setIsPrevDueModalOpen] = useState(false);
  const [previousDuePaidAdjustments, setPreviousDuePaidAdjustments] = useState<{ totalAmount: number; totalCash: number; totalOnline: number } | null>(null);
  // Filters for Previous Month Due Paid modal
  const [prevFilterName, setPrevFilterName] = useState('');
  const [prevFilterPaidAt, setPrevFilterPaidAt] = useState(''); // YYYY-MM-DD
  const [prevFilterOriginalMonth, setPrevFilterOriginalMonth] = useState(''); // YYYY-MM
  const [prevFilterBranchId, setPrevFilterBranchId] = useState<number | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesData = await api.getBranches();
        setBranches(branchesData);
      } catch (error) {
        console.error('Failed to fetch branches:', error);
        toast.error('Failed to load branches');
      }
    };
    fetchBranches();
  }, []);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const params: { month?: string; branchId?: number } = {};
        if (selectedMonth) params.month = selectedMonth;
        if (selectedBranchId) params.branchId = selectedBranchId;
        const data = await api.getCollections(params);

        if (!data || !Array.isArray(data.collections)) {
          throw new Error('Invalid data structure received');
        }

        const mapped = data.collections.map((c: any) => ({
          historyId: c.historyId,
          studentId: c.studentId,
          name: c.name,
          shiftTitle: c.shiftTitle,
          totalFee: typeof c.totalFee === 'number' ? c.totalFee : 0,
          amountPaid: typeof c.amountPaid === 'number' ? c.amountPaid : 0,
          dueAmount: typeof c.dueAmount === 'number' ? c.dueAmount : 0,
          cash: typeof c.cash === 'number' ? c.cash : 0,
          online: typeof c.online === 'number' ? c.online : 0,
          remark: c.remark || '',
          createdAt: c.createdAt,
          paymentDate: c.paymentDate ?? null,
          branchId: c.branchId,
          branchName: c.branchName
        }));

        setCollections(mapped);
        setPreviousDuePaid(data.previousDuePaid || null);
        setPreviousDuePaidAdjustments(data.previousDuePaidAdjustments || null);
      } catch (err: any) {
        console.error('Failed to fetch collections:', err);
        toast.error(err.message || 'Failed to load collection data');
        setCollections([]);
        setPreviousDuePaid(null);
        setPreviousDuePaidAdjustments(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, [selectedMonth, selectedBranchId]);

  useEffect(() => {
    setFilteredCollections(
      collections.filter(col => {
        const matchesSearch = (col.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        // Filter strictly by Created At (from changed_at)
        const createdAtStr = col.createdAt || null;
        const createdAtDate = createdAtStr ? new Date(createdAtStr) : null;

        const matchesMonth = !selectedMonth || !createdAtDate || (
          `${createdAtDate.getFullYear()}-${String(createdAtDate.getMonth() + 1).padStart(2, '0')}` === selectedMonth
        );

        const matchesDate = !selectedDate || !createdAtDate || (
            createdAtDate.toISOString().slice(0, 10) === selectedDate
        );

        return matchesSearch && matchesMonth && matchesDate;
      })
    );
  }, [collections, searchTerm, selectedMonth, selectedDate]);

  const totalStudents = filteredCollections.length;
  const baseCollected = filteredCollections.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalDue = filteredCollections.reduce((sum, c) => sum + c.dueAmount, 0);
  const totalCash = filteredCollections.reduce((sum, c) => sum + c.cash, 0);
  const totalOnline = filteredCollections.reduce((sum, c) => sum + c.online, 0);
  // Removed security money aggregation as per requirements
  // Add previous-month due paid into current month Total Collected only
  const isViewingCurrentMonth = selectedMonth === currentMonth;
  const totalCollected = isViewingCurrentMonth
    ? baseCollected + (previousDuePaid?.totalAmount || 0)
    : Math.max(0, baseCollected - (previousDuePaidAdjustments?.totalAmount || 0));

  const displayCash = isViewingCurrentMonth
    ? totalCash
    : Math.max(0, totalCash - (previousDuePaidAdjustments?.totalCash || 0));
  const displayOnline = isViewingCurrentMonth
    ? totalOnline
    : Math.max(0, totalOnline - (previousDuePaidAdjustments?.totalOnline || 0));

  const handlePayDue = (collection: Collection) => {
    setSelectedCollection(collection);
    setPaymentAmount('');
    setPaymentMethod(null);
    setIsPayModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCollection || !paymentMethod || !paymentAmount) {
      toast.error('Please select a payment method and enter a payment amount');
      return;
    }
    const payment = parseFloat(paymentAmount);
    if (isNaN(payment) || payment <= 0 || payment > selectedCollection.dueAmount) {
      toast.error('Invalid payment amount');
      return;
    }
    try {
      await api.updateCollectionPayment(selectedCollection.historyId, {
        amount: payment,
        method: paymentMethod,
      });
      toast.success('Payment updated successfully');
      setIsPayModalOpen(false);
      await refreshCollections();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment');
    }
  };

  const handleDeleteClick = (historyId: number) => {
    setCollectionToDelete(historyId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!collectionToDelete) return;
    
    setIsDeleting(true);
    try {
      await api.deleteCollection(collectionToDelete);
      toast.success('Collection record deleted successfully');
      await refreshCollections();
    } catch (err: any) {
      console.error('Error deleting collection:', err);
      toast.error(err.message || 'Failed to delete collection record');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setCollectionToDelete(null);
    }
  };

  const refreshCollections = async () => {
    try {
      const params: { month?: string; branchId?: number } = {};
      if (selectedMonth) params.month = selectedMonth;
      if (selectedBranchId) params.branchId = selectedBranchId;
      const data = await api.getCollections(params);
      
      const mapped = data.collections.map((c: any) => ({
        historyId: c.historyId,
        studentId: c.studentId,
        name: c.name,
        shiftTitle: c.shiftTitle,
        totalFee: typeof c.totalFee === 'number' ? c.totalFee : 0,
        amountPaid: typeof c.amountPaid === 'number' ? c.amountPaid : 0,
        dueAmount: typeof c.dueAmount === 'number' ? c.dueAmount : 0,
        cash: typeof c.cash === 'number' ? c.cash : 0,
        online: typeof c.online === 'number' ? c.online : 0,
        remark: c.remark || '',
        createdAt: c.createdAt,
        paymentDate: c.paymentDate ?? null,
        branchId: c.branchId,
        branchName: c.branchName
      }));
      
      setCollections(mapped);
      setPreviousDuePaid(data.previousDuePaid || null);
      setPreviousDuePaidAdjustments(data.previousDuePaidAdjustments || null);
    } catch (err) {
      console.error('Error refreshing collections:', err);
      toast.error('Failed to refresh collection data');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fef9f6]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : (
          <motion.div
            className="max-w-7xl mx-auto"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1
              className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 flex items-center gap-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              📊 Collection & Due
            </motion.h1>
            <p className="text-gray-600 mb-6 text-sm md:text-base">
              View and manage student payment details.
            </p>

            <motion.div
              className="mb-6 flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <input
                type="text"
                placeholder="Search by student name..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm md:text-base"
              />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSelectedMonth(e.target.value)
                  setSelectedDate(''); // Reset date when month changes
                }}
                className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm md:text-base"
              />
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm md:text-base"
              />
              <select
                value={selectedBranchId || ''}
                onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm md:text-base"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </motion.div>

            {user?.role === 'admin' && ( // Wrap the aggregated financial data section in a conditional render
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="text-sm font-medium text-gray-500">Total Students</h3>
                  <p className="text-xl font-bold text-gray-800">{totalStudents}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="text-sm font-medium text-gray-500">Total Collected</h3>
                  <p className="text-xl font-bold text-green-600">₹{totalCollected.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="text-sm font-medium text-gray-500">Total Due</h3>
                  <p className="text-xl font-bold text-red-600">₹{totalDue.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="text-sm font-medium text-gray-500">Total Cash Collected</h3>
                  <p className="text-xl font-bold text-green-600">₹{displayCash.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="text-sm font-medium text-gray-500">Total Online Collected</h3>
                  <p className="text-xl font-bold text-green-600">₹{displayOnline.toFixed(2)}</p>
                </div>
                {isViewingCurrentMonth && previousDuePaid && previousDuePaid.totalAmount > 0 && (
                  <button
                    onClick={() => setIsPrevDueModalOpen(true)}
                    className="bg-white p-4 rounded-lg shadow-sm border text-left hover:shadow-md transition"
                    title="View students who paid previous month due in the current month"
                  >
                    <h3 className="text-sm font-medium text-gray-500">Previous Month Due Paid</h3>
                    <p className="text-xl font-bold text-indigo-600">₹{previousDuePaid.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1">Cash: ₹{previousDuePaid.totalCash.toFixed(2)} · Online: ₹{previousDuePaid.totalOnline.toFixed(2)}</p>
                    <p className="text-[11px] text-gray-400 mt-1">Click to view {previousDuePaid.items.length} student(s)</p>
                  </button>
                )}
              </motion.div>
            )}

            <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Online</th>
                    
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remark</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">Created At</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-purple-700">Date of Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCollections.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-4 text-center text-gray-500">
                        No collections found
                      </td>
                    </tr>
                  ) : (
                    filteredCollections.map((collection) => (
                      <motion.tr
                        key={collection.historyId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{collection.name}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{collection.branchName || 'N/A'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{collection.shiftTitle || 'N/A'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">₹{collection.totalFee.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">₹{collection.cash.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">₹{collection.online.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600">₹{collection.amountPaid.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600">₹{collection.dueAmount.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{collection.remark || 'N/A'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {collection.createdAt ? (
                            <span className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                              {new Date(collection.createdAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {collection.paymentDate ? (
                            <span className="inline-block px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-medium">
                              {new Date(collection.paymentDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                      {collection.dueAmount > 0 && (
                        <button
                          onClick={() => handlePayDue(collection)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium mr-2"
                        >
                          Pay Due
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(collection.historyId)}
                        className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {isPayModalOpen && selectedCollection && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                  <h3 className="text-lg font-semibold mb-4">Pay Due for {selectedCollection.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">Due Amount: ₹{selectedCollection.dueAmount.toFixed(2)}</p>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Select Payment Method:</p>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={() => setPaymentMethod('cash')}
                          className="mr-2"
                        />
                        Cash
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="online"
                          checked={paymentMethod === 'online'}
                          onChange={() => setPaymentMethod('online')}
                          className="mr-2"
                        />
                        Online
                      </label>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(e.target.value)}
                    placeholder="Enter payment amount"
                    className="w-full p-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    step="0.01"
                    min="0"
                    max={selectedCollection.dueAmount.toString()}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsPayModalOpen(false)}
                      className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePaymentSubmit}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    >
                      Submit Payment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Previous Month Due Paid - Details Modal */}
      {isPrevDueModalOpen && previousDuePaid && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Previous Month Due Paid - Details</h3>
              <button onClick={() => setIsPrevDueModalOpen(false)} className="text-gray-600 hover:text-gray-800">✕</button>
            </div>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <input
                type="text"
                placeholder="Search name..."
                className="p-2 border rounded"
                value={prevFilterName}
                onChange={(e) => setPrevFilterName(e.target.value)}
              />
              <input
                type="date"
                className="p-2 border rounded"
                value={prevFilterPaidAt}
                onChange={(e) => setPrevFilterPaidAt(e.target.value)}
              />
              <input
                type="month"
                className="p-2 border rounded"
                value={prevFilterOriginalMonth}
                onChange={(e) => setPrevFilterOriginalMonth(e.target.value)}
              />
              <select
                className="p-2 border rounded"
                value={prevFilterBranchId ?? ''}
                onChange={(e) => setPrevFilterBranchId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Compute filtered items and modal totals */}
            {(() => {
              const items = previousDuePaid.items.filter((it) => {
                const nameOk = !prevFilterName || (it.studentName || '').toLowerCase().includes(prevFilterName.toLowerCase());
                const paidAtOk = !prevFilterPaidAt || (new Date(it.paidAt).toISOString().slice(0,10) === prevFilterPaidAt);
                const monthOk = !prevFilterOriginalMonth || it.originalMonth === prevFilterOriginalMonth;
                const branchOk = !prevFilterBranchId || it.branchId === prevFilterBranchId;
                return nameOk && paidAtOk && monthOk && branchOk;
              });
              const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0);
              const totalCash = items.filter(i => i.method === 'cash').reduce((s, i) => s + (i.amount || 0), 0);
              const totalOnline = items.filter(i => i.method === 'online').reduce((s, i) => s + (i.amount || 0), 0);
            
              return (
                <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-xs text-gray-500">Total Amount</div>
                <div className="text-base font-bold">₹{totalAmount.toFixed(2)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-xs text-gray-500">Cash</div>
                <div className="text-base font-bold">₹{totalCash.toFixed(2)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-xs text-gray-500">Online</div>
                <div className="text-base font-bold">₹{totalOnline.toFixed(2)}</div>
              </div>
            </div>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid At</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Month</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-center text-gray-500" colSpan={6}>No previous month due payments</td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-4 py-2 text-sm">{it.studentName}</td>
                        <td className="px-4 py-2 text-sm">{it.branchName || 'N/A'}</td>
                        <td className="px-4 py-2 text-sm text-green-600">₹{it.amount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm">{it.method}</td>
                        <td className="px-4 py-2 text-sm">{new Date(it.paidAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-sm">{it.originalMonth}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setIsPrevDueModalOpen(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100">Close</button>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <AlertDialogTitle>Delete Collection Record</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to delete this collection record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CollectionDue;