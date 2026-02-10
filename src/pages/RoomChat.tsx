import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const RoomChat = () => {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const adminId = role === 'admin' ? profile?.id : profile?.admin_id;

  const { data: messages = [] } = useQuery({
    queryKey: ['chat_messages', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('admin_id', adminId)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!adminId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('room-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `admin_id=eq.${adminId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat_messages', adminId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [adminId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !profile || !adminId) return;
    const { error } = await supabase.from('chat_messages').insert({
      admin_id: adminId,
      sender_id: user.id,
      sender_name: profile.name,
      content: message.trim(),
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setMessage('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-2xl font-bold text-foreground mb-4">Room Chat</h1>
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Group Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-3 pb-2">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation!</p>
          ) : messages.map((m: any) => {
            const isMe = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {!isMe && <p className="text-xs font-semibold mb-0.5 opacity-70">{m.sender_name}</p>}
                  <p className="text-sm">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </CardContent>
        <div className="p-4 border-t border-border">
          <form onSubmit={send} className="flex gap-2">
            <Input placeholder="Type a message..." value={message} onChange={e => setMessage(e.target.value)} className="flex-1" />
            <Button type="submit" size="icon" disabled={!message.trim()}><Send className="w-4 h-4" /></Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default RoomChat;
