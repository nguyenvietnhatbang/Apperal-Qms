'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UserList, { User } from './components/UserList';
import UserModal from './components/UserModal';
import DepartmentList, { Department } from './components/DepartmentList';
import DepartmentModal from './components/DepartmentModal';

export default function AuthPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
  
  // Data States
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Modals & Form States
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    id: null as string | null,
    username: '',
    password: '',
    display_name: '',
    department_id: '' as string
  });
  
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({
    id: null as string | null,
    name: '',
    permissions: [] as string[]
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      const hasPermission = data.session.username === 'admin' || data.session.permissions.includes('auth');
      if (!hasPermission) {
        router.replace('/modules');
        return;
      }
      setSession(data.session);
    } catch (e) {
      router.replace('/login');
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/departments')
      ]);

      if (usersRes.ok && deptsRes.ok) {
        const usersData = await usersRes.json();
        const deptsData = await deptsRes.json();
        setUsers(usersData.data);
        setDepartments(deptsData.data);
      }
    } catch (e) {
      console.error('Error fetching admin data', e);
    }
  };

  useEffect(() => {
    fetchSession().then(() => {
      fetchData().then(() => {
        setLoading(false);
      });
    });
  }, [router]);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // User Actions
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setUserForm({
        id: user.id,
        username: user.username,
        password: '',
        display_name: user.display_name,
        department_id: user.department_id || ''
      });
    } else {
      setUserForm({
        id: null,
        username: '',
        password: '',
        display_name: '',
        department_id: ''
      });
    }
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = userForm.id !== null;
    const url = '/api/admin/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userForm.id,
          username: userForm.username,
          password: userForm.password,
          display_name: userForm.display_name,
          department_id: userForm.department_id ? String(userForm.department_id) : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi lưu người dùng.');
      } else {
        showNotification('success', isEdit ? 'Đã cập nhật tài khoản thành công!' : 'Đã tạo tài khoản mới thành công!');
        setShowUserModal(false);
        fetchData();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này không?')) return;
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi xóa người dùng.');
      } else {
        showNotification('success', 'Đã xóa tài khoản thành công.');
        fetchData();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  // Department Actions
  const handleOpenDeptModal = (dept?: Department) => {
    if (dept) {
      setDeptForm({
        id: dept.id,
        name: dept.name,
        permissions: dept.permissions || []
      });
    } else {
      setDeptForm({
        id: null,
        name: '',
        permissions: []
      });
    }
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = deptForm.id !== null;
    const url = '/api/admin/departments';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deptForm.id,
          name: deptForm.name,
          permissions: deptForm.permissions
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi lưu phòng ban.');
      } else {
        showNotification('success', isEdit ? 'Cập nhật phòng ban thành công!' : 'Đã tạo phòng ban thành công!');
        setShowDeptModal(false);
        fetchData();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('Xóa phòng ban sẽ hủy phòng ban của các nhân viên thuộc phòng này. Bạn có chắc chắn?')) return;
    try {
      const res = await fetch(`/api/admin/departments?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi xóa phòng ban.');
      } else {
        showNotification('success', 'Đã xóa phòng ban thành công.');
        fetchData();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navbar */}
      <header className="glass-panel border-t-0 border-x-0 border-b border-white/[0.06] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/modules')}
              className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="h-5 w-px bg-white/10" />
            <span className="font-bold text-white">Quản lý Phân Quyền</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full">
              {session?.displayName} (Admin)
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Floating Notifications */}
        {successMsg && (
          <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 text-emerald-400 animate-fade-in text-sm max-w-sm shadow-lg shadow-emerald-500/5">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-rose-500/10 p-4 border border-rose-500/20 text-rose-400 animate-fade-in text-sm max-w-sm shadow-lg shadow-rose-500/5">
            {errorMsg}
          </div>
        )}

        {/* Tab Buttons & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="inline-flex rounded-xl p-1 bg-slate-950/40 border border-white/5 self-start">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'users' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tài khoản hệ thống ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'departments' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Phòng ban & Vai trò ({departments.length})
            </button>
          </div>

          <div>
            {activeTab === 'users' ? (
              <button
                onClick={() => handleOpenUserModal()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Tạo tài khoản
              </button>
            ) : (
              <button
                onClick={() => handleOpenDeptModal()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Thêm phòng ban
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Panel Content */}
        <div className="animate-fade-in">
          {activeTab === 'users' ? (
            <UserList 
              users={users} 
              onEdit={handleOpenUserModal} 
              onDelete={handleDeleteUser} 
            />
          ) : (
            <DepartmentList 
              departments={departments} 
              onEdit={handleOpenDeptModal} 
              onDelete={handleDeleteDept} 
            />
          )}
        </div>
      </main>

      {/* Forms & Dialog Modals */}
      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        userForm={userForm}
        setUserForm={setUserForm}
        departments={departments}
        onSave={handleSaveUser}
      />

      <DepartmentModal
        isOpen={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        deptForm={deptForm}
        setDeptForm={setDeptForm}
        onSave={handleSaveDept}
      />
    </div>
  );
}
