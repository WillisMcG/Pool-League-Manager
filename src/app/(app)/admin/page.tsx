'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardBody, Badge, Modal } from '@/components/ui';
import { ScoreForm } from '../submit/ScoreForm';
import { approveSubmission, rejectSubmissions, adminPostScores, processSmsScore } from './actions';
import type { ScheduleEntry, Player, Submission, Match, Matchup, SmsPendingScore } from '@/types';
import type { MatchupInput } from '@/lib/validation/score-validation';
import { ClipboardCheck, ShieldCheck, History, AlertTriangle, Clock, CheckCircle, MessageSquare } from 'lucide-react';
import { useFeatures } from '@/lib/subscription/use-features';
import { UpgradePrompt } from '@/components/UpgradePrompt';

type Tab = 'review' | 'direct' | 'recent' | 'sms';

interface SubmissionGroup {
  scheduleId: string;
  week: number;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  submissions: Submission[];
  isConflict: boolean;
}

export default function AdminPage() {
  const { membership, organization } = useAuth();
  const { currentSeason, settings } = useOrg();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('review');
  const [groups, setGroups] = useState<SubmissionGroup[]>([]);
  const [recentMatches, setRecentMatches] = useState<(Match & { schedule_entry?: ScheduleEntry })[]>([]);
  const [unfinished, setUnfinished] = useState<ScheduleEntry[]>([]);
  const [teamMap, setTeamMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Direct entry state
  const [directMatch, setDirectMatch] = useState<ScheduleEntry | null>(null);
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);

  // SMS queue state
  const [smsQueue, setSmsQueue] = useState<SmsPendingScore[]>([]);

  // Conflict review modal
  const [reviewGroup, setReviewGroup] = useState<SubmissionGroup | null>(null);

  const supabase = createClient();
  const isAdmin = membership?.role === 'admin';
  const { hasSmsSubmission } = useFeatures();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, currentSeason?.id]);

  async function loadData() {
    if (!organization || !currentSeason) {
      setLoading(false);
      return;
    }

    // Get teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id);
    const tMap = new Map((teams || []).map(t => [t.id, t.name]));
    setTeamMap(tMap);

    // Get schedule entries
    const { data: scheduleData } = await supabase
      .from('schedule')
      .select('*')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id)
      .eq('is_bye', false)
      .order('week');

    // Get submissions
    const { data: subs } = await supabase
      .from('submissions')
      .select('*')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id);

    // Get completed matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const completedScheduleIds = new Set((matchesData || []).map((m: Match) => m.schedule_id));

    // Group submissions by schedule_id
    const subsBySchedule = new Map<string, Submission[]>();
    for (const sub of (subs || []) as Submission[]) {
      const list = subsBySchedule.get(sub.schedule_id) || [];
      list.push(sub);
      subsBySchedule.set(sub.schedule_id, list);
    }

    // Build submission groups
    const gps: SubmissionGroup[] = [];
    const scheduleIds = Array.from(subsBySchedule.keys());
    for (const schedId of scheduleIds) {
      const schedSubs = subsBySchedule.get(schedId)!;
      const sched = (scheduleData as ScheduleEntry[] || []).find(s => s.id === schedId);
      if (!sched) continue;

      gps.push({
        scheduleId: schedId,
        week: sched.week,
        date: sched.date,
        homeTeamName: tMap.get(sched.home_team_id) || sched.home_team_id,
        awayTeamName: tMap.get(sched.away_team_id) || sched.away_team_id,
        homeTeamId: sched.home_team_id,
        awayTeamId: sched.away_team_id,
        submissions: schedSubs,
        isConflict: schedSubs.length === 2 &&
          (schedSubs[0].home_score !== schedSubs[1].home_score ||
           schedSubs[0].away_score !== schedSubs[1].away_score),
      });
    }
    gps.sort((a, b) => a.week - b.week);
    setGroups(gps);

    // Unfinished schedule entries (for direct entry)
    const unfin = ((scheduleData as ScheduleEntry[]) || []).filter(
      s => !completedScheduleIds.has(s.id) && !subsBySchedule.has(s.id)
    );
    setUnfinished(unfin);

    // Attach schedule info to recent matches
    const schedMap = new Map(((scheduleData as ScheduleEntry[]) || []).map(s => [s.id, s]));
    const enriched = ((matchesData as Match[]) || []).map(m => ({
      ...m,
      schedule_entry: schedMap.get(m.schedule_id),
    }));
    setRecentMatches(enriched);

    // Load SMS queue
    const { data: smsData } = await supabase
      .from('sms_pending_scores')
      .select('*')
      .eq('org_id', organization.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setSmsQueue((smsData as SmsPendingScore[]) || []);

    setLoading(false);
  }

  async function handleApprove(group: SubmissionGroup, subIndex: number) {
    const sub = group.submissions[subIndex];
    const result = await approveSubmission({
      scheduleId: group.scheduleId,
      submissionId: sub.id,
    });
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    toast('Scores approved!', 'success');
    setReviewGroup(null);
    setLoading(true);
    await loadData();
  }

  async function handleReject(group: SubmissionGroup) {
    const result = await rejectSubmissions({ scheduleId: group.scheduleId });
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    toast('Submissions rejected. Teams can resubmit.', 'success');
    setReviewGroup(null);
    setLoading(true);
    await loadData();
  }

  async function selectDirectEntry(sched: ScheduleEntry) {
    if (!organization) return;
    const [homeRes, awayRes] = await Promise.all([
      supabase
        .from('players')
        .select('*')
        .eq('team_id', sched.home_team_id)
        .eq('org_id', organization.id)
        .order('name'),
      supabase
        .from('players')
        .select('*')
        .eq('team_id', sched.away_team_id)
        .eq('org_id', organization.id)
        .order('name'),
    ]);
    setHomeRoster((homeRes.data as Player[]) || []);
    setAwayRoster((awayRes.data as Player[]) || []);
    setDirectMatch(sched);
  }

  async function handleDirectSubmit(matchups: MatchupInput[]) {
    if (!directMatch || !currentSeason || !settings) return;
    const result = await adminPostScores({
      scheduleId: directMatch.id,
      seasonId: currentSeason.id,
      matchups,
      matchesPerNight: settings.matches_per_night,
      bestOf: settings.best_of,
    });
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    toast('Scores posted!', 'success');
    setDirectMatch(null);
    setLoading(true);
    await loadData();
  }

  async function handleSmsAction(smsId: string, action: 'approve' | 'reject', sms?: SmsPendingScore) {
    if (action === 'approve' && sms?.parsed_data) {
      const parsed = sms.parsed_data as { matchups?: MatchupInput[] };
      const result = await processSmsScore({
        smsId,
        action: 'approve',
        scheduleId: sms.schedule_id || undefined,
        seasonId: currentSeason?.id,
        teamId: sms.team_id || undefined,
        matchups: parsed.matchups,
        matchesPerNight: settings?.matches_per_night,
        bestOf: settings?.best_of,
      });
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      toast('SMS scores approved and submitted!', 'success');
    } else {
      const result = await processSmsScore({ smsId, action: 'reject' });
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      toast('SMS submission rejected.', 'success');
    }
    setLoading(true);
    await loadData();
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl">
        <Card>
          <CardBody>
            <p className="text-center text-slate-500 py-8">Admin access required.</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black text-slate-800 mb-6">
        Admin
        {currentSeason && (
          <span className="text-base font-normal text-slate-500 ml-3">
            {currentSeason.name}
          </span>
        )}
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
        {[
          { id: 'review' as Tab, label: 'Pending Review', icon: ClipboardCheck, count: groups.length },
          { id: 'direct' as Tab, label: 'Direct Entry', icon: ShieldCheck },
          { id: 'sms' as Tab, label: 'SMS Queue', icon: MessageSquare, count: smsQueue.length },
          { id: 'recent' as Tab, label: 'Recent Results', icon: History },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              tab === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Pending Review Tab ── */}
      {tab === 'review' && (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No pending submissions to review.</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            groups.map(group => (
              <Card key={group.scheduleId}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-700">Week {group.week}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(group.date + 'T12:00:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric',
                          })}
                        </span>
                        {group.isConflict ? (
                          <Badge variant="danger">
                            <AlertTriangle className="w-3 h-3 mr-1 inline" />
                            Conflict
                          </Badge>
                        ) : (
                          <Badge variant="info">
                            <Clock className="w-3 h-3 mr-1 inline" />
                            {group.submissions.length === 1 ? 'Waiting for other team' : 'Pending'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">{group.homeTeamName}</span>
                        <span className="text-slate-400 mx-2">vs</span>
                        <span className="font-medium">{group.awayTeamName}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {group.submissions.length} submission{group.submissions.length !== 1 ? 's' : ''}
                        {group.submissions.map((s, i) => (
                          <span key={i}> &mdash; {teamMap.get(s.team_id) || 'Unknown'}: {s.home_score}-{s.away_score}</span>
                        ))}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {group.isConflict && (
                        <Button size="sm" onClick={() => setReviewGroup(group)}>
                          Review
                        </Button>
                      )}
                      {group.submissions.length === 1 && (
                        <Button size="sm" variant="danger" onClick={() => handleReject(group)}>
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Direct Entry Tab ── */}
      {tab === 'direct' && (
        <div>
          {directMatch ? (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Week {directMatch.week} &mdash;{' '}
                {new Date(directMatch.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </p>
              <ScoreForm
                homeTeamName={teamMap.get(directMatch.home_team_id) || directMatch.home_team_id}
                awayTeamName={teamMap.get(directMatch.away_team_id) || directMatch.away_team_id}
                homeRoster={homeRoster}
                awayRoster={awayRoster}
                matchesPerNight={settings?.matches_per_night || 5}
                bestOf={settings?.best_of || 3}
                onSubmit={handleDirectSubmit}
                onCancel={() => setDirectMatch(null)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {unfinished.length === 0 ? (
                <Card>
                  <CardBody>
                    <div className="text-center py-8">
                      <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">All matches have scores or pending submissions.</p>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                unfinished.map(sched => (
                  <Card key={sched.id}>
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-slate-700">Week {sched.week}</span>
                          <span className="text-xs text-slate-500 ml-2">
                            {new Date(sched.date + 'T12:00:00').toLocaleDateString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric',
                            })}
                          </span>
                          <p className="text-sm text-slate-600 mt-1">
                            <span className="font-medium">{teamMap.get(sched.home_team_id) || sched.home_team_id}</span>
                            <span className="text-slate-400 mx-2">vs</span>
                            <span className="font-medium">{teamMap.get(sched.away_team_id) || sched.away_team_id}</span>
                          </p>
                        </div>
                        <Button size="sm" onClick={() => selectDirectEntry(sched)}>
                          Enter Scores
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SMS Queue Tab ── */}
      {tab === 'sms' && !hasSmsSubmission && (
        <div className="py-4">
          <UpgradePrompt feature="SMS score submission" requiredTier="Pro" />
        </div>
      )}
      {tab === 'sms' && hasSmsSubmission && (
        <div className="space-y-3">
          {smsQueue.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No pending SMS submissions to review.</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            smsQueue.map(sms => {
              const parsed = sms.parsed_data as { matchups?: MatchupInput[]; confidence?: string; notes?: string } | null;
              return (
                <Card key={sms.id}>
                  <CardBody>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-700">{sms.from_phone}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(sms.created_at).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}
                          </span>
                          {parsed?.confidence && (
                            <Badge
                              variant={
                                parsed.confidence === 'high' ? 'success' :
                                parsed.confidence === 'medium' ? 'warning' : 'danger'
                              }
                            >
                              {parsed.confidence} confidence
                            </Badge>
                          )}
                        </div>

                        {sms.body && (
                          <p className="text-xs text-slate-500 mb-2">{sms.body}</p>
                        )}

                        {sms.media_url && (
                          <a
                            href={sms.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 hover:underline mb-2 block"
                          >
                            View scoresheet image
                          </a>
                        )}

                        {parsed?.matchups && parsed.matchups.length > 0 && (
                          <div className="bg-slate-50 rounded p-2 mt-2">
                            <p className="text-xs font-medium text-slate-600 mb-1">Parsed scores:</p>
                            {parsed.matchups.map((m, i) => (
                              <p key={i} className="text-xs text-slate-600">
                                Game {i + 1}: {m.home_player} ({m.home_wins}) vs {m.away_player} ({m.away_wins})
                              </p>
                            ))}
                          </div>
                        )}

                        {parsed?.notes && (
                          <p className="text-xs text-amber-600 mt-1">{parsed.notes}</p>
                        )}

                        {sms.error_message && (
                          <p className="text-xs text-red-500 mt-1">{sms.error_message}</p>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4 shrink-0">
                        {parsed?.matchups && parsed.matchups.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => handleSmsAction(sms.id, 'approve', sms)}
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleSmsAction(sms.id, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Recent Results Tab ── */}
      {tab === 'recent' && (
        <div className="space-y-3">
          {recentMatches.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No match results yet.</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            recentMatches.map(match => (
              <Card key={match.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      {match.schedule_entry && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-700">
                            Week {match.schedule_entry.week}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(match.schedule_entry.date + 'T12:00:00').toLocaleDateString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-slate-600">
                        {match.schedule_entry ? (
                          <>
                            <span className="font-medium">{teamMap.get(match.schedule_entry.home_team_id) || '?'}</span>
                            <span className="text-slate-400 mx-2">vs</span>
                            <span className="font-medium">{teamMap.get(match.schedule_entry.away_team_id) || '?'}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Unknown match</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-700">
                        {match.home_score} - {match.away_score}
                      </p>
                      <Badge variant="success">Approved</Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Conflict Review Modal ── */}
      {reviewGroup && (
        <Modal
          open={true}
          onClose={() => setReviewGroup(null)}
          title="Resolve Score Conflict"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Week {reviewGroup.week}: {reviewGroup.homeTeamName} vs {reviewGroup.awayTeamName}
            </p>

            <div className="grid grid-cols-2 gap-4">
              {reviewGroup.submissions.map((sub, i) => {
                const teamName = teamMap.get(sub.team_id) || 'Unknown';
                const matchups = (sub.matchups || []) as Matchup[];
                return (
                  <div key={sub.id} className="border border-slate-200 rounded-lg p-4">
                    <p className="font-bold text-sm text-slate-700 mb-1">{teamName}&apos;s Submission</p>
                    <p className="text-xs text-slate-500 mb-3">
                      Score: {sub.home_score} - {sub.away_score}
                    </p>
                    <div className="space-y-1">
                      {matchups.map((m, j) => (
                        <p key={j} className="text-xs text-slate-600">
                          {m.home_player} ({m.home_wins}) vs {m.away_player} ({m.away_wins})
                        </p>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => handleApprove(reviewGroup, i)}
                    >
                      Approve This
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center">
              <Button variant="danger" onClick={() => handleReject(reviewGroup)}>
                Reject Both — Teams Resubmit
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
