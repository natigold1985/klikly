import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // מוודא שהמשתמש הוא אדמין או המייל הספציפי שהוגדר
        if (!user || (user.role !== 'admin' && user.email !== 'natigold04@gmail.com')) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // שליפת כלל המשתמשים במערכת בעזרת הרשאת מערכת
        const allUsers = await base44.asServiceRole.entities.User.list();

        return Response.json({ users: allUsers });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});