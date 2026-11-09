export interface Space {
  id?: number;
  name: string;
  key: string; // e.g. "CERT", "PROJ"
  icon: string; // emoji or icon name
  color: string; // hex color for the space
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: string;
  spaceId: number;
  name: string;
  order: number;
  wipLimit?: number;
  color?: string; // status accent color
}
