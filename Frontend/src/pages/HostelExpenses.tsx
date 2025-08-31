import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

// Interfaces for our data structures
interface Expense {
  id: number;
  title: string;
  amount: number;
  cash: number;
  online: number;
  date: string;
  remark: string | null;
  branchId?: number | null;
  branchName?: string | null;
}

interface Branch  { id: number; name: string }

interface ApiExpenseResponse {
  id: number;
  title: string;
  amount: number | string;
  cash: number | string;
  online: number | string;
  date: string;
  remark: string | null;
  branchId?: number | null;
  branchName?: string | null;
}

// Helper function to parse expense data from the API
const parseExpensesData = (data: any): Expense[] => {
  if (!data || !Array.isArray(data.expenses)) {
    console.error('Invalid API response:', data);
    throw new Error('Invalid API response: expenses is not an array');
  }
  return data.expenses.map((e: ApiExpenseResponse) => ({
    id: e.id,
    title: e.title,
    amount: parseFloat(String(e.amount || 0)),
    cash:   parseFloat(String(e.cash   || 0)),
    online: parseFloat(String(e.online || 0)),
    date: e.date,
    remark: e.remark,
    branchId:   e.branchId   ?? null,
    branchName: e.branchName ?? null,
  }));
};

const HostelExpenses: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expenses,     setExpenses]     = useState<Expense[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>();
  const [formData,     setFormData]     = useState({
    title: '', cash: '', online: '', date: '', remark: '', branchId: ''
  });
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loading,      setLoading]      = useState(true);

  // Effect to load branches on component mount
  useEffect(() => {
    api.getHostelBranches()
      .then(data => setBranches(Array.isArray(data)? data : []))
      .catch(() => toast.error('Failed to load hostel branches'));
  }, []);

  // Effect to load hostel expenses
  useEffect(() => {
    setLoading(true);
    api.getHostelExpenses(selectedBranchId)
      .then(data => {
        setExpenses(parseExpensesData(data));
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load hostel expenses');
        setExpenses([]);
      })
      .finally(() => setLoading(false));
  }, [selectedBranchId]);

  // Effect to populate the form when an expense is selected for editing
  useEffect(() => {
    if (editingExpense) {
      const pureDate = editingExpense.date.split('T')[0];
      setFormData({
        title:  editingExpense.title,
        cash:   editingExpense.cash.toString(),
        online: editingExpense.online.toString(),
        date:   pureDate,
        remark: editingExpense.remark || '',
        branchId: editingExpense.branchId?.toString() || ''
      });
    } else {
      setFormData({ title:'', cash:'', online:'', date:'', remark:'', branchId: selectedBranchId?.toString()||'' });
    }
  }, [editingExpense, selectedBranchId]);

  // Form input change handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(f => ({ ...f, [name]: value }));
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedBranchId(e.target.value ? parseInt(e.target.value,10) : undefined);

  // Form submission handler (for adding or updating)
  const handleSubmit = async () => {
    const totalAmt = parseFloat(formData.cash||'0') + parseFloat(formData.online||'0');
    if (!formData.title || totalAmt<=0 || !formData.date) {
      toast.error('Title, a valid amount, and date are required');
      return;
    }
    const payload = {
      title: formData.title,
      cash: formData.cash,
      online: formData.online,
      date: formData.date,
      remark: formData.remark,
      branchId: formData.branchId ? parseInt(formData.branchId,10) : null
    };
    try {
      if (editingExpense) {
        await api.updateHostelExpense(editingExpense.id, payload as any);
        toast.success('Hostel expense updated');
        setEditingExpense(null);
      } else {
        await api.addHostelExpense(payload as any);
        toast.success('Hostel expense added');
      }
      // Reload the list after submission
      const data = await api.getHostelExpenses(selectedBranchId);
      setExpenses(parseExpensesData(data));
    } catch {
      toast.error('Failed to save hostel expense');
    }
  };

  const handleEdit = (exp: Expense) => setEditingExpense(exp);
  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.deleteHostelExpense(id);
      setExpenses(es => es.filter(e => e.id !== id));
      toast.success('Deleted');
      if (editingExpense?.id === id) setEditingExpense(null);
    } catch {
      toast.error('Failed to delete');
    }
  };

  // Helper to format date string
  const formatDate = (dateString: string) => dateString.split('T')[0];

  // Group expenses by month and year for display
  const groupedExpenses = expenses.reduce((acc, exp) => {
    const [year, month] = formatDate(exp.date).split('-');
    const monthName = new Intl.DateTimeFormat('en-US',{ month:'long' })
      .format(new Date(Number(year), Number(month)-1));
    const key = `${monthName} ${year}`;
    acc[key] = acc[key] || [];
    acc[key].push(exp);
    return acc;
  }, {} as Record<string, Expense[]>);

  const getBranchName = (e: Expense) =>
    e.branchName ||
    (e.branchId ? branches.find(b=>b.id===e.branchId)?.name : 'Global') ||
    'Global';

  const totalAmountDisplay =
    (parseFloat(formData.cash||'0') + parseFloat(formData.online||'0')).toFixed(2);

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
                Hostel Expenses
              </motion.h1>

              {/* Branch Filter */}
              <motion.div className="bg-white shadow rounded-lg p-6 mb-4"
                initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} transition={{delay:0.15}}>
                <label className="font-semibold mb-2 block">Filter by Branch</label>
                <select value={selectedBranchId||''} onChange={handleBranchChange}
                  className="w-full sm:w-1/3 px-4 py-2 border rounded">
                  <option value="">All Branches</option>
                  {branches.map(b=>(
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </motion.div>

              {/* Add/Edit Form */}
              <motion.div className="bg-white shadow rounded-lg p-6 mb-8"
                initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} transition={{delay:0.15}}>
                <h2 className="text-lg font-semibold mb-4">
                  {editingExpense ? 'Edit Hostel Expense' : 'Add New Hostel Expense'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  
                  {/* --- FIX START --- */}
                  {/* Title Input */}
                  <div>
                    <label className="block text-sm">Title</label>
                    <input type="text" name="title" value={formData.title}
                      onChange={handleChange} placeholder="Enter expense title"
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* --- FIX END --- */}

                  {/* Cash */}
                  <div>
                    <label className="block text-sm">Cash Amount</label>
                    <input type="number" name="cash" value={formData.cash}
                      onChange={handleChange} step="0.01" placeholder="0.00"
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Online */}
                  <div>
                    <label className="block text-sm">Online Amount</label>
                    <input type="number" name="online" value={formData.online}
                      onChange={handleChange} step="0.01" placeholder="0.00"
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Date */}
                  <div>
                    <label className="block text-sm">Date</label>
                    <input type="date" name="date" value={formData.date}
                      onChange={handleChange}
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Remark */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm">Remark</label>
                    <input name="remark" value={formData.remark}
                      onChange={handleChange}
                      placeholder="Optional remark"
                      className="w-full mt-1 px-4 py-2 border rounded"/>
                  </div>
                  {/* Branch */}
                  <div>
                    <label className="block text-sm">Branch</label>
                    <select name="branchId" value={formData.branchId}
                      onChange={handleChange}
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
                    <button onClick={handleSubmit}
                      className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700">
                      {editingExpense ? 'Update' : 'Add'}
                    </button>
                    {editingExpense && (
                      <button onClick={()=>setEditingExpense(null)}
                        className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Listings Table */}
              {Object.entries(groupedExpenses)
                .sort(([a],[b]) => {
                  const [ma, ya] = a.split(' ');
                  const [mb, yb] = b.split(' ');
                  return new Date(`${yb}-${mb}-01`).getTime()
                       - new Date(`${ya}-${ma}-01`).getTime();
                })
                .map(([monthYear, exps], idx) => {
                  const total = exps.reduce((sum,e)=> sum+ e.amount, 0);
                  return (
                    <motion.div key={monthYear} className="mb-8"
                      initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
                      transition={{delay:0.2 + idx*0.1}}>
                      <h2 className="text-xl font-semibold mb-4">{monthYear}</h2>
                      <div className="overflow-x-auto bg-white shadow rounded-lg">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100 font-semibold">
                            <tr>
                              {['Title','Cash','Online','Total Amount','Remark','Date','Branch','Actions']
                                .map(h=> <th key={h} className="py-3 px-4 text-left">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {exps.map(e=>(
                              <tr key={e.id} className="hover:bg-gray-50">
                                <td className="py-3 px-4">{e.title}</td>
                                <td className="py-3 px-4">₹{e.cash.toFixed(2)}</td>
                                <td className="py-3 px-4">₹{e.online.toFixed(2)}</td>
                                <td className="py-3 px-4 font-semibold">₹{e.amount.toFixed(2)}</td>
                                <td className="py-3 px-4">{e.remark||'-'}</td>
                                <td className="py-3 px-4">{formatDate(e.date)}</td>
                                <td className="py-3 px-4">{getBranchName(e)}</td>
                                <td className="py-3 px-4">
                                  <button onClick={()=>handleEdit(e)} className="text-blue-600 hover:underline mr-2">Edit</button>
                                  <button onClick={()=>handleDelete(e.id)} className="text-red-600 hover:underline">Delete</button>
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

              {expenses.length === 0 && !loading && (
                <div className="p-6 text-center text-gray-500">No hostel expenses found.</div>
              )}
            </motion.div>
        }
      </div>
    </div>
  );
};

export default HostelExpenses;