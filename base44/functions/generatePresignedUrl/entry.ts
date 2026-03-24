import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: 'de',
    endpoint: 'https://de.s3.bunnycdn.com',
    forcePathStyle: true,
    credentials: {
        accessKeyId: Deno.env.get('BUNNY_ACCESS_KEY'),
        secretAccessKey: Deno.env.get('BUNNY_SECRET_KEY'),
    },
});

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const payload = await req.json().catch(() => ({}));
        const { fileName, fileType, fileSize, projectId, token } = payload;

        if (!fileName || !fileType) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const user = await base44.auth.me();
        
        if (!user && !token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let finalProjectId = projectId || 'general';

        if (token && !user) {
            const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token: token });
            if (links.length === 0) {
                 return Response.json({ error: 'Invalid token' }, { status: 401 });
            }
            finalProjectId = links[0].project_id;
        }

        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const prefix = user ? user.id : 'client_upload';
        const filePath = `uploads/${prefix}/${finalProjectId}/${timestamp}_${randomString}_${safeFileName}`;

        const command = new PutObjectCommand({
            Bucket: 'natiklikly',
            Key: filePath,
            ContentType: fileType
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return Response.json({
            uploadUrl: uploadUrl,
            fileKey: filePath,
            expiresIn: 3600,
            maxFileSize: 500 * 1024 * 1024,
        });

    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});