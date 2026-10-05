/**
 * Admin → Settings: the engineer's details for the report's "prepared by".
 * Stored in this browser only (localStorage); the report copies them in when
 * it is made Final.
 */

import { useState } from 'react';

import { saveProfile, type EngineerProfile } from '../../state/engineerProfile.ts';
import { Card, Notice, TextField } from '../primitives.tsx';

export function SettingsSection({ profile, onProfile }: { profile: EngineerProfile; onProfile: (p: EngineerProfile) => void }) {
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<EngineerProfile>) => {
    const next = { ...profile, ...patch };
    onProfile(next);
    setError(saveProfile(next));
  };
  return (
    <div className="grid max-w-2xl gap-4">
      <Card title="Prepared by" subtitle="Printed on the report cover and in the sign-off block.">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Your name" helper="As it should appear on the report." value={profile.name} autoComplete="name" onChange={(name) => set({ name: name.slice(0, 120) })} />
          <TextField label="Job title" helper="e.g. Security Systems Engineer." value={profile.title} autoComplete="organization-title" onChange={(title) => set({ title: title.slice(0, 120) })} />
          <TextField label="Phone" helper="Optional." type="tel" value={profile.phone} autoComplete="tel" onChange={(phone) => set({ phone: phone.slice(0, 60) })} />
          <TextField label="Email" helper="Optional." type="email" value={profile.email} autoComplete="email" onChange={(email) => set({ email: email.slice(0, 160) })} />
        </div>
        <p className="mt-3 text-xs text-[var(--color-ink-3)]">
          Kept in this browser only. They are not in the project file or the link, except as printed on a report made Final.
        </p>
        {error && (
          <div className="mt-3">
            <Notice kind="warning" role="status">
              {error}
            </Notice>
          </div>
        )}
      </Card>
    </div>
  );
}
