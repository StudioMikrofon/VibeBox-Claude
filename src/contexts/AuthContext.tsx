import { createContext, useContext, ReactNode } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  createSession: (hostName: string, roomName: string) => Promise<string>;
  joinSession: (code: string, guestName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const generateRoomCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const createSession = async (hostName: string, roomName: string): Promise<string> => {
    try {
      const code = generateRoomCode();
      console.log('Creating session with code:', code);

      await addDoc(collection(db, 'sessions'), {
        code: code,
        hostName,
        roomName,
        createdAt: serverTimestamp(),
        queue: [],
        guests: [],
        settings: {
          maxSongsPerGuest: 3,
          queuePermission: 'public',
          enableCrossfade: false,
          autoSkipNegative: false,
          autoSkipThreshold: -3,
          allowVoting: true,
          showCurrentPlaying: true
        }
      });

      console.log('Session created successfully');
      return code;
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error('Failed to create session. Please try again.');
    }
  };

  const joinSession = async (code: string, guestName: string): Promise<boolean> => {
    try {
      console.log('🔵 [1] Starting joinSession, code:', code, 'guest:', guestName);

      const q = query(collection(db, 'sessions'), where('code', '==', code));
      const querySnapshot = await getDocs(q);

      console.log('🔵 [2] Query result, found docs:', querySnapshot.size);

      if (querySnapshot.empty) {
        console.log('🔴 [3] No session found with code:', code);
        throw new Error('Invalid room code');
      }

      const sessionDoc = querySnapshot.docs[0];
      console.log('🔵 [4] Session doc ID:', sessionDoc.id);
      console.log('🔵 [5] Current guests array:', sessionDoc.data().guests);

      await updateDoc(doc(db, 'sessions', sessionDoc.id), {
        guests: arrayUnion(guestName)
      });

      console.log('🔵 [6] updateDoc called, should have added:', guestName);

      // Verify update
      const verifySnapshot = await getDocs(q);
      const updatedData = verifySnapshot.docs[0].data();
      console.log('🔵 [7] After update, guests array:', updatedData.guests);

      return true;
    } catch (error) {
      console.error('🔴 [ERROR] joinSession failed:', error);
      throw new Error('Failed to join session. Please check the room code.');
    }
  };

  const value: AuthContextType = {
    createSession,
    joinSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
