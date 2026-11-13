import {
  BookOpen, Brain, Briefcase, Building2, ClipboardList, CloudSun, Code, Database, FlaskConical, Folder, Globe, GraduationCap,
  Lightbulb, Megaphone, Palette, Rocket, Server, Shield, Sparkles, Target, Trophy, Users, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import { SPACE_ICON_KEYS, spaceIconKey, type SpaceIconKey } from '../../utils/spaceIcon';

const ICONS: Record<SpaceIconKey, LucideIcon> = {
  clipboard: ClipboardList, sparkles: Sparkles, trophy: Trophy, book: BookOpen, cloud: CloudSun, rocket: Rocket,
  lightbulb: Lightbulb, target: Target, wrench: Wrench, globe: Globe, brain: Brain, zap: Zap,
  folder: Folder, briefcase: Briefcase, code: Code, shield: Shield, users: Users, megaphone: Megaphone,
  flask: FlaskConical, palette: Palette, server: Server, graduation: GraduationCap, building: Building2, database: Database,
};

/** The line icon of a space (the same family as the navigation icons). Takes whatever the space has saved. */
export function SpaceIcon({ icon, className = 'w-4 h-4' }: { icon: string | null | undefined; className?: string }) {
  const key = spaceIconKey(icon);
  const Icon = ICONS[key];
  return <Icon className={className} data-space-icon={key} aria-hidden />;
}

/** The grid of icons to choose from when creating or editing a space. */
export function SpaceIconPicker({ value, onChange }: { value: string; onChange: (key: SpaceIconKey) => void }) {
  const chosen = spaceIconKey(value);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Space icon">
      {SPACE_ICON_KEYS.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-label={key}
          aria-pressed={chosen === key}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            chosen === key ? 'bg-lira-blue-light text-lira-blue ring-2 ring-lira-blue' : 'text-lira-muted hover:bg-gray-100 hover:text-lira-text'
          }`}
        >
          <SpaceIcon icon={key} />
        </button>
      ))}
    </div>
  );
}
