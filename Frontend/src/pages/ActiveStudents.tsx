import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '../services/api';
import { Search, ChevronLeft, ChevronRight, Trash2, Eye, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Define the Student type with the dynamic status field
interface Student {
  id: number;
  name: string;
  registrationNumber?: string | null;
  email: string;
  phone: string;
  address: string;
  branchId: number;
  membershipStart: string;
  membershipEnd: string;
  totalFee: number;
  amountPaid: number;
  status: string; // Can be 'active', 'expired', etc.
  createdAt: string;
}

// Utility function to format date to YYYY-MM-DD
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toISOString().split('T')[0];
};

const ActiveStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage, setStudentsPerPage] = useState(10);
  const [isCollapsed, setIsCollapsed] = useState(false); // Added for Sidebar
  const navigate = useNavigate();

  // Normalize Indian phone number to wa.me format
  const buildWhatsAppUrl = (phone: string | undefined | null): string | null => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    let num = digits;
    if (num.startsWith('91') && num.length === 12) {
      // already correct
    } else if (num.length === 10) {
      num = '91' + num;
    } else if (num.startsWith('0') && num.length === 11) {
      num = '91' + num.slice(1);
    } else if (num.startsWith('91') && num.length > 12) {
      // keep last 10 as local number
      num = '91' + num.slice(-10);
    } else if (num.length > 10) {
      num = '91' + num.slice(-10);
    } else {
      return null;
    }
    return `https://wa.me/${num}`;
  };

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await api.getStudents();
        const updatedStudents = response.students.map((student: Student) => {
          const membershipEndDate = new Date(student.membershipEnd);
          const currentDate = new Date();
          const isExpired = membershipEndDate < currentDate;
          return {
            ...student,
            status: isExpired ? 'expired' : student.status,
          };
        });
        const activeStudents = updatedStudents.filter((student: Student) => student.status === 'active');
        setStudents(activeStudents);
        setLoading(false);
      } catch (error: any) {
        console.error('Failed to fetch active students:', error.message);
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredStudents = students.filter((student: Student) =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.registrationNumber && student.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

  const handleDelete = async (id: number) => { // Fixed: id type to number
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await api.deleteStudent(id);
        setStudents(students.filter((student) => student.id !== id));
        toast.success('Student deleted successfully');
      } catch (error: any) {
        console.error('Failed to delete student:', error.message);
        toast.error('Failed to delete student');
      }
    }
  };

  const handleViewDetails = (id: number) => { // Fixed: id type to number
    navigate(`/students/${id}`);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} /> {/* Added props */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Active Students</h1>
              <p className="text-gray-500">Manage all your active students</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <h3 className="text-lg font-medium">Active Students List</h3>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-300"
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} // Added type
                  />
                </div>
              </div>
              {loading ? (
                <div className="flex justify-center p-8">Loading active students...</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Registration Number</TableHead>
                          <TableHead className="hidden md:table-cell">Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Membership End</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentStudents.length > 0 ? (
                          currentStudents.map((student: Student) => (
                            <TableRow key={student.id}>
                              <TableCell>{student.name}</TableCell>
                              <TableCell>{student.registrationNumber || 'N/A'}</TableCell>
                              <TableCell className="hidden md:table-cell">{student.phone}</TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {student.status === 'active' ? 'Active' : 'Expired'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">{formatDate(student.membershipEnd)}</TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1 md:gap-2">
                                  {/* WhatsApp chat */}
                                  {(() => {
                                    const waUrl = buildWhatsAppUrl(student.phone);
                                    return waUrl ? (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded hover:bg-gray-100 text-green-600 hover:text-green-800 inline-flex items-center justify-center"
                                        title={`Chat on WhatsApp`}
                                      >
                                        <MessageCircle size={16} />
                                      </a>
                                    ) : (
                                      <button
                                        className="p-2 rounded text-gray-400 cursor-not-allowed inline-flex items-center justify-center"
                                        title="Invalid phone number"
                                        disabled
                                      >
                                        <MessageCircle size={16} />
                                      </button>
                                    );
                                  })()}
                                  <button
                                    onClick={() => handleViewDetails(student.id)}
                                    className="p-2 rounded hover:bg-gray-100 text-blue-600 hover:text-blue-800 inline-flex items-center justify-center"
                                    title="View details"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(student.id)}
                                    className="p-2 rounded hover:bg-gray-100 text-red-600 hover:text-red-800 inline-flex items-center justify-center"
                                    title="Delete student"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                              {filteredStudents.length === 0
                                ? 'No active students found matching your search.'
                                : 'No active students on this page.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {!loading && filteredStudents.length > 0 && (
                <div className="flex flex-col md:flex-row items-center justify-between border-t border-gray-200 px-6 py-3 space-y-2 md:space-y-0">
                  <div className="flex items-center space-x-2">
                    <select
                      value={studentsPerPage}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { // Added type
                        setStudentsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="text-sm border rounded py-2 px-3"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-500">students per page</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="text-sm text-gray-500">
                    Showing {indexOfFirstStudent + 1} to {Math.min(indexOfLastStudent, filteredStudents.length)} of {filteredStudents.length} students
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveStudents;