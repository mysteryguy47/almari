/**
 * Every icon the app uses, by name. The UI maps each name to a component
 * (src/components/Icon.tsx); TypeScript forces that map to cover this whole
 * list, and a test checks each name exists in the icon package.
 */
export const ICON_NAMES = [
  'Activity', 'Archive', 'Award', 'Baby', 'Banknote', 'Bell', 'BellOff', 'Bike', 'BookOpen', 'Briefcase',
  'Building', 'Calendar', 'CalendarClock', 'Camera', 'Car', 'ChartPie', 'Check', 'ChevronDown', 'ChevronLeft',
  'ChevronRight', 'CircleCheck', 'Clock', 'Coins', 'Contact', 'Copy', 'CreditCard', 'Download', 'Droplet',
  'Ellipsis', 'Eye', 'EyeOff', 'Factory', 'FileCheck', 'FileHeart', 'FileKey', 'FileLock', 'FileText',
  'FingerprintPattern', 'Flame', 'Flower2', 'Folder', 'Fuel', 'Gauge', 'Gavel', 'Gift', 'Glasses', 'Globe',
  'GraduationCap', 'HandCoins', 'Handshake', 'Hash', 'Heart', 'HeartHandshake', 'HeartPulse', 'Hospital', 'House',
  'IdCard', 'Image', 'IndianRupee', 'Info', 'KeyRound', 'Landmark', 'Languages', 'LayoutGrid', 'Leaf',
  'Lightbulb', 'ListTodo', 'Lock', 'LogOut', 'Mail', 'MapPin', 'Microscope', 'Moon', 'Newspaper', 'NotebookPen',
  'Package', 'Palette', 'PawPrint', 'PenLine', 'Phone', 'PiggyBank', 'Pill', 'Plane', 'PlugZap', 'Plus',
  'Receipt', 'ReceiptText', 'Repeat', 'RotateCcw', 'Router', 'Scale', 'ScanLine', 'School', 'ScrollText',
  'Search', 'Send', 'Settings', 'Share2', 'Shield', 'ShieldCheck', 'Signature', 'Smartphone', 'Sofa', 'Sparkles',
  'Sprout', 'Stamp', 'Stethoscope', 'StickyNote', 'Store', 'Sun', 'SunMoon', 'Syringe', 'TestTube', 'Ticket',
  'Tractor', 'Trash', 'TrendingUp', 'TriangleExclamationPoint', 'Truck', 'Tv', 'Umbrella', 'Undo2', 'User',
  'UserCheck', 'UserPlus', 'Users', 'Vault', 'Wallet', 'Wheat', 'Wifi', 'Wrench', 'X', 'Zap',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
