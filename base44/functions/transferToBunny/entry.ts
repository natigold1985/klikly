import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { S3Client } from 'npm:@aws-sdk/client-s3';
import { Upload } from 'npm:@aws-sdk/lib-storage';

const s3Client = new S3Client({
    region: 'fsn1',
    endpoint: 'https://storage.bunnycdn.com',
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
        const { fileUrl, fileName, fileType, projectId, token } = payload;

        if (!fileUrl || !fileName) {
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

        // Fetch the temporarily uploaded file as a stream
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
            throw new Error(`Failed to fetch file from temporary storage: ${fileResponse.statusText}`);
        }

        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const prefix = user ? user.id : 'client_upload';
        const fileKey = `uploads/${prefix}/${finalProjectId}/${timestamp}_${randomString}_${safeFileName}`;

        // Stream the file directly to BunnyCDN S3 to bypass browser CORS
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: 'natiklikly',
                Key: fileKey,
                Body: fileResponse.body,
                ContentType: fileType || 'application/octet-stream',
            },
        });

        await upload.done();

        return Response.json({
            finalUrl: `https://de.s3.bunnycdn.com/natiklikly/${fileKey}`,
            fileKey: fileKey,
        });

    } catch (error) {
        console.error('Error transferring file:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});