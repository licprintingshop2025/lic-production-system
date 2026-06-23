export const workers = [
  { name: "Francis", position: "Liaison" },
  { name: "Steve", position: "Prod. Head" },
  { name: "Manuel", position: "Skilled Worker" },
  { name: "Pau", position: "Skilled Worker" },
  { name: "Rafael", position: "Skilled Worker" },
  { name: "Nilo", position: "Skilled Worker" },
  { name: "Onyx", position: "Skilled Worker" },
  { name: "Gary", position: "Skilled Worker" },
  { name: "Atoy", position: "QA" },
  { name: "OJT", position: "OJT" },
];

export const primaryAssignments: Record<string, string> = {
  "Station 1 & 2 (Layouting & Encoding)": "Steve",
  "Admin Head - (For Approval to Printing)": "Steve",
  "Quality Checking": "Atoy",
  "Receiving & Pre-Print Formatting": "Manuel",
  Running: "Rafael",
  Numbering: "Rafael",
  Collating: "Onyx",
  "Stapling/Padding": "Atoy",
  "Cutting & Trimming": "Pau",
  Browning: "Gary",
  Stamping: "Francis",
  "Packaging & Labelling": "Gary",
  "Finish Receipt": "Steve",
};

export const workerSkills: Record<string, string[]> = {
  Francis: ["Stamping"],
  Steve: [
    "Station 1 & 2 (Layouting & Encoding)",
    "Admin Head - (For Approval to Printing)",
    "Finish Receipt",
    "Collating",
    "Packaging & Labelling",
  ],
  Manuel: [
    "Receiving & Pre-Print Formatting",
    "Running",
    "Numbering",
    "Collating",
    "Cutting & Trimming",
  ],
  Pau: ["Cutting & Trimming", "Stapling/Padding"],
  Rafael: ["Running", "Numbering"],
  Nilo: [
    "Running",
    "Collating",
    "Stapling/Padding",
    "Cutting & Trimming",
    "Browning",
  ],
  Onyx: ["Collating", "Stapling/Padding", "Packaging & Labelling"],
  Gary: ["Browning", "Packaging & Labelling", "Collating"],
  Atoy: ["Quality Checking", "Stapling/Padding", "Cutting & Trimming"],
  OJT: ["Collating", "Packaging & Labelling"],
};

export const productionStations = Object.keys(primaryAssignments);