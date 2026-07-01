"use client";

import { useEffect, useState } from "react";
import { AdminShell, ResourceTable, Tabs, badge, type ResourceConfig } from "@/app/_components/admin-ui";

type Department = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
};

type User = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  departmentId: string | null;
  departmentName: string | null;
  status: string;
  isAdmin: boolean;
  lastLoginAt: string | null;
};

export function AuthAdmin() {
  const [active, setActive] = useState("departments");
  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/departments?options=true")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          setDepartmentOptions(
            payload.data.map((department: { id: string; code: string; name: string }) => ({
              value: department.id,
              label: `${department.code} - ${department.name}`,
            })),
          );
        }
      });
  }, []);

  const departmentConfig: ResourceConfig<Department> = {
    key: "departments",
    title: "Phòng ban",
    description: "Quản lý phòng ban/role và trạng thái hoạt động.",
    endpoint: "/api/admin/departments",
    searchPlaceholder: "Tìm mã hoặc tên phòng ban",
    defaultItem: { code: "", name: "", description: "", isAdmin: false, isActive: true },
    columns: [
      { key: "code", label: "Mã" },
      { key: "name", label: "Tên" },
      { key: "isAdmin", label: "Admin", render: (row) => badge(row.isAdmin ? "admin" : "role") },
      { key: "isActive", label: "Trạng thái", render: (row) => badge(row.isActive ? "active" : "inactive") },
    ],
    fields: [
      { name: "code", label: "Mã phòng ban", required: true },
      { name: "name", label: "Tên phòng ban", required: true },
      { name: "description", label: "Mô tả", type: "textarea" },
      { name: "isAdmin", label: "Toàn quyền admin", type: "checkbox" },
      { name: "isActive", label: "Đang hoạt động", type: "checkbox" },
    ],
  };

  const userConfig: ResourceConfig<User> = {
    key: "users",
    title: "Người dùng web",
    description: "Quản lý tài khoản đăng nhập, khóa/mở khóa và gán phòng ban.",
    endpoint: "/api/admin/users",
    searchPlaceholder: "Tìm username, tên hiển thị, email",
    defaultItem: {
      username: "",
      displayName: "",
      email: "",
      departmentId: "",
      password: "",
      status: "active",
      isAdmin: false,
    },
    columns: [
      { key: "username", label: "Username" },
      { key: "displayName", label: "Tên hiển thị" },
      { key: "email", label: "Email" },
      { key: "departmentName", label: "Phòng ban" },
      { key: "status", label: "Trạng thái", render: (row) => badge(row.status) },
      { key: "isAdmin", label: "Admin", render: (row) => badge(row.isAdmin ? "admin" : "user") },
    ],
    fields: [
      { name: "username", label: "Username", required: true },
      { name: "displayName", label: "Tên hiển thị", required: true },
      { name: "email", label: "Email" },
      { name: "departmentId", label: "Phòng ban", type: "select", options: departmentOptions },
      { name: "password", label: "Password / reset password", type: "password" },
      {
        name: "status",
        label: "Trạng thái",
        type: "select",
        options: [
          { value: "active", label: "Đang hoạt động" },
          { value: "inactive", label: "Tạm dừng" },
          { value: "locked", label: "Đã khóa" },
        ],
      },
      { name: "isAdmin", label: "Toàn quyền admin", type: "checkbox" },
    ],
    beforeSubmit: (values) => {
      if (!values.password) {
        const rest = { ...values };
        delete rest.password;
        return rest;
      }
      return values;
    },
  };

  return (
    <AdminShell title="Auth" description="Quản lý phòng ban, user và quyền truy cập module.">
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Tabs
          active={active}
          tabs={[
            { key: "departments", label: "Phòng ban" },
            { key: "users", label: "Người dùng" },
          ]}
          onChange={setActive}
        />
        <div className="min-w-0">
          {active === "departments" ? <ResourceTable config={departmentConfig} /> : <ResourceTable config={userConfig} />}
        </div>
      </div>
    </AdminShell>
  );
}
