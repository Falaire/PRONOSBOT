import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { sendTelegramMessage } from "@/lib/notify/telegram";
import { formatDateTimeLome } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Cron quotidien (~08h00 Africa/Lome) : envoie le récapitulatif des meilleurs pronostics du
 * jour (confiance >= 65%) au canal Telegram public + aux abonnés Premium ayant renseigné leur
 * telegram_chat_id.
 */
async function handler(req: NextRequest) {
  const auth = await assertAdminOrCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

  const { data: predictions, error } = await supabase
    .from("predictions")
    .select(
      `confidence, prob_home, prob_draw, prob_away, predicted_score_home, predicted_score_away,
       fixture:fixtures(kickoff_at, home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name))`
    )
    .gte("confidence", 65)
    .gte("fixture.kickoff_at", now.toISOString())
    .lte("fixture.kickoff_at", in24h.toISOString())
    .order("confidence", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = (predictions ?? []).map((p: any) => {
    const fx = p.fixture;
    return `⚽ <b>${fx.home.name} vs ${fx.away.name}</b>\n🕒 ${formatDateTimeLome(fx.kickoff_at)}\n📊 1: ${Math.round(
      p.prob_home * 100
    )}% · X: ${Math.round(p.prob_draw * 100)}% · 2: ${Math.round(p.prob_away * 100)}%\n🎯 Score probable: ${
      p.predicted_score_home
    }-${p.predicted_score_away} · Confiance: ${p.confidence}%`;
  });

  const message =
    lines.length > 0
      ? `🔥 <b>Pronostics du jour — KickPredict</b>\n\n${lines.join("\n\n")}\n\nVoir l'analyse complète : ${
          process.env.NEXT_PUBLIC_SITE_URL
        }/dashboard`
      : "Aucun pronostic à forte confiance pour aujourd'hui.";

  const errors: string[] = [];
  let sent = 0;

  const channelChatId = process.env.TELEGRAM_CHAT_ID;
  if (channelChatId) {
    try {
      await sendTelegramMessage(channelChatId, message);
      sent++;
    } catch (e: any) {
      errors.push(e.message);
    }
  }

  const { data: subscribers } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  for (const s of subscribers ?? []) {
    try {
      await sendTelegramMessage(s.telegram_chat_id, message);
      sent++;
    } catch (e: any) {
      errors.push(e.message);
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}

export const GET = handler;
export const POST = handler;
