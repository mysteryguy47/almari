/**
 * Family vehicles. A family can have a car, two scooters and a tractor; each
 * keeps its own RC, insurance, PUC, bills and service record.
 */
import { visibleTo } from './access';
import { daysUntil } from './dates';
import { getTemplate, nameInSentence, VEHICLE_ESSENTIALS } from './templates';
import type { DocItem, Family, ID, Vehicle, VehicleKind } from './types';
import { OK, type Check } from './validation';

export const VEHICLE_KINDS: { value: VehicleKind; label: string; example: string }[] = [
  { value: 'car', label: 'Car', example: 'Swift, Papa’s car' },
  { value: 'bike', label: 'Motorcycle', example: 'Splendor, Bullet' },
  { value: 'scooter', label: 'Scooter', example: 'Activa, Jupiter' },
  { value: 'tractor', label: 'Tractor', example: 'Mahindra 575' },
  { value: 'commercial', label: 'Truck or taxi', example: 'Tata Ace, Ertiga taxi' },
  { value: 'other', label: 'Other', example: 'E-rickshaw, van' },
];

export function vehicleKindLabel(kind: VehicleKind): string {
  return VEHICLE_KINDS.find((k) => k.value === kind)?.label ?? 'Vehicle';
}

/** "dl 3c ab-1234" → "DL3CAB1234". */
export function normalisePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * How the plate is printed: "DL 3C AB 1234", "MH 12 DE 1433", "22 BH 1234 AA".
 * Anything else is shown as typed, upper-case.
 */
export function formatPlate(value: string | undefined): string {
  if (!value) return '';
  const p = normalisePlate(value);
  const bh = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/.exec(p);
  if (bh) return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`;
  const std = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(p);
  if (std) {
    const [, state, district, letters, digits] = std;
    // Delhi writes the vehicle class with the district: DL 3C AB 1234, DL 8S 1234.
    if (state === 'DL' && letters) return [state, `${district}${letters[0]}`, letters.slice(1), digits].filter(Boolean).join(' ');
    return [state, district.padStart(2, '0'), letters, digits].filter(Boolean).join(' ');
  }
  return p;
}

/** Plates have a state code, a district number, letters and up to four digits; the BH series starts with the year. */
export function checkPlate(value: string): Check {
  const p = normalisePlate(value);
  if (!p) return OK;
  if (/^\d{2}BH\d{4}[A-Z]{1,2}$/.test(p) || /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(p)) return OK;
  return { level: 'warn', message: 'That does not look like a number plate (e.g. DL 3C AB 1234). Saved as typed.' };
}

/** The vehicles the family has, not deleted, in the order they were added. */
export function vehiclesOf(family: Family): Vehicle[] {
  return (family.vehicles ?? []).filter((v) => !v.deletedAt);
}

export function findVehicle(family: Family, id: ID | undefined): Vehicle | undefined {
  return id ? (family.vehicles ?? []).find((v) => v.id === id && !v.deletedAt) : undefined;
}

/** A vehicle's papers the viewer can see, the ones that expire first. */
export function vehicleDocs(family: Family, viewerId: ID, vehicleId: ID): DocItem[] {
  return visibleTo(family, viewerId, family.documents)
    .filter((d) => d.vehicleId === vehicleId)
    .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') || b.createdAt - a.createdAt);
}

/** Vehicle papers not under any vehicle (saved before vehicles, or their vehicle was deleted). */
export function looseVehicleDocs(family: Family, viewerId: ID): DocItem[] {
  return visibleTo(family, viewerId, family.documents).filter(
    (d) => getTemplate(d.templateId).category === 'vehicles' && !findVehicle(family, d.vehicleId),
  );
}

/** The paper that needs doing first: the soonest expiry within 30 days, or one already expired. */
export function vehicleAttention(docs: DocItem[]): { doc: DocItem; days: number } | undefined {
  let best: { doc: DocItem; days: number } | undefined;
  for (const d of docs) {
    if (!d.expiryDate) continue;
    const days = daysUntil(d.expiryDate);
    if (days === null || days > 30) continue;
    if (!best || days < best.days) best = { doc: d, days };
  }
  return best;
}

/** The papers every vehicle needs: RC, insurance and PUC. Electric vehicles need no PUC (no exhaust to test). */
export function essentialsFor(vehicle: Pick<Vehicle, 'electric'> | undefined): string[] {
  return VEHICLE_ESSENTIALS.filter((id) => !(id === 'puc' && vehicle?.electric));
}

/** Which of the vehicle's essential papers it has no paper for yet. */
export function missingEssentials(docs: DocItem[], vehicle?: Pick<Vehicle, 'electric'>): string[] {
  const have = new Set(docs.map((d) => d.templateId));
  return essentialsFor(vehicle).filter((id) => !have.has(id));
}

/** "Swift insurance", "Activa PUC": the title a vehicle paper gets unless the person types one. */
export function vehicleDocTitle(vehicle: Pick<Vehicle, 'name'>, templateId: string): string {
  const template = getTemplate(templateId);
  return `${vehicle.name.trim()} ${template.short ?? nameInSentence(template.name)}`;
}

/**
 * The vehicle a plate belongs to. Saving an RC whose number matches a
 * vehicle files it there; the plate written with or without spaces matches.
 */
export function vehicleByPlate(family: Family, plate: string | undefined): Vehicle | undefined {
  const p = plate ? normalisePlate(plate) : '';
  if (p.length < 6) return undefined;
  return vehiclesOf(family).find((v) => v.number && normalisePlate(v.number) === p);
}
