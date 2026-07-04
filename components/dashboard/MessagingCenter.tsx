import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageItem, MessageThread, MessageUser, UserRole } from '../../types';
import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessageOnce,
  getMessagingRecipients,
  sendMessage,
  startDirectMessageThread,
  subscribeToMessages,
  subscribeToMessageThreads,
  toggleMessageThreadPinned,
} from '../../services/supabase.service';
import { uploadVoiceNote } from '../../services/cloudinary';
import { useNotification } from '../NotificationSystem';
import OptimizedImage from '../OptimizedImage';
import { AVATAR_PLACEHOLDER_IMAGE } from '../../utils/placeholders';
import { MessageSquare, Mic, Pencil, Pin, PinOff, Reply, Search, Send, Square, Tag, Trash2, UserRound, Volume2 } from 'lucide-react';

interface MessagingCenterProps {
  currentUserId: string;
  currentRole: UserRole;
}

const getThreadLabel = (thread: MessageThread | undefined, currentUserId: string): string => {
  if (!thread) return 'Select a conversation';
  if (thread.title) return thread.title;
  const otherParticipants = thread.participants.filter((participant) => participant.userId !== currentUserId);
  return otherParticipants.map((participant) => participant.user?.displayName || 'User').join(', ') || 'Conversation';
};

const getThreadAvatar = (thread: MessageThread | undefined, currentUserId: string): string => {
  const other = thread?.participants.find((participant) => participant.userId !== currentUserId);
  return other?.user?.photoUrl || AVATAR_PLACEHOLDER_IMAGE;
};

const getCurrentParticipant = (thread: MessageThread | undefined, currentUserId: string) => (
  thread?.participants.find((participant) => participant.userId === currentUserId)
);

