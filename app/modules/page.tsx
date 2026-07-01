'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserSession {
  userId: number;
  username: string;
  displayName: string;
  departmentName: string | null;
  permissions: string[];
}

export default function ModulesPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(async (res) => {
        if (!res.ok) {
          router.replace('/login');
        } else {
          const data = await res.json();
          setSession(data.session);
        }
      })
      .catch(() => {
        router.replace('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (e) {
      console.error('Error logging out', e);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-slate-400 text-sm">Đang tải cấu hình cổng thông tin...</span>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const hasAuthPermission = session.username === 'admin' || session.permissions.includes('auth');
  const hasPayrollPermission = session.username === 'admin' || session.permissions.includes('payroll');

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navbar */}
      <header className="glass-panel border-t-0 border-x-0 border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V17.8a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-2.05ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H17.8A2.25 2.25 0 0 1 20 6v2.25a2.25 2.25 0 0 1-2.25 2.25H15.75a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H17.8A2.25 2.25 0 0 1 20 15.75V17.8a2.25 2.25 0 0 1-2.25 2.25H15.75a2.25 2.25 0 0 1-2.25-2.25v-2.05Z" />
              </svg>
            </div>
            <span className="font-bold tracking-tight text-white">Apparel Portal</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-white">{session.displayName}</span>
              <span className="text-xs text-slate-400">{session.departmentName || 'Chưa phân phòng ban'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            LỰA CHỌN MODULE
          </h1>
          <p className="mt-2.5 text-slate-400 max-w-md mx-auto text-sm sm:text-base">
            Chào mừng quay trở lại. Hãy lựa chọn hệ thống nghiệp vụ tương ứng dưới quyền hạn của bạn.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          
          {/* Module 1: Auth & Phân Quyền */}
          <div 
            onClick={() => hasAuthPermission && router.push('/auth')}
            className={`glass-panel rounded-3xl p-8 border-white/[0.06] flex flex-col justify-between transition-all duration-300 animate-fade-in animate-delay-100 ${
              hasAuthPermission 
                ? 'cursor-pointer hover:-translate-y-1.5 hover:border-indigo-500/30 hover:shadow-indigo-500/5 group' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                {!hasAuthPermission && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-400 border border-slate-700/50">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    Khóa
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Quản lý Phân Quyền
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Quản lý các tài khoản đăng nhập cổng thông tin, định nghĩa các phòng ban và phân quyền chức năng động cho từng đối tượng.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
              <span>{hasAuthPermission ? 'Truy cập hệ thống' : 'Chưa được phân quyền'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </div>

          {/* Module 2: Chấm Công / Tính Lương */}
          <div 
            onClick={() => hasPayrollPermission && router.push('/payroll')}
            className={`glass-panel rounded-3xl p-8 border-white/[0.06] flex flex-col justify-between transition-all duration-300 animate-fade-in animate-delay-200 ${
              hasPayrollPermission 
                ? 'cursor-pointer hover:-translate-y-1.5 hover:border-emerald-500/30 hover:shadow-emerald-500/5 group' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5M5.25 7.5h13.5m-12 9h10.5M5.25 10.5h13.5m-10.5 3h7.5m-1.5 6h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                {!hasPayrollPermission && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-400 border border-slate-700/50">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    Khóa
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                Chấm Công & Tính Lương
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Nhập dữ liệu chấm công thô từ Excel, tự động chuẩn hóa làm sạch, quản lý hồ sơ và cấu hình lương nhân viên, tính toán bảng lương chu kỳ và xuất phiếu lương chi tiết.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>{hasPayrollPermission ? 'Truy cập hệ thống' : 'Chưa được phân quyền'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
