// Sidebar.tsx
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, UserPlus, Building2, Calendar, Clock, Grid, DollarSign, Wallet, ShoppingBag, BarChart2, Settings, ChevronRight, UserCheck, AlertTriangle, Menu, X, LogOut, MapPin, Package, ToggleLeft, CreditCard } from 'lucide-react';

// Using a placeholder for the logo as local assets cannot be resolved in this environment.
const logoUrl = 'https://placehold.co/40x40/E9D5FF/4C1D95?text=SL';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showHostelDropdown, setShowHostelDropdown] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { path: '/', icon: <Home size={20} />, label: 'Home' },
    { path: '/students', icon: <UserPlus size={20} />, label: 'Library Students', hasDropdown: true },
    { path: '/hostel', icon: <Building2 size={20} />, label: 'Hostel Students', hasDropdown: true },
    { path: '/schedule', icon: <Calendar size={20} />, label: 'Schedule' },
    { path: '/shifts', icon: <Clock size={20} />, label: 'Shifts' },
    { path: '/seats', icon: <Grid size={20} />, label: 'Seats' },
    { path: '/branches', icon: <MapPin size={20} />, label: 'Manage Branches' },
    { path: '/products', icon: <Package size={20} />, label: 'Products' },
    { path: '/advance-payments', icon: <CreditCard size={20} />, label: 'Advance' },
    { path: '/transactions', icon: <DollarSign size={20} />, label: 'Transactions' },
    { path: '/collections', icon: <Wallet size={20} />, label: 'Collection & Due' },
    { path: '/expenses', icon: <ShoppingBag size={20} />, label: 'Expenses' },
    { path: '/profit-loss', icon: <BarChart2 size={20} />, label: 'Profit & Loss' },
    { path: '/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  const handleLogout = () => {
    navigate('/login');
  };

  return (
      <div
        className={`h-screen bg-gradient-to-br from-purple-50 to-orange-50 border-r border-gray-100 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="p-4 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Library Logo" className="h-10 w-10 rounded-full object-cover" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-orange-400 text-transparent bg-clip-text">
                SILENT LIBRARY
              </h1>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronRight size={20} className={`${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-purple-100 text-purple-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
                  onClick={(e) => {
                    if (item.hasDropdown && !isCollapsed) {
                      e.preventDefault();
                      if (item.label === 'Library Students') {
                        setShowStudentDropdown(!showStudentDropdown);
                      } else if (item.label === 'Hostel Students') {
                        setShowHostelDropdown(!showHostelDropdown);
                      }
                    }
                  }}
                >
                  <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                    <span className={isActive(item.path) ? 'text-purple-600' : 'text-gray-500'}>{item.icon}</span>
                    {!isCollapsed && <span className="font-medium">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.hasDropdown && (
                    <ChevronRight
                      size={18}
                      className={`transition-transform ${
                        (item.label === 'Library Students' && showStudentDropdown) || 
                        (item.label === 'Hostel Students' && showHostelDropdown) ? 'rotate-90' : ''
                      }`}
                    />
                  )}
                </Link>
                {!isCollapsed && item.hasDropdown && showStudentDropdown && item.label === 'Library Students' && (
                  <div className="ml-8 mt-1 space-y-1 animate-fade-in">
                    <Link
                      to="/students/add"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/students/add') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Add Student
                    </Link>
                    <Link
                      to="/students"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/students') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      View All
                    </Link>
                    <Link
                      to="/active-students"
                      className={`flex items-center py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/active-students') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <UserCheck size={14} className="mr-1.5" />
                      Active Students
                    </Link>
                    <Link
                      to="/expired-memberships"
                      className={`flex items-center py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/expired-memberships')
                          ? 'bg-purple-50 text-purple-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <AlertTriangle size={14} className="mr-1.5" />
                      Expired Members
                    </Link>
                    <Link
                      to="/inactive-students"
                      className={`flex items-center py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/inactive-students') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <ToggleLeft size={14} className="mr-1.5" />
                      Inactive Students
                    </Link>
                  </div>
                )}
                {!isCollapsed && item.hasDropdown && showHostelDropdown && item.label === 'Hostel Students' && (
                  <div className="ml-8 mt-1 space-y-1 animate-fade-in">
                    <Link
                      to="/hostel-dashboard"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/hostel-dashboard') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Hostel Dashboard
                    </Link>
                    <Link
                      to="/hostel/active-students"
                      className={`flex items-center py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/hostel/active-students') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                        <UserCheck size={14} className="mr-1.5" />
                        Active Students
                    </Link>
                    <Link
                      to="/hostel/collections"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/hostel/collections') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Collection & Due
                    </Link>
                    {/* START: Added Hostel Expenses Link */}
                    <Link
                      to="/hostel/expenses"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/hostel/expenses') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Hostel Expenses
                    </Link>
                    {/* END: Added Hostel Expenses Link */}

                    <Link
                      to="/hostel/profit-loss"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/hostel/profit-loss') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Profit & Loss
                    </Link>

                    <Link
                      to="/hostel/expired"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/hostel/expired') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Expired Memberships
                    </Link>
                     <Link
                      to="/hostel"
                      className={`block py-2 px-3 rounded-md text-sm font-medium ${
                        isActive('/hostel') ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Student Management
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-2">
          <button
            className={`flex items-center w-full px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
            onClick={handleLogout}
          >
            <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <LogOut size={20} className="text-gray-500" />
              {!isCollapsed && <span className="font-medium">Logout</span>}
            </div>
          </button>
        </div>
      </div>
  );
};

export default Sidebar;
