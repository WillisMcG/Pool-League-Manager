import { sendEmail } from './send-email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pool-league-manager.com';

function wrap(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #059669; margin: 0;">Pool League Manager</h2>
      </div>
      ${content}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        <a href="${APP_URL}" style="color: #059669;">pool-league-manager.com</a>
      </p>
    </div>
  `;
}

/** Sent to the captain who just submitted scores */
export async function notifyScoreSubmitted(opts: {
  captainEmail: string;
  captainName: string;
  homeTeam: string;
  awayTeam: string;
  week: number;
  status: 'pending' | 'auto_approved' | 'conflict';
}) {
  const statusMessages: Record<string, string> = {
    pending: 'Your scores are saved and waiting for the other team to submit.',
    auto_approved: 'Both teams submitted matching scores — results are now official!',
    conflict: 'The other team submitted different scores. An admin will review both submissions.',
  };

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    auto_approved: '#059669',
    conflict: '#ef4444',
  };

  await sendEmail({
    to: opts.captainEmail,
    subject: `Scores submitted: ${opts.homeTeam} vs ${opts.awayTeam} (Week ${opts.week})`,
    html: wrap(`
      <p>Hi ${opts.captainName},</p>
      <p>Your scores for <strong>Week ${opts.week}: ${opts.homeTeam} vs ${opts.awayTeam}</strong> have been submitted.</p>
      <div style="background: ${statusColors[opts.status]}15; border-left: 4px solid ${statusColors[opts.status]}; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <strong style="color: ${statusColors[opts.status]};">
          ${opts.status === 'pending' ? 'Pending' : opts.status === 'auto_approved' ? 'Approved' : 'Conflict'}
        </strong>
        <p style="margin: 4px 0 0; color: #475569;">${statusMessages[opts.status]}</p>
      </div>
      <p><a href="${APP_URL}/submit" style="color: #059669;">View submissions</a></p>
    `),
  });
}

/** Sent to admin when there's a score conflict */
export async function notifyAdminConflict(opts: {
  adminEmails: string[];
  homeTeam: string;
  awayTeam: string;
  week: number;
}) {
  await sendEmail({
    to: opts.adminEmails,
    subject: `Score conflict: ${opts.homeTeam} vs ${opts.awayTeam} (Week ${opts.week})`,
    html: wrap(`
      <p>A score conflict needs your attention.</p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <strong style="color: #ef4444;">Score Mismatch</strong>
        <p style="margin: 4px 0 0; color: #475569;">
          Both captains submitted different scores for <strong>Week ${opts.week}: ${opts.homeTeam} vs ${opts.awayTeam}</strong>.
        </p>
      </div>
      <p><a href="${APP_URL}/admin" style="display: inline-block; background: #059669; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review in Admin Panel</a></p>
    `),
  });
}

/** Sent to both captains when scores are auto-approved */
export async function notifyBothTeamsApproved(opts: {
  captainEmails: string[];
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  week: number;
}) {
  await sendEmail({
    to: opts.captainEmails,
    subject: `Results official: ${opts.homeTeam} ${opts.homeScore}-${opts.awayScore} ${opts.awayTeam} (Week ${opts.week})`,
    html: wrap(`
      <p>Scores have been verified and are now official.</p>
      <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <strong style="color: #059669;">Week ${opts.week} Results</strong>
        <p style="margin: 8px 0 0; font-size: 18px; color: #1e293b;">
          ${opts.homeTeam} <strong>${opts.homeScore}</strong> — <strong>${opts.awayScore}</strong> ${opts.awayTeam}
        </p>
      </div>
      <p><a href="${APP_URL}/standings" style="color: #059669;">View updated standings</a></p>
    `),
  });
}
