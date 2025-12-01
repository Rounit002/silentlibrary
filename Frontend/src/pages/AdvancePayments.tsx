import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, CreditCard, Calendar, User, DollarSign } from 'lucide-react';

interface AdvancePayment {
  id: number;
  studentId: number;
  studentName: string;
  studentPhone: string;
  registrationNumber: string;
  studentMembershipEnd?: string; // Added student's membership end date
  amount: number;
  paymentMethod: 'cash' | 'online';
  paymentDate: string;
  usedAmount: number;
  remainingAmount: number;
  status: 'active' | 'fully_used' | 'cancelled';
  notes: string;
  branchId: number;
  branchName: string;
  createdAt: string;
}

interface Student {
  id: number;
  name: string;
  phone: string;
  registration_number: string;
  membership_end?: string; // Added membership end date
  // branch_id is not returned by GET /api/students currently; make it optional
  branch_id?: number;
}

interface Branch {
  id: number;
  name: string;
}

const AdvancePayments: React.FC = () => {
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<AdvancePayment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'fully_used' | 'cancelled'>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [dateFilterType, setDateFilterType] = useState<'none' | 'specificDate' | 'month'>('none');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    payment_method: 'cash' as 'cash' | 'online',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
    branch_id: '',
    membership_end: ''
  });

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  useEffect(() => {
    fetchAdvancePayments();
    fetchStudents();
    fetchBranches();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showStudentDropdown) {
        const target = event.target as Element;
        if (!target.closest('.student-dropdown-container')) {
          setShowStudentDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStudentDropdown]);

  const formatDate = (dateString: string) => {
    // Format date as YYYY-MM-DD regardless of input format
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = () => {
    if (dateFilterType === 'specificDate' && selectedDate) {
      const formattedDate = formatDate(selectedDate);
      return {
        startDate: formattedDate,
        endDate: formattedDate
      };
    } else if (dateFilterType === 'month' && selectedMonth) {
      // First day of the selected month
      const startDate = `${selectedMonth}-01`;
      // Last day of the selected month
      const lastDay = new Date(
        parseInt(selectedMonth.split('-')[0]),
        parseInt(selectedMonth.split('-')[1]),
        0
      ).getDate();
      const endDate = `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;
      
      return { startDate, endDate };
    }
    return { startDate: '', endDate: '' };
  };

  const fetchAdvancePayments = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (branchFilter !== 'all') params.append('branchId', branchFilter);

      // Add date range filter if any is selected
      if (dateFilterType !== 'none') {
        const { startDate, endDate } = getDateRange();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      }

      // First fetch advance payments
      const [paymentsResponse, studentsResponse] = await Promise.all([
        fetch(`/api/advance-payments?${params}`, { credentials: 'include' }),
        fetch('/api/students', { credentials: 'include' })
      ]);
      
      if (paymentsResponse.ok && studentsResponse.ok) {
        const [paymentsData, studentsData] = await Promise.all([
          paymentsResponse.json(),
          studentsResponse.json()
        ]);

        // Create a map of student ID to membership end date
        const studentMembershipMap = new Map<number, string>();
        studentsData.students.forEach((student: any) => {
          if (student.membership_end) {
            studentMembershipMap.set(student.id, student.membership_end);
          }
        });

        // Enrich advance payments with student membership end date
        const enrichedPayments = paymentsData.advancePayments.map((payment: any) => ({
          ...payment,
          studentMembershipEnd: studentMembershipMap.get(payment.studentId) || null
        }));

        setAdvancePayments(enrichedPayments);
      }
    } catch (error) {
      console.error('Error fetching advance payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (searchTerm = '') => {
    try {
      const url = `/api/students${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Ensure membership_end is properly formatted
        const formattedStudents = data.students.map((student: any) => ({
          ...student,
          membership_end: student.membership_end ? new Date(student.membership_end).toISOString().split('T')[0] : null
        }));
        setStudents(formattedStudents);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = selectedPayment 
        ? `/api/advance-payments/${selectedPayment.id}`
        : '/api/advance-payments';
      
      const method = selectedPayment ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchAdvancePayments();
        resetForm();
        setShowAddModal(false);
        setShowEditModal(false);
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Error saving advance payment');
      }
    } catch (error) {
      console.error('Error saving advance payment:', error);
      alert('Error saving advance payment');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this advance payment?')) return;

    try {
      const response = await fetch(`/api/advance-payments/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        fetchAdvancePayments();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Error cancelling advance payment');
      }
    } catch (error) {
      console.error('Error cancelling advance payment:', error);
      alert('Error cancelling advance payment');
    }
  };

  const resetForm = () => {
    setFormData({
      student_id: '',
      amount: '',
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: '',
      branch_id: '',
      membership_end: ''
    });
    setSelectedStudent(null);
    setStudentSearchTerm('');
    setShowStudentDropdown(false);
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setStudentSearchTerm(`${student.name} - ${student.phone}`);
    
    if (student.branch_id) {
      const studentBranch = branches.find(b => b.id === student.branch_id);
      if (studentBranch) {
        setSelectedBranch(studentBranch);
      }
    }

    setFormData({
      ...formData,
      student_id: student.id.toString(),
      branch_id: student.branch_id ? student.branch_id.toString() : '',
      membership_end: student.membership_end || ''
    });
    setShowStudentDropdown(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStudentSearchTerm(value);
    
    if (value.length > 1 || value.length === 0) {
      fetchStudents(value);
    }
    
    setShowStudentDropdown(value.length > 0);
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    student.phone.includes(studentSearchTerm) ||
    (student.registration_number && student.registration_number.toLowerCase().includes(studentSearchTerm.toLowerCase()))
  );

  const openEditModal = (payment: AdvancePayment) => {
    setSelectedPayment(payment);
    const student = students.find(s => s.id === payment.studentId);
    if (student) {
      setSelectedStudent(student);
      setStudentSearchTerm(`${student.name} - ${student.phone}`);
    }
    setFormData({
      student_id: payment.studentId.toString(),
      amount: payment.amount.toString(),
      payment_method: payment.paymentMethod,
      payment_date: payment.paymentDate.split('T')[0],
      notes: payment.notes || '',
      branch_id: payment.branchId.toString(),
      membership_end: student?.membership_end || ''
    });
    setShowEditModal(true);
  };

  const filteredPayments = advancePayments.filter((payment) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' ||
      payment.studentName.toLowerCase().includes(searchLower) ||
      payment.studentPhone.includes(searchTerm) ||
      (payment.registrationNumber && payment.registrationNumber.toLowerCase().includes(searchLower));

    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || payment.branchId.toString() === branchFilter;

    // Apply date filter if any is selected
    let matchesDate = true;
    if (dateFilterType === 'specificDate' && selectedDate) {
      // Format both dates to YYYY-MM-DD for comparison
      const paymentDate = formatDate(payment.paymentDate);
      const filterDate = formatDate(selectedDate);
      matchesDate = paymentDate === filterDate;
    } else if (dateFilterType === 'month' && selectedMonth) {
      const paymentDate = new Date(payment.paymentDate);
      const paymentMonth = paymentDate.toISOString().slice(0, 7);
      matchesDate = paymentMonth === selectedMonth;
    }

    return matchesSearch && matchesStatus && matchesBranch && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      fully_used: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header and Filters */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Advance Payments</h1>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                Add Advance Payment
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="fully_used">Fully Used</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Filter by Date</label>
                
                {/* Specific Date Selection */}
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="dateNone"
                    name="dateFilter"
                    checked={dateFilterType === 'none'}
                    onChange={() => setDateFilterType('none')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="dateNone" className="text-sm text-gray-700">No Date Filter</label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="specificDate"
                    name="dateFilter"
                    checked={dateFilterType === 'specificDate'}
                    onChange={() => setDateFilterType('specificDate')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="specificDate" className="text-sm text-gray-700">Specific Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    disabled={dateFilterType !== 'specificDate'}
                    className="p-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="monthSelect"
                    name="dateFilter"
                    checked={dateFilterType === 'month'}
                    onChange={() => setDateFilterType('month')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="monthSelect" className="text-sm text-gray-700">Select Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    disabled={dateFilterType !== 'month'}
                    className="p-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{payment.studentName}</div>
                        <div className="text-sm text-gray-500">{payment.studentPhone}</div>
                        <div className="text-xs text-gray-400">{payment.registrationNumber}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₹{payment.amount.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.paymentMethod === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {payment.paymentMethod.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.studentMembershipEnd ? new Date(payment.studentMembershipEnd).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.branchName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(payment)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        {payment.status === 'active' && payment.usedAmount === 0 && (
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Cancel"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No advance payments found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new advance payment.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedPayment ? 'Edit Advance Payment' : 'Add New Advance Payment'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative student-dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studentSearchTerm}
                      onChange={handleSearchChange}
                      onFocus={() => setShowStudentDropdown(true)}
                      placeholder="Search student by name, phone, or registration..."
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  </div>
                  
                  {showStudentDropdown && studentSearchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map(student => (
                          <div
                            key={student.id}
                            onClick={() => handleStudentSelect(student)}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{student.name}</div>
                            <div className="text-sm text-gray-500">{student.phone}</div>
                            {student.registration_number && (
                              <div className="text-xs text-gray-400">Reg: {student.registration_number}</div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-gray-500 text-sm">No students found</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedStudent && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Student Details:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="font-medium">Name:</span> {selectedStudent.name}</div>
                      <div><span className="font-medium">Phone:</span> {selectedStudent.phone}</div>
                      {selectedStudent.registration_number && (
                        <div><span className="font-medium">Registration:</span> {selectedStudent.registration_number}</div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value as 'cash' | 'online'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => {
                      const branchId = e.target.value;
                      const branch = branches.find(b => b.id.toString() === branchId) || null;
                      setSelectedBranch(branch);
                      setFormData({...formData, branch_id: branchId});
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={!!selectedStudent} // Disable if student is selected (auto-filled from student)
                  >
                    <option value="">Select Branch</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {selectedStudent && (
                    <p className="mt-1 text-sm text-gray-500">
                      Branch auto-filled from student record
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Membership Expiry Date</label>
                  <input
                    type="date"
                    value={formData.membership_end}
                    onChange={(e) => setFormData({...formData, membership_end: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={!selectedStudent}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                  >
                    {selectedPayment ? 'Update' : 'Add'} Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancePayments;
