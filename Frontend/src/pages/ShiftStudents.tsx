// File: ShiftStudents.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

interface Student {
  id: number;
  name: string;
  registrationNumber?: string | null;
  email: string;
  phone: string;
  address: string;
  branchId: number;
  branchName?: string;
  membershipStart: string;
  membershipEnd: string;
  status: 'active' | 'expired';
  totalFee: number;
  amountPaid: number;
  dueAmount: number;
  cash: number;
  online: number;
  securityMoney: number;
  remark: string | null;
  profileImageUrl?: string | null;
  createdAt: string;
  assignments?: Array<{
    seatId: number;
    shiftId: number;
    seatNumber: string;
    shiftTitle: string;
  }>;
}

interface Branch {
  id: number;
  name: string;
  code: string | null; // Ensuring 'code' can be null to match the first error's context
}

// New interface for the API response containing students and total count
interface StudentsByShiftResponse {
  students: Student[];
  totalCount: number;
}

const ShiftStudents: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shiftName, setShiftName] = useState<string>('');
  const [filters, setFilters] = useState({ search: '', status: 'all', branchId: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        // Assuming api.getBranches() returns Promise<Branch[]>
        const data = await api.getBranches();
        setBranches(data || []); // Corrected: removed .data
      } catch (err) {
        console.error('Failed to fetch branches:', err);
      }
    };
    fetchBranches();
  }, []);

  useEffect(() => {
    const fetchShiftAndStudents = async () => {
      try {
        setIsLoading(true);
        const shiftId = parseInt(id!, 10);
        if (isNaN(shiftId)) {
          throw new Error('Invalid shift ID');
        }

        const shiftResponse = await api.getSchedule(shiftId);
        setShiftName(shiftResponse.description || `Shift ${shiftId}`);

        const params: { search?: string; status?: string; branchId?: number; page?: number; limit?: number } = {
          search: filters.search || undefined,
          status: filters.status !== 'all' ? filters.status : undefined,
          branchId: filters.branchId !== 'all' ? parseInt(filters.branchId) : undefined,
          page: currentPage,
          limit: itemsPerPage,
        };

        // Corrected: Use type assertion 'as' to resolve the type mismatch.
        const studentsResponse = await api.getStudentsByShift(shiftId, params) as StudentsByShiftResponse;

        if (!studentsResponse || !Array.isArray(studentsResponse.students)) {
          throw new Error('Invalid response: Students data is missing or not an array');
        }

        setStudents(studentsResponse.students);
        setTotalStudents(studentsResponse.totalCount || 0);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load shift details or students. Please try again later.';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error('Failed to fetch shift or students:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchShiftAndStudents();
  }, [id, filters, currentPage, itemsPerPage]); // Add pagination states to dependencies

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleBranchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, branchId: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value, 10));
    setCurrentPage(1); // Reset to first page when items per page changes
  };

  const totalPages = Math.ceil(totalStudents / itemsPerPage);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md dark:bg-gray-800 dark:text-gray-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>
      <div
        className={`fixed inset-y-0 left-0 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 ${
          isCollapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </div>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Students in {shiftName}
                </CardTitle>
                <Button
                  variant="outline"
                  onClick={() => navigate('/shifts')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Back to Shifts
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <Input
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Search by name or phone"
                    className="max-w-sm"
                  />
                  <Select value={filters.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.branchId} onValueChange={handleBranchChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading students...</div>
                ) : error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : students.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No students found for this shift with the selected filters.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Registration No.</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.registrationNumber || 'N/A'}</TableCell>
                            <TableCell>{student.email || 'N/A'}</TableCell>
                            <TableCell>{student.phone || 'N/A'}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                  student.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {student.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total Students: {totalStudents}
                      </div>
                      <div className="flex items-center space-x-4">
                        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                          <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Per page" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages || totalStudents === 0}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftStudents;