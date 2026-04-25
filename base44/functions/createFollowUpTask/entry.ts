import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all projects marked as "completed" or "ready_for_download"
    const projects = await base44.asServiceRole.entities.Project.filter({});
    const existingTasks = await base44.asServiceRole.entities.Task.filter({});

    const now = new Date();
    let created = 0;

    for (const project of projects) {
      // Only trigger for delivered projects
      if (project.status !== 'completed' && project.status !== 'ready_for_download') continue;

      // Check if updated_date is ~14 days ago
      const updatedDate = new Date(project.updated_date);
      const daysSinceUpdate = (now - updatedDate) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 13 || daysSinceUpdate > 16) continue;

      // Check if a follow-up task already exists for this project
      const hasFollowUp = existingTasks.some(t => 
        t.related_to_id === project.id && 
        t.title?.includes('מכירה נוספת')
      );
      if (hasFollowUp) continue;

      await base44.asServiceRole.entities.Task.create({
        related_to_type: 'project',
        related_to_id: project.id,
        title: `מכירה נוספת: ${project.client_name}`,
        description: `14 ימים עברו מאז מסירת הפרויקט. זמן מצוין להציע אלבום, הדפסות, או הרחבת חבילה ל${project.client_name}.`,
        due_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        priority: 'medium',
        stage: 'general',
      });
      created++;
    }

    return Response.json({ success: true, tasks_created: created });
  } catch (error) {
    console.error("Follow-up task error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});