const parseTags = (value: string): string[] => value
  .split(',')
  .map((tag) => tag.trim().replace(/^#/, ''))
  .filter(Boolean)
  .slice(0, 6);

const MessagingCenter: React.FC<MessagingCenterProps> = ({ currentUserId, currentRole }) => {
  const { addNotification, confirmAction } = useNotification();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [recipients, setRecipients] = useState<MessageUser[]>([]);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId),
    [threads, activeThreadId]
  );

  const activeThreadPinned = Boolean(getCurrentParticipant(activeThread, currentUserId)?.pinnedAt);

  useEffect(() => {
    setLoadingThreads(true);
    const unsubscribe = subscribeToMessageThreads(currentUserId, (nextThreads) => {
      setThreads(nextThreads);
      setLoadingThreads(false);
      setActiveThreadId((current) => current || nextThreads[0]?.id || null);
    });

    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return undefined;
    }

    return subscribeToMessages(activeThreadId, setMessages);
  }, [activeThreadId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      getMessagingRecipients(recipientQuery)
        .then(setRecipients)
        .catch(() => setRecipients([]));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [recipientQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, activeThreadId]);

  const openConversation = async (recipientId: string) => {
    try {
      const threadId = await startDirectMessageThread(recipientId);
      setActiveThreadId(threadId);
      setRecipientQuery('');
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Could not start conversation. Apply the messaging migration first.');
    }
  };

  const submitMessage = async (voice?: { url: string; publicId: string; duration: number }) => {
    if (!activeThreadId) {
      addNotification('info', 'Choose a conversation first.');
      return;
    }

    const text = body.trim();
    if (!text && !voice) return;

    setSending(true);
    try {
      if (editingMessage) {
        await editMessageOnce(editingMessage.id, text);
      } else {
        await sendMessage({
          threadId: activeThreadId,
          body: text || undefined,
          voiceUrl: voice?.url,
          voicePublicId: voice?.publicId,
          voiceDurationSeconds: voice?.duration,
          replyToMessageId: replyingTo?.id,
          tags: parseTags(tagsInput),
        });
      }
      setBody('');
      setTagsInput('');
      setReplyingTo(null);
      setEditingMessage(null);
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : editingMessage ? 'Failed to edit message.' : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const startEditing = (message: MessageItem) => {
    setEditingMessage(message);
    setReplyingTo(null);
    setTagsInput('');
    setBody(message.body || '');
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setBody('');
  };

  const togglePinned = async (thread: MessageThread) => {
    const pinned = Boolean(getCurrentParticipant(thread, currentUserId)?.pinnedAt);
    try {
      await toggleMessageThreadPinned(thread.id, !pinned);
      setThreads((current) => current.map((item) => {
        if (item.id !== thread.id) return item;
        return {
          ...item,
          participants: item.participants.map((participant) => participant.userId === currentUserId
            ? { ...participant, pinnedAt: pinned ? undefined : new Date().toISOString() }
            : participant),
        };
      }));
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Could not update pinned conversation.');
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      addNotification('error', 'Voice recording is not supported on this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);

        if (!blob.size) return;
        setUploadingVoice(true);
        try {
          const uploaded = await uploadVoiceNote(blob);
          await submitMessage({ url: uploaded.url, publicId: uploaded.publicId, duration });
        } catch (error) {
          addNotification('error', error instanceof Error ? error.message : 'Failed to upload voice note.');
        } finally {
          setUploadingVoice(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      addNotification('error', 'Microphone permission was denied.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const removeMessage = async (message: MessageItem, everyone: boolean) => {
    const confirmed = await confirmAction({
      title: everyone ? 'Delete Message for Everyone' : 'Delete Message',
      message: everyone
        ? 'This removes the message content for everyone in this conversation.'
        : 'This hides the message only for you.',
      confirmLabel: 'Delete',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      if (everyone) {
        await deleteMessageForEveryone(message.id);
      } else {
        await deleteMessageForMe(message.id);
        setMessages((current) => current.filter((item) => item.id !== message.id));
      }
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Could not delete message.');
    }
  };

  const canDeleteForEveryone = (message: MessageItem) => Boolean(activeThread && !message.deletedAt);
  const hasOtherParticipantRead = (message: MessageItem) => Boolean(activeThread?.participants.some((participant) => (
    participant.userId !== currentUserId
    && participant.lastReadAt
    && new Date(participant.lastReadAt).getTime() >= new Date(message.createdAt).getTime()
  )));
  const canEditMessage = (message: MessageItem) => (
    message.senderId === currentUserId
    && Boolean(message.body)
    && !message.deletedAt
    && !message.editCount
    && !hasOtherParticipantRead(message)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[620px]">
      <aside className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[360px]">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-bold mb-3">
            <MessageSquare className="w-5 h-5 text-brand-primary" /> Messages
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-brand-muted" />
            <input
              value={recipientQuery}
              onChange={(event) => setRecipientQuery(event.target.value)}
              placeholder="Search people"
              className="w-full pl-9 pr-3 py-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        {recipientQuery && (
          <div className="border-b border-white/10 max-h-48 overflow-y-auto">
            {recipients.length === 0 ? (
              <div className="p-4 text-sm text-brand-muted">No matching people.</div>
            ) : recipients.map((recipient) => (
              <button
                key={recipient.id}
                onClick={() => openConversation(recipient.id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-white/5 text-left transition-colors"
              >
                <OptimizedImage src={recipient.photoUrl || AVATAR_PLACEHOLDER_IMAGE} variant="avatar" className="w-9 h-9 rounded-lg object-cover" alt={recipient.displayName} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{recipient.displayName}</div>
                  <div className="text-xs text-brand-muted capitalize">{recipient.role}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="p-4 text-sm text-brand-muted animate-pulse">Loading conversations...</div>
          ) : threads.length === 0 ? (
            <div className="p-5 text-sm text-brand-muted leading-relaxed">No conversations yet. Search for a model, client, agency, or admin to start messaging.</div>
          ) : threads.map((thread) => {
            const pinned = Boolean(getCurrentParticipant(thread, currentUserId)?.pinnedAt);
            return (
            <div
              key={thread.id}
              className={`w-full p-4 flex items-center gap-3 text-left border-b border-white/5 transition-colors ${activeThreadId === thread.id ? 'bg-brand-primary/10' : 'hover:bg-white/5'}`}
            >
              <button onClick={() => setActiveThreadId(thread.id)} className="min-w-0 flex-1 flex items-center gap-3 text-left">
                <OptimizedImage src={getThreadAvatar(thread, currentUserId)} variant="avatar" className="w-11 h-11 rounded-xl object-cover" alt={getThreadLabel(thread, currentUserId)} />
                <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">{getThreadLabel(thread, currentUserId)}</div>
                  <div className="text-xs text-brand-muted truncate">{pinned ? 'Pinned • ' : ''}{new Date(thread.lastMessageAt).toLocaleString()}</div>
                </div>
              </button>
              <button
                onClick={() => togglePinned(thread)}
                className={`p-2 rounded-lg border transition-colors ${pinned ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white'}`}
                title={pinned ? 'Unpin conversation' : 'Pin conversation'}
              >
                {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            </div>
          );
          })}
        </div>
      </aside>

      <section className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[620px]">
        <header className="p-4 border-b border-white/10 flex items-center gap-3">
          <OptimizedImage src={getThreadAvatar(activeThread, currentUserId)} variant="avatar" className="w-11 h-11 rounded-xl object-cover" alt="Conversation" />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white">{getThreadLabel(activeThread, currentUserId)}</h3>
            <p className="text-xs text-brand-muted">Realtime messages use Ably when configured, with Supabase as the persistent store.</p>
          </div>
          {activeThread && (
            <button
              onClick={() => togglePinned(activeThread)}
              className={`p-2 rounded-lg border transition-colors ${activeThreadPinned ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white'}`}
              title={activeThreadPinned ? 'Unpin conversation' : 'Pin conversation'}
            >
              {activeThreadPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/10">
          {!activeThreadId ? (
            <div className="h-full flex items-center justify-center text-center text-brand-muted">
              <div>
                <UserRound className="w-10 h-10 mx-auto mb-3 opacity-60" />
                <p>Select or start a conversation.</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-brand-muted">No messages yet.</div>
          ) : messages.map((message) => {
            const own = message.senderId === currentUserId;
            const reply = message.replyToMessageId ? messages.find((item) => item.id === message.replyToMessageId) : null;

            return (
              <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] sm:max-w-[72%] rounded-xl border p-3 ${own ? 'bg-brand-primary/15 border-brand-primary/25' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs font-bold text-white">{own ? 'You' : message.sender?.displayName || 'User'}</span>
                    <span className="text-[10px] text-brand-muted">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {reply && (
                    <div className="mb-2 border-l-2 border-brand-primary pl-2 text-xs text-brand-muted truncate">
                      Replying to {reply.senderId === currentUserId ? 'you' : reply.sender?.displayName || 'user'}: {reply.body || 'voice note'}
                    </div>
                  )}

                  {message.deletedAt ? (
                    <p className="text-sm italic text-brand-muted">Message deleted</p>
                  ) : (
                    <>
                      {message.body && <p className="text-sm text-brand-text whitespace-pre-wrap break-words">{message.body}</p>}
                      {message.editedAt && <div className="text-[10px] text-brand-muted mt-1">Edited</div>}
                      {message.voiceUrl && (
                        <div className="mt-2 flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-brand-primary" />
                          <audio controls src={message.voiceUrl} className="w-full max-w-[280px]" />
                        </div>
                      )}
                    </>
                  )}

                  {message.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.tags.map((tag) => <span key={tag} className="text-[10px] bg-white/10 text-brand-muted rounded-full px-2 py-0.5">#{tag}</span>)}
                    </div>
                  )}

                  {!message.deletedAt && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <button onClick={() => setReplyingTo(message)} className="text-brand-muted hover:text-brand-primary flex items-center gap-1"><Reply className="w-3 h-3" /> Reply</button>
                      {canEditMessage(message) && (
                        <button onClick={() => startEditing(message)} className="text-brand-muted hover:text-brand-primary flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>
                      )}
                      <button onClick={() => removeMessage(message, false)} className="text-brand-muted hover:text-red-400 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
                      {canDeleteForEveryone(message) && (
                        <button onClick={() => removeMessage(message, true)} className="text-brand-muted hover:text-red-400 flex items-center gap-1">Delete for everyone</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <footer className="p-4 border-t border-white/10 space-y-3">
          {replyingTo && (
            <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-brand-muted">
              <span className="truncate">Replying to {replyingTo.senderId === currentUserId ? 'your message' : replyingTo.sender?.displayName || 'message'}: {replyingTo.body || 'voice note'}</span>
              <button onClick={() => setReplyingTo(null)} className="text-white">Cancel</button>
            </div>
          )}

          {editingMessage && (
            <div className="flex items-center justify-between gap-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg px-3 py-2 text-xs text-brand-primary">
              <span className="truncate">Editing message. You can edit once before another participant reads it.</span>
              <button onClick={cancelEditing} className="text-white">Cancel</button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2">
            <Tag className="w-4 h-4 text-brand-muted" />
            <input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="Tags: booking, urgent, payment"
              className="flex-1 bg-transparent text-sm text-white focus:outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={editingMessage ? 'Edit your message...' : 'Write a message...'}
              rows={2}
              className="flex-1 resize-none bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-brand-primary"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage();
                }
              }}
            />
            <div className="flex sm:flex-col gap-2">
              <button
                onClick={() => recording ? stopRecording() : startRecording()}
                disabled={!activeThreadId || uploadingVoice}
                className={`flex-1 sm:flex-none px-4 py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center ${recording ? 'bg-red-500 text-white' : 'bg-white/5 text-brand-muted hover:text-white hover:bg-white/10 disabled:opacity-50'}`}
                title={recording ? 'Stop recording' : 'Record voice note'}
              >
                {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => submitMessage()}
                disabled={!activeThreadId || sending || uploadingVoice || !body.trim()}
                className="flex-1 sm:flex-none px-5 py-3 bg-brand-primary hover:bg-brand-accent disabled:opacity-50 disabled:hover:bg-brand-primary text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          {uploadingVoice && <div className="text-xs text-brand-muted animate-pulse">Uploading voice note...</div>}
        </footer>
      </section>
    </div>
  );
};

export default MessagingCenter;