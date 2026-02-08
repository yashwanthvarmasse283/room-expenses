import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { Message } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const [messages, setMessages] = useState(storage.getMessages());
  const [content, setContent] = useState('');
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});

  const myMessages = isAdmin
    ? messages.filter(m => m.toAdminId === user?.id)
    : messages.filter(m => m.fromUserId === user?.id);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user?.adminId) return;
    const msg: Message = {
      id: uuid(), fromUserId: user.id, fromUserName: user.name,
      toAdminId: user.adminId, content: content.trim(),
      read: false, createdAt: new Date().toISOString(),
    };
    const updated = [...messages, msg];
    storage.setMessages(updated);
    setMessages(updated);
    setContent('');
    toast({ title: 'Sent' });
  };

  const reply = (msgId: string) => {
    const text = replyContent[msgId]?.trim();
    if (!text) return;
    const updated = messages.map(m => m.id === msgId ? { ...m, reply: text, read: true } : m);
    storage.setMessages(updated);
    setMessages(updated);
    setReplyContent(r => ({ ...r, [msgId]: '' }));
    toast({ title: 'Reply sent' });
  };

  const markRead = (id: string) => {
    const updated = messages.map(m => m.id === id ? { ...m, read: true } : m);
    storage.setMessages(updated);
    setMessages(updated);
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
        {myMessages.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No messages.</CardContent></Card>
        ) : [...myMessages].reverse().map(m => (
          <Card key={m.id} className={!m.read && isAdmin ? 'border-primary/30' : ''} onClick={() => isAdmin && !m.read && markRead(m.id)}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{isAdmin ? m.fromUserName : 'You'}</p>
                    {!m.read && isAdmin && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-foreground mt-1">{m.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(m.createdAt).toLocaleString()}</p>
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
