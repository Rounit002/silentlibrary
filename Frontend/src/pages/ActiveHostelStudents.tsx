import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { MessageSquare } from 'lucide-react';

interface ActiveStudent {
  id: string;
  name: string;
  phoneNumber: string;
  branchName: string;
  stayEndDate: string;
}

const ActiveHostelStudents: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);
  const [hostelBranches, setHostelBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildWhatsAppUrl = (phone: string): string | null => {
    const cleanedPhone = phone.replace(/\s+/g, '');
    const digits = cleanedPhone.replace(/\D/g, '');
    if (!digits) return null;
    return `https://wa.me/${digits.startsWith('91') ? digits : '91' + digits}`;
  };

  useEffect(() => {
    const fetchActiveStudents = async () => {
      setLoading(true);
      setError(null);
      try {
        const allStudents = await api.getHostelStudents(typeof selectedBranchId === 'number' ? selectedBranchId : undefined);
        if (!Array.isArray(allStudents)) {
          throw new Error('Invalid data received from server');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today for accurate comparison

        const filteredStudents = allStudents
          .filter((student: any) => {
            if (!student.stayEndDate) return false;
            const endDate = new Date(student.stayEndDate);
            return endDate >= today;
          })
          .map((student: any) => ({
            id: student.id,
            name: student.name,
            phoneNumber: student.phoneNumber || student.studentPhoneNumber || 'N/A',
            branchName: student.branchName || 'N/A',
            stayEndDate: new Date(student.stayEndDate).toLocaleDateString(),
          }));

        setActiveStudents(filteredStudents);
      } catch (err: any) {
        console.error('Failed to fetch active students:', err);
        const errorMessage = err.message || 'Failed to fetch active students';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    const fetchHostelBranches = async () => {
      try {
        const branches = await api.getHostelBranches();
        if (Array.isArray(branches)) {
          setHostelBranches(branches);
        } else {
          setHostelBranches([]);
        }
      } catch (err: any) {
        console.error('Failed to fetch hostel branches:', err);
      }
    };

    fetchHostelBranches();
    fetchActiveStudents();
  }, [selectedBranchId]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#fef9f6]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
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
              ✅ Active Hostel Students
            </motion.h1>
            <div className="bg-white rounded-lg shadow-sm border p-3 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedBranchId(val === '' ? '' : Number(val));
                  }}
                  className="w-full sm:w-64 p-2 border rounded-md bg-white"
                >
                  <option value="">All branches</option>
                  {hostelBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membership End Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                        No active students found.
                      </td>
                    </tr>
                  ) : (
                    activeStudents.map((student) => (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{student.name}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{student.phoneNumber}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{student.branchName}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{student.stayEndDate}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">
                          {student.phoneNumber && student.phoneNumber !== 'N/A' ? (
                            <button
                              onClick={() => {
                                const waUrl = buildWhatsAppUrl(student.phoneNumber);
                                if (!waUrl) return;
                                window.open(waUrl, '_blank');
                              }}
                              className="inline-flex items-center justify-center p-2 rounded border hover:bg-gray-50"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare size={16} />
                            </button>
                          ) : null}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ActiveHostelStudents;