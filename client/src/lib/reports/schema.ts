import type { Report } from "./types";
import { f3ChecklistTemplate, F3_RESULT_OPTS } from "./f3-logic";
import { f6Template } from "./f6-logic";
import { f7CharRows } from "./f7-logic";

const RESULT_OPTS = ["Accepted", "Passed", "Pass", "Fail", "NA", ""];

const idRow = (n: number) => ({ sl: String(n) });

export const COMPANY = {
  name: "HI-Q ELECTRONICS PVT LTD",
  tagline: "PRINTED CIRCUIT BOARD MANUFACTURING EST: 1983",
  address: "No: 9, Industrial Estate, Hosur - 635109, Tamilnadu, India.",
  website: "www.hiqelectronics.com",
  ncage: "3566Y",
  ulFile: "E156972",
};

const equipmentSection = (key: string) => ({
  kind: "table" as const,
  title: "Equipment Used",
  key,
  addLabel: "Add equipment",
  columns: [
    { key: "sl", label: "Sl. No.", width: 0.5 },
    { key: "name", label: "Equipment Name", width: 2.2 },
    { key: "serial", label: "Serial No", width: 1.2 },
    { key: "range", label: "Range", width: 1.2 },
    { key: "cal", label: "Cal. Due Date", type: "date" as const, width: 1.1 },
  ],
  rows: [idRow(1), idRow(2)],
});

const testedBy = (title = "Sign-off", nameLabel = "Tested by"): any => ({
  kind: "signoff",
  title,
  fields: [
    { key: "testedBy", label: nameLabel },
    { key: "testedDate", label: "Date", type: "date" },
  ],
});

const commonHeader = (extra: any[] = []): any => ({
  kind: "fields",
  title: "Report Identification",
  fields: [
    { key: "cocNumber", label: "COC Number", shared: "cocNumber" },
    { key: "customer", label: "Customer", shared: "customer" },
    { key: "partNumber", label: "Part Number in PCB", shared: "partNumber" },
    { key: "poNumber", label: "P.O. Number", shared: "poNumber" },
    { key: "partRevPcb", label: "Rev No" },
    { key: "partNumberPo", label: "Part Number in PO" },
    { key: "partRevPo", label: "Rev No" },
    { key: "regulatoryRequirement", label: "Regulatory Requirement", type: "select", options: ["IPC-6012", "IPC-6013", "IPC-6018"], shared: "regulatoryRequirement" },
    { key: "standard", label: "Applicable Standard", default: "IPC-6012F", shared: "standard" },
    { key: "ipcClass", label: "IPC Class", default: "Class 3", shared: "ipcClass" },
    { key: "layerCount", label: "Layer Count", shared: "layers" },
    ...extra,
    { key: "lotPanels", label: "No. of Panels in Lot" },
    { key: "testedPanels", label: "No. of Panels Tested" },
    { key: "weekCode", label: "Week Code", shared: "weekCode" },
  ],
});

