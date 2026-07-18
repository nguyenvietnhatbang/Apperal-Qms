"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, Shield, LayoutGrid, LogOut, Plus, Search, 
  Edit2, Trash2, Key, Bell, User, Check, X, ShieldAlert,
  ChevronRight, Home, Settings, HelpCircle, Loader2, ArrowLeft, 
  ChevronsLeft, ChevronsRight, ChevronLeft, SlidersHorizontal, Building2, Menu
} from "lucide-react";
import Link from "next/link";

interface AuthDashboardClientProps {
  currentUser: any;
  initialDepartments: any[];
  initialUsers: any[];
  initialFactories: any[];
  initialDepartmentsByFactory: Record<string, any[]>;
  modules: any[];
}

export default function AuthDashboardClient({
  currentUser,
  initialDepartments,
  initialUsers,
  initialFactories,
  initialDepartmentsByFactory,
  modules,
}: AuthDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "departments" | "factories">("users");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [departments, setDepartments] = useState(initialDepartments);
  const [users, setUsers] = useState(initialUsers);
  const [factories, setFactories] = useState(initialFactories);
  const [selectedFactoryId, setSelectedFactoryId] = useState(currentUser.factoryId);
  const [departmentsByFactory, setDepartmentsByFactory] = useState<Record<string, any[]>>(initialDepartmentsByFactory);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const hasSkippedInitialRefresh = useRef(false);

  // Pagination & Custom Filters State
  const [pageUsers, setPageUsers] = useState(1);
  const [limitUsers, setLimitUsers] = useState(20);
  const [deptFilter, setDeptFilter] = useState("all");

  const [pageDepts, setPageDepts] = useState(1);
  const [limitDepts, setLimitDepts] = useState(20);
  const [pageFactories, setPageFactories] = useState(1);
  const [limitFactories, setLimitFactories] = useState(20);

  // Reset pagination & search when tab switches
  useEffect(() => {
    setSearchTerm("");
    setPageUsers(1);
    setPageDepts(1);
    setPageFactories(1);
  }, [activeTab]);

  // Dialog State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);

  const [factoryModalOpen, setFactoryModalOpen] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<any>(null);

  // User Form State
  const [usernameForm, setUsernameForm] = useState("");
  const [displayNameForm, setDisplayNameForm] = useState("");
  const [emailForm, setEmailForm] = useState("");
  const [passwordForm, setPasswordForm] = useState("");
  const [deptIdForm, setDeptIdForm] = useState("");
  const [userMembershipsForm, setUserMembershipsForm] = useState<Record<string, { enabled: boolean; departmentId: string; isDefault: boolean }>>({});
  const [statusForm, setStatusForm] = useState<"active" | "inactive" | "locked">("active");
  const [isAdminForm, setIsAdminForm] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Department Form State
  const [deptCodeForm, setDeptCodeForm] = useState("");
  const [deptNameForm, setDeptNameForm] = useState("");
  const [deptDescForm, setDeptDescForm] = useState("");
  const [deptIsAdminForm, setDeptIsAdminForm] = useState(false);
  const [deptIsActiveForm, setDeptIsActiveForm] = useState(true);
  const [deptPermissions, setDeptPermissions] = useState<Record<string, any>>({});
  const [deptFormError, setDeptFormError] = useState<string | null>(null);

  const [factoryCodeForm, setFactoryCodeForm] = useState("");
  const [factoryNameForm, setFactoryNameForm] = useState("");
  const [factoryDescForm, setFactoryDescForm] = useState("");
  const [factoryIsActiveForm, setFactoryIsActiveForm] = useState(true);
  const [factoryFormError, setFactoryFormError] = useState<string | null>(null);

  // Fetch updated data
  const refreshData = async (factoryId = selectedFactoryId) => {
    setIsLoading(true);
    try {
      const isSystemAdmin = currentUser.isSystemAdmin;
      const [usersResponse, departmentsResponse, factoriesResponse] = await Promise.all([
        fetch(isSystemAdmin ? "/api/admin/users" : `/api/admin/users?factoryId=${encodeURIComponent(factoryId)}`),
        fetch(isSystemAdmin ? "/api/admin/departments?allFactories=true" : `/api/admin/departments?factoryId=${encodeURIComponent(factoryId)}`),
        isSystemAdmin ? fetch("/api/admin/factories") : Promise.resolve(null),
      ]);
      const [usersData, departmentsData, factoriesData] = await Promise.all([
        usersResponse.json(),
        departmentsResponse.json(),
        factoriesResponse?.json() ?? Promise.resolve(null),
      ]);

      if (usersData.success) setUsers(usersData.data);
      if (factoriesData?.success) setFactories(factoriesData.data);

      if (departmentsData.success) {
        if (isSystemAdmin) {
          const nextDepartmentsByFactory: Record<string, any[]> = departmentsData.data.reduce((result: Record<string, any[]>, department: any) => {
            const departmentFactoryId = department.factory_id;
            if (!result[departmentFactoryId]) result[departmentFactoryId] = [];
            result[departmentFactoryId].push(department);
            return result;
          }, {} as Record<string, any[]>);
          setDepartmentsByFactory(nextDepartmentsByFactory);
          setDepartments(nextDepartmentsByFactory[factoryId] || []);
        } else {
          setDepartments(departmentsData.data);
          setDepartmentsByFactory({ [factoryId]: departmentsData.data });
        }
      }
    } catch (error) {
      console.error("Refresh data error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser.isSystemAdmin) return;
    if (!hasSkippedInitialRefresh.current) {
      hasSkippedInitialRefresh.current = true;
      return;
    }

    void refreshData(selectedFactoryId);
  }, [selectedFactoryId]);

  // Open User Modal
  const openUserModal = (userItem: any = null) => {
    setSelectedUser(userItem);
    setUserFormError(null);
    if (userItem) {
      setUsernameForm(userItem.username);
      setDisplayNameForm(userItem.display_name);
      setEmailForm(userItem.email || "");
      setPasswordForm(""); // keep blank unless updating
      setDeptIdForm(userItem.department_id || "");
      setStatusForm(userItem.status);
      setIsAdminForm(userItem.is_admin);
      const membershipMap: Record<string, { enabled: boolean; departmentId: string; isDefault: boolean }> = {};
      factories.forEach((factory) => {
        const membership = (userItem.memberships || []).find((item: any) => item.factoryId === factory.id);
        membershipMap[factory.id] = {
          enabled: Boolean(membership),
          departmentId: membership?.departmentId || "",
          isDefault: Boolean(membership?.isDefault),
        };
      });
      setUserMembershipsForm(membershipMap);
    } else {
      setUsernameForm("");
      setDisplayNameForm("");
      setEmailForm("");
      setPasswordForm("");
      setDeptIdForm("");
      setStatusForm("active");
      setIsAdminForm(false);
      const membershipMap: Record<string, { enabled: boolean; departmentId: string; isDefault: boolean }> = {};
      factories.forEach((factory, index) => {
        membershipMap[factory.id] = {
          enabled: factory.id === selectedFactoryId || (!selectedFactoryId && index === 0),
          departmentId: "",
          isDefault: factory.id === selectedFactoryId || (!selectedFactoryId && index === 0),
        };
      });
      setUserMembershipsForm(membershipMap);
    }
    setUserModalOpen(true);
  };

  // Handle User Submit
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    const memberships = Object.entries(userMembershipsForm)
      .filter(([, membership]) => membership.enabled)
      .map(([factoryId, membership]) => ({
        factoryId,
        departmentId: membership.departmentId || null,
        isDefault: membership.isDefault,
        isActive: true,
      }));
    const fallbackFactoryId = memberships.find((membership) => membership.isDefault)?.factoryId || memberships[0]?.factoryId || selectedFactoryId;
    const normalizedMemberships = memberships.map((membership) => ({
      ...membership,
      isDefault: membership.factoryId === fallbackFactoryId,
    }));

    const payload = {
      username: usernameForm,
      displayName: displayNameForm,
      email: emailForm,
      password: passwordForm || undefined,
      departmentId: normalizedMemberships.find((membership) => membership.factoryId === fallbackFactoryId)?.departmentId || deptIdForm || null,
      status: statusForm,
      isAdmin: isAdminForm,
      factoryId: fallbackFactoryId,
      memberships: normalizedMemberships,
    };

    if (memberships.length === 0) {
      setUserFormError("Vui lòng cấp ít nhất một xưởng cho tài khoản.");
      return;
    }

    if (!selectedUser && !passwordForm) {
      setUserFormError("Mật khẩu là bắt buộc cho tài khoản mới.");
      return;
    }

    try {
      setIsLoading(true);
      const url = selectedUser ? `/api/admin/users/${selectedUser.id}` : "/api/admin/users";
      const method = selectedUser ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setUserFormError(data.error?.message || "Lỗi lưu tài khoản.");
        return;
      }

      setUserModalOpen(false);
      await refreshData();
    } catch (err) {
      setUserFormError("Lỗi kết nối server.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle User Delete
  const handleUserDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa tài khoản này không?")) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/users/${id}?factoryId=${selectedFactoryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Lỗi xóa người dùng");
        return;
      }
      await refreshData();
    } catch (err) {
      alert("Lỗi kết nối");
    } finally {
      setIsLoading(false);
    }
  };

  // Open Department Modal
  const openDeptModal = async (deptItem: any = null) => {
    setSelectedDept(deptItem);
    setDeptFormError(null);
    
    // Initialize permissions object for all modules
    const initialPerms: Record<string, any> = {};
    modules.forEach(m => {
      initialPerms[m.id] = { canView: false, canCreate: false, canUpdate: false, canDelete: false, canApprove: false };
    });

    if (deptItem) {
      setDeptCodeForm(deptItem.code);
      setDeptNameForm(deptItem.name);
      setDeptDescForm(deptItem.description || "");
      setDeptIsAdminForm(deptItem.is_admin);
      setDeptIsActiveForm(deptItem.is_active);

      // Load permissions
      try {
        setIsLoading(true);
        const res = await fetch(`/api/admin/departments/${deptItem.id}?factoryId=${selectedFactoryId}`);
        const data = await res.json();
        if (data.success && data.data.permissions) {
          data.data.permissions.forEach((p: any) => {
            initialPerms[p.moduleId] = {
              canView: p.canView,
              canCreate: p.canCreate,
              canUpdate: p.canUpdate,
              canDelete: p.canDelete,
              canApprove: p.canApprove,
            };
          });
        }
      } catch (err) {
        console.error("Error loading permissions", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setDeptCodeForm("");
      setDeptNameForm("");
      setDeptDescForm("");
      setDeptIsAdminForm(false);
      setDeptIsActiveForm(true);
    }

    setDeptPermissions(initialPerms);
    setDeptModalOpen(true);
  };

  // Handle Permission Toggle
  const togglePermission = (moduleId: string, field: string) => {
    setDeptPermissions(prev => {
      const current = prev[moduleId] || { canView: false, canCreate: false, canUpdate: false, canDelete: false, canApprove: false };
      return {
        ...prev,
        [moduleId]: {
          ...current,
          [field]: !current[field]
        }
      };
    });
  };

  // Handle Department Submit
  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptFormError(null);

    // Map permissions state to API payload
    const permissionsPayload = Object.keys(deptPermissions).map(moduleId => ({
      moduleId,
      canView: deptPermissions[moduleId].canView,
      canCreate: deptPermissions[moduleId].canCreate,
      canUpdate: deptPermissions[moduleId].canUpdate,
      canDelete: deptPermissions[moduleId].canDelete,
      canApprove: deptPermissions[moduleId].canApprove,
    }));

    const payload = {
      code: deptCodeForm,
      name: deptNameForm,
      description: deptDescForm,
      isAdmin: deptIsAdminForm,
      isActive: deptIsActiveForm,
      permissions: permissionsPayload,
      factoryId: selectedFactoryId,
    };

    try {
      setIsLoading(true);
      const url = selectedDept ? `/api/admin/departments/${selectedDept.id}` : "/api/admin/departments";
      const method = selectedDept ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setDeptFormError(data.error?.message || "Lỗi lưu phòng ban.");
        return;
      }

      setDeptModalOpen(false);
      await refreshData();
    } catch (err) {
      setDeptFormError("Lỗi kết nối server.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Department Delete
  const handleDeptDelete = async (id: string) => {
    if (!confirm("Xóa phòng ban này sẽ làm ảnh hưởng đến phân quyền các thành viên thuộc phòng. Bạn có chắc chắn xóa?")) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/departments/${id}?factoryId=${selectedFactoryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Lỗi xóa phòng ban");
        return;
      }
      await refreshData();
    } catch (err) {
      alert("Lỗi kết nối");
    } finally {
      setIsLoading(false);
    }
  };

  const openFactoryModal = (factoryItem: any = null) => {
    setSelectedFactory(factoryItem);
    setFactoryFormError(null);
    if (factoryItem) {
      setFactoryCodeForm(factoryItem.code);
      setFactoryNameForm(factoryItem.name);
      setFactoryDescForm(factoryItem.description || "");
      setFactoryIsActiveForm(factoryItem.is_active ?? factoryItem.isActive ?? true);
    } else {
      setFactoryCodeForm("");
      setFactoryNameForm("");
      setFactoryDescForm("");
      setFactoryIsActiveForm(true);
    }
    setFactoryModalOpen(true);
  };

  const handleFactorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFactoryFormError(null);

    const payload = {
      code: factoryCodeForm,
      name: factoryNameForm,
      description: factoryDescForm,
      isActive: factoryIsActiveForm,
    };

    try {
      setIsLoading(true);
      const url = selectedFactory ? `/api/admin/factories/${selectedFactory.id}` : "/api/admin/factories";
      const method = selectedFactory ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setFactoryFormError(data.error?.message || "Lỗi lưu xưởng.");
        return;
      }

      setFactoryModalOpen(false);
      await refreshData(selectedFactoryId);
    } catch (err) {
      setFactoryFormError("Lỗi kết nối server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFactoryDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa xưởng này không? Xưởng chỉ xóa được khi chưa có dữ liệu liên quan.")) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/factories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Lỗi xóa xưởng");
        return;
      }
      if (selectedFactoryId === id) {
        const nextFactory = factories.find((f) => f.id !== id);
        if (nextFactory) setSelectedFactoryId(nextFactory.id);
      }
      await refreshData(selectedFactoryId);
    } catch (err) {
      alert("Lỗi kết nối");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (confirm("Bạn có muốn đăng xuất?")) {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    }
  };

  const uniqueDepartments = Array.from(
    new Set(departments.map(d => d.name).filter(Boolean))
  ) as string[];

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department_name && u.department_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDept = deptFilter === "all" || u.department_name === deptFilter;
    return matchesSearch && matchesDept;
  });

  const paginatedUsers = filteredUsers.slice(
    (pageUsers - 1) * limitUsers,
    pageUsers * limitUsers
  );

  const filteredDepts = departments.filter(d => 
    d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedDepts = filteredDepts.slice(
    (pageDepts - 1) * limitDepts,
    pageDepts * limitDepts
  );

  const filteredFactories = factories.filter(f =>
    f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedFactories = filteredFactories.slice(
    (pageFactories - 1) * limitFactories,
    pageFactories * limitFactories
  );

  return (
    <div className="dashboard-shell flex h-screen bg-zinc-50 text-zinc-900 font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-zinc-200 flex flex-col justify-between shrink-0 shadow-sm transition-transform duration-200 md:relative md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div>
          {/* Logo Brand */}
          <div className="px-6 py-5 border-b border-zinc-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/10">
              CF
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-800">Aparel</h2>
              <p className="text-xs text-zinc-400">Hệ thống nội bộ</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveTab("users"); setSearchTerm(""); setMobileNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                activeTab === "users" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Tài khoản Web</span>
            </button>
            <button
              onClick={() => { setActiveTab("departments"); setSearchTerm(""); setMobileNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                activeTab === "departments" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Phòng ban & Phân quyền</span>
            </button>
            {currentUser.isSystemAdmin && (
              <button
                onClick={() => { setActiveTab("factories"); setSearchTerm(""); setMobileNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                  activeTab === "factories" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span>Nhà xưởng</span>
              </button>
            )}
          </nav>
        </div>

        {/* Footer Sidebar info */}
        <div className="p-4 border-t border-zinc-100 space-y-1">
          <Link href="/modules" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors font-medium">
            <LayoutGrid className="w-5 h-5" />
            <span>Quay lại Trang chủ</span>
          </Link>
          <div className="text-xs text-zinc-400 py-2 px-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            <span>Thông tin bản quyền</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors font-medium cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      {mobileNavOpen && <button type="button" aria-label="Đóng menu" className="mobile-nav-backdrop fixed inset-0 z-30 bg-zinc-950/30 md:hidden" onClick={() => setMobileNavOpen(false)} />}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* Top Header Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-sm z-10">
          <button type="button" aria-label="Mở menu" className="mobile-menu-button icon-btn md:hidden shrink-0" onClick={() => setMobileNavOpen(true)}><Menu className="w-5 h-5" /></button>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium">
            <Link href="/modules" className="hover:text-zinc-800">Trang chủ</Link>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
            <Link href="/auth" className="hover:text-zinc-800">Hệ thống</Link>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
            <span className="text-zinc-800 font-semibold">Cấu hình phân quyền</span>
          </div>

          {/* User profile dropdown info */}
          <div className="flex items-center gap-4 min-w-0">
            {currentUser.isSystemAdmin && (
              <select
                value={selectedFactoryId}
                onChange={(e) => setSelectedFactoryId(e.target.value)}
                className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
              >
                {factories.filter((factory) => factory.is_active ?? factory.isActive ?? true).map((factory) => (
                  <option key={factory.id} value={factory.id}>{factory.name}</option>
                ))}
              </select>
            )}
            <button className="p-2 text-zinc-400 hover:text-zinc-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="h-8 w-px bg-zinc-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-800 leading-none">{currentUser.displayName}</p>
                <p className="text-xs text-zinc-400 mt-1 uppercase font-bold tracking-wider">
                  {currentUser.isAdmin ? "Admin" : currentUser.departmentName || "Thành viên"}
                </p>
              </div>
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/10">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden bg-zinc-50">
          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center z-50">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {/* Tab Views Card */}
          <div className="flex-1 flex flex-col min-h-0 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            {activeTab === "users" && (() => {
              const totalItems = filteredUsers.length;
              const totalPages = Math.ceil(totalItems / limitUsers) || 1;
              return (
                <>
                  {/* Card Top Toolbar */}
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm tài khoản..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageUsers(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <select
                        value={deptFilter}
                        onChange={(e) => {
                          setDeptFilter(e.target.value);
                          setPageUsers(1);
                        }}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        <option value="all">Phòng ban (Tất cả)</option>
                        {uniqueDepartments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openUserModal()}
                        className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10 px-4 py-2 font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm tài khoản</span>
                      </button>
                    </div>
                  </div>

                  {/* Table Grid */}
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 w-12 text-center">
                            <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                          </th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Họ và Tên</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Tên đăng nhập</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Email</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Phòng ban</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Vai trò</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Trạng thái</th>
                          <th className="px-6 py-3 sticky top-0 right-0 bg-zinc-50 border-b border-zinc-100 border-l border-zinc-100 z-30 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-sm">
                        {paginatedUsers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-zinc-400">Không tìm thấy tài khoản nào.</td>
                          </tr>
                        ) : (
                          paginatedUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors whitespace-nowrap">
                              <td data-label="Chọn" className="px-6 py-2.5 text-center">
                                <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                              </td>
                              <td data-label="Họ và tên" className="px-6 py-2.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                                    {u.display_name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-zinc-800">{u.display_name}</span>
                                </div>
                              </td>
                              <td data-label="Tên đăng nhập" className="px-6 py-2.5 font-mono text-zinc-650 font-bold">{u.username}</td>
                              <td data-label="Email" className="px-6 py-2.5 text-zinc-500">{u.email || "-"}</td>
                              <td data-label="Phòng ban" className="px-6 py-2.5">
                                <span className="font-medium text-zinc-700">{u.department_name || "Chưa phân"}</span>
                              </td>
                              <td data-label="Vai trò" className="px-6 py-2.5">
                                {u.is_admin ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-55/60 text-red-650 border border-red-200/50 text-xs font-bold rounded-lg uppercase">
                                    <Shield className="w-3.5 h-3.5" /> Admin
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 text-zinc-600 border border-zinc-200 text-xs font-bold rounded-lg uppercase">
                                    Staff
                                  </span>
                                )}
                              </td>
                              <td data-label="Trạng thái" className="px-6 py-2.5">
                                {u.status === "active" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Đang hoạt động</span>
                                ) : u.status === "locked" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">Đang khóa</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-550 border border-zinc-200">Ngừng hoạt động</span>
                                )}
                              </td>
                              <td data-label="Thao tác" className="px-6 py-2.5 sticky right-0 bg-white border-l border-zinc-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right z-10">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => openUserModal(u)} className="icon-btn hover:text-blue-600 rounded-lg p-1.5 cursor-pointer" title="Sửa"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleUserDelete(u.id)} disabled={u.username === "admin"} className="icon-btn-danger hover:bg-red-50 hover:text-red-700 rounded-lg p-1.5 disabled:opacity-30 cursor-pointer" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold select-none">
                    <div>Hiển thị {(pageUsers - 1) * limitUsers + 1}-{Math.min(pageUsers * limitUsers, totalItems)} / Tổng: {totalItems}</div>
                    <div className="flex items-center gap-2">
                      <span>Số hàng:</span>
                      <select
                        value={limitUsers}
                        onChange={(e) => {
                          setLimitUsers(Number(e.target.value));
                          setPageUsers(1);
                        }}
                        className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageUsers(1)} disabled={pageUsers === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageUsers(p => Math.max(1, p - 1))} disabled={pageUsers === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-bold mx-1">{pageUsers} / {totalPages}</span>
                      <button onClick={() => setPageUsers(p => Math.min(totalPages, p + 1))} disabled={pageUsers === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageUsers(totalPages)} disabled={pageUsers === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}

            {activeTab === "departments" && (() => {
              const totalItems = filteredDepts.length;
              const totalPages = Math.ceil(totalItems / limitDepts) || 1;
              return (
                <>
                  {/* Card Top Toolbar */}
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm phòng ban..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageDepts(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openDeptModal()}
                        className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10 px-4 py-2 font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm phòng ban</span>
                      </button>
                    </div>
                  </div>

                  {/* Table Grid */}
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 w-12 text-center">
                            <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                          </th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Mã phòng ban</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Tên phòng ban</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Mô tả</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Quyền Admin</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Trạng thái</th>
                          <th className="px-6 py-3 sticky top-0 right-0 bg-zinc-50 border-b border-zinc-100 border-l border-zinc-100 z-30 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-sm">
                        {paginatedDepts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">Không tìm thấy phòng ban nào.</td>
                          </tr>
                        ) : (
                          paginatedDepts.map((d) => (
                            <tr key={d.id} className="hover:bg-zinc-50/50 transition-colors whitespace-nowrap">
                              <td data-label="Chọn" className="px-6 py-2.5 text-center">
                                <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                              </td>
                              <td data-label="Mã phòng ban" className="px-6 py-2.5 font-mono font-bold text-zinc-700">{d.code}</td>
                              <td data-label="Tên phòng ban" className="px-6 py-2.5 font-semibold text-zinc-800">{d.name}</td>
                              <td data-label="Mô tả" className="px-6 py-2.5 text-zinc-500">{d.description || "-"}</td>
                              <td data-label="Quyền Admin" className="px-6 py-2.5">
                                {d.is_admin ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-55/60 text-red-650 border border-red-200/50 text-xs font-bold rounded-lg uppercase">
                                    <ShieldAlert className="w-3.5 h-3.5" /> Quyền quản trị
                                  </span>
                                ) : (
                                  <span className="text-zinc-400">Nhân viên thường</span>
                                )}
                              </td>
                              <td data-label="Trạng thái" className="px-6 py-2.5">
                                {d.is_active ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Kích hoạt</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">Tắt</span>
                                )}
                              </td>
                              <td data-label="Thao tác" className="px-6 py-2.5 sticky right-0 bg-white border-l border-zinc-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right z-10">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => openDeptModal(d)} className="icon-btn hover:text-blue-600 rounded-lg p-1.5 cursor-pointer" title="Sửa & Phân quyền"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDeptDelete(d.id)} disabled={d.code === "admin"} className="icon-btn-danger hover:bg-red-50 hover:text-red-700 rounded-lg p-1.5 disabled:opacity-30 cursor-pointer" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold select-none">
                    <div>Hiển thị {(pageDepts - 1) * limitDepts + 1}-{Math.min(pageDepts * limitDepts, totalItems)} / Tổng: {totalItems}</div>
                    <div className="flex items-center gap-2">
                      <span>Số hàng:</span>
                      <select
                        value={limitDepts}
                        onChange={(e) => {
                          setLimitDepts(Number(e.target.value));
                          setPageDepts(1);
                        }}
                        className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageDepts(1)} disabled={pageDepts === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageDepts(p => Math.max(1, p - 1))} disabled={pageDepts === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-bold mx-1">{pageDepts} / {totalPages}</span>
                      <button onClick={() => setPageDepts(p => Math.min(totalPages, p + 1))} disabled={pageDepts === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageDepts(totalPages)} disabled={pageDepts === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}

            {activeTab === "factories" && currentUser.isSystemAdmin && (() => {
              const totalItems = filteredFactories.length;
              const totalPages = Math.ceil(totalItems / limitFactories) || 1;
              return (
                <>
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Tìm xưởng..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setPageFactories(1);
                        }}
                        className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <button
                      onClick={() => openFactoryModal()}
                      className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10 px-4 py-2 font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm xưởng</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Mã xưởng</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Tên xưởng</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Mô tả</th>
                          <th className="px-6 py-3 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20">Trạng thái</th>
                          <th className="px-6 py-3 sticky top-0 right-0 bg-zinc-50 border-b border-zinc-100 border-l border-zinc-100 z-30 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-sm">
                        {paginatedFactories.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">Không tìm thấy xưởng nào.</td>
                          </tr>
                        ) : (
                          paginatedFactories.map((factory) => (
                            <tr key={factory.id} className="hover:bg-zinc-50/50 transition-colors whitespace-nowrap">
                              <td className="px-6 py-2.5 font-mono font-bold text-zinc-700">{factory.code}</td>
                              <td className="px-6 py-2.5 font-semibold text-zinc-800">{factory.name}</td>
                              <td className="px-6 py-2.5 text-zinc-500">{factory.description || "-"}</td>
                              <td className="px-6 py-2.5">
                                {(factory.is_active ?? factory.isActive) ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Kích hoạt</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">Tắt</span>
                                )}
                              </td>
                              <td className="px-6 py-2.5 sticky right-0 bg-white border-l border-zinc-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right z-10">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => openFactoryModal(factory)} className="icon-btn hover:text-blue-600 rounded-lg p-1.5 cursor-pointer" title="Sửa xưởng"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleFactoryDelete(factory.id)} disabled={factory.code === "default"} className="icon-btn-danger hover:bg-red-50 hover:text-red-700 rounded-lg p-1.5 disabled:opacity-30 cursor-pointer" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold select-none">
                    <div>Hiển thị {(pageFactories - 1) * limitFactories + 1}-{Math.min(pageFactories * limitFactories, totalItems)} / Tổng: {totalItems}</div>
                    <div className="flex items-center gap-2">
                      <span>Số hàng:</span>
                      <select
                        value={limitFactories}
                        onChange={(e) => {
                          setLimitFactories(Number(e.target.value));
                          setPageFactories(1);
                        }}
                        className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageFactories(1)} disabled={pageFactories === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageFactories(p => Math.max(1, p - 1))} disabled={pageFactories === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-bold mx-1">{pageFactories} / {totalPages}</span>
                      <button onClick={() => setPageFactories(p => Math.min(totalPages, p + 1))} disabled={pageFactories === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageFactories(totalPages)} disabled={pageFactories === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </main>
      </div>

      {/* User CRUD Dialog Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-zoomIn">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-bold text-md text-zinc-800">
                {selectedUser ? "Chỉnh sửa tài khoản" : "Tạo tài khoản mới"}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {userFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>{userFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Tên đăng nhập *</label>
                    <input
                      type="text"
                      value={usernameForm}
                      onChange={(e) => setUsernameForm(e.target.value)}
                      disabled={!!selectedUser}
                      placeholder="vd: bangluong"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Họ và Tên *</label>
                    <input
                      type="text"
                      value={displayNameForm}
                      onChange={(e) => setDisplayNameForm(e.target.value)}
                      placeholder="vd: Lê Minh Công"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Email</label>
                    <input
                      type="email"
                      value={emailForm}
                      onChange={(e) => setEmailForm(e.target.value)}
                      placeholder="user@camthien.vn"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Phòng ban</label>
                    <select
                      value={deptIdForm}
                      onChange={(e) => setDeptIdForm(e.target.value)}
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    >
                      <option value="">-- Chưa phân phòng --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name} {d.is_admin ? "(Admin)" : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {currentUser.isSystemAdmin && (
                  <div className="rounded-xl border border-zinc-200 overflow-hidden">
                    <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">Xưởng được truy cập</h4>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {factories.map((factory) => {
                        const membership = userMembershipsForm[factory.id] || { enabled: false, departmentId: "", isDefault: false };
                        const factoryDepartments = departmentsByFactory[factory.id] || [];
                        return (
                          <div key={factory.id} className="grid grid-cols-[1fr_180px_80px] gap-3 px-4 py-3 items-center">
                            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={membership.enabled}
                                onChange={(e) => {
                                  const enabled = e.target.checked;
                                  setUserMembershipsForm((current) => ({
                                    ...current,
                                    [factory.id]: {
                                      ...membership,
                                      enabled,
                                      isDefault: enabled && !Object.entries(current).some(([id, item]) => id !== factory.id && item.enabled && item.isDefault),
                                    },
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                              <span>{factory.name}</span>
                            </label>
                            <select
                              value={membership.departmentId}
                              disabled={!membership.enabled}
                              onChange={(e) => {
                                setUserMembershipsForm((current) => ({
                                  ...current,
                                  [factory.id]: { ...membership, departmentId: e.target.value },
                                }));
                              }}
                              className="input rounded-xl border-zinc-250 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                            >
                              <option value="">-- Chưa phân phòng --</option>
                              {factoryDepartments.map((department) => (
                                <option key={department.id} value={department.id}>
                                  {department.name} {department.is_admin ? "(Admin)" : ""}
                                </option>
                              ))}
                            </select>
                            <label className="flex items-center justify-end gap-2 text-xs font-bold text-zinc-500">
                              <input
                                type="radio"
                                name="defaultFactory"
                                checked={membership.enabled && membership.isDefault}
                                disabled={!membership.enabled}
                                onChange={() => {
                                  setUserMembershipsForm((current) => {
                                    const next: Record<string, { enabled: boolean; departmentId: string; isDefault: boolean }> = {};
                                    Object.keys(current).forEach((id) => {
                                      next[id] = { ...current[id], isDefault: id === factory.id };
                                    });
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 text-blue-600 border-zinc-300 focus:ring-blue-500 cursor-pointer"
                              />
                              Mặc định
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">
                    Mật khẩu {selectedUser ? "(Để trống nếu không muốn đổi)" : "*"}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={passwordForm}
                      onChange={(e) => setPasswordForm(e.target.value)}
                      placeholder="••••••••"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required={!selectedUser}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Trạng thái</label>
                    <select
                      value={statusForm}
                      onChange={(e) => setStatusForm(e.target.value as any)}
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    >
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Khóa tạm thời</option>
                      <option value="locked">Bị vô hiệu hóa</option>
                    </select>
                  </div>

                  <div className="flex items-center h-full pt-6">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAdminForm}
                        onChange={(e) => setIsAdminForm(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Tài khoản Quản trị (Admin)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="btn-secondary rounded-xl text-sm px-4 py-2 cursor-pointer font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm px-4 py-2 cursor-pointer font-semibold shadow-md shadow-blue-500/10 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department CRUD Dialog Modal with Dynamic Permission Table */}
      {deptModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-zoomIn">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-bold text-md text-zinc-800">
                {selectedDept ? "Chỉnh sửa & Phân quyền phòng ban" : "Tạo phòng ban mới"}
              </h3>
              <button onClick={() => setDeptModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeptSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {deptFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>{deptFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Mã phòng ban *</label>
                    <input
                      type="text"
                      value={deptCodeForm}
                      onChange={(e) => setDeptCodeForm(e.target.value)}
                      placeholder="vd: hr"
                      disabled={selectedDept?.code === "admin"}
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Tên phòng ban *</label>
                    <input
                      type="text"
                      value={deptNameForm}
                      onChange={(e) => setDeptNameForm(e.target.value)}
                      placeholder="vd: Hành chính Nhân sự"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Mô tả phòng ban</label>
                  <textarea
                    value={deptDescForm}
                    onChange={(e) => setDeptDescForm(e.target.value)}
                    placeholder="Mô tả công việc hoặc vai trò của phòng ban..."
                    rows={2}
                    className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deptIsAdminForm}
                        onChange={(e) => setDeptIsAdminForm(e.target.checked)}
                        disabled={selectedDept?.code === "admin"}
                        className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Quyền Admin tối cao (Full Modules)</span>
                    </label>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deptIsActiveForm}
                        onChange={(e) => setDeptIsActiveForm(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Phòng ban đang kích hoạt</span>
                    </label>
                  </div>
                </div>

                {/* Permissions matrix table */}
                {!deptIsAdminForm && (
                  <div className="mt-6 border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3">
                      <h4 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Phân Quyền Module Chi Tiết</h4>
                    </div>
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                          <th className="px-4 py-3">Phân hệ (Module)</th>
                          <th className="px-4 py-3 text-center">Xem</th>
                          <th className="px-4 py-3 text-center">Tạo</th>
                          <th className="px-4 py-3 text-center">Sửa</th>
                          <th className="px-4 py-3 text-center">Xóa</th>
                          <th className="px-4 py-3 text-center">Duyệt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {modules.map((m) => {
                          const perm = deptPermissions[m.id] || { canView: false, canCreate: false, canUpdate: false, canDelete: false, canApprove: false };
                          return (
                            <tr key={m.id} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-3.5">
                                <p className="font-semibold text-zinc-800">{m.name}</p>
                                <p className="text-xs text-zinc-400 mt-0.5">{m.description}</p>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={perm.canView}
                                  onChange={() => togglePermission(m.id, "canView")}
                                  className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={perm.canCreate}
                                  onChange={() => togglePermission(m.id, "canCreate")}
                                  className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={perm.canUpdate}
                                  onChange={() => togglePermission(m.id, "canUpdate")}
                                  className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={perm.canDelete}
                                  onChange={() => togglePermission(m.id, "canDelete")}
                                  className="w-4 h-4 text-red-600 rounded border-zinc-300 focus:ring-red-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={perm.canApprove}
                                  onChange={() => togglePermission(m.id, "canApprove")}
                                  className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="btn-secondary rounded-xl text-sm px-4 py-2 cursor-pointer font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm px-4 py-2 cursor-pointer font-semibold shadow-md shadow-blue-500/10 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {factoryModalOpen && currentUser.isSystemAdmin && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-zoomIn">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-bold text-md text-zinc-800">
                {selectedFactory ? "Chỉnh sửa xưởng" : "Tạo xưởng mới"}
              </h3>
              <button onClick={() => setFactoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFactorySubmit}>
              <div className="p-6 space-y-4">
                {factoryFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>{factoryFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Mã xưởng *</label>
                    <input
                      type="text"
                      value={factoryCodeForm}
                      onChange={(e) => setFactoryCodeForm(e.target.value)}
                      placeholder="vd: xuong-a"
                      disabled={selectedFactory?.code === "default"}
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Tên xưởng *</label>
                    <input
                      type="text"
                      value={factoryNameForm}
                      onChange={(e) => setFactoryNameForm(e.target.value)}
                      placeholder="vd: Xưởng A"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Mô tả</label>
                  <textarea
                    value={factoryDescForm}
                    onChange={(e) => setFactoryDescForm(e.target.value)}
                    placeholder="Ghi chú về nhà xưởng, chi nhánh hoặc khu sản xuất..."
                    rows={3}
                    className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none py-2"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={factoryIsActiveForm}
                    onChange={(e) => setFactoryIsActiveForm(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Xưởng đang hoạt động</span>
                </label>
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFactoryModalOpen(false)}
                  className="btn-secondary rounded-xl text-sm px-4 py-2 cursor-pointer font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm px-4 py-2 cursor-pointer font-semibold shadow-md shadow-blue-500/10 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
