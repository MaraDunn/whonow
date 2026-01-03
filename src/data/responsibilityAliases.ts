/**
 * Responsibility Alias Mapping (Many → One)
 * Maps normalized phrases to canonical responsibility IDs
 */

export const RESPONSIBILITY_ALIASES: Record<string, string> = {
  // HR Employee Relations
  "internal dispute": "RESP_HR_EMPLOYEE_RELATIONS",
  "workplace conflict": "RESP_HR_EMPLOYEE_RELATIONS",
  "employee grievance": "RESP_HR_EMPLOYEE_RELATIONS",
  "employee relations": "RESP_HR_EMPLOYEE_RELATIONS",
  "workplace issues": "RESP_HR_EMPLOYEE_RELATIONS",
  "conflict resolution": "RESP_HR_EMPLOYEE_RELATIONS",
  "internal conflicts": "RESP_HR_EMPLOYEE_RELATIONS",
  "workplace disputes": "RESP_HR_EMPLOYEE_RELATIONS",
  
  // IT Security
  "it security": "RESP_IT_SECURITY",
  "security incident": "RESP_IT_SECURITY",
  "cybersecurity": "RESP_IT_SECURITY",
  "security issues": "RESP_IT_SECURITY",
  "security breach": "RESP_IT_SECURITY",
  "data security": "RESP_IT_SECURITY",
  
  // IT Support
  "it support": "RESP_IT_SUPPORT",
  "technical support": "RESP_IT_SUPPORT",
  "help desk": "RESP_IT_SUPPORT",
  "tech issues": "RESP_IT_SUPPORT",
  "computer problems": "RESP_IT_SUPPORT",
  "it help": "RESP_IT_SUPPORT",
  
  // Finance Billing
  "billing": "RESP_FINANCE_BILLING",
  "invoicing": "RESP_FINANCE_BILLING",
  "payments": "RESP_FINANCE_BILLING",
  "accounts payable": "RESP_FINANCE_BILLING",
  "billing questions": "RESP_FINANCE_BILLING",
  "invoice issues": "RESP_FINANCE_BILLING",
  
  // Sales Leads
  "sales leads": "RESP_SALES_LEADS",
  "leads": "RESP_SALES_LEADS",
  "prospects": "RESP_SALES_LEADS",
  "new business": "RESP_SALES_LEADS",
  "sales opportunities": "RESP_SALES_LEADS",
  
  // Marketing Events
  "marketing events": "RESP_MARKETING_EVENTS",
  "events": "RESP_MARKETING_EVENTS",
  "conferences": "RESP_MARKETING_EVENTS",
  "event planning": "RESP_MARKETING_EVENTS",
  "trade shows": "RESP_MARKETING_EVENTS",
  
  // Legal Contracts
  "contracts": "RESP_LEGAL_CONTRACTS",
  "legal contracts": "RESP_LEGAL_CONTRACTS",
  "contract review": "RESP_LEGAL_CONTRACTS",
  "agreements": "RESP_LEGAL_CONTRACTS",
  "legal agreements": "RESP_LEGAL_CONTRACTS",
  
  // HR Recruiting
  "recruiting": "RESP_HR_RECRUITING",
  "hiring": "RESP_HR_RECRUITING",
  "talent acquisition": "RESP_HR_RECRUITING",
  "job openings": "RESP_HR_RECRUITING",
  "recruitment": "RESP_HR_RECRUITING",
};

