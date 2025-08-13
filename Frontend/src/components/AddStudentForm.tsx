import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';
import Select from 'react-select';

// Define types based on updated api.ts interfaces
interface Branch {
  id: number;
  name: string;
}

interface Seat {
  id: number;
  seatNumber: string;
}

interface Schedule {
  id: number;
  title: string;
  description?: string | null;
  time: string;
  eventDate: string;
}

interface ShiftOption {
  value: number;
  label: string;
  isDisabled: boolean;
}

interface SelectOption {
  value: number | null;
  label: string;
  isDisabled?: boolean;
}

interface FormData {
  name: string;
  registrationNumber: string;
  fatherName: string;
  aadharNumber: string;
  email: string;
  phone: string;
  address: string;
  branchId: number | null;
  membershipStart: string;
  membershipEnd: string;
  seatId: number | null;
  shiftId: number | null;
  totalFee: string;
  cash: string;
  online: string;
  securityMoney: string;
  remark: string;
  image: File | null;
  imageUrl: string;
}

const AddStudentForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    registrationNumber: '',
    fatherName: '',
    aadharNumber: '',
    email: '',
    phone: '',
    address: '',
    branchId: null,
    membershipStart: '',
    membershipEnd: '',
    seatId: null,
    shiftId: null,
    totalFee: '',
    cash: '',
    online: '',
    securityMoney: '',
    remark: '',
    image: null,
    imageUrl: '',
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [shifts, setShifts] = useState<Schedule[]>([]);
  const [availableShifts, setAvailableShifts] = useState<Schedule[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchesData, shiftsData] = await Promise.all([
          api.getBranches(),
          api.getSchedules(),
        ]);
        setBranches(branchesData);
        setShifts(shiftsData.schedules);
        setAvailableShifts(shiftsData.schedules); // Initially, all shifts are available
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        toast.error('Failed to load branches or shifts');
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchSeats = async () => {
      if (formData.branchId !== null) {
        setLoadingSeats(true);
        try {
          const seatsResponse = await api.getSeats({ branchId: formData.branchId });
          setSeats(seatsResponse.seats);
        } catch (error) {
          console.error('Failed to fetch seats:', error);
          toast.error('Failed to load seats');
        } finally {
          setLoadingSeats(false);
        }
      } else {
        setSeats([]);
      }
    };
    fetchSeats();
  }, [formData.branchId]);

  useEffect(() => {
    const fetchAvailableShifts = async () => {
      if (formData.seatId !== null) {
        setLoadingShifts(true);
        try {
          const availableShiftsResponse = await api.getAvailableShifts(formData.seatId);
          setAvailableShifts(availableShiftsResponse.availableShifts);
        } catch (error) {
          console.error('Failed to fetch available shifts:', error);
          toast.error('Failed to load available shifts');
        } finally {
          setLoadingShifts(false);
        }
      } else {
        setAvailableShifts(shifts); // When seat is "None", all shifts are available
      }
    };
    fetchAvailableShifts();
  }, [formData.seatId, shifts]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof FormData, option: SelectOption | ShiftOption | null) => {
    if (name === 'shiftId') {
      const opt = option as ShiftOption | null;
      setFormData(prev => ({ ...prev, [name]: opt ? opt.value : null }));
    } else {
      const opt = option as SelectOption | null;
      setFormData(prev => ({ ...prev, [name]: opt ? opt.value : null }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error('Only JPEG, JPG, PNG, and GIF images are allowed');
        return;
      }
      if (file.size > 200 * 1024) {
        toast.error('Image size exceeds 200KB limit');
        return;
      }
      setFormData(prev => ({ ...prev, image: file }));
    }
  };

  const branchOptions: SelectOption[] = branches.map(branch => ({
    value: branch.id,
    label: branch.name,
  }));

  const seatOptions: SelectOption[] = [
    { value: null, label: 'None', isDisabled: false },
    ...seats.map(seat => ({
      value: seat.id,
      label: seat.seatNumber,
      isDisabled: false,
    })),
  ];

  const shiftOptions: ShiftOption[] = shifts.map(shift => {
    const isAvailable = availableShifts.some(s => s.id === shift.id);
    const label = formData.seatId !== null
      ? `${shift.title} (${shift.time} on ${shift.eventDate}) ${isAvailable ? '(Available)' : '(Assigned)'}`
      : `${shift.title} (${shift.time} on ${shift.eventDate})`;
    return {
      value: shift.id,
      label,
      isDisabled: formData.seatId !== null ? !isAvailable : false, // Enable all shifts when seat is "None"
    };
  });

  const handleSubmit = async () => {
    if (
      !formData.name ||
      !formData.phone ||
      formData.branchId === null ||
      !formData.membershipStart ||
      !formData.membershipEnd
    ) {
      toast.error('Please fill in all required fields (Name, Phone, Branch, Membership Start, Membership End)');
      return;
    }

    // Allow submission with seatId as null and a shift selected
    try {
      let imageUrl = '';
      if (formData.image) {
        const imageFormData = new FormData();
        imageFormData.append('image', formData.image);
        try {
          const uploadResponse = await api.uploadImage(imageFormData);
          imageUrl = uploadResponse.imageUrl || '';
        } catch (error: any) {
          console.error('Image upload failed:', error);
          toast.error(error.response?.data?.message || 'Failed to upload image');
          return;
        }
      }

      const studentData = {
        name: formData.name,
        registrationNumber: formData.registrationNumber,
        fatherName: formData.fatherName,
        aadharNumber: formData.aadharNumber,
        email: formData.email,
        phone: formData.phone,
        address: formData.address.trim() || '',
        branchId: formData.branchId!,
        membershipStart: formData.membershipStart,
        membershipEnd: formData.membershipEnd,
        seatId: formData.seatId !== null ? formData.seatId : null,
        shiftIds: formData.shiftId !== null ? [formData.shiftId] : [],
        totalFee: formData.totalFee ? parseFloat(formData.totalFee) : 0,
        amountPaid: (parseFloat(formData.cash) || 0) + (parseFloat(formData.online) || 0),
        cash: parseFloat(formData.cash) || 0,
        online: parseFloat(formData.online) || 0,
        securityMoney: parseFloat(formData.securityMoney) || 0,
        remark: formData.remark || '',
        profileImageUrl: imageUrl,
      };

      await api.addStudent(studentData);
      toast.success('Student added successfully');
      navigate('/students');
    } catch (error: any) {
      console.error('Failed to add student:', error);
      toast.error(error.message || 'Failed to add student');
    }
  };

  const cashAmount = parseFloat(formData.cash) || 0;
  const onlineAmount = parseFloat(formData.online) || 0;
  const totalAmountPaid = cashAmount + onlineAmount;
  const dueAmount = (parseFloat(formData.totalFee) || 0) - totalAmountPaid;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add New Student</h1>
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Registration Number
          </label>
          <input
            type="text"
            id="registrationNumber"
            name="registrationNumber"
            value={formData.registrationNumber}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="fatherName" className="block text-sm font-medium text-gray-700 mb-1">
            Father's Name
          </label>
          <input
            type="text"
            id="fatherName"
            name="fatherName"
            value={formData.fatherName}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="aadharNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Aadhar Number
          </label>
          <input
            type="text"
            id="aadharNumber"
            name="aadharNumber"
            value={formData.aadharNumber}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="text"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="branchId" className="block text-sm font-medium text-gray-700 mb-1">
            Branch
          </label>
          <Select
            options={branchOptions}
            value={branchOptions.find(option => option.value === formData.branchId) || null}
            onChange={(option: SelectOption | null) => handleSelectChange('branchId', option)}
            placeholder="Select a branch"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="membershipStart" className="block text-sm font-medium text-gray-700 mb-1">
            Membership Start
          </label>
          <input
            type="date"
            id="membershipStart"
            name="membershipStart"
            value={formData.membershipStart}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="membershipEnd" className="block text-sm font-medium text-gray-700 mb-1">
            Membership End
          </label>
          <input
            type="date"
            id="membershipEnd"
            name="membershipEnd"
            value={formData.membershipEnd}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="seatId" className="block text-sm font-medium text-gray-700 mb-1">
            Select Seat
          </label>
          <Select
            options={seatOptions}
            value={seatOptions.find(option => option.value === formData.seatId) || null}
            onChange={(option: SelectOption | null) => handleSelectChange('seatId', option)}
            isLoading={loadingSeats}
            placeholder="Select a seat"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="shiftId" className="block text-sm font-medium text-gray-700 mb-1">
            Select Shift
          </label>
          <Select
            options={shiftOptions}
            value={shiftOptions.find(option => option.value === formData.shiftId) || null}
            onChange={(option: ShiftOption | null) => handleSelectChange('shiftId', option)}
            isLoading={loadingShifts}
            placeholder="Select a shift"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="totalFee" className="block text-sm font-medium text-gray-700 mb-1">
            Total Fee
          </label>
          <input
            type="number"
            id="totalFee"
            name="totalFee"
            value={formData.totalFee}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="cash" className="block text-sm font-medium text-gray-700 mb-1">
            Cash Payment
          </label>
          <input
            type="number"
            id="cash"
            name="cash"
            value={formData.cash}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="online" className="block text-sm font-medium text-gray-700 mb-1">
            Online Payment
          </label>
          <input
            type="number"
            id="online"
            name="online"
            value={formData.online}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="securityMoney" className="block text-sm font-medium text-gray-700 mb-1">
            Security Money
          </label>
          <input
            type="number"
            id="securityMoney"
            name="securityMoney"
            value={formData.securityMoney}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount Paid
          </label>
          <input
            type="number"
            id="amountPaid"
            name="amountPaid"
            value={totalAmountPaid.toFixed(2)}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
          />
        </div>
        <div>
          <label htmlFor="dueAmount" className="block text-sm font-medium text-gray-700 mb-1">
            Due Amount
          </label>
          <input
            type="number"
            id="dueAmount"
            name="dueAmount"
            value={dueAmount.toFixed(2)}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
          />
        </div>
        <div>
          <label htmlFor="remark" className="block text-sm font-medium text-gray-700 mb-1">
            Remark
          </label>
          <textarea
            id="remark"
            name="remark"
            value={formData.remark}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            rows={3}
          />
        </div>
        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
            Profile Image (max 200KB)
          </label>
          <input
            type="file"
            id="image"
            name="image"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition duration-200"
        >
          Add Student
        </button>
      </div>
    </div>
  );
};

export default AddStudentForm;