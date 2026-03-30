import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from './authStore';
import { supabase } from '../supabase';

export interface Cursor {
  x: number;
  y: number;
}

export interface Collaborator {
  uid: string;
  name: string;
  cursor: Cursor | null;
  color: string;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];

export function useCollaboration(documentId: string, initialData: any = null) {
  const { profile } = useAuthStore();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [sharedData, setSharedData] = useState<any>(initialData);
  const isLocalUpdate = useRef(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!documentId || !profile) return;

    const userColor = COLORS[Math.abs(profile.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % COLORS.length];
    
    const userPresence = {
      uid: profile.uid,
      name: profile.fullName,
      color: userColor,
      cursor: null as Cursor | null
    };

    const channel = supabase.channel(`room:${documentId}`, {
      config: {
        presence: {
          key: profile.uid,
        },
      },
    });
    
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: Collaborator[] = [];
        for (const id in state) {
          if (id !== profile.uid) {
            // state[id] is an array of presence objects for that key
            users.push(state[id][0] as unknown as Collaborator);
          }
        }
        setCollaborators(users);
      })
      .on('broadcast', { event: 'data-update' }, (payload) => {
        if (!isLocalUpdate.current) {
          setSharedData(payload.payload.data);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userPresence);
        }
      });

    let lastUpdate = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdate > 30) {
        userPresence.cursor = { x: e.pageX, y: e.pageY };
        channel.track(userPresence);
        lastUpdate = now;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      supabase.removeChannel(channel);
    };
  }, [documentId, profile]);

  const updateSharedData = (data: any) => {
    setSharedData(data);
    isLocalUpdate.current = true;
    
    const sanitizedData = JSON.parse(JSON.stringify(data));
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'data-update',
        payload: { data: sanitizedData },
      });
    }
    
    setTimeout(() => {
      isLocalUpdate.current = false;
    }, 50);
  };

  return { collaborators, sharedData, updateSharedData };
}
