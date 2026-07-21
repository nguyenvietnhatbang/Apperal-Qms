"use client";

import { useEffect, useState } from "react";
import type { PersonalOverview, PersonalUser } from "@/features/personal/types";
import PersonalAttendance from "./personal-attendance";
import PersonalDashboard from "./personal-dashboard";
import PersonalSalaryHistory from "./personal-salary-history";
import PersonalShell from "./personal-shell";

type PersonalView = "overview" | "attendance" | "salary";

export default function PersonalWorkspace({ user, overview, initialMonth, initialView }: { user: PersonalUser; overview: PersonalOverview; initialMonth: string; initialView: PersonalView }) {
  const [activeView, setActiveView] = useState<PersonalView>(initialView);

  useEffect(() => {
    const handlePopState = () => setActiveView(getViewFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const changeView = (view: PersonalView) => {
    if (view === activeView) return;
    setActiveView(view);
    const path = view === "attendance" ? "/personal/attendance" : view === "salary" ? "/personal/salary-history" : "/personal";
    window.history.pushState(null, "", path);
  };

  return <PersonalShell user={user} activeView={activeView} onViewChange={changeView}>
    <div className={activeView === "overview" ? "contents" : "hidden"} aria-hidden={activeView !== "overview"}>
      <PersonalDashboard user={user} initialOverview={overview} embedded />
    </div>
    <div className={activeView === "attendance" ? "contents" : "hidden"} aria-hidden={activeView !== "attendance"}>
      <PersonalAttendance user={user} initialMonth={initialMonth} initialRecords={overview.attendance} initialLeaveSummary={overview.leaveSummary} embedded />
    </div>
    <div className={activeView === "salary" ? "contents" : "hidden"} aria-hidden={activeView !== "salary"}>
      <PersonalSalaryHistory overview={overview} />
    </div>
  </PersonalShell>;
}

function getViewFromPath(pathname: string): PersonalView {
  if (pathname.endsWith("/attendance")) return "attendance";
  if (pathname.endsWith("/salary-history")) return "salary";
  return "overview";
}
