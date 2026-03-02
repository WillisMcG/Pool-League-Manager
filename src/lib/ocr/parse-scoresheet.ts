import Anthropic from '@anthropic-ai/sdk';
import type { MatchupInput } from '@/lib/validation/score-validation';

export interface ParsedScoresheet {
  matchups: MatchupInput[];
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

interface ParseContext {
  homeTeamName: string;
  awayTeamName: string;
  homeRoster: string[];
  awayRoster: string[];
  matchesPerNight: number;
  bestOf: number;
}

export async function parseScoresheetImage(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  context: ParseContext,
): Promise<ParsedScoresheet> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const winsNeeded = Math.ceil(context.bestOf / 2);

  const prompt = `You are a pool/billiards league scoresheet parser. Analyze this scoresheet image and extract the game results.

**League Format:**
- ${context.matchesPerNight} games per match night
- Best of ${context.bestOf} (first to ${winsNeeded} wins per game)

**Teams:**
- Home team: "${context.homeTeamName}" — Roster: [${context.homeRoster.join(', ')}]
- Away team: "${context.awayTeamName}" — Roster: [${context.awayRoster.join(', ')}]

**Instructions:**
1. Find each individual game matchup on the scoresheet
2. For each game, identify the home player and away player (match names to the provided rosters)
3. Determine how many games each player won in that matchup (scores should be 0 to ${winsNeeded})
4. One player must have exactly ${winsNeeded} wins per game matchup

**Respond with ONLY a JSON object in this exact format:**
{
  "matchups": [
    { "home_player": "Player Name", "away_player": "Player Name", "home_wins": 2, "away_wins": 1 }
  ],
  "confidence": "high",
  "notes": "any issues or uncertainties"
}

- "confidence": "high" if all names and scores are clearly readable
- "confidence": "medium" if some names are hard to read but scores are clear
- "confidence": "low" if significant uncertainty in names or scores
- Player names MUST match exactly one of the roster names provided above (use closest match for handwritten names)
- Return exactly ${context.matchesPerNight} matchups
- If you cannot parse the scoresheet at all, return empty matchups with confidence "low" and explain in notes`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ],
    }],
  });

  // Extract text from response
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Parse JSON from response (Claude may wrap it in markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { matchups: [], confidence: 'low', notes: 'Failed to parse response' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      matchups: (parsed.matchups || []).map((m: Record<string, unknown>) => ({
        home_player: String(m.home_player || ''),
        away_player: String(m.away_player || ''),
        home_wins: Number(m.home_wins || 0),
        away_wins: Number(m.away_wins || 0),
      })),
      confidence: parsed.confidence || 'low',
      notes: parsed.notes,
    };
  } catch {
    return { matchups: [], confidence: 'low', notes: 'Failed to parse JSON from response' };
  }
}
