import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Define interfaces based on api.ts expectations (camelCase)
interface UserData {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: string;
}

interface UserProfile {
  user: UserData;
}

interface ProfileUpdateData {
  fullName: string | null;
  email: string | null;
}

interface PasswordUpdateData {
  currentPassword: string;
  newPassword: string;
}

interface NewUserData {
  username: string;
  password: string;
  role: 'admin' | 'staff';
}

interface SettingsData {
  brevoTemplateId: string;
  daysBeforeExpiration: number; // Changed to number to match backend expectation
}

// Form data interface for type safety
interface FormData {
  fullName: string;
  email: string;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const Settings = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user is null
  if (!user) {
    return <div>Please log in to access settings.</div>;
  }

  // Fetch user profile data
  const { data: userProfile, isLoading, error } = useQuery<UserProfile>({
    queryKey: ['userProfile'],
    queryFn: api.getUserProfile,
  });

  // Fetch all users (admin only)
  const { data: allUsers, isLoading: usersLoading, error: usersError } = useQuery<UserData[]>({
    queryKey: ['allUsers'],
    queryFn: api.getAllUsers,
    enabled: user.role === 'admin',
  });

  // Fetch settings (admin only)
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    enabled: user.role === 'admin',
  });

  // Initialize form states
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [newUserData, setNewUserData] = useState<NewUserData>({
    username: '',
    password: '',
    role: 'staff',
  });

  const [settingsForm, setSettingsForm] = useState({
    brevoTemplateId: '',
    daysBeforeExpiration: '', // Keep as string for form input
  });

  // Sidebar state for responsiveness
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Populate form with fetched profile data
  useEffect(() => {
    if (userProfile?.user) {
      setFormData((prev) => ({
        ...prev,
        fullName: userProfile.user.fullName || '',
        email: userProfile.user.email || '',
      }));
    }
  }, [userProfile]);

  // Populate settings form
  useEffect(() => {
    if (settings) {
      setSettingsForm({
        brevoTemplateId: settings.brevoTemplateId || '',
        daysBeforeExpiration: settings.daysBeforeExpiration?.toString() || '', // Convert number to string for input
      });
    }
  }, [settings]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUserData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettingsForm((prev) => ({ ...prev, [name]: value }));
  };

  // Mutations
  const profileMutation = useMutation({
    mutationFn: (data: ProfileUpdateData) => api.updateUserProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Profile updated successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to update profile';
      toast.error(errorMessage);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordUpdateData) => api.changeUserPassword(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Password changed successfully!');
      setFormData((prev) => ({
        ...prev,
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to change password';
      toast.error(errorMessage);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: NewUserData) => api.addUser(data),
    onSuccess: () => {
      toast.success('User created successfully!');
      setNewUserData({ username: '', password: '', role: 'staff' });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to create user';
      toast.error(errorMessage);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => api.deleteUser(userId),
    onSuccess: () => {
      toast.success('User deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to delete user';
      toast.error(errorMessage);
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data: { brevoTemplateId: string; daysBeforeExpiration: number }) => api.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to update settings';
      toast.error(errorMessage);
    },
  });

  // Form submission handlers
  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const updateData: ProfileUpdateData = {
      fullName: formData.fullName || null,
      email: formData.email || null,
    };
    profileMutation.mutate(updateData);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.oldPassword || !formData.newPassword || !formData.confirmPassword) {
      toast.error('Please fill all password fields');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    const updateData: PasswordUpdateData = {
      currentPassword: formData.oldPassword,
      newPassword: formData.newPassword,
    };
    passwordMutation.mutate(updateData);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password) {
      toast.error('Username and password are required');
      return;
    }
    createUserMutation.mutate(newUserData);
  };

  const handleDeleteUser = (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleSettingsUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const daysBeforeExpiration = parseInt(settingsForm.daysBeforeExpiration, 10);
    if (isNaN(daysBeforeExpiration) || daysBeforeExpiration <= 0) {
      toast.error('Days Before Expiration must be a positive number');
      return;
    }
    const updateData = {
      brevoTemplateId: settingsForm.brevoTemplateId,
      daysBeforeExpiration,
    };
    settingsMutation.mutate(updateData);
  };

  // Render logic
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading profile: {error.message}</div>;

  return (
    <div className="flex h-screen bg-gray-50">
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
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
              <p className="text-gray-500">Manage your account settings and preferences</p>
            </div>
            <div className="space-y-6">
              {/* Profile Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-lg font-semibold">Profile Information</h3>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-center mb-6">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full bg-purple-100 flex items-center justify-center">
                        <User className="h-12 w-12 text-purple-500" />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute -bottom-2 -right-2 rounded-full"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                  <form onSubmit={handleProfileUpdate}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="fullName" className="text-sm font-medium">
                          Full Name
                        </label>
                        <Input
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="Your full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">
                          Email Address
                        </label>
                        <Input
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          type="email"
                          placeholder="Your email address"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                </div>
              </div>
              {/* Password Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-lg font-semibold">Change Password</h3>
                </div>
                <div className="p-5">
                  <form onSubmit={handlePasswordUpdate}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="oldPassword" className="text-sm font-medium">
                          Current Password
                        </label>
                        <Input
                          id="oldPassword"
                          name="oldPassword"
                          value={formData.oldPassword}
                          onChange={handleChange}
                          type="password"
                          placeholder="Enter your current password"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="newPassword" className="text-sm font-medium">
                          New Password
                        </label>
                        <Input
                          id="newPassword"
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          type="password"
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-sm font-medium">
                          Confirm New Password
                        </label>
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          type="password"
                          placeholder="Confirm new password"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button type="submit">Update Password</Button>
                    </div>
                  </form>
                </div>
              </div>
              {/* Brevo Email Settings (Admin Only) */}
              {user.role === 'admin' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-200">
                    <h3 className="text-lg font-semibold">Brevo Email Settings</h3>
                  </div>
                  <div className="p-5">
                    {settingsLoading ? (
                      <div>Loading settings...</div>
                    ) : settingsError ? (
                      <div>Error loading settings: {settingsError.message}</div>
                    ) : (
                      <form onSubmit={handleSettingsUpdate}>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label htmlFor="brevoTemplateId" className="text-sm font-medium">
                              Brevo Template ID
                            </label>
                            <Input
                              id="brevoTemplateId"
                              name="brevoTemplateId"
                              value={settingsForm.brevoTemplateId}
                              onChange={handleSettingsChange}
                              placeholder="Enter Brevo template ID"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="daysBeforeExpiration" className="text-sm font-medium">
                              Days Before Expiration
                            </label>
                            <Input
                              id="daysBeforeExpiration"
                              name="daysBeforeExpiration"
                              type="number"
                              min="1"
                              step="1"
                              value={settingsForm.daysBeforeExpiration}
                              onChange={handleSettingsChange}
                              placeholder="Enter number of days"
                            />
                          </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                          <Button type="submit">Save Settings</Button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
              {/* Create New User (Admin Only) */}
              {user.role === 'admin' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-200">
                    <h3 className="text-lg font-semibold">Create New User</h3>
                  </div>
                  <div className="p-5">
                    <form onSubmit={handleCreateUser}>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="newUsername" className="text-sm font-medium">
                            Username
                          </label>
                          <Input
                            id="newUsername"
                            name="username"
                            value={newUserData.username}
                            onChange={handleNewUserChange}
                            placeholder="Enter username"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="newPassword" className="text-sm font-medium">
                            Password
                          </label>
                          <Input
                            id="newPassword"
                            name="password"
                            value={newUserData.password}
                            onChange={handleNewUserChange}
                            type="password"
                            placeholder="Enter password"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="role" className="text-sm font-medium">
                            Role
                          </label>
                          <select
                            id="role"
                            name="role"
                            value={newUserData.role}
                            onChange={handleNewUserChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end">
                        <Button type="submit">Create User</Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              {/* All Users List (Admin Only) */}
              {user.role === 'admin' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-200">
                    <h3 className="text-lg font-semibold">All Users</h3>
                  </div>
                  <div className="p-5">
                    {usersLoading ? (
                      <div>Loading users...</div>
                    ) : usersError ? (
                      <div>Error loading users: {usersError.message}</div>
                    ) : (
                      <ul className="space-y-4">
                        {allUsers?.map((u) => (
                          <li key={u.id} className="flex justify-between items-center">
                            <span>
                              {u.username} ({u.role})
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
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

export default Settings;