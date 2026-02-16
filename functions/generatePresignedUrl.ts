import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fileName, fileType, fileSize, projectId } = await req.json();

        if (!fileName || !fileType) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate file type (images and videos only)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/avi'];
        if (!allowedTypes.includes(fileType)) {
            return Response.json({ error: 'Invalid file type. Only images and videos are allowed.' }, { status: 400 });
        }

        // Generate a unique file path with user ID to ensure isolation
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `uploads/${user.id}/${projectId || 'general'}/${timestamp}_${randomString}_${safeFileName}`;

        // In a real implementation, you would generate a presigned URL here
        // For now, we'll use the Core.UploadFile integration as a placeholder
        // This would be replaced with actual R2/S3 presigned URL generation

        return Response.json({
            uploadUrl: filePath, // This would be the presigned URL
            fileKey: filePath,
            expiresIn: 3600, // 1 hour
            maxFileSize: 500 * 1024 * 1024, // 500MB
        });

    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});