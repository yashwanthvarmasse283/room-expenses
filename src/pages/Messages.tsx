import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const Messages = () => {
  const { user, role, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === 'admin';
  const [content, setContent] = useState('');
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', isAdmin ? 'admin' : 'user', profile?.id, user?.id],
    queryFn: async () => {
      if (isAdmin && profile) {
        const { data } = await supabase.from('messages').select('*').eq('to_admin_id', profile.id).order('created_at', { ascending: false });
        return data ?? [];
      } else if (user) {
        const { data } = await supabase.from('messages').select('*').eq('from_user_id', user.id).order('created_at', { ascending: false });
        return data ?? [];
      }
      return [];
    },
    enabled: !!user,
  });

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user || !profile?.admin_id) return;
    const { error } = await supabase.from('messages').insert({
      from_user_id: user.id,
      from_user_name: profile.name,
      to_admin_id: profile.admin_id,
      content: content.trim(),
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    setContent('');
    toast({ title: 'Sent' });
  };

  const reply = async (msgId: string) => {
    const text = replyContent[msgId]?.trim();
    if (!text) return;
    const { error } = await supabase.from('messages').update({ reply: text, read: true }).eq('id', msgId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    setReplyContent(r => ({ ...r, [msgId]: '' }));
    toast({ title: 'Reply sent' });
  };

  const markRead = async (id: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Messages</h1>

      {!isAdmin && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={sendMessage} className="flex gap-3">
              <Textarea placeholder="Send a message to your admin..." value={content} onChange={e => setContent(e.target.value)} className="flex-1" />
              <Button type="submit" size="icon"><Send className="w-4 h-4" /></Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {messages.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No messages.</CardContent></Card>
        ) : messages.map((m: any) => (
          <Card key={m.id} className={!m.read && isAdmin ? 'border-primary/30' : ''} onClick={() => isAdmin && !m.read && markRead(m.id)}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{isAdmin ? m.from_user_name : 'You'}</p>
                    {!m.read && isAdmin && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-foreground mt-1">{m.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString()}</p>
                </div>
              </div>
              {m.reply && (
                <div className="bg-muted rounded-lg p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Admin Reply:</p>
                  <p className="text-foreground">{m.reply}</p>
                </div>
              )}
              {isAdmin && !m.reply && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Reply..."
                    value={replyContent[m.id] || ''}
                    onChange={e => setReplyContent(r => ({ ...r, [m.id]: e.target.value }))}
                  />
                  <Button size="sm" onClick={() => reply(m.id)}>Reply</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Messages;
