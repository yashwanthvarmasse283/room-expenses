import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Megaphone, Trash2, Pin, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const NoticeBoard = () => {
  const { role, profile, isViewOnly } = useAuth();
  const isAdmin = role === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const { data: notices = [] } = useQuery({
    queryKey: ['notices', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('notices').select('*').eq('admin_id', adminId).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!adminId,
  });

  // Sort: pinned first, then by date
  const sortedNotices = useMemo(() => {
    return [...notices].sort((a: any, b: any) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [notices]);

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('notices-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices', filter: `admin_id=eq.${adminId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notices', adminId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, queryClient]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isViewOnly) return;
    const { error } = await supabase.from('notices').insert({ admin_id: profile.id, title: title.trim(), content: content.trim() });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['notices'] });
    setOpen(false); setTitle(''); setContent('');
    toast({ title: 'Notice Posted' });
  };

  const remove = async (id: string) => {
    if (isViewOnly) return;
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['notices'] });
    toast({ title: 'Notice Deleted' });
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    if (isViewOnly) return;
    const { error } = await supabase.from('notices').update({ pinned: !currentPinned } as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['notices'] });
    toast({ title: !currentPinned ? 'Notice Pinned' : 'Notice Unpinned' });
  };

  const openEdit = (notice: any) => {
    setEditingId(notice.id);
    setEditTitle(notice.title);
    setEditContent(notice.content);
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || isViewOnly) return;
    const { error } = await supabase
      .from('notices')
      .update({ title: editTitle.trim(), content: editContent.trim() })
      .eq('id', editingId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['notices'] });
    setEditOpen(false);
    setEditingId(null);
    toast({ title: 'Notice Updated' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Notice Board</h1>
        {isAdmin && !isViewOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Post Notice</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post a Notice</DialogTitle></DialogHeader>
              <form onSubmit={post} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Content</Label><Textarea value={content} onChange={e => setContent(e.target.value)} required rows={4} /></div>
                <Button className="w-full" type="submit">Post</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sortedNotices.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No notices yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {sortedNotices.map((n: any) => (
            <Card key={n.id} className={`transition-all hover:shadow-md ${n.pinned ? 'border-2 border-primary/40 bg-primary/5' : ''}`}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {n.pinned && <Pin className="w-4 h-4 text-primary" />}
                  <Megaphone className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  {n.pinned && <Badge variant="secondary" className="text-[10px]">Pinned</Badge>}
                </div>
                {isAdmin && !isViewOnly && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => togglePin(n.id, n.pinned)} title={n.pinned ? 'Unpin' : 'Pin'}>
                      <Pin className={`w-4 h-4 ${n.pinned ? 'text-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(n)} title="Edit">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Delete">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this notice?</AlertDialogTitle>
                          <AlertDialogDescription>"{n.title}" will be permanently deleted.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(n.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Notice Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Notice</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Content</Label><Textarea value={editContent} onChange={e => setEditContent(e.target.value)} required rows={4} /></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NoticeBoard;
