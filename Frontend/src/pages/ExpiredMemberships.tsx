import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '../services/api';
import { Search, ChevronLeft, ChevronRight, Trash2, Eye, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Select from 'react-select';

// Comprehensive Student interface combining details from all pages
interface Student {
  id: number;
  name: string;
  registrationNumber?: string | null;
  email: string;
  phone: string;
  address?: string | null;
  branchId?: number;
  branchName?: string;
  status?: string;
  membershipStart?: string;
  membershipEnd: string;
  totalFee?: number;
  amountPaid?: number;
  dueAmount?: number;
  cash?: number;
  online?: number;
  remark?: string | null;
  profileImageUrl?: string | null;
  createdAt?: string;
  assignments?: Array<{
    seatId: number;
    shiftId: number;
    seatNumber: string;
    shiftTitle: string;
  }>;
  shiftId?: number;
  shiftTitle?: string;
  seatId?: number;
  seatNumber?: string;
}

interface Seat {
  id: number;
  seatNumber: string;
  studentId?: number | null;
}

const hasPermissions = (user: any): user is { permissions: string[] } => {
  return user && 'permissions' in user && Array.isArray(user.permissions);
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toISOString().split('T')[0];
};

const ExpiredMemberships = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterBranch, setSelectedFilterBranch] = useState<any>(null);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // State for all form fields
  const [nameInput, setNameInput] = useState('');
  const [registrationNumberInput, setRegistrationNumberInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addMonths(new Date(), 1));
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [shiftOptions, setShiftOptions] = useState<any[]>([]);
  const [seatOptions, setSeatOptions] = useState<any[]>([]);
  const [branchOptions, setBranchOptions] = useState<any[]>([]);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedSeat, setSelectedSeat] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [totalFee, setTotalFee] = useState<string>('');
  const [cash, setCash] = useState<string>('');
  const [online, setOnline] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [studentsResp, shiftsResp, branchesResp] = await Promise.all([
          api.getExpiredMemberships(selectedFilterBranch?.value),
          api.getSchedules(),
          api.getBranches(),
        ]);

        setStudents(studentsResp.students);
        setShiftOptions(shiftsResp.schedules.map((shift: any) => ({ value: shift.id, label: shift.title })));
        setBranchOptions(branchesResp.map((branch: any) => ({ value: branch.id, label: branch.name })));
      } catch (e: any) {
        console.error('Error fetching data:', e);
        toast.error(e.message || 'Failed to fetch expired memberships.');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedFilterBranch]);

  useEffect(() => {
    if (selectedShift && selectedStudent) {
      const fetchSeatsForShift = async () => {
        try {
          const response = await api.getSeats({ shiftId: selectedShift.value });
          const allSeats: Seat[] = response.seats;
          const availableSeats = allSeats.filter((seat: any) => !seat.studentId || seat.studentId === selectedStudent.id);
          setSeatOptions([
            { value: null, label: 'None' },
            ...availableSeats.map((seat: any) => ({ value: seat.id, label: seat.seatNumber }))
          ]);
          if (selectedSeat && !availableSeats.some((seat: any) => seat.id === selectedSeat.value) && selectedSeat.value !== null) {
            setSelectedSeat(null);
          }
        } catch (error) {
          console.error('Error fetching seats for shift:', error);
          toast.error('Failed to fetch seats');
        }
      };
      fetchSeatsForShift();
    }
  }, [selectedShift, selectedStudent]);

  const handleRenewClick = async (student: Student) => {
    try {
        setLoading(true);
        const fullStudentDetails = await api.getStudent(student.id);
        setSelectedStudent(fullStudentDetails);

        // Set new membership dates
        setStartDate(new Date());
        setEndDate(addMonths(new Date(), 1));
        setPaymentDate(new Date());

        // Pre-fill all form fields with the student's existing data
        setNameInput(fullStudentDetails.name || '');
        setRegistrationNumberInput(fullStudentDetails.registrationNumber || '');
        setEmailInput(fullStudentDetails.email || '');
        setPhoneInput(fullStudentDetails.phone || '');
        setAddressInput(fullStudentDetails.address || '');
        setSelectedBranch(fullStudentDetails.branchId ? { value: fullStudentDetails.branchId, label: fullStudentDetails.branchName } : null);
        
        const currentAssignment = fullStudentDetails.assignments?.[0];
        setSelectedShift(currentAssignment ? { value: currentAssignment.shiftId, label: currentAssignment.shiftTitle } : null);
        
        // This slight delay allows the seat options to populate based on the selected shift
        setTimeout(() => {
             setSelectedSeat(currentAssignment ? { value: currentAssignment.seatId, label: currentAssignment.seatNumber } : null);
        }, 150);

        setTotalFee(fullStudentDetails.totalFee ? fullStudentDetails.totalFee.toString() : '0');
        setCash(fullStudentDetails.cash ? fullStudentDetails.cash.toString() : '0');
        setOnline(fullStudentDetails.online ? fullStudentDetails.online.toString() : '0');
        setRemark(fullStudentDetails.remark || '');
        
        setRenewDialogOpen(true);
    } catch (error) {
        console.error("Failed to fetch student details for renewal:", error);
        toast.error("Failed to load student details for renewal.");
    } finally {
        setLoading(false);
    }
  };

  const handleRenewSubmit = async () => {
    if (
      !selectedStudent || !startDate || !endDate ||
      !nameInput.trim() || !phoneInput.trim() || !addressInput.trim() ||
      !selectedShift?.value || !totalFee || !selectedBranch?.value
    ) {
      toast.error('Please ensure Name, Phone, Address, Branch, Shift, and Fee are filled correctly.');
      return;
    }

    try {
      await api.renewStudent(selectedStudent.id, {
        name: nameInput,
        registrationNumber: registrationNumberInput,
        address: addressInput,
        membershipStart: format(startDate, 'yyyy-MM-dd'),
        membershipEnd: format(endDate, 'yyyy-MM-dd'),
        paymentDate: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : undefined,
        email: emailInput,
        phone: phoneInput,
        branchId: selectedBranch.value,
        shiftIds: [selectedShift.value],
        seatId: selectedSeat ? selectedSeat.value : undefined,
        totalFee: parseFloat(totalFee),
        cash: parseFloat(cash) || 0,
        online: parseFloat(online) || 0,
        remark: remark.trim() || undefined,
      });

      toast.success(`Membership renewed for ${selectedStudent.name}`);
      setRenewDialogOpen(false);

      const resp = await api.getExpiredMemberships();
      setStudents(resp.students);
      setCurrentPage(1); // Reset to first page after renewal

    } catch (err: any) {
      console.error('Renew error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to renew membership');
    }
  };

  const cashAmount = parseFloat(cash) || 0;
  const onlineAmount = parseFloat(online) || 0;
  const paid = cashAmount + onlineAmount;
  const due = (parseFloat(totalFee) || 0) - paid;

  // Pagination calculations
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm)) ||
      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredStudents.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Expired Memberships</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" />
            <input
              className="pl-10 pr-4 py-2 border rounded w-full"
              placeholder="Search by name, phone, or Reg. No."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <Select
              isClearable
              placeholder="Filter by Branch..."
              options={branchOptions}
              value={selectedFilterBranch}
              onChange={setSelectedFilterBranch}
              className="w-full md:w-1/3"
            />
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>S.No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Registration Number</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((student, index) => (
                      <TableRow key={student.id}>
                        <TableCell>{startIndex + index + 1}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.registrationNumber || 'N/A'}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.phone}</TableCell>
                        <TableCell>{formatDate(student.membershipEnd)}</TableCell>
                        <TableCell className="space-x-2">
                          {student.phone && (
                            <Button
                              onClick={() => {
                                const cleanedPhone = student.phone.replace(/\s+/g, '');
                                const whatsappUrl = `https://wa.me/${cleanedPhone.startsWith('91') ? cleanedPhone : '91' + cleanedPhone}`;
                                window.open(whatsappUrl, '_blank');
                              }}
                              variant="outline"
                            >
                              <MessageSquare size={16} />
                            </Button>
                          )}
                          <Button onClick={() => navigate(`/students/${student.id}`)} variant="outline">
                            <Eye size={16} />
                          </Button>
                          {(user?.role === 'admin' || user?.role === 'staff') && (
                            <Button onClick={() => handleRenewClick(student)}>
                              <ChevronRight size={16} /> Renew
                            </Button>
                          )}
                          {(user?.role === 'admin' ||
                            (hasPermissions(user) && user.permissions.includes('manage_students'))) && (
                            <Button
                              variant="destructive"
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
                                  try {
                                    await api.deleteStudent(student.id);
                                    setStudents(students.filter((s) => s.id !== student.id));
                                    toast.success('Student deleted successfully.');
                                  } catch(err: any) {
                                    toast.error(err.message || "Failed to delete student.");
                                  }
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
                </p>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Renewal Dialog */}
        <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Renew Membership</DialogTitle>
              <DialogDescription>Renew for {selectedStudent?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Registration Number</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="text"
                  value={registrationNumberInput}
                  onChange={(e) => setRegistrationNumberInput(e.target.value)}
                />
              </div>
              <div>
                {/* Removed Father's Name field */}
              </div>
              <div>
                {/* Removed Aadhar Number field */}
              </div>
              <div>
                <label className="block text-sm font-medium">Address</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Start Date</label>
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="rounded-md border"/>
              </div>
              <div>
                <label className="block text-sm font-medium">End Date</label>
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="rounded-md border"/>
              </div>
              <div>
                <label className="block text-sm font-medium">Date of Payment</label>
                <Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} className="rounded-md border"/>
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Phone</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Branch</label>
                <Select
                  options={branchOptions}
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  placeholder="Select Branch"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Shift</label>
                <Select
                  options={shiftOptions}
                  value={selectedShift}
                  onChange={setSelectedShift}
                  placeholder="Select Shift"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Seat</label>
                <Select
                  options={seatOptions}
                  value={selectedSeat}
                  onChange={setSelectedSeat}
                  placeholder="Select Seat"
                  isDisabled={!selectedShift}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Total Fee</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="number"
                  value={totalFee}
                  onChange={(e) => setTotalFee(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Cash Payment</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="number"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Online Payment</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="number"
                  value={online}
                  onChange={(e) => setOnline(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                {/* Removed Security Money field */}
              </div>
              <div>
                <label className="block text-sm font-medium">Amount Paid</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1 bg-gray-100"
                  type="number"
                  value={paid.toFixed(2)}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Due Amount</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1 bg-gray-100"
                  type="number"
                  value={due.toFixed(2)}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Remark</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRenewSubmit}>Renew Membership</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ExpiredMemberships;