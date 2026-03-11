/**
 * Canonical Responsibility Registry
 * Each responsibility has a stable ID, domain, priority, and structured filters
 */

export interface Responsibility {
  id: string;
  domain: string;
  priority: number;
  filters: {
    departments?: string[];
    roles?: string[];
    tags?: string[];
    owner?: string; // Explicit owner ID if defined
  };
}

export const RESPONSIBILITIES: Record<string, Responsibility> = {
  RESP_DESIGN: {
    id: "RESP_DESIGN",
    domain: "design",
    priority: 85,
    filters: {
      departments: ["design", "creative", "product design"],
      roles: ["designer", "graphic designer", "visual designer", "brand designer", "ui designer", "ux designer", "product designer", "creative director"],
      tags: ["design", "branding", "logo", "visual", "graphics", "ui", "ux", "creative"],
    },
  },
  RESP_ENGINEERING: {
    id: "RESP_ENGINEERING",
    domain: "engineering",
    priority: 85,
    filters: {
      departments: ["engineering", "development", "tech"],
      roles: ["engineer", "developer", "software engineer", "frontend developer", "backend developer", "fullstack developer"],
      tags: ["coding", "development", "software", "programming", "tech"],
    },
  },
  RESP_MARKETING: {
    id: "RESP_MARKETING",
    domain: "marketing",
    priority: 80,
    filters: {
      departments: ["marketing", "growth"],
      roles: ["marketing manager", "growth marketer", "marketing specialist"],
      tags: ["marketing", "campaigns", "advertising", "growth"],
    },
  },
  RESP_SALES: {
    id: "RESP_SALES",
    domain: "sales",
    priority: 80,
    filters: {
      departments: ["sales", "business development"],
      roles: ["sales", "account executive", "business development"],
      tags: ["sales", "revenue", "deals", "clients"],
    },
  },
  RESP_FINANCE: {
    id: "RESP_FINANCE",
    domain: "finance",
    priority: 80,
    filters: {
      departments: ["finance", "accounting"],
      roles: ["accountant", "financial analyst", "controller", "cfo"],
      tags: ["finance", "accounting", "budget", "financial"],
    },
  },
  RESP_CONTENT: {
    id: "RESP_CONTENT",
    domain: "content",
    priority: 75,
    filters: {
      departments: ["content", "marketing"],
      roles: ["content writer", "copywriter", "editor", "content strategist"],
      tags: ["writing", "content", "copywriting", "editorial"],
    },
  },
  RESP_SOCIAL_MEDIA: {
    id: "RESP_SOCIAL_MEDIA",
    domain: "marketing",
    priority: 75,
    filters: {
      departments: ["marketing", "social media"],
      roles: ["social media manager", "community manager"],
      tags: ["social media", "community", "engagement"],
    },
  },
  RESP_OPERATIONS: {
    id: "RESP_OPERATIONS",
    domain: "operations",
    priority: 75,
    filters: {
      departments: ["operations", "ops"],
      roles: ["operations manager", "ops", "project manager"],
      tags: ["operations", "logistics", "process"],
    },
  },
  RESP_LEGAL: {
    id: "RESP_LEGAL",
    domain: "legal",
    priority: 80,
    filters: {
      departments: ["legal"],
      roles: ["lawyer", "attorney", "legal counsel", "general counsel"],
      tags: ["legal", "compliance", "contracts", "law"],
    },
  },
  RESP_HR_EMPLOYEE_RELATIONS: {
    id: "RESP_HR_EMPLOYEE_RELATIONS",
    domain: "hr",
    priority: 80,
    filters: {
      departments: ["hr", "people ops"],
      roles: ["hr manager", "people partner", "hr business partner"],
      tags: ["employee relations", "conflict resolution", "workplace issues"],
    },
  },
  RESP_IT_SECURITY: {
    id: "RESP_IT_SECURITY",
    domain: "it",
    priority: 75,
    filters: {
      departments: ["it", "security"],
      roles: ["security engineer", "it administrator", "security analyst"],
      tags: ["security", "cybersecurity", "incident response"],
    },
  },
  RESP_IT_SUPPORT: {
    id: "RESP_IT_SUPPORT",
    domain: "it",
    priority: 70,
    filters: {
      departments: ["it", "tech support"],
      roles: ["it support", "help desk", "technical support"],
      tags: ["it support", "technical issues", "help desk"],
    },
  },
  RESP_FINANCE_BILLING: {
    id: "RESP_FINANCE_BILLING",
    domain: "finance",
    priority: 75,
    filters: {
      departments: ["finance", "accounting"],
      roles: ["accountant", "billing specialist", "accounts payable"],
      tags: ["billing", "invoicing", "payments"],
    },
  },
  RESP_SALES_LEADS: {
    id: "RESP_SALES_LEADS",
    domain: "sales",
    priority: 80,
    filters: {
      departments: ["sales"],
      roles: ["sales manager", "account executive", "business development"],
      tags: ["leads", "prospects", "sales"],
    },
  },
  RESP_MARKETING_EVENTS: {
    id: "RESP_MARKETING_EVENTS",
    domain: "marketing",
    priority: 75,
    filters: {
      departments: ["marketing"],
      roles: ["event manager", "marketing coordinator", "event coordinator"],
      tags: ["events", "conferences", "marketing events"],
    },
  },
  RESP_LEGAL_CONTRACTS: {
    id: "RESP_LEGAL_CONTRACTS",
    domain: "legal",
    priority: 85,
    filters: {
      departments: ["legal"],
      roles: ["legal counsel", "contracts manager", "paralegal", "lawyer", "attorney", "general counsel"],
      tags: ["contracts", "legal", "agreements"],
    },
  },
  RESP_HR_RECRUITING: {
    id: "RESP_HR_RECRUITING",
    domain: "hr",
    priority: 75,
    filters: {
      departments: ["hr", "recruiting"],
      roles: ["recruiter", "talent acquisition", "hr recruiter"],
      tags: ["recruiting", "hiring", "talent"],
    },
  },
};

