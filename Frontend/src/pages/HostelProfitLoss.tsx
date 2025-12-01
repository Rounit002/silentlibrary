import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import api from '../services/api'; // Assuming you will add getHostelProfitLoss to this file
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiCreditCard, FiCalendar, FiFilter, FiChevronsRight } from 'react-icons/fi';

interface Branch {
  id: number;
  name: string;
}

const HostelProfitLoss: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [date, setDate] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reportTitle, setReportTitle] = useState('');

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        // Fetch hostel-specific branches
        const branchesData = await api.getHostelBranches();
        setBranches(branchesData);
      } catch (error) {
        console.error('Failed to fetch hostel branches:', error);
        toast.error('Failed to load hostel branches');
      }
    };
    fetchBranches();
  }, []);

  const handleFetch = async () => {
    if (!month && !date) {
      toast.error('Please select a month or a specific date.');
      return;
    }
    setLoading(true);
    setData(null);

    try {
      const params: { month?: string; date?: string; branchId?: number | null } = {
        branchId: selectedBranchId,
      };

      let reportPeriod = '';
      if (date) {
        params.date = date;
        const d = new Date(date + 'T00:00:00');
        reportPeriod = d.toLocaleDateString('en-US', { dateStyle: 'full' });
      } else if (month) {
        params.month = month;
        const [year, m] = month.split('-');
        const d = new Date(parseInt(year), parseInt(m) - 1);
        reportPeriod = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      }

      // Call the new API endpoint for hostel P&L
      // NOTE: You must add a `getHostelProfitLoss` function to your `services/api.ts` file
      const response = await api.getHostelProfitLoss(params);
      setData(response);
      setReportTitle(reportPeriod);
    } catch (error) {
      console.error('Failed to fetch hostel profit/loss:', error);
      toast.error('Failed to load hostel profit/loss data. ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const InfoCard = ({ title, value, icon, colorClass = 'text-gray-800' }: { title: string; value: string; icon: React.ReactNode; colorClass?: string }) => (
    <motion.div
      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
      whileHover={{ y: -5, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div className="flex items-center">
        <div className="p-3 bg-gray-100 rounded-full mr-4">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className={`text-lg font-semibold ${colorClass}`}>{value}</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <style>
        {`
          .loader { border-top-color: #9333ea; animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}
      </style>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <motion.div
            className="max-w-7xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1 className="text-3xl md:text-4xl font-bold mb-6 text-gray-800 flex items-center gap-3">
              <FiChevronsRight className="text-purple-600" />
              Hostel Profit & Loss Statement
            </motion.h1>

            <motion.div
              className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-200"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <FiFilter className="mr-2" /> Report Filters
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="month" className="block text-sm font-medium text-gray-600 mb-1">Month</label>
                  <input
                    type="month" id="month" value={month} onChange={(e) => { setMonth(e.target.value); setDate(''); }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-600 mb-1">Specific Date (Overrides Month)</label>
                  <input
                    type="date" id="date" value={date} onChange={(e) => { setDate(e.target.value); setMonth(''); }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="branch" className="block text-sm font-medium text-gray-600 mb-1">Branch</label>
                  <select
                    id="branch" value={selectedBranchId || ''} onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleFetch} disabled={loading}
                  className="w-full sm:w-auto bg-purple-600 text-white font-semibold px-8 py-2.5 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all duration-300 ease-in-out disabled:bg-purple-300 flex items-center justify-center"
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </motion.div>

            {loading && (
              <div className="text-center p-10">
                <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mx-auto"></div>
                <p className="mt-4 text-gray-500">Fetching financial data...</p>
              </div>
            )}

            {!loading && !data && (
              <div className="text-center p-10 bg-white rounded-lg shadow-sm border-2 border-dashed">
                <FiCalendar className="mx-auto text-5xl text-gray-300" />
                <p className="mt-4 text-gray-500">Select a period and click "Generate Report" to view the summary.</p>
              </div>
            )}

            {data && (
              <motion.div
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-200"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-xl font-bold mb-6 text-gray-800">
                  Hostel Financial Summary for <span className="text-purple-600">{reportTitle}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <InfoCard title="Total Collections" value={`₹${data.totalCollected.toFixed(2)}`} icon={<FiDollarSign className="text-green-500" />} colorClass="text-green-600" />
                  <InfoCard title="Cash Collections" value={`₹${data.cashCollected.toFixed(2)}`} icon={<FiDollarSign className="text-blue-500" />} colorClass="text-blue-600" />
                  <InfoCard title="Online Collections" value={`₹${data.onlineCollected.toFixed(2)}`} icon={<FiCreditCard className="text-purple-500" />} colorClass="text-purple-600" />
                  <InfoCard title="Total Expenses" value={`₹${data.totalExpenses.toFixed(2)}`} icon={<FiCreditCard className="text-red-500" />} colorClass="text-red-600" />
                  <InfoCard title="Cash Expenses" value={`₹${data.cashExpenses.toFixed(2)}`} icon={<FiDollarSign className="text-orange-500" />} colorClass="text-orange-600" />
                  <InfoCard title="Online Expenses" value={`₹${data.onlineExpenses.toFixed(2)}`} icon={<FiCreditCard className="text-indigo-500" />} colorClass="text-indigo-600" />
                  {data.profitLoss >= 0 ? (
                    <InfoCard title="Net Profit" value={`₹${Math.abs(data.profitLoss).toFixed(2)}`} icon={<FiTrendingUp className="text-green-500" />} colorClass="text-green-600" />
                  ) : (
                    <InfoCard title="Net Loss" value={`₹${Math.abs(data.profitLoss).toFixed(2)}`} icon={<FiTrendingDown className="text-red-500" />} colorClass="text-red-600" />
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default HostelProfitLoss;