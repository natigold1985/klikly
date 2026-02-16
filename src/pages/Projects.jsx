import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Plus, Search, Briefcase, Upload, Download, Eye, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isClient = user?.role === 'client';

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', searchTerm, statusFilter, user?.email],
    queryFn: () => {
      if (isClient) {
        return base44.entities.Project.filter({ client_email: user.email }, '-created_date', 200);
      }
      return base44.entities.Project.list('-created_date', 200);
    },
    enabled: !!user,
  });

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = 
      project.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.client_email && project.client_email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      pending_payment: { label: 'ממתין לתשלום', color: 'bg-yellow-500' },
      paid: { label: 'שולם', color: 'bg-green-500' },
      shooting_scheduled: { label: 'צילום מתוכנן', color: 'bg-blue-500' },
      shooting_done: { label: 'צילום בוצע', color: 'bg-indigo-500' },
      awaiting_selection: { label: 'ממתין לבחירת לקוח', color: 'bg-purple-500' },
      editing: { label: 'בעריכה', color: 'bg-orange-500' },
      ready_for_download: { label: 'מוכן להורדה', color: 'bg-cyan-500' },
      completed: { label: 'הושלם', color: 'bg-gray-500' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-gray-500' };
    return <Badge className={`${badge.color} text-white`}>{badge.label}</Badge>;
  };

  const getStatusIcon = (status) => {
    if (status === 'awaiting_selection') return <Eye className="w-5 h-5 text-purple-500" />;
    if (status === 'ready_for_download') return <Download className="w-5 h-5 text-cyan-500" />;
    if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <Briefcase className="w-5 h-5 text-indigo-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            פרויקטים
          </h1>
          <p className="text-slate-600 mt-1">נהל את כל הפרויקטים הפעילים שלך</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש לפי שם לקוח או אימייל..."
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="pending_payment">ממתין לתשלום</SelectItem>
                <SelectItem value="paid">שולם</SelectItem>
                <SelectItem value="shooting_scheduled">צילום מתוכנן</SelectItem>
                <SelectItem value="shooting_done">צילום בוצע</SelectItem>
                <SelectItem value="awaiting_selection">ממתין לבחירת לקוח</SelectItem>
                <SelectItem value="editing">בעריכה</SelectItem>
                <SelectItem value="ready_for_download">מוכן להורדה</SelectItem>
                <SelectItem value="completed">הושלם</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="p-12 text-center">
            <Briefcase className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-500">לא נמצאו פרויקטים</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="bg-white/60 backdrop-blur-sm border-white/20 hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      {getStatusIcon(project.status)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {project.client_name}
                      </h3>
                      {project.shooting_type && (
                        <p className="text-sm text-slate-600">{project.shooting_type}</p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(project.status)}
                </div>

                <div className="space-y-2 mb-4">
                  {project.shooting_date && (
                    <div className="text-sm text-slate-600">
                      📅 {new Date(project.shooting_date).toLocaleDateString('he-IL')}
                    </div>
                  )}
                  {project.total_price && (
                    <div className="text-sm font-medium text-indigo-600">
                      ₪{project.total_price.toLocaleString()}
                    </div>
                  )}
                </div>

                {(project.raw_photos_count > 0 || project.selected_photos_count > 0 || project.final_photos_count > 0) && (
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-200 text-xs text-slate-600">
                    {project.raw_photos_count > 0 && (
                      <div className="flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>{project.raw_photos_count} גולמיות</span>
                      </div>
                    )}
                    {project.selected_photos_count > 0 && (
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        <span>{project.selected_photos_count} נבחרו</span>
                      </div>
                    )}
                    {project.final_photos_count > 0 && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{project.final_photos_count} ערוכות</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}