'use client';

import { useState, useRef } from 'react';
import { Button, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { MatchupInput } from '@/lib/validation/score-validation';
import { Camera, X } from 'lucide-react';

interface ScoresheetScannerProps {
  homeTeamName: string;
  awayTeamName: string;
  homeRoster: string[];
  awayRoster: string[];
  matchesPerNight: number;
  bestOf: number;
  onParsed: (matchups: MatchupInput[]) => void;
}

export function ScoresheetScanner({
  homeTeamName,
  awayTeamName,
  homeRoster,
  awayRoster,
  matchesPerNight,
  bestOf,
  onParsed,
}: ScoresheetScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleFile(file: File) {
    setScanning(true);
    setConfidence(null);
    setNotes(null);
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('image', file);
    formData.append('homeTeamName', homeTeamName);
    formData.append('awayTeamName', awayTeamName);
    formData.append('homeRoster', JSON.stringify(homeRoster));
    formData.append('awayRoster', JSON.stringify(awayRoster));
    formData.append('matchesPerNight', String(matchesPerNight));
    formData.append('bestOf', String(bestOf));

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.error) {
        toast(data.error, 'error');
        setScanning(false);
        return;
      }

      if (data.matchups && data.matchups.length > 0) {
        setConfidence(data.confidence);
        setNotes(data.notes || null);
        onParsed(data.matchups);
        toast(
          data.confidence === 'high'
            ? 'Scoresheet parsed successfully! Please review below.'
            : 'Scoresheet parsed with some uncertainty. Please review carefully.',
          data.confidence === 'high' ? 'success' : 'info',
        );
      } else {
        toast('Could not parse scoresheet. Please enter scores manually.', 'error');
      }
    } catch {
      toast('Failed to scan scoresheet. Please try again.', 'error');
    }

    setScanning(false);
  }

  function clearPreview() {
    setPreview(null);
    setConfidence(null);
    setNotes(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 mb-4">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />

      {preview ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <img
              src={preview}
              alt="Scoresheet preview"
              className="max-h-32 rounded border border-slate-200"
            />
            <div className="flex-1">
              {scanning ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Analyzing scoresheet...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {confidence && (
                    <Badge
                      variant={
                        confidence === 'high'
                          ? 'success'
                          : confidence === 'medium'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {confidence} confidence
                    </Badge>
                  )}
                  {notes && (
                    <p className="text-xs text-slate-500">{notes}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Rescan
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearPreview}
                    >
                      <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-2">
            Photograph or upload a paper scoresheet to auto-fill the form
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="w-4 h-4 mr-1" /> Scan Scoresheet
          </Button>
        </div>
      )}
    </div>
  );
}