/* ------------------------------------------------------------------ F1 */
const f1: Report = {
  id: "f1",
  code: "HIQ-QAD-P06-F1",
  title: "Certificate of Conformance",
  rev: "Rev 2.07 · Eff. 05 Sep 2025",
  group: "Certificate",
  sections: [
    {
      kind: "fields",
      title: "Order Lookup",
      fields: [
        { key: "productionOrder", label: "Production Order Number", span: 2 },
        { key: "cocNumber", label: "COC Number", shared: "cocNumber" },
        { key: "date", label: "Date", type: "date", shared: "cocDate" },
      ],
    },
    {
      kind: "fields",
      title: "Customer and product details",
      fields: [
        { key: "customer", label: "Customer", shared: "customer", span: 2 },
        { key: "address", label: "Customer Address", type: "textarea", shared: "customerAddress", span: 2 },
        { key: "partName", label: "2. Part Name", shared: "partName" },
        { key: "partRevPcb", label: "Rev No", shared: "partRev" },
        { key: "partNumberPo", label: "Part Number in PO", shared: "partNumber" },
        { key: "partRevPo", label: "Rev No" },
        { key: "description", label: "Part Description", shared: "partName", span: 2 },
        { key: "prevCoc", label: "Previous COC Reference" },
        { key: "prevCocDate", label: "Previous COC Date", type: "date" },
        { key: "poNumber", label: "P.O. Number", shared: "poNumber", span: 2 },
        { key: "specification", label: "Specification", shared: "specification", span: 2 },
        {
  key: "regulatoryRequirement",
  label: "IS Specification",
  type: "select",
  options: [
    "76-001-001(Class-2)",
    "CES14429 (Class-2)",
    "CES14429 (Class-3)",
    "IPC-6012 Class-2",
    "IPC-6012 Class-3",
    "IPC-6012 Class-3A",
    "IPC-6012 Class-3DA",
    "IPC6012ES",
    "IPC-6013 Class-2",
    "IPC-6013 Class-3",
    "IPC-6013 Class-3A",
    "IPC-6018 Class-2",
    "IPC-6018 Class-3",
    "IPC-A-600J CLASS-3A",
    "IPC-CLASS-2",
    "IPC-CLASS-3",
    "ISRO-PAX-304 ISSUE 2 GND",
    "ISRO-PAX-304 ISSUE 2 SPA",
    "JSS 52302",
    "MIL-PRF-31032/1 -Class-3",
    "MIL-PRF-31032/2 -Class-3",
    "MIL-PRF-31032/3 -Class-3",
    "MIL-PRF-31032/4 -Class-3",
    "MIL-PRF-31032/5 -Class-3",
    "MIL-PRF-31032/6 -Class-3",
    "NA",
  ],
  shared: "regulatoryRequirement",
  span: 2,
},
        { key: "weekCode", label: "Week Code", shared: "weekCode" },
        { key: "batchCode", label: "Batch Code", shared: "batchCode" },
        { key: "quantity", label: "Quantity", shared: "quantity" },
        { key: "rohs", label: "RoHS Compliance" },
        { key: "ulMark", label: "UL Mark", type: "select", options: ["Yes", "No"] },
      ],
    },
    {
      kind: "fields",
      title: "Construction",
      fields: [
        { key: "material", label: "Material", shared: "material" },
        { key: "layers", label: "No. of Layers", shared: "layers" },
        { key: "boardFinish", label: "Board Finish", shared: "boardFinish" },
        {
  key: "regulatoryRequirement",
  label: "Regulatory Requirement",
  type: "select",
  options: ["IPC-6012", "IPC-6013", "IPC-6018"],
  shared: "regulatoryRequirement",
},
        { key: "pcbType", label: "PCB Type", type: "select", placeholder: "Select based on regulatory requirement" },
      ],
    },
    {
      kind: "note",
      title: "Statement of Compliance",
      text: "This document certifies that all printed boards manufactured as items called for in the referenced purchase order comply in every aspect with said purchase order, procurement specification, part drawings, supplied original data, traceability requirements and/or referenced specifications including special purchase order conditions.\n\nTest and Inspection reports used to certify the printed boards are attached along with this document and are also available at Hi-Q Quality Control department for review at the request of the stated customer or governing regulatory bodies.\n\nThe signing of this form by a certified Hi-Q Q/A department confirms the completion of all required inspections and electrical tests as stated in this section.\n\nThe manufacturing country of origin is India.",
    },
    {
      kind: "signoff",
      title: "Approval",
      columns: [
        {
          title: "Inspected by",
          fields: [
            { key: "inspectedBy", label: "Name" },
            { key: "inspectedDesig", label: "Desig" },
            { key: "inspectedDate", label: "Date", type: "date" },
          ],
        },
        {
          title: "Verified by",
          fields: [
            { key: "verifiedBy", label: "Name" },
            { key: "verifiedDesig", label: "Desig" },
            { key: "verifiedDate", label: "Date", type: "date" },
          ],
        },
        {
          title: "Approved by",
          fields: [
            { key: "approvedBy", label: "Name" },
            { key: "designation", label: "Desig" },
            { key: "approvedDate", label: "Date", type: "date" },
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ F3 */
const f3: Report = {
  id: "f3",
  code: "HIQ-QAD-P06-F3",
  title: "Rigid Blank PCB Inspection Report",
  rev: "Rev 2.04 · Eff. 14 May 2025",
  group: "Inspection",
  sections: [
    {
      kind: "fields",
      title: "Report Identification",
      fields: [
        { key: "customer", label: "Customer", shared: "customer", span: 2 },
        { key: "reportNumber", label: "Report Number", default: "MI-", placeholder: "MI- plus F1 COC number" },
        { key: "poNumber", label: "P.O. Number", shared: "poNumber" },
        { key: "specification", label: "Specification", shared: "specification" },
        { key: "partNumber", label: "Part Number", shared: "partNumber" },
        { key: "weekCode", label: "Week Code", shared: "weekCode" },
        { key: "batchCode", label: "Batch Code", shared: "batchCode" },
      ],
    },
    {
      kind: "table",
      title: "Inspection Checklist",
      subtitle: "Acceptance testing and frequency — IPC-6012F, table 4-3",
      key: "checklist",
      fixed: true,
      columns: [
        { key: "sl", label: "Sl. No.", width: 0.45, readonly: true },
        { key: "characteristic", label: "Characteristics", width: 2.2, readonly: true },
        { key: "req", label: "Requirement as per IPC-6012F", width: 1.1, readonly: true },
        { key: "specimen", label: "Sample", width: 1.1, readonly: true },
        { key: "method", label: "Inspection / Test Method", width: 1.7 },
        { key: "sample", label: "Sample Size", width: 0.9, readonly: true },
        { key: "qty", label: "Sample Qty", width: 0.8 },
        { key: "obs", label: "Observations", width: 1.2 },
        { key: "inspector", label: "Inspected by", width: 1 },
        { key: "result", label: "Result", type: "select", options: F3_RESULT_OPTS, width: 0.9 },
        { key: "remarks", label: "Remarks", width: 1.2 },
      ],
      rows: f3ChecklistTemplate(),
    },
    testedBy("Inspection Sign-off", "Inspected by"),
  ],
};

/* ------------------------------------------------------------------ F4 */
const f4: Report = {
  id: "f4",
  code: "HIQ-QAD-P06-F4",
  title: "Electrical Test Report",
  rev: "Rev 2.02 · Eff. 26 Apr 2024",
  group: "Testing",
  sections: [
    {
      kind: "fields",
      fields: [
        { key: "testLevel", label: "Test level", default: "IPC-9252B LEVEL-C" },
        { key: "standard", label: "Applicable standard", default: "IPC-9252B" },
        {
          key: "testMethod",
          label: "Test method",
          type: "select",
          options: ["Resistive", "Indirect"],
          placeholder: "Select",
        },
        { key: "sourceData", label: "Source data used", placeholder: "—" },
        { key: "qtyPassed", label: "Quantity passed", placeholder: "Enter quantity passed" },
        { key: "dataRetention", label: "Data retention", default: "Yes" },
        { key: "traceability", label: "Traceability by serial no.", default: "Yes" },
      ],
    },
    {
      kind: "table",
      title: "Resistive test parameters",
      key: "params",
      fixed: true,
      columns: [
        { key: "sl", label: "Sl. No.", width: 0.5 },
        { key: "test", label: "Parameter", width: 2.2 },
        { key: "value", label: "Requirement", width: 1.6 },
        { key: "result", label: "Result", type: "select", options: ["Pass", "Fail"], width: 1 },
      ],
      rows: [
        { sl: "1", test: "Continuity(Opens)", value: "< 8 Ω", result: "" },
        { sl: "2", test: "Isolation(Shorts)", value: "≥12.7MΩ", result: "" },
        { sl: "3", test: "Test Voltage", value: "250 V", result: "" },
        { sl: "4", test: "Adjacency Test method Used?", value: "Yes", result: "" },
        { sl: "5", test: "Horizontal Distance", value: "< 1.27mm", result: "" },
        { sl: "6", test: "Vertical Distance", value: "None", result: "" },
      ],
    },
    testedBy(),
  ],
};

/* ------------------------------------------------------------------ F2 */
const serialRows = Array.from({ length: 4 }, (_, i) => ({ sl: String(i + 1), serial: "", reason: "" }));
const f2: Report = {
  id: "f2",
  code: "HIQ-QAD-P06-F2",
  title: "PCB Serial Number Report",
  rev: "Rev 2.01 · Eff. 05 Mar 2020",
  group: "Traceability",
  sections: [
    {
      kind: "fields",
      title: "Report Identification",
      fields: [
        { key: "customer", label: "Customer", shared: "customer" },
        { key: "reportNumber", label: "Report Number", default: "SN-", placeholder: "SN- plus F1 COC number" },
        { key: "partNumber", label: "Part Number", shared: "partNumber" },
        { key: "poNumber", label: "P.O. Number", shared: "poNumber" },
        { key: "layers", label: "No. of Layers", shared: "layers" },
        { key: "supplyForm", label: "Supply Form", shared: "supplyForm" },
        { key: "weekCode", label: "Week Code", shared: "weekCode" },
      ],
    },
    {
      kind: "fields",
      title: "Serial Numbers",
      fields: [
        { key: "suppliedSerials", label: "Serial Numbers Supplied", type: "textarea", span: 3 },
        { key: "stockSerials", label: "Stock Board Serial Numbers", type: "textarea", span: 3 },
      ],
    },
    {
      kind: "table",
      title: "Supplied X-Out Details",
      key: "suppliedXout",
      addLabel: "Add X-out",
      columns: [
        { key: "sl", label: "Sl. No", width: 0.5 },
        { key: "serial", label: "PCB Serial Number", width: 2 },
        { key: "reason", label: "Rejection Reason", width: 3 },
      ],
      rows: serialRows,
    },
    {
      kind: "table",
      title: "Stock Board X-Out Details",
      key: "stockXout",
      addLabel: "Add X-out",
      columns: [
        { key: "sl", label: "Sl. No", width: 0.5 },
        { key: "serial", label: "PCB Serial Number", width: 2 },
        { key: "reason", label: "Rejection Reason", width: 3 },
      ],
      rows: serialRows,
    },
    testedBy("Inspection Sign-off", "Inspected by"),
  ],
};

/* ------------------------------------------------------------------ F5 */
const f5: Report = {
  id: "f5",
  code: "HIQ-QAD-P06-F5",
  title: "Mechanical Measurement Report",
  rev: "Rev 2.01 · Eff. 05 Mar 2020",
  group: "Testing",
  sections: [
    {
      kind: "fields",
      fields: [
        { key: "lotSize", label: "Total production qty" },
        { key: "aql", label: "Sample size", default: "AQL 4.0" },
        { key: "sampleSize", label: "Sample qty" },
        { key: "drawingNo", label: "Drawing No" },
        { key: "sampledSerials", label: "Sampled board serial numbers", span: 2 },
      ],
    },
    {
      kind: "table",
      title: "Mechanical Drill Information",
      key: "drill",
      columns: [
        { key: "sl", label: "Sl No.", width: 0.5 },
        { key: "type", label: "Characteristics", width: 1 },
        { key: "mode", label: "Dim.", width: 0.8 },
        { key: "dim", label: "Requirement", width: 1 },
        { key: "holes", label: "No. of Holes/Slots", width: 0.8 },
        { key: "tolPlus", label: "Tolerance+", width: 0.7 },
        { key: "tolMinus", label: "Tolerance-", width: 0.7 },
        { key: "uom", label: "UoM", width: 0.6 },
        { key: "remarks", label: "Remarks", width: 1.2 },
      ],
      rows: [{ sl: "1", type: "PTH", mode: "Single", uom: "mm" }],
    },
    {
      kind: "table",
      title: "Counter Sink, Cutout, Slot measurements",
      key: "countersink",
      columns: [
        { key: "sl", label: "Sl No.", width: 0.5 },
        { key: "type", label: "Characteristics", width: 1 },
        { key: "mode", label: "Dim.", width: 0.8 },
        { key: "feature", label: "Feature", width: 1.2 },
        { key: "dim", label: "Requirement", width: 1 },
        { key: "holes", label: "No. of Holes/Slots", width: 0.8 },
        { key: "tolPlus", label: "Tolerance+", width: 0.7 },
        { key: "tolMinus", label: "Tolerance-", width: 0.7 },
        { key: "uom", label: "UoM", width: 0.6 },
        { key: "remarks", label: "Remarks", width: 1.2 },
      ],
      rows: [{ sl: "1", type: "PTH", mode: "Single", feature: "Counter Sink", uom: "mm" }],
    },
    {
      kind: "table",
      title: "Dimple & Bump Measurements",
      key: "laser",
      columns: [
        { key: "sl", label: "Sl No.", width: 0.5 },
        { key: "characteristic", label: "Characteristics", width: 1 },
        { key: "size", label: "Drill Size", width: 0.8 },
        { key: "holes", label: "No. of Holes/Slots", width: 0.8 },
        { key: "remarks", label: "Remarks", width: 1.2 },
      ],
      rows: [{ sl: "1", characteristic: "Dimple" }],
      rows: [{ sl: "1", feature: "Via Hole", characteristic: "Dimple" }],
    },
    {
      kind: "table",
      title: "Board Dimensional",
      key: "board",
      columns: [
        { key: "sl", label: "Sl No.", width: 0.5 },
        { key: "characteristic", label: "Characteristic", width: 1.4 },
        { key: "dim", label: "Requirement", width: 1 },
        { key: "tolPlus", label: "Tolerance+", width: 0.7 },
        { key: "tolMinus", label: "Tolerance-", width: 0.7 },
        { key: "uom", label: "UoM", width: 0.6 },
        { key: "remarks", label: "Remarks", width: 1.2 },
      ],
      rows: [{ sl: "1", characteristic: "Board thickness", bowMode: "Custom", uom: "mm" }],
    },
    testedBy("Inspection Sign-off", "Inspected by"),
  ],
};

/* ------------------------------------------------------------------ AS-F1 */
const asF1: Report = {
  id: "as-f1",
  code: "HIQ-QAD-P05-F1",
  title: "AS 9102 Form 1 — Part Number Accountability",
  rev: "Rev 1.02 · Eff. 11 Dec 2023",
  group: "AS9102",
  sections: [
    {
      kind: "fields",
      title: "FAIR identification",
      fields: [
        { key: "partNumber", label: "1. Part Number", shared: "partNumber" },
        { key: "partName", label: "2. Part Name" },
        { key: "serialNumber", label: "3. Serial Number" },
        { key: "fairIdentifier", label: "4. FAIR Identifier" },
      ],
    },
    {
      kind: "fields",
      title: "Part, drawing and order",
      fields: [
        { key: "partRevision", label: "5. Part Revision Level", shared: "partRev" },
        { key: "drawingNumber", label: "6. Drawing Number" },
        { key: "drawingRevision", label: "7. Drawing Revision Level" },
        { key: "additionalChanges", label: "8. Additional Changes" },
        { key: "processReference", label: "9. Manufacturing Process Reference", shared: "productionOrder" },
        {
          key: "organizationName",
          label: "10. Organization Name",
          default: "HI-Q ELECTRONICS PVT LTD",
        },
        { key: "supplierCode", label: "11. Supplier Code" },
        { key: "purchaseOrderNumber", label: "12. Purchase Order Number", shared: "poNumber" },
      ],
    },
    {
      kind: "fields",
      title: "FAI type",
      fields: [
        {
          key: "faiType",
          label: "13. Detail FAI / Assembly FAI",
          type: "select",
          options: ["Detail FAI", "Assembly FAI"],
          default: "Detail FAI",
        },
        {
          key: "faiScope",
          label: "14. Full FAI / Partial FAI",
          type: "select",
          options: ["Full FAI", "Partial FAI"],
          default: "Full FAI",
        },
        {
          key: "baselinePartNumber",
          label: "Baseline Part Number (including revision level)",
          span: 2,
        },
        {
          key: "faiReason",
          label: "Reason for Full / Partial FAI",
          type: "textarea",
          span: 3,
        },
      ],
    },
    {
      kind: "note",
      title: "Instructions",
      text: `a) If the above part number is a detail part only, go to Field 19.

b) If the above part number is an assembly, go to the "INDEX" section below.`,
    },
    {
      kind: "table",
      title: "INDEX of part numbers or sub-assembly numbers required to make the assembly noted above",
      key: "index",
      addLabel: "Add part / sub-assembly",
      columns: [
        { key: "partNumber", label: "15. Part Number", width: 1.4 },
        { key: "partName", label: "16. Part Name", width: 1.4 },
      {
  key: "partType",
  label: "17. Part Type",
  width: 1.2,
},
        { key: "fairIdentifier", label: "18. FAIR Identifier", width: 1.5 },
      ],
      rows: [],
    },
    {
      kind: "fields",
      title: "Nonconformance",
      fields: [
        {
          key: "documentedNonconformance",
          label: "19. Does FAIR contain a documented nonconformance(s)?",
          type: "select",
          options: ["No", "Yes"],
          default: "No",
          span: 2,
        },
      ],
    },
    {
      kind: "signoff",
      title: "FAI verification",
      columns: [
        {
          title: "20. FAI Verified By",
          fields: [
            { key: "verifiedByName", label: "Name" },
            { key: "verifiedByDate", label: "21. Date", type: "date" },
          ],
        },
        {
          title: "22. FAI Reviewed/Approved By",
          fields: [
            { key: "reviewedByName", label: "Name" },
            { key: "reviewedByDate", label: "23. Date", type: "date" },
          ],
        },
        {
          title: "24. Customer Approval",
          fields: [
            { key: "customerApprovalName", label: "Name" },
            { key: "customerApprovalDate", label: "25. Date", type: "date" },
          ],
        },
      ],
    },
    {
      kind: "fields",
      title: "Comments",
      fields: [{ key: "comments", label: "Comments", type: "textarea", span: 3 }],
    },
  ],
};

/* ------------------------------------------------------------------ F15 */
const f15: Report = {
  id: "f15",
  code: "HIQ-QAD-P06-F15",
  title: "Solderability Test Report",
  rev: "Rev 1.01 · Eff. 26 Apr 2024",
  group: "Testing",
  sections: [
    {
      kind: "fields",
      fields: [
        { key: "standard", label: "Applicable Standard", default: "J-STD-003" },
        { key: "durability", label: "Coating Durability", default: "Coating Durability A", type: "select", options: ["Coating Durability A", "Coating Durability B", "Category 1", "Category 2", "Category 3"] },
        { key: "smtLand", label: "Solderable Surface mount land Present?", type: "select", options: ["Yes", "No"], default: "Yes" },
        { key: "pth", label: "Solderable PTH Present?", type: "select", options: ["Yes", "No"], default: "Yes" },
        { key: "solder", label: "Solder Used", default: "SAC 305" },
        { key: "lotPanels", label: "No. of Panels in Lot" },
        { key: "aql", label: "AQL", default: "AQL 2.5" },
        { key: "testedPanels", label: "No. of Panels Tested" },
      ],
    },
    {
      kind: "table",
      title: "Test Result",
      key: "results",
      fixed: true,
      columns: [
        { key: "category", label: "Category", width: 1.4 },
        { key: "specimen", label: "Test specimen", width: 1 },
        { key: "requirement", label: "Requirement", width: 2 },
        { key: "observation", label: "Observation", width: 2 },
        { key: "result", label: "Result", type: "select", options: ["—", "Pass", "Fail", "NA"], width: 0.8 },
      ],
      rows: [
        { category: "Plated Through Hole", specimen: 'Coupon "S"', requirement: "No evidence of dewetting & Non-wetting.", observation: "No evidence of dewetting & Non-wetting.", result: "Pass" },
        { category: "Surface Mount Land", specimen: 'Coupon "W"', requirement: "No evidence of dewetting & Non-wetting.", observation: "No evidence of dewetting & Non-wetting.", result: "Pass" },
      ],
    },
    testedBy(),
  ],
};

/* ------------------------------------------------------------------ F16 */
const f16: Report = {
  id: "f16",
  code: "HIQ-QAD-P06-F16",
  title: "Adhesion Test Report",
  rev: "Rev 1.00 · Eff. 05 Mar 2020",
  group: "Testing",
  sections: [
    {
      kind: "fields",
      fields: [
        { key: "lotPanels", label: "No. of Panels in Lot" },
        { key: "aql", label: "AQL", default: "AQL 4.0" },
        { key: "testedPanels", label: "No. of Panels Tested" },
      ],
    },
    {
      kind: "table",
      title: "Test Result",
      key: "results",
      fixed: true,
      columns: [
        { key: "type", label: "Adhesion type", width: 1.2 },
        { key: "method", label: "Test method", width: 1.4 },
        { key: "specimen", label: "Test specimen", width: 1.2 },
        { key: "requirement", label: "Requirement", width: 1.8 },
        { key: "observation", label: "Observation", width: 1.8 },
        { key: "result", label: "Result", type: "select", options: ["—", "Pass", "Fail", "NA"], width: 0.8 },
      ],
      rows: [
        { type: "Plating Adhesion", method: "IPC-TM-650, Method 2.4.1", specimen: 'Coupon "P" & "PCB"', requirement: "No evidence of material removal in tape and test area.", observation: "No material removal observed in tape test area", result: "" },
        { type: "Solder Mask Adhesion", method: "IPC-TM-650, Method 2.4.28.1", specimen: 'Coupon "G"', requirement: "No evidence of material removal in tape and test area.", observation: "No material removal observed in tape test area", result: "" },
        { type: "Legend Adhesion", method: "IPC-TM-650, Method 2.4.1.1", specimen: "Solvent Resistance coupon.", requirement: "No evidence of material removal in tape and test area.", observation: "No material removal observed in tape test area", result: "" },
      ],
    },
    testedBy(),
  ],
};

/* ------------------------------------------------------------------ F6 */
const f6: Report = {
  id: "f6",
  code: "HIQ-QAD-P06-F6",
  title: "Structural Integrity Test Report — Rigid PCB",
  rev: "Rev 2.04 · Eff. 26 Apr 2024",
  group: "Testing",
  sections: [
    {
      kind: "fields",
      title: "Report Identification",
      fields: [
        { key: "customer", label: "Customer", shared: "customer", span: 2 },
        { key: "poNumber", label: "P.O. Number", shared: "poNumber" },
        { key: "acceptedPanels", label: "Total Accepted Panels" },
        { key: "partNumber", label: "Part Number", shared: "partNumber" },
        { key: "weekCode", label: "Week Code", shared: "weekCode" },
      ],
    },
    {
      kind: "table",
      title: "Microsection Evaluation",
      key: "structural",
      fixed: true,
      columns: [
        { key: "sl", label: "Sl. No.", width: 0.5, readonly: true },
        { key: "inspection", label: "Inspection requirement", width: 2.4, readonly: true },
        { key: "req", label: "IPC-6012 ref.", width: 1.3, readonly: true },
        { key: "panel1", label: "Panel", type: "select", options: ["—", "Not Accepted", "Accepted", "NA", "None"], width: 1.1 },
        { key: "remarks", label: "Remarks", width: 1.6 },
      ],
      rows: f6Template(),
    },
    testedBy("Inspection Sign-off", "Inspected by"),
  ],
};

/* ------------------------------------------------------------------ F7 */
const f7: Report = {
  id: "f7",
  code: "HIQ-QAD-P06-F7",
  title: "Microsection Report",
  rev: "Rev 2.04 · Eff. 26 Apr 2024",
  group: "Microsection",
  sections: [
    {
      kind: "fields",
      title: "Report Identification",
      fields: [
        { key: "reportNumber", label: "Report Number", default: "CA-", placeholder: "CA- plus F1 COC number" },
        { key: "partNumber", label: "Part Number", shared: "partNumber" },
        { key: "date", label: "Date", type: "date" },
        { key: "weekCode", label: "Week Code", shared: "weekCode" },
        { key: "panelNumber", label: "Panel Number" },
      ],
    },
    {
      kind: "table",
      title: "Microsection Characteristics",
      subtitle: "Measurements in X-direction and Y-direction",
      key: "characteristics",
      fixed: true,
      columns: [
        { key: "characteristic", label: "Characteristic", width: 2 },
        { key: "stage", label: "Etch Stage", width: 1.2 },
        { key: "requirement", label: "Requirement", width: 1.8 },
        { key: "measuredX", label: "X-direction", width: 1.1 },
        { key: "measuredY", label: "Y-direction", width: 1.1 },
        { key: "result", label: "Result", type: "select", options: RESULT_OPTS, width: 0.8 },
        { key: "remarks", label: "Remarks", width: 1.3 },
      ],
      rows: f7CharRows(),
    },
    testedBy("Analysed by"),
  ],
};

/* ------------------------------------------------------------------ F12 */
const f12: Report = {
  id: "f12",
  code: "HIQ-QAD-P06-F12",
  title: "Dielectric Withstanding Voltage Test Report",
  rev: "Rev 1.00 · Eff. 20 Jun 2019",
  group: "Special Tests",
  sections: [
    commonHeader([
      { key: "procedure", label: "Test Procedure", default: "IPC-TM-650, Method 2.5.7" },
      { key: "specimen", label: "Test Specimen" },
    ]),
    {
      kind: "fields",
      title: "Test Conditions",
      fields: [
        { key: "voltage", label: "Voltage Applied" },
        { key: "rampTime", label: "Ramp Time" },
        { key: "testTime", label: "Test Time" },
      ],
    },
    {
      kind: "table",
      title: "Test Result",
      key: "results",
      addLabel: "Add panel",
      columns: [
        { key: "panel", label: "Panel No", width: 0.8 },
        { key: "requirement", label: "Requirement", width: 2 },
        { key: "leakageReq", label: "Leakage Current Req.", width: 1.2 },
        { key: "visual", label: "Visual Observation", width: 1.6 },
        { key: "leakage", label: "Leakage Current", width: 1.2 },
        { key: "result", label: "Result", type: "select", options: RESULT_OPTS, width: 0.8 },
      ],
      rows: [
        { panel: "1", requirement: "No evidence of flashover / sparkover / breakdown.", result: "Pass" },
      ],
    },
    equipmentSection("equipment"),
    testedBy(),
  ],
};

/* ------------------------------------------------------------------ F13 */
const f13: Report = {
  id: "f13",
  code: "HIQ-QAD-P06-F13",
  title: "Peel Strength Test Report",
  rev: "Rev 1.00 · Eff. 20 Jun 2019",
  group: "Special Tests",
  sections: [
    {
      kind: "fields",
      title: "Report Identification",
      fields: [
        { key: "cocNumber", label: "COC Number", shared: "cocNumber" },
        { key: "customer", label: "Customer", shared: "customer" },
        { key: "partNumber", label: "Part Number", shared: "partNumber" },
        { key: "poNumber", label: "P.O. Number", shared: "poNumber" },
        { key: "standard", label: "Applicable Standard", shared: "standard" },
        { key: "specSheet", label: "Base material spec sheet No", default: "IPC-4101/126" },
        { key: "procedure", label: "Test Procedure", default: "IPC-TM-650, Method 2.4.1" },
        { key: "specimen", label: "Test Specimen", default: "P Coupon" },
        { key: "lotPanels", label: "No. of Panels in Lot" },
        { key: "testedPanels", label: "No. of Panels Tested" },
        { key: "weekCode", label: "Week Code", shared: "weekCode" },
      ],
    },
    {
      kind: "table",
      title: "Test Result",
      key: "results",
      addLabel: "Add specimen",
      columns: [
        { key: "panel", label: "Panel No", width: 0.7 },
        { key: "side", label: "Side", width: 1 },
        { key: "visual", label: "Visual Observation", width: 1.8 },
        { key: "width", label: "Width of Specimen (cm)", width: 1.2 },
        { key: "load", label: "Minimum Load (N)", width: 1.2 },
        { key: "peel", label: "Peel Strength (N/cm)", width: 1.2 },
      ],
      rows: [
        { panel: "1", side: "Top Side", visual: "No defects observed" },
        { panel: "1", side: "Bottom Side", visual: "No defects observed" },
      ],
    },
    {
      kind: "fields",
      title: "Summary",
      fields: [
        { key: "avgPeel", label: "Average Peel Strength (N/cm)" },
        { key: "thickness", label: "Board Thickness (mm)" },
        { key: "requirement", label: "Peel Strength Requirement (N/cm)", default: ">0.70" },
        { key: "result", label: "Result", type: "select", options: ["Pass", "Fail"], default: "Pass" },
      ],
    },
    equipmentSection("equipment"),
    testedBy(),
  ],
};

/* ------------------------------------------------------------------ F14 */
const f14: Report = {
  id: "f14",
  code: "HIQ-QAD-P06-F14",
  title: "Rework Simulation Test Report",
  rev: "Rev 1.00 · Eff. 20 Jun 2019",
  group: "Special Tests",
  sections: [
    commonHeader([
      { key: "procedure", label: "Test Procedure", default: "IPC-TM-650, Method 2.4.36" },
      { key: "specimen", label: "Test Specimen", default: "A Coupon" },
    ]),
    {
      kind: "table",
      title: "Test Result",
      subtitle: "Microsection evaluation at 100X",
      key: "results",
      fixed: true,
      columns: [
        { key: "panel", label: "Panel No", width: 0.7 },
        { key: "check", label: "Check Point", width: 2.2 },
        { key: "requirement", label: "Requirement", width: 2 },
        { key: "observation", label: "Visual Observation", width: 1.6 },
        { key: "result", label: "Result", type: "select", options: RESULT_OPTS, width: 0.8 },
      ],
      rows: [
        { panel: "A", check: "Separation of plating layers.", requirement: "None allowed", observation: "None observed", result: "Pass" },
        { panel: "A", check: "Plating cracks.", requirement: "None allowed", observation: "None observed", result: "Pass" },
        { panel: "A", check: "Separation in internal interconnections.", requirement: "None allowed", observation: "None observed", result: "Pass" },
        { panel: "A", check: "Contamination between PTH wall and internal layers.", requirement: "None allowed", observation: "None observed", result: "Pass" },
        { panel: "A", check: "Blister, measling, delamination, discolouration.", requirement: "None allowed", observation: "None observed", result: "Pass" },
        { panel: "A", check: "Lifted land.", requirement: "Shall not be more than the copper thickness subject to no corner cracks.", observation: "None observed", result: "Pass" },
      ],
    },
    equipmentSection("equipment"),
    testedBy(),
  ],
};

/* ------------------------------------------------------------------ F17 */
const mirColumns = [
  { key: "panel", label: "Panel No", width: 0.8 },
  { key: "requirement", label: "Visual Requirement", width: 1.8 },
  { key: "resistanceReq", label: "Resistance Requirement", width: 1.4 },
  { key: "visual", label: "Visual Observation", width: 1.6 },
  { key: "resistance", label: "Resistance", width: 1.2 },
  { key: "result", label: "Result", type: "select" as const, options: RESULT_OPTS, width: 0.8 },
];
const f17: Report = {
  id: "f17",
  code: "HIQ-QAD-P06-F17",
  title: "Moisture and Insulation Resistance Test Report",
  rev: "Rev 1.00 · Eff. 20 Jun 2019",
  group: "Special Tests",
  sections: [
    commonHeader([
      { key: "procedure", label: "Test Procedure", default: "IPC-TM-650, Method 2.6.3" },
      { key: "specimen", label: "Test Specimen" },
    ]),
    {
      kind: "table",
      title: "Condition — As Received",
      key: "asReceived",
      addLabel: "Add panel",
      columns: mirColumns,
      rows: [{ panel: "1", result: "Pass" }],
    },
    {
      kind: "table",
      title: "Condition — After Exposure to Moisture",
      key: "afterMoisture",
      addLabel: "Add panel",
      columns: mirColumns,
      rows: [{ panel: "1", result: "Pass" }],
    },
    equipmentSection("equipment"),
    testedBy(),
  ],
};

export const REPORTS: Report[] = [f1, f2, f3, f4, f5, f6, f7, f15, f16, asF1,f12, f13, f14, f17];

export const REPORT_GROUPS = Array.from(new Set(REPORTS.map((r) => r.group)));
