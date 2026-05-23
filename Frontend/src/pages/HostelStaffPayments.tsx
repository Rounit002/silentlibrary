import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

interface HostelStaff {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface HostelStaffPayment {
  id: number;
  staffId: number;
  staffName: string;
  cash: number;
  online: number;
  amount: number;
  date: string;
  remark: string | null;
  branchId?: number | null;
  branchName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HostelBranch { id: number; name: string }

const HostelStaffPayments: React.FC = () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [payments, setPayments] = useState<HostelStaffPayment[]>([]);
  const [staffList, setStaffList] = useState<HostelStaff[]>([]);
  const [branches, setBranches] = useState<HostelBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedStaffId, setSelectedStaffId] = useState<number>();
  const [paymentFormData, setPaymentFormData] = useState({
    staffId: '', cash: '', online: '', date: '', remark: '', branchId: ''
  });
  const [staffFormData, setStaffFormData] = useState({ name: '' });
  const [editingPayment, setEditingPayment] = useState<HostelStaffPayment | null>(null);
  const [editingStaff, setEditingStaff] = useState<HostelStaff | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);

  // load hostel branches
  useEffect(() => {
    api.getHostelBranches()
      .then(data => setBranches(Array.isArray(data)? data : []))
      .catch(() => toast.error('Failed to load hostel branches'));
  }, []);

  // load payments + staff
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await api.getHostelStaffPayments({
          branchId: selectedBranchId,
          month: selectedMonth || undefined,
          staffId: selectedStaffId
        });
        setPayments(data.payments || []);
        setStaffList(data.staff || []);
      } catch {
        toast.error('Failed to load hostel staff payments');
        setPayments([]);
        setStaffList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedBranchId, selectedMonth, selectedStaffId]);

  // when editingPayment changes, populate form
  useEffect(() => {
    if (editingPayment) {
      const pureDate = editingPayment.date.split('T')[0];
      setPaymentFormData({
        staffId: editingPayment.staffId.toString(),
        cash: editingPayment.cash.toString(),
        online: editingPayment.online.toString(),
        date: pureDate,
        remark: editingPayment.remark || '',
        branchId: editingPayment.branchId?.toString() || ''
      });
    } else {
      setPaymentFormData({ 
        staffId: '', 
        cash: '', 
        online: '', 
        date: '', 
        remark: '', 
        branchId: selectedBranchId?.toString()||'' 
      });
    }
  }, [editingPayment, selectedBranchId]);

  // when editingStaff changes, populate form
  useEffect(() => {
    if (editingStaff) {
      setStaffFormData({ name: editingStaff.name });
    } else {
      setStaffFormData({ name: '' });
    }
  }, [editingStaff]);

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentFormData(f => ({ ...f, [name]: value }));
  };

  const handleStaffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStaffFormData(f => ({ ...f, name: e.target.value }));
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedBranchId(e.target.value ? parseInt(e.target.value,10) : undefined);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSelectedMonth(e.target.value);

  const handleStaffFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedStaffId(e.target.value ? parseInt(e.target.value,10) : undefined);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const csvBlob = await api.exportHostelStaffPaymentsCsv({
        branchId: selectedBranchId,
        month: selectedMonth || undefined,
        staffId: selectedStaffId
      });
      const url = window.URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      const suffix = selectedMonth && selectedMonth.trim() ? selectedMonth : 'all';
      link.href = url;
      link.download = `hostel_staff_payments_${suffix}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Export ready');
    } catch (error: any) {
      console.error('Failed to export hostel staff payments CSV:', error);
      toast.error(error.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePaymentSubmit = async () => {
    const totalAmt = parseFloat(paymentFormData.cash||'0') + parseFloat(paymentFormData.online||'0');
    if (!paymentFormData.staffId || totalAmt<=0 || !paymentFormData.date) {
      toast.error('Staff, a valid amount, and date are required');
      return;
    }
    const payload = {
      staffId: parseInt(paymentFormData.staffId,10),
      cash: paymentFormData.cash,
      online: paymentFormData.online,
      date: paymentFormData.date,
      remark: paymentFormData.remark,
      branchId: paymentFormData.branchId ? parseInt(paymentFormData.branchId,10) : null
    };
    try {
      if (editingPayment) {
        await api.updateHostelStaffPayment(editingPayment.id, payload as any);
        toast.success('Payment updated');
        setEditingPayment(null);
      } else {
        await api.addHostelStaffPayment(payload as any);
        toast.success('Payment added');
      }
      // reload list
      const data = await api.getHostelStaffPayments({
        branchId: selectedBranchId,
        month: selectedMonth || undefined,
        staffId: selectedStaffId
      });
      setPayments(data.payments || []);
      setStaffList(data.staff || []);
    } catch {
      toast.error('Failed to save payment');
    }
  };

  const handleStaffSubmit = async () => {
    if (!staffFormData.name || !staffFormData.name.trim()) {
      toast.error('Staff name is required');
      return;
    }
    try {
      if (editingStaff) {
        await api.updateHostelStaff(editingStaff.id, { name: staffFormData.name.trim() });
        toast.success('Staff updated');
        setEditingStaff(null);
      } else {
        await api.addHostelStaff({ name: staffFormData.name.trim() });
        toast.success('Staff added');
      }
      // reload staff list
      const data = await api.getHostelStaffPayments({
        branchId: selectedBranchId,
        month: selectedMonth || undefined,
        staffId: selectedStaffId
      });
      setStaffList(data.staff || []);
      setStaffFormData({ name: '' });
      setShowStaffModal(false);
    } catch {
      toast.error('Failed to save staff');
    }
  };

  const handleEditPayment = (payment: HostelStaffPayment) => setEditingPayment(payment);
  const handleDeletePayment = async (id: number) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await api.deleteHostelStaffPayment(id);
      setPayments(ps => ps.filter(p => p.id !== id));
      toast.success('Deleted');
      if (editingPayment?.id === id) setEditingPayment(null);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleEditStaff = (staff: HostelStaff) => {
    setEditingStaff(staff);
    setShowStaffModal(true);
  };

  const handleDeleteStaff = async (id: number) => {
    if (!window.confirm('Delete this staff? This will also delete all their payment records.')) return;
    try {
      await api.deleteHostelStaff(id);
      setStaffList(s => s.filter(st => st.id !== id));
      setPayments(ps => ps.filter(p => p.staffId !== id));
      toast.success('Staff deleted');
      if (editingStaff?.id === id) {
        setEditingStaff(null);
        setShowStaffModal(false);
      }
    } catch {
      toast.error('Failed to delete staff');
    }
  };

  // display date part only
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return dateString.split('T')[0];
  };

  // group by Month Year
  const groupedPayments = payments.reduce((acc, payment) => {
    const dateStr = formatDate(payment.date);
    if (dateStr === '-') return acc; // Skip invalid dates
    const [year, month] = dateStr.split('-');
    const monthName = new Intl.DateTimeFormat('en-US',{ month:'long' })
      .format(new Date(Number(year), Number(month)-1));
    const key = `${monthName} ${year}`;
    acc[key] = acc[key] || [];
    acc[key].push(payment);
    return acc;
  }, {} as Record<string, HostelStaffPayment[]>);

  const getBranchName = (p: HostelStaffPayment) =>
    p.branchName ||
    (p.branchId ? branches.find(b=>b.id===p.branchId)?.name : 'Global') ||
    'Global';

  const totalAmountDisplay =
    (parseFloat(paymentFormData.cash||'0') + parseFloat(paymentFormData.online||'0')).toFixed(2);

  return (
    <div className="flex h-screen overflow-hidden bg-[#fef9f6]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}/>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading
          ? <div className="text-center text-gray-500">Loading...</div>
          : <motion.div className="max-w-6xl mx-auto"
              initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
              <motion.h1 className="text-2xl md:text-3xl font-bold mb-6"
                initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
                🏨 Hostel Staff Payments
              </motion.h1>

              {/* Filters */}
              <motion.div className="bg-white shadow rounded-lg p-6 mb-4 space-y-4"
                initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} transition={{delay:0.15}}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div>
                      <label className="font-semibold mb-2 block">Filter by Branch</label>
                      <select value={selectedBranchId||''} onChange={handleBranchChange}
                        className="w-full sm:w-48 px-4 py-2 border rounded">
                        <option value="">All Branches</option>
                        {branches.map(b=>(
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold mb-2 block">Filter by Month</label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={handleMonthChange}
                        className="w-full sm:w-48 px-4 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="font-semibold mb-2 block">Filter by Staff</label>
                      <select value={selectedStaffId||''} onChange={handleStaffFilterChange}
                        className="w-full sm:w-48 px-4 py-2 border rounded">
                        <option value="">All Staff</option>
                        {staffList.map(s=>(
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowStaffModal(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
                    >
                      Manage Staff
                    </button>
                    <button
                      onClick={handleExportCsv}
                      disabled={isExporting}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isExporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Add/Edit Payment Form */}
              <motion.div className="bg-white shadow rounded-lg p-6 mb-8"
                initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} transition={{delay:0.15}}>
                <h2 className="text-lg font-semibold mb-4">
                  {editingPayment ? 'Edit Payment' : 'Add New Payment'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* Staff */}
                  <div>
                    <label className="block text-sm">Staff</label>
                    <select name="staffId" value={paymentFormData.staffId} onChange={handlePaymentChange}
                      className="w-full mt-1 px-4 py-2 border rounded">
                      <option value="">Select Staff</option>
                      {staffList.map(s=>(
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Cash */}
                  <div>
                    <label className="block text-sm">Cash Amount</label>
                    <input type="number" name="cash" value={paymentFormData.cash}
                      onChange={handlePaymentChange} step="0.01" placeholder="0.00"
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Online */}
                  <div>
                    <label className="block text-sm">Online Amount</label>
                    <input type="number" name="online" value={paymentFormData.online}
                      onChange={handlePaymentChange} step="0.01" placeholder="0.00"
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Date */}
                  <div>
                    <label className="block text-sm">Date</label>
                    <input type="date" name="date" value={paymentFormData.date}
                      onChange={handlePaymentChange}
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Remark */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm">Remark</label>
                    <input name="remark" value={paymentFormData.remark}
                      onChange={handlePaymentChange}
                      placeholder="Optional remark"
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Branch */}
                  <div>
                    <label className="block text-sm">Branch</label>
                    <select name="branchId" value={paymentFormData.branchId}
                      onChange={handlePaymentChange}
                      className="w-full mt-1 px-4 py-2 border rounded">
                      <option value="">Global (No Branch)</option>
                      {branches.map(b=>(
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-between items-center">
                  <div className="font-semibold">
                    Total Amount: ₹{totalAmountDisplay}
                  </div>
                  <div className="space-x-2">
                    <button onClick={handlePaymentSubmit}
                      className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700">
                      {editingPayment ? 'Update' : 'Add'}
                    </button>
                    {editingPayment && (
                      <button onClick={()=>setEditingPayment(null)}
                        className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Staff Modal */}
              {showStaffModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <motion.div className="bg-white rounded-lg p-6 w-full max-w-md"
                    initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}>
                    <h2 className="text-lg font-semibold mb-4">
                      {editingStaff ? 'Edit Staff' : 'Add New Staff'}
                    </h2>
                    <div className="mb-4">
                      <label className="block text-sm mb-2">Staff Name</label>
                      <input
                        type="text"
                        value={staffFormData.name}
                        onChange={handleStaffChange}
                        placeholder="Enter staff name"
                        className="w-full px-4 py-2 border rounded"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowStaffModal(false);
                          setEditingStaff(null);
                          setStaffFormData({ name: '' });
                        }}
                        className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleStaffSubmit}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        {editingStaff ? 'Update' : 'Add'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Staff List */}
              <motion.div className="bg-white shadow rounded-lg p-6 mb-8"
                initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} transition={{delay:0.2}}>
                <h2 className="text-lg font-semibold mb-4">Staff List</h2>
                {staffList.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">No staff added yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 font-semibold">
                        <tr>
                          <th className="py-3 px-4 text-left">Name</th>
                          <th className="py-3 px-4 text-left">Created At</th>
                          <th className="py-3 px-4 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffList.map(staff => (
                          <tr key={staff.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4">{staff.name}</td>
                            <td className="py-3 px-4">{formatDate(staff.createdAt)}</td>
                            <td className="py-3 px-4">
                              <button onClick={()=>handleEditStaff(staff)} className="text-blue-600 hover:underline mr-2">Edit</button>
                              <button onClick={()=>handleDeleteStaff(staff.id)} className="text-red-600 hover:underline">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>

              {/* Payments Listings */}
              {Object.entries(groupedPayments)
                .sort(([a],[b]) => {
                  const [ma, ya] = a.split(' ');
                  const [mb, yb] = b.split(' ');
                  return new Date(`${yb}-${mb}-01`).getTime()
                       - new Date(`${ya}-${ma}-01`).getTime();
                })
                .map(([monthYear, pays], idx) => {
                  const total = pays.reduce((sum,p)=> sum+ p.amount, 0);
                  return (
                    <motion.div key={monthYear} className="mb-8"
                      initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
                      transition={{delay:0.2 + idx*0.1}}>
                      <h2 className="text-xl font-semibold mb-4">{monthYear}</h2>
                      <div className="overflow-x-auto bg-white shadow rounded-lg">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100 font-semibold">
                            <tr>
                              {['Staff Name','Cash','Online','Total Amount','Remark','Date','Branch','Actions']
                                .map(h=> <th key={h} className="py-3 px-4 text-left">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {pays.map(p=>(
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="py-3 px-4">{p.staffName}</td>
                                <td className="py-3 px-4">₹{p.cash.toFixed(2)}</td>
                                <td className="py-3 px-4">₹{p.online.toFixed(2)}</td>
                                <td className="py-3 px-4 font-semibold">₹{p.amount.toFixed(2)}</td>
                                <td className="py-3 px-4">{p.remark||'-'}</td>
                                <td className="py-3 px-4">{formatDate(p.date)}</td>
                                <td className="py-3 px-4">{getBranchName(p)}</td>
                                <td className="py-3 px-4">
                                  <button onClick={()=>handleEditPayment(p)} className="text-blue-600 hover:underline mr-2">Edit</button>
                                  <button onClick={()=>handleDeletePayment(p.id)} className="text-red-600 hover:underline">Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-2 text-right font-semibold">
                        Total for {monthYear}: ₹{total.toFixed(2)}
                      </div>
                    </motion.div>
                  );
                })
              }

              {payments.length === 0 && !loading && (
                <div className="p-6 text-center text-gray-500">No payments found.</div>
              )}
            </motion.div>
        }
      </div>
    </div>
  );
};

export default HostelStaffPayments;
