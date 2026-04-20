import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const vapidKeys = webpush.generateVAPIDKeys();
    return Response.json({
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
      instructions: "Copy these keys and paste them as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your app secrets."
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});