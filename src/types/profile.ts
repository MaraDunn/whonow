export interface Profile {
  id: string;
  companyId?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  avatarUrl?: string;
  description?: string;
  isVisibleInDirectory: boolean;
  hasCompletedCompanySetup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  inviteCode?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  createdAt: string;
  updatedAt: string;
}

export type AppRole = 'admin' | 'member';
