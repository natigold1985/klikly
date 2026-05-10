import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REPLY_TEXT = 'Thanks for your comment! Please send us a DM and we’ll be happy to help 📩';
const RECENT_POST_LIMIT = 10;
const COMMENTS_PER_POST_LIMIT = 50;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const dryRun = payload.dry_run === true;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');
    const me = await instagramGet('https://graph.instagram.com/me', accessToken, 'id,username');
    const accountUsername = String(me.username || '').toLowerCase();

    const mediaData = await instagramGet(`https://graph.instagram.com/${me.id}/media`, accessToken, 'id,caption,media_type,permalink,timestamp,comments_count', { limit: RECENT_POST_LIMIT });
    const recentMedia = mediaData.data || [];
    const existingReplies = await base44.asServiceRole.entities.InstagramCommentReply.list('-created_date', 500);
    const processedCommentIds = new Set(existingReplies.map((item) => item.comment_id));

    let replied = 0;
    let skipped = 0;
    let errors = 0;

    for (const media of recentMedia) {
      if (!media.comments_count) continue;

      const commentsData = await instagramGet(`https://graph.instagram.com/${media.id}/comments`, accessToken, 'id,text,username,timestamp,replies{id,text,username,timestamp}', { limit: COMMENTS_PER_POST_LIMIT });
      const comments = commentsData.data || [];

      for (const comment of comments) {
        if (!comment.id || processedCommentIds.has(comment.id)) {
          skipped += 1;
          continue;
        }

        const commentUsername = String(comment.username || '').toLowerCase();
        const hasBusinessReply = Array.isArray(comment.replies?.data) && comment.replies.data.some((reply) => String(reply.username || '').toLowerCase() === accountUsername);

        if (commentUsername === accountUsername || hasBusinessReply) {
          await logReply(base44, media, comment, REPLY_TEXT, 'skipped', '', dryRun);
          processedCommentIds.add(comment.id);
          skipped += 1;
          continue;
        }

        if (dryRun) {
          await logReply(base44, media, comment, REPLY_TEXT, 'skipped', 'Dry run only', dryRun);
          processedCommentIds.add(comment.id);
          skipped += 1;
          continue;
        }

        try {
          const replyUrl = `https://graph.instagram.com/${comment.id}/replies`;
          const params = new URLSearchParams({ access_token: accessToken, message: REPLY_TEXT });
          const res = await fetch(replyUrl, { method: 'POST', body: params });
          const responseText = await res.text();
          if (!res.ok) throw new Error(responseText || `Instagram reply failed: ${res.status}`);

          await logReply(base44, media, comment, REPLY_TEXT, 'replied', '', dryRun);
          processedCommentIds.add(comment.id);
          replied += 1;
        } catch (error) {
          await logReply(base44, media, comment, REPLY_TEXT, 'error', error.message, dryRun);
          processedCommentIds.add(comment.id);
          errors += 1;
        }
      }
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'instagram_comment_auto_reply_run',
      details: `Instagram auto-reply completed. Replied: ${replied}, skipped: ${skipped}, errors: ${errors}, dry_run: ${dryRun}`,
      status: errors > 0 ? 'error' : 'success',
      related_entity_type: 'InstagramCommentReply',
    }).catch(() => {});

    return Response.json({ success: true, dry_run: dryRun, replied, skipped, errors, posts_checked: recentMedia.length });
  } catch (error) {
    console.error('replyToInstagramComments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function instagramGet(url, accessToken, fields, extraParams = {}) {
  const params = new URLSearchParams({ access_token: accessToken, fields });
  Object.entries(extraParams).forEach(([key, value]) => params.set(key, String(value)));
  const res = await fetch(`${url}?${params.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Instagram request failed: ${res.status}`);
  return JSON.parse(text);
}

async function logReply(base44, media, comment, replyText, status, errorMessage, dryRun) {
  await base44.asServiceRole.entities.InstagramCommentReply.create({
    comment_id: comment.id,
    media_id: media.id,
    media_permalink: media.permalink || '',
    username: comment.username || '',
    comment_text: comment.text || '',
    reply_text: replyText,
    status,
    error_message: errorMessage || '',
    replied_at: new Date().toISOString(),
  }).catch(() => {});
}