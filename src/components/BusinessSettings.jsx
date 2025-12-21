import React, { useMemo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_TYPES } from '@/lib/businessTypes';

const toLines = (s) => String(s || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

export default function BusinessSettings({ profile, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(profile);

  const businessTypeOptions = useMemo(
    () => Object.entries(BUSINESS_TYPES).map(([key, value]) => ({ key, label: value.label })),
    []
  );

  const startEdit = () => {
    setDraft(profile);
    setOpen(true);
  };

  const handleSave = () => {
    const normalized = {
      ...draft,
      contactLines: Array.isArray(draft.contactLines) ? draft.contactLines : toLines(draft.contactLines),
    };
    onSave(normalized);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={startEdit} className="gap-2">
        <Settings2 className="w-4 h-4" />
        Business Settings
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Business Settings</DialogTitle>
            <DialogDescription>
              These settings control your logo, watermark, business name, and PDF branding.
              They are saved locally in your browser.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Select value={draft.businessType} onValueChange={(v) => setDraft({ ...draft, businessType: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  {businessTypeOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filename Prefix</Label>
              <Input value={draft.filenamePrefix || ''} onChange={(e) => setDraft({ ...draft, filenamePrefix: e.target.value })} placeholder="e.g., GreenMile" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Business Name</Label>
              <Input value={draft.businessName || ''} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} placeholder="Your business name" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Tagline</Label>
              <Input value={draft.tagline || ''} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="Short tagline (optional)" />
            </div>

            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={draft.logoUrl || ''} onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} placeholder="https://.../logo.png" />
              {draft.logoUrl ? (
                <div className="mt-2 p-3 border rounded-md bg-muted/30 flex items-center justify-center">
                  <img src={draft.logoUrl} alt="Logo preview" className="max-h-16 object-contain" />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Watermark URL</Label>
              <Input value={draft.watermarkUrl || ''} onChange={(e) => setDraft({ ...draft, watermarkUrl: e.target.value })} placeholder="https://.../watermark.png" />
              {draft.watermarkUrl ? (
                <div className="mt-2 p-3 border rounded-md bg-muted/30 flex items-center justify-center">
                  <img src={draft.watermarkUrl} alt="Watermark preview" className="max-h-16 object-contain opacity-60" />
                </div>
              ) : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Contact Lines (one per line)</Label>
              <Textarea
                value={Array.isArray(draft.contactLines) ? draft.contactLines.join('\n') : (draft.contactLines || '')}
                onChange={(e) => setDraft({ ...draft, contactLines: e.target.value })}
                rows={4}
                placeholder={'City, State\nPhone\nEmail'}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
