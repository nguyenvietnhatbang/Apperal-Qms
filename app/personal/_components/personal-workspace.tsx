"use client";

import { useEffect, useState } from "react";
import type { PersonalOverview, PersonalUser } from "@/features/personal/types";
import PersonalAttendance from "./personal-attendance";
import PersonalDashboard from "./personal-dashboard";
import PersonalShell from "./personal-shell";

type PersonalView = "overview" | "attendance";

export default function PersonalWorkspace({ user, overview, initialMonth, initialView }: { user: PersonalUser; overview: PersonalOverview; initialMonth: string; initialView: PersonalView }) {
  const [activeView, setActiveView] = useState<PersonalView>(initialView);

  useEffect(() => {
    const handlePopState = () => setActiveView(window.location.pathname.endsWith("/attendance") ? "attendance" : "overview");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const changeView = (view: PersonalView) => {
    if (view === activeView) return;
    setActiveView(view);
    window.history.pushState(null, "", view === "attendance" ? "/personal/attendance" : "/personal");
  };

  return <PersonalShell user={user} activeView={activeView} onViewChange={changeView}>
    <div className={activeView === "overview" ? "contents" : "hidden"} aria-hidden={activeView !== "overview"}>
      <PersonalDashboard user={user} initialOverview={overview} embedded />
    </div>
    <div className={activeView === "attendance" ? "contents" : "hidden"} aria-hidden={activeView !== "attendance"}>
      <PersonalAttendance user={user} initialMonth={initialMonth} initialRecords={overview.attendance} embedded />
    </div>
  </PersonalShell>;
}
