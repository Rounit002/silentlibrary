import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import Sidebar from '../components/Sidebar';

const ManageBranches: React.FC = () => {
  const [branches, setBranches] = useState<{ id: number; name: string; code?: string | null }[]>([]);
  const [formData, setFormData] = useState({ name: '', code: '' });
  const [editingBranch, setEditingBranch] = useState<{ id: number; name: string; code?: string | null } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const fetchBranches = async () => {
      const data = await api.getBranches();
      setBranches(data);
    };
    fetchBranches();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (editingBranch) {
        const updatedBranch = await api.updateBranch(editingBranch.id, formData);
        setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
        setEditingBranch(null);
      } else {
        const newBranch = await api.addBranch(formData);
        setBranches(prev => [...prev, newBranch]);
        setFormData({ name: '', code: '' });
      }
      toast.success('Branch saved successfully');
    } catch (error) {
      toast.error('Failed to save branch');
    }
  };

  const handleEdit = (branch: { id: number; name: string; code?: string | null }) => {
    setEditingBranch(branch);
    setFormData({ name: branch.name, code: branch.code || '' });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure?')) {
      await api.deleteBranch(id);
      setBranches(prev => prev.filter(b => b.id !== id));
      toast.success('Branch deleted');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 p-6">
        <h1 className="text-3xl font-bold mb-6">Manage Branches</h1>
        <div className="bg-white p-4 rounded shadow mb-6">
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Branch Name"
            className="p-2 border rounded mr-2"
          />
          <input
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="Branch Code"
            className="p-2 border rounded mr-2"
          />
          <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded">
            {editingBranch ? 'Update' : 'Add'} Branch
          </button>
        </div>
        <table className="w-full bg-white rounded shadow">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2">Name</th>
              <th className="p-2">Code</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map(branch => (
              <tr key={branch.id}>
                <td className="p-2">{branch.name}</td>
                <td className="p-2">{branch.code || '-'}</td>
                <td className="p-2">
                  <button onClick={() => handleEdit(branch)} className="text-blue-600 mr-2">Edit</button>
                  <button onClick={() => handleDelete(branch.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageBranches;