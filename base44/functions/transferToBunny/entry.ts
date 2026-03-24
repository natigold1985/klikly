import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const STORAGE_ZONE_NAME = 'natiklikly';
const BUNNY_ACCESS_KEY = Deno.env.get('BUNNY_SECRET_KEY'); // Use the Secret Key as the Password (standard S3 mapping)
const BUNNY_ENDPOINT = 'https://storage.bunnycdn.com'; // Main storage endpoint (Falkenstein)

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
        
        // Construct the file path in Bunny Storage
        const filePath = `uploads/${prefix}/${finalProjectId}/${timestamp}_${randomString}_${safeFileName}`;
        const uploadUrl = `${BUNNY_ENDPOINT}/${STORAGE_ZONE_NAME}/${filePath}`;

        // Upload to Bunny Storage using API
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'AccessKey': BUNNY_ACCESS_KEY, // The API Key for the storage zone
                'Content-Type': fileType || 'application/octet-stream',
            },
            body: fileResponse.body // Stream the body directly
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Bunny Storage upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
        }

        return Response.json({
            finalUrl: `https://${STORAGE_ZONE_NAME}.b-cdn.net/${filePath}`,
            fileKey: filePath,
        });

    } catch (error) {
        console.error('Error transferring file:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});