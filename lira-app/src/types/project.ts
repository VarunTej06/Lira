export interface Project {
  id: string;
  name: string;
  key: string; // e.g., "LIRA", "PRJ"
  description: string;
  lead: string; // Lead / Owner e.g., "Varun Tej"
  spaceId: number; // associated Space id
  repoUrl?: string;
  environments?: string[];
  category?: string;
  createdAt: string;
  updatedAt?: string;
}
