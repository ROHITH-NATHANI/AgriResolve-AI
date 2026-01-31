export type RegulatorySeverity = 'banned' | 'restricted';

export interface RestrictedChemicalEntry {
  name: string;
  severity: RegulatorySeverity;
  aliases?: string[];
  notes?: string;
}

// Hackathon-focused, lightweight compliance list.
// Replace/extend with an official jurisdiction-specific source as needed.
const RESTRICTED_CHEMICALS: RestrictedChemicalEntry[] = [
  {
    name: 'Monocrotophos',
    severity: 'restricted',
    aliases: ['mono-crotophos', 'monocrotofos'],
    notes: 'Often restricted; verify local legality before any use.',
  },
  {
    name: 'Endosulfan',
    severity: 'banned',
    aliases: ['endosulphan'],
    notes: 'Commonly banned; included as a safety red-flag.',
  },
  {
    name: 'Carbofuran',
    severity: 'restricted',
    aliases: ['carbofuran 3g', 'furadan'],
    notes: 'Often restricted; verify local legality before any use.',
  },
  {
    name: 'Paraquat',
    severity: 'restricted',
    aliases: ['paraquat dichloride'],
    notes: 'High-toxicity herbicide; frequently regulated.',
  },
];

export interface RestrictedChemicalHit {
  entry: RestrictedChemicalEntry;
  matched: string;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findRestrictedChemicals(text: string): RestrictedChemicalHit[] {
  const normalized = text?.trim();
  if (!normalized) return [];

  const hits: RestrictedChemicalHit[] = [];
  const seen = new Set<string>();

  for (const entry of RESTRICTED_CHEMICALS) {
    const names = [entry.name, ...(entry.aliases ?? [])].filter(Boolean);
    const pattern = new RegExp(`\\b(${names.map(escapeRegExp).join('|')})\\b`, 'ig');

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized))) {
      const matched = match[0];
      const key = `${entry.name}::${matched.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ entry, matched });
    }
  }

  return hits;
}

export function buildComplianceSummaryText(hits: RestrictedChemicalHit[]): string {
  if (hits.length === 0) return 'No restricted chemical names detected.';

  const unique = Array.from(
    new Map(hits.map((h) => [h.entry.name, h.entry])).values()
  );

  const banned = unique.filter((e) => e.severity === 'banned').map((e) => e.name);
  const restricted = unique.filter((e) => e.severity === 'restricted').map((e) => e.name);

  const parts: string[] = [];
  if (banned.length) parts.push(`Banned/red-flag: ${banned.join(', ')}`);
  if (restricted.length) parts.push(`Restricted/verify: ${restricted.join(', ')}`);
  return parts.join(' • ');
}
