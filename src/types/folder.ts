export type DirectoryType = 'contacts' | 'clients' | 'team';

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  directoryType: DirectoryType;
}
