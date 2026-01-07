export type DirectoryType = 'contacts' | 'clients' | 'team';

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  directoryType: DirectoryType;
  isOrganizationFolder?: boolean;
  ownerId?: string | null;
  companyId?: string | null;
}
