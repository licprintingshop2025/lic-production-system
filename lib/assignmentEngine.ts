export type AttendanceStatus =
  "Present" | "Half-day AM" | "Half-day PM" | "Absent" | "None";

export type Employee = {
  employeeId: string;
  name: string;
  position: string;
  skills: string[];
  status: string;
  maxStations: number;
  shift: string;
  employmentType?: string;
};

export type StationLoad = {
  name: string;
  jobs: number;
  rushJobs?: number;
};

export type Assignment = {
  station: string;
  jobs: number;
  primary: string;
  support: string;
  status: string;
  notes: string;
};

const ADMIN_ONLY_STATIONS = [
  "Station 1 & 2 (Layouting & Encoding)",
  "Admin Head - (For Approval to Printing)",
];

const RELEASE_STATIONS = ["Ready for Release"];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isAdminOnlyStation(stationName: string) {
  const stationKey = normalize(stationName);

  return ADMIN_ONLY_STATIONS.some(
    (station) => normalize(station) === stationKey,
  );
}

function isReleaseStation(stationName: string) {
  const stationKey = normalize(stationName);

  return RELEASE_STATIONS.some((station) => normalize(station) === stationKey);
}

function isAvailable(status?: AttendanceStatus) {
  return (
    status === "Present" || status === "Half-day AM" || status === "Half-day PM"
  );
}

function isActive(employee: Employee) {
  return employee.status?.toLowerCase().trim() === "active";
}

function employmentPriority(type?: string) {
  const value = type?.toLowerCase().trim();

  if (value === "full-time") return 1;
  if (value === "part-time") return 2;
  if (value === "contractual") return 3;
  if (value === "ojt") return 4;

  return 5;
}

function employeeCanWork(employee: Employee, station: string) {
  const stationKey = normalize(station);

  return (employee.skills || []).some((skill) => {
    const skillKey = normalize(skill);
    return skillKey.includes(stationKey) || stationKey.includes(skillKey);
  });
}

export function generateSmartAssignments({
  employees,
  stations,
  attendance,
}: {
  employees: Employee[];
  stations: StationLoad[];
  attendance: Record<string, AttendanceStatus>;
}) {
  const workerLoad: Record<string, number> = {};
  const activeEmployees = employees.filter(isActive);

  const assignments: Assignment[] = stations.map((station) => {
    if (isAdminOnlyStation(station.name)) {
      return {
        station: station.name,
        jobs: station.jobs,
        primary: "—",
        support: "—",
        status: "Admin Only",
        notes:
          "This station is monitored only and does not require worker assignment.",
      };
    }

    if (isReleaseStation(station.name)) {
      return {
        station: station.name,
        jobs: station.jobs,
        primary: "—",
        support: "—",
        status: "Release Stage",
        notes:
          "Orders in this stage are ready for release and do not require production assignment.",
      };
    }

    if (station.jobs === 0) {
      return {
        station: station.name,
        jobs: station.jobs,
        primary: "—",
        support: "—",
        status: "No Active Job",
        notes: "No active job in this station today.",
      };
    }

    const qualifiedWorkers = activeEmployees.filter((employee) =>
      employeeCanWork(employee, station.name),
    );

    const availableWorkers = qualifiedWorkers
      .filter((employee) => {
        const load = workerLoad[employee.name] || 0;

        return (
          isAvailable(attendance[employee.name]) &&
          load < Number(employee.maxStations || 1)
        );
      })
      .sort((a, b) => {
        const aLoad = workerLoad[a.name] || 0;
        const bLoad = workerLoad[b.name] || 0;

        if (aLoad !== bLoad) return aLoad - bLoad;

        const aAttendance = attendance[a.name];
        const bAttendance = attendance[b.name];

        if (aAttendance === "Present" && bAttendance !== "Present") return -1;
        if (bAttendance === "Present" && aAttendance !== "Present") return 1;

        const aPriority = employmentPriority(a.employmentType);
        const bPriority = employmentPriority(b.employmentType);

        if (aPriority !== bPriority) return aPriority - bPriority;

        return Number(b.maxStations || 1) - Number(a.maxStations || 1);
      });

    const primaryWorker = availableWorkers[0];
    const supportWorker = availableWorkers[1];

    if (primaryWorker) {
      workerLoad[primaryWorker.name] =
        (workerLoad[primaryWorker.name] || 0) + 1;
    }

    if (supportWorker && station.jobs >= 6) {
      workerLoad[supportWorker.name] =
        (workerLoad[supportWorker.name] || 0) + 1;
    }

    if (primaryWorker && supportWorker && station.jobs >= 6) {
      return {
        station: station.name,
        jobs: station.jobs,
        primary: primaryWorker.name,
        support: supportWorker.name,
        status: "Covered",
        notes:
          "Primary and support workers assigned based on workload, skills, attendance, and capacity.",
      };
    }

    if (primaryWorker) {
      return {
        station: station.name,
        jobs: station.jobs,
        primary: primaryWorker.name,
        support: "—",
        status: station.jobs >= 6 ? "Needs Support" : "Covered",
        notes:
          station.jobs >= 6
            ? "Qualified primary worker assigned, but this station may need support due to workload."
            : "Qualified worker assigned based on skills, attendance, and workload.",
      };
    }

    if (qualifiedWorkers.length > 0) {
      return {
        station: station.name,
        jobs: station.jobs,
        primary: "—",
        support: "—",
        status: "Unavailable",
        notes:
          "Qualified workers exist but are absent, unavailable, or already at max station capacity.",
      };
    }

    return {
      station: station.name,
      jobs: station.jobs,
      primary: "—",
      support: "—",
      status: "No Skill Match",
      notes: "No active employee has this station listed in skills.",
    };
  });

  return {
    assignments,
    workerLoad,
  };
}
