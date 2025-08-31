import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { toast } from 'sonner';
import { Trash2, ArrowLeft, Edit, Printer } from 'lucide-react';
import SilentLibrary from "./SilentLibrary.jpg";
import SilentLogo from "./SilentLogo.png";
import SLSIN from "./SLSIN.jpg";

// Updated Student interface to match api.ts exactly
interface Student {
  id: number;
  name: string;
  registrationNumber?: string | null;
  email: string;
  phone: string;
  address: string;
  branchId: number;
  branchName?: string;
  status: string;
  membershipStart: string;
  membershipEnd: string;
  totalFee: number;
  amountPaid: number;
  dueAmount: number;
  cash: number;
  online: number;
  remark?: string | null;
  profileImageUrl?: string | null;
  createdAt: string;
  paymentDate?: string | null;
  assignments?: Array<{
    seatId: number;
    shiftId: number;
    seatNumber: string;
    shiftTitle: string;
  }>;
}

const formatDate = (isoDate: string | undefined): string => {
  if (!isoDate) return 'N/A';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toISOString().split('T')[0];
};

const StudentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const studentId = parseInt(id!, 10);
        if (isNaN(studentId)) {
          throw new Error('Invalid student ID');
        }

        const studentData = await api.getStudent(studentId);
        if (!studentData) throw new Error('Student data not found');

        console.log('Fetched student data:', studentData);

        const membershipEndDate = new Date(studentData.membershipEnd);
        const currentDate = new Date();
        const isExpired = membershipEndDate < currentDate;

        setStudent({
          ...studentData,
          status: isExpired ? 'expired' : studentData.status,
          totalFee: studentData.totalFee,
          amountPaid: studentData.amountPaid,
          dueAmount: studentData.dueAmount,
          cash: studentData.cash,
          online: studentData.online,
        });

        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch student:', err);
        const errorMessage = err.message === 'Server error'
          ? 'Failed to load student details due to a server error. Please try again later.'
          : err.message;
        setError(errorMessage);
        toast.error(errorMessage);
        setStudent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        const studentId = parseInt(id!, 10);
        if (isNaN(studentId)) {
          throw new Error('Invalid student ID');
        }

        await api.deleteStudent(studentId);
        toast.success('Student deleted successfully');
        navigate('/students');
      } catch (error: any) {
        console.error('Failed to delete student:', error.message);
        const errorMessage = error.message === 'Student not found'
          ? 'Student not found. It may have already been deleted.'
          : 'Failed to delete student: ' + error.message;
        toast.error(errorMessage);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div>Loading student details...</div>;
  if (error) return <div>{error}</div>;
  if (!student) return <div>Student not found</div>;

  const shiftTitle = student.assignments && student.assignments.length > 0
    ? student.assignments[0].shiftTitle
    : undefined;
  const seatNumber = student.assignments && student.assignments.length > 0
    ? student.assignments[0].seatNumber
    : undefined;

  return (
    <>
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 8mm;
            }
            
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              font-family: Arial, sans-serif;
              position: relative;
            }
            
            .content-container {
              position: relative;
            }
            
            .watermark {
              position: absolute;
              top: 60%;
              left: 50%;
              transform: translate(-50%, -50%);
              width:  250px;
              height: 250px;
              opacity: 0.15;
              z-index: 1;
              pointer-events: none;
              display: none;
            }
            
            .watermark.print-watermark {
              display: block;
            }
            
            .content-wrapper {
              position: relative;
              z-index: 2;
            }
            
            .no-print {
              display: none !important;
            }
            
            .print-container {
              padding: 0;
              height: calc(50vh - 8mm);
              max-height: 380px;
              overflow: hidden;
              page-break-inside: avoid;
              page-break-after: always;
              border-bottom: 1px solid #ddd;
              margin-bottom: 3mm;
              position: relative;
              z-index: 1;
            }
            
            .print-container:last-child {
              page-break-after: avoid;
              border-bottom: none;
              margin-bottom: 0;
            }
            
            .bg-white {
              background: none;
              border: none;
              box-shadow: none;
              padding: 6px;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            
            .print-logo {
              width: 100vw;
              max-width: none;
              height: auto;
              max-height: 80px;
              object-fit: contain;
              margin: 0;
              display: block;
              position: relative;
              left: 50%;
              transform: translateX(-50%);
            }
            
            .logo-container {
              text-align: center;
              margin-bottom: 10px;
              width: 100%;
              overflow: visible;
              padding-top: 5px;
            }
            
            .reg-number {
              text-align: right;
              font-size: 11px;
              margin-bottom: 6px;
              font-weight: bold;
            }
            
            .reg-number span:first-child {
              font-size: 8px;
            }
            
            .print-title {
              text-align: center;
              color: #f97316;
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 6px;
            }
            
            .student-info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 0.5px;
              font-size: 11px;
              flex: 1;
              overflow: hidden;
            }
            
            .student-info-item {
              margin-bottom: 2px;
              padding: 0.5px;
            }
            
            .student-info-item h2 {
              font-size: 10px;
              font-weight: 600;
              margin: 0 0 1px 0;
              color: #374151;
              text-transform: uppercase;
            }
            
            .student-info-item p {
              font-size: 10px;
              margin: 0;
              color: #6b7280;
              word-wrap: break-word;
              line-height: 1.1;
            }
            
            .student-info-item.full-width {
              grid-column: 1 / -1;
            }
            
            .student-info-item.half-width {
              grid-column: span 2;
            }
            
            .profile-image-print {
              width: 35px;
              height: 35px;
              object-fit: cover;
              border-radius: 50%;
              float: right;
              margin-left: 6px;
            }
            
            .status-badge {
              display: inline-block;
              padding: 2px 4px;
              border-radius: 3px;
              font-size: 8px;
              font-weight: 500;
            }
            
            .status-active {
              background-color: #dcfce7;
              color: #166534;
            }
            
            .status-expired {
              background-color: #fecaca;
              color: #991b1b;
            }
          }
          
          .logo-container {
            width: 100%;
            margin-bottom: 20px;
          }
          
          .logo-container img {
            width: 100%;
            height: auto;
          }
          
          .reg-number {
            text-align: right;
            font-size: 17px;
            margin-bottom: 20px;
            font-weight: bold;
          }
        `}
      </style>

      <div className="flex h-screen bg-gray-50">
        {/* <Sidebar className="no-print" /> */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* <Navbar className="no-print" /> */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto print-container" ref={printRef}>
              
              <button
                onClick={() => navigate(-1)}
                className="mb-4 flex items-center text-purple-600 hover:text-purple-800 no-print"
              >
                <ArrowLeft size={20} className="mr-2" />
                Back
              </button>
              
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 content-container">
                {/* Watermark - only visible when printing */}
                <div className="watermark print-watermark hidden print:block">
                  <img src={SilentLogo} alt="Silent Library Watermark" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                </div>
                <div className="content-wrapper">
                  <div className="logo-container">
                    <img src={SilentLibrary} alt="SDM Library Logo" className="print-logo hidden print:block" />
                    <img src={SilentLibrary} alt="SDM Library Logo" className="block print:hidden" />
                  </div>
                  <div className="reg-number" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span>Phone. No: 6205583370 <br /> 8102233678</span>
                    <span>Reg. No: 08898</span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-800 mb-6 no-print">Student Details</h1>

                  {/* Profile image for print - positioned in header */}
                  {student.profileImageUrl && (
                    <div className="mb-6 print:hidden">
                      <h2 className="text-lg font-medium mb-2">Profile Image</h2>
                      <img src={student.profileImageUrl} alt="Profile" className="w-32 h-32 object-cover rounded-full" />
                    </div>
                  )}

                  {/* Print layout with optimized 3-column grid */}
                  <div className="student-info-grid hidden print:grid">
                  {student.profileImageUrl && (
                    <img src={student.profileImageUrl} alt="Profile" className="profile-image-print" />
                  )}
                  
                  <div className="student-info-item">
                    <h2>Name</h2>
                    <p>{student.name || 'Unknown'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Reg. No.</h2>
                    <p>{student.registrationNumber || 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Branch</h2>
                    <p>{student.branchName || 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Phone</h2>
                    <p>{student.phone || 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Status</h2>
                    <p>
                      <span className={`status-badge ${student.status === 'active' ? 'status-active' : 'status-expired'}`}>
                        {student.status === 'active' ? 'Active' : 'Expired'}
                      </span>
                    </p>
                  </div>
                  <div className="student-info-item">
                    <h2>Shift</h2>
                    <p>{shiftTitle || 'None'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Seat No.</h2>
                    <p>{seatNumber || 'None'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Start Date</h2>
                    <p>{formatDate(student.membershipStart)}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>End Date</h2>
                    <p>{formatDate(student.membershipEnd)}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Total Fee</h2>
                    <p>{student.totalFee !== undefined && student.totalFee !== null ? `Rs. ${student.totalFee.toFixed(0)}` : 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Paid</h2>
                    <p>{student.amountPaid !== undefined && student.amountPaid !== null ? `Rs. ${student.amountPaid.toFixed(0)}` : 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Due</h2>
                    <p>{student.dueAmount !== undefined && student.dueAmount !== null ? `Rs. ${student.dueAmount.toFixed(0)}` : 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Cash</h2>
                    <p>{student.cash !== undefined && student.cash !== null ? `Rs. ${student.cash.toFixed(0)}` : 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Online</h2>
                    <p>{student.online !== undefined && student.online !== null ? `Rs. ${student.online.toFixed(0)}` : 'N/A'}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Pay Date</h2>
                    <p>{formatDate(student.paymentDate || undefined)}</p>
                  </div>
                  <div className="student-info-item">
                    <h2>Created</h2>
                    <p>{formatDate(student.createdAt)}</p>
                  </div>
                  <div className="student-info-item half-width">
                    <h2>Email</h2>
                    <p>{student.email || 'Unknown'}</p>
                  </div>
                  <div className="student-info-item full-width">
                    <h2>Address</h2>
                    <p>{student.address || 'N/A'}</p>
                  </div>
                  <div className="student-info-item half-width">
                    <h2>Remark</h2>
                    <p>{student.remark || 'N/A'}</p>
                  </div>
                  <div className="student-info-item half-width hidden print:block" style={{position: 'absolute', bottom: '10px', right: '10px', textAlign: 'center'}}>
                    <img src={SLSIN} alt="Silent Library Signature" style={{width: '80px', height: '40px', objectFit: 'contain'}} />
                    <h2 style={{fontSize: '8px', margin: '2px 0 0 0'}}>SILENT LIBRARY (Digital Signature)</h2>
                  </div>
                </div>

                {/* Screen layout - unchanged */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
                  <div>
                    <h2 className="text-lg font-medium">Name</h2>
                    <p className="text-gray-600">{student.name || 'Unknown'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Registration Number</h2>
                    <p className="text-gray-600">{student.registrationNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Email</h2>
                    <p className="text-gray-600">{student.email || 'Unknown'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Phone</h2>
                    <p className="text-gray-600">{student.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Address</h2>
                    <p className="text-gray-600">{student.address || 'N/A'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Branch</h2>
                    <p className="text-gray-600">{student.branchName || 'N/A'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Status</h2>
                    <p className={`inline-block px-2 py-1 rounded-full text-xs ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {student.status === 'active' ? 'Active' : 'Expired'}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Membership Start</h2>
                    <p className="text-gray-600">{formatDate(student.membershipStart)}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Membership End</h2>
                    <p className="text-gray-600">{formatDate(student.membershipEnd)}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Assigned Shift</h2>
                    <p className="text-gray-600">
                      {shiftTitle || 'No shift assigned'}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Seat Number</h2>
                    <p className="text-gray-600">{seatNumber || 'None'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Total Fee</h2>
                    <p className="text-gray-600">
                      {student.totalFee !== undefined && student.totalFee !== null ? `Rs. ${student.totalFee.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Amount Paid</h2>
                    <p className="text-gray-600">
                      {student.amountPaid !== undefined && student.amountPaid !== null ? `Rs. ${student.amountPaid.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Due Amount</h2>
                    <p className="text-gray-600">
                      {student.dueAmount !== undefined && student.dueAmount !== null ? `Rs. ${student.dueAmount.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Cash Payment</h2>
                    <p className="text-gray-600">
                      {student.cash !== undefined && student.cash !== null ? `Rs. ${student.cash.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Online Payment</h2>
                    <p className="text-gray-600">
                      {student.online !== undefined && student.online !== null ? `Rs. ${student.online.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Date of Payment</h2>
                    <p className="text-gray-600">{formatDate(student.paymentDate || undefined)}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Created At</h2>
                    <p className="text-gray-600">{formatDate(student.createdAt)}</p>
                  </div>
                  <div className="col-span-2">
                    <h2 className="text-lg font-medium">Remark</h2>
                    <p className="text-gray-600">{student.remark || 'N/A'}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">SILENT LIBRARY (Digital Signature)</h2>
                    <img src={SLSIN} alt="Silent Library Watermark" style={{width: '150px', height: '150px', objectFit: 'contain'}} />
                  </div>
                </div>
                </div>

                <div className="mt-6 flex space-x-4 no-print">
                  <button
                    onClick={() => navigate(`/students/${student.id}/edit`)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Edit size={16} className="mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Printer size={16} className="mr-2" />
                    Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentDetails;