import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'sonner';
import { ArrowLeft, PlusCircle, Trash2, Loader2, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

interface HostelRoom {
  id: number;
  seatNumber: string;
  branchId: number;
  branchName: string;
  isAssigned: boolean;
  studentId: number | null;
  studentName: string | null;
}

const HostelRoomsPage = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [newRoomNumbers, setNewRoomNumbers] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: branches } = useQuery({
    queryKey: ['hostelBranches'],
    queryFn: () => api.getHostelBranches(),
  });

  const { data: rooms, isLoading: loadingRooms } = useQuery({
    queryKey: ['hostelRooms', selectedBranchId],
    queryFn: () => api.getHostelSeats(selectedBranchId),
    enabled: !!selectedBranchId,
  });

  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const addRoomsMutation = useMutation({
    mutationFn: (data: { seat_numbers: string; branch_id: string }) => api.addHostelSeats(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostelRooms', selectedBranchId] });
      setNewRoomNumbers('');
      toast.success('Rooms added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add rooms');
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (id: number) => api.deleteHostelSeat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostelRooms', selectedBranchId] });
      toast.success('Room deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete room');
    },
  });

  const handleAddRooms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) {
      toast.error('Please select a branch');
      return;
    }
    if (!newRoomNumbers.trim()) {
      toast.error('Please enter room numbers');
      return;
    }
    addRoomsMutation.mutate({ seat_numbers: newRoomNumbers, branch_id: selectedBranchId });
  };

  const handleDeleteRoom = (id: number) => {
    if (window.confirm('Are you sure you want to delete this room?')) {
      deleteRoomMutation.mutate(id);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Home className="mr-2 h-6 w-6 text-indigo-600" />
                  Room Management
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage hostel rooms and view assignments</p>
              </div>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                Back
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Branch</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                  >
                    <option value="">Select a Branch</option>
                    {branches?.map((branch: any) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <form onSubmit={handleAddRooms} className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add New Room(s)</label>
                    <input
                      type="text"
                      value={newRoomNumbers}
                      onChange={(e) => setNewRoomNumbers(e.target.value)}
                      placeholder="e.g. 101, 102, 103"
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addRoomsMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors self-end h-[38px]"
                  >
                    {addRoomsMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                    Add
                  </button>
                </form>
              </div>
            </div>

            {loadingRooms ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
              </div>
            ) : rooms?.seats?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {rooms.seats.map((room: HostelRoom) => (
                  <div
                    key={room.id}
                    className={`relative p-4 rounded-lg border-2 transition-all group ${
                      room.isAssigned
                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                        : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    }`}
                  >
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Room"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="text-center">
                      <div className={`text-lg font-bold ${
                        room.isAssigned ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                      }`}>
                        {room.seatNumber}
                      </div>
                      <div className={`text-xs mt-1 font-medium truncate ${
                        room.isAssigned ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'
                      }`}>
                        {room.isAssigned ? room.studentName : 'Available'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">No rooms found for this branch.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default HostelRoomsPage;
