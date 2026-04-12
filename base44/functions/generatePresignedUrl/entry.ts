import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { S3Client, GetObjectCommand, PutObjectCommand } from 'npm:@aws-sdk/client-s3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  endpoint: Deno.env.get("S3_ENDPOINT") || "https://sg.storage.bunnycdn.com",
  region: Deno.env.get("S3_REGION") || "sg",
  credentials: {
    accessKeyId: Deno.env.get("S3_ACCESS_KEY_ID") || Deno.env.get("BUNNY_ACCESS_KEY") || "",
    secretAccessKey: Deno.env.get("S3_SECRET_ACCESS_KEY") || Deno.env.get("BUNNY_SECRET_KEY") || "",
  },
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, fileName, token } = await req.json();

    if (!token || !action || !fileName) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // STRICT ISOLATION: Validate token before ANY storage action
    const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token });
    const link = links[0];

    if (!link) {
      return Response.json({ error: '403 Forbidden: Invalid or expired token' }, { status: 403 });
    }

    const bucketName = Deno.env.get("S3_BUCKET_NAME") || "base44-delivery";
    let command;

    if (action === 'get') {
      command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });
    } else if (action === 'put') {
      command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Generate a time-limited Presigned URL (valid for 1 hour)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return Response.json({ url: signedUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});