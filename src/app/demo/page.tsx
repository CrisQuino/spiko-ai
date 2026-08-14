'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { generateQuickFeedback, evaluateCEFR, type CEFRAssessment } from '@/lib/cefr-evaluator';
import { supabase, getJobDescription } from '@/lib/supabase';
import { getLanguage, type LanguageConfig } from '@/lib/languages';
import { makeT } from '@/lib/i18n';

type Message = {
  role: 'ai' | 'user';
  content: string;
  timestamp: number;
};

type Phase = 'intro' | 'diagnosis' | 'resolution' | 'verification' | 'complete';

export default function DemoPage() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPhase, setCurrentPhase] = useState<Phase>('intro');
  const [progress, setProgress] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voiceModeActive, setVoiceModeActive] = useState(false); // Continuous voice conversation mode
  const voiceModeRef = useRef(false); // Ref to avoid stale closure
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null); // Store recognition instance
  
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Practice configuration (language + job description) read from the URL.
  const [language, setLanguage] = useState<LanguageConfig>(() => getLanguage(null));
  const [jdTitle, setJdTitle] = useState<string | null>(null);
  // Refs mirror the config so async callbacks never read a stale value.
  const languageRef = useRef<LanguageConfig>(getLanguage(null));
  const jdRef = useRef<{ content: string | null; title: string | null }>({ content: null, title: null });
  const levelRef = useRef<string | null>(null); // selected CEFR level ('' = auto)
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0 });
  const totalTokensRef = useRef({ input: 0, output: 0 }); // mirror to avoid stale closures at completion
  const [scenarioTitle, setScenarioTitle] = useState<string | null>(null);
  const scenarioTitleRef = useRef<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<string[]>([]);
  const [cefrAssessment, setCefrAssessment] = useState<CEFRAssessment | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pendingAudioQueue, setPendingAudioQueue] = useState(0);
  const [clarificationCount, setClarificationCount] = useState(0);
  
  // Use refs to track completion state without triggering re-renders
  const completionTriggeredRef = useRef(false);
  const scenarioCompletedRef = useRef(false);
  
  // Store critical data in refs to avoid stale closures
  const lessonIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  
  // Audio unlock for iOS/mobile (must be triggered by user interaction)
  const audioUnlockedRef = useRef(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null); // Reusable audio element for iOS
  
  // Function to unlock audio on iOS (call on first user interaction)
  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    
    console.log('🔓 Unlocking audio for iOS...');
    
    // Create a reusable audio element
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
      (audioElementRef.current as any).playsInline = true;
      (audioElementRef.current as any).webkitPlaysInline = true;
    }
    
    // Create a silent audio context to unlock
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        // Resume if suspended
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        console.log('✅ AudioContext unlocked');
      }
    } catch (e) {
      console.log('⚠️ AudioContext unlock failed:', e);
    }
    
    // Also try playing a silent audio element
    try {
      const silentAudio = audioElementRef.current;
      silentAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAbD/4xjEAAAANIAAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjEWwAADSAAAAAA';
      silentAudio.play().then(() => {
        console.log('✅ Silent audio played - audio unlocked');
        audioUnlockedRef.current = true;
      }).catch(e => {
        console.log('⚠️ Silent audio failed:', e);
      });
    } catch (e) {
      console.log('⚠️ Audio element unlock failed:', e);
    }
    
    audioUnlockedRef.current = true;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Stop all audio / recognition when leaving the page (navigation or unmount),
  // so nothing keeps talking in the background after closing the session.
  useEffect(() => {
    return () => {
      try {
        audioElementRef.current?.pause();
        audioRef.current?.pause();
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      voiceModeRef.current = false;
    };
  }, []);
  
  // Timer for elapsed time
  useEffect(() => {
    if (!started || !startTime) return;
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [started, startTime]);
  
  const [scenarioCompleted, setScenarioCompleted] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true); // Demo mode flag - default to true until auth check
  const [demoTimeLimit] = useState(2 * 60 * 1000); // 2 minutes for demo
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Loading state for auth check
  
  // Read practice config (language + job description) from the URL on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const lang = getLanguage(params.get('lang'));
    setLanguage(lang);
    languageRef.current = lang;

    levelRef.current = params.get('level');

    const jdId = params.get('jd');
    if (jdId) {
      getJobDescription(jdId).then((jd) => {
        if (jd) {
          setJdTitle(jd.title);
          jdRef.current = { content: jd.content, title: jd.title };
          console.log('📋 Loaded job description:', jd.title);
        } else {
          console.warn('⚠️ Job description not found or not accessible:', jdId);
        }
      });
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticated = !!session;
      
      console.log('🔐 Auth check:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
      setIsDemoMode(!isAuthenticated);
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);
  
  // Auto-complete después de tiempo límite (5 min para usuarios, 2 min para demo)
  useEffect(() => {
    if (!startTime || scenarioCompletedRef.current) return;
    
    const timeLimit = isDemoMode ? demoTimeLimit : 5 * 60 * 1000;
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= timeLimit && !scenarioCompletedRef.current) {
        console.log(`⏰ ${isDemoMode ? '2 minutes (DEMO)' : '5 minutes'} reached - auto-completing scenario`);
        setProgress(100);
        setScenarioCompleted(true);
        scenarioCompletedRef.current = true;
        // Check if we can trigger completion immediately
        setTimeout(() => checkAndTriggerCompletion(), 100);
      }
    }, 1000); // Check cada segundo
    
    return () => clearInterval(checkInterval);
  }, [startTime, isDemoMode, demoTimeLimit]);
  
  useEffect(() => {
    if (progress === 100 && !scenarioCompletedRef.current) {
      setScenarioCompleted(true);
      scenarioCompletedRef.current = true;
      console.log('🏁 Scenario reached 100%');
      // Check if we can trigger completion
      setTimeout(() => checkAndTriggerCompletion(), 100);
    }
  }, [progress]);
  
  // Function to check if we should trigger completion
  const checkAndTriggerCompletion = () => {
    console.log('🔍 Checking completion conditions...');
    console.log('  scenarioCompleted:', scenarioCompletedRef.current);
    console.log('  isPlayingAudio:', isPlayingAudio);
    console.log('  pendingAudioQueue:', pendingAudioQueue);
    console.log('  completionTriggered:', completionTriggeredRef.current);
    console.log('  cefrAssessment:', !!cefrAssessment);
    
    // Check all conditions
    if (
      scenarioCompletedRef.current && 
      !isPlayingAudio && 
      pendingAudioQueue === 0 && 
      !completionTriggeredRef.current &&
      !cefrAssessment &&
      startTime
    ) {
      console.log('✅ ALL CONDITIONS MET - Triggering completion');
      completionTriggeredRef.current = true;
      completeLesson();
    } else {
      console.log('⏸️ Conditions not met yet');
    }
  };
  
  const completeLesson = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 COMPLETING LESSON (Client-side evaluation)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Use refs to avoid stale closure issues
    const currentLessonId = lessonIdRef.current;
    const currentMessages = messagesRef.current;
    
    console.log('  lessonId:', currentLessonId);
    console.log('  startTime:', startTime);
    console.log('  messages:', currentMessages.length);
    console.log('  completionTriggered:', completionTriggeredRef.current);
    
    if (!startTime) {
      console.error('❌ Missing startTime - ABORTING');
      return;
    }
    
    // lessonId is optional - we can still calculate assessment without it
    if (!currentLessonId) {
      console.warn('⚠️ No lessonId (server start failed), but continuing with client-side assessment');
    }
    
    try {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const userMessages = currentMessages.filter(m => m.role === 'user').map(m => m.content);
      
      console.log('🔍 Filtered user messages:', userMessages.length);
      console.log('📝 User messages:', userMessages);
      
      // Safety check for empty messages
      if (userMessages.length === 0) {
        console.warn('⚠️ No user messages found, using mock assessment');
        setCefrAssessment({
          overall: { level: 'B1', score: 60, description: 'Good effort!' },
          pronunciation: { level: 'B1', score: 60, description: 'Clear pronunciation' },
          fluency: { level: 'B1', score: 60, description: 'Good fluency' },
          vocabulary: { level: 'B1', score: 60, description: 'Good vocabulary' },
          grammar: { level: 'B1', score: 60, description: 'Good grammar' },
          interaction: { level: 'B1', score: 60, description: 'Good interaction' },
          comprehension: { level: 'B1', score: 60, description: 'Good comprehension' },
          technicalJargon: { level: 'Basic', termsUsed: [], accuracy: 50 },
          quickFeedback: ['Try the demo again!'],
          finalFeedback: 'Complete a full conversation to get detailed feedback.'
        });
        console.log('✅ Mock assessment set');
        return;
      }
      
      console.log('📊 Assessment data:');
      console.log('  Duration:', durationSeconds, 'seconds');
      console.log('  User messages:', userMessages.length);
      console.log('  Total tokens:', totalTokens);
      console.log('  Clarifications needed:', clarificationCount);
      
      // Stop any audio/conversation still playing before showing the result.
      stopAllAudio();
      setEvaluating(true);

      // Rigorous, language-aware CEFR evaluation via the LLM, with the heuristic
      // evaluator as a safety fallback if the call fails.
      console.log('🧮 Requesting LLM CEFR evaluation...');
      let assessment: CEFRAssessment;
      try {
        const evalRes = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentMessages,
            language: languageRef.current.code,
            level: levelRef.current,
          }),
        });
        if (!evalRes.ok) throw new Error(`evaluate ${evalRes.status}`);
        const evalData = await evalRes.json();
        assessment = evalData.assessment;
        console.log('✅ Assessment source:', evalData.source, '→', assessment.overall.level, assessment.overall.score);
      } catch (e) {
        console.warn('⚠️ LLM evaluation failed, using heuristic fallback:', e);
        assessment = evaluateCEFR(userMessages, durationSeconds, 'production_incident', clarificationCount);
      }

      setEvaluating(false);

      // Show assessment
      console.log('💾 Setting CEFR assessment state...');
      setCefrAssessment(assessment);
      console.log('✅ CEFR assessment state set!');
      
      // 🔄 BACKGROUND: Save to server (non-blocking, non-critical)
      // Only save if we have a lessonId (server start succeeded)
      if (currentLessonId) {
        console.log('💾 Saving to server in background...');
        
        // Get auth token for authenticated save
        supabase.auth.getSession().then(({ data: { session } }) => {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
          
          fetch('/api/lesson/complete', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              lessonId: currentLessonId,
              messages: currentMessages, // Send full messages array, not just user content
              durationSeconds,
              tokenUsage: totalTokensRef.current,
              clarificationCount,
              assessment, // Include the client assessment
              scenarioTitle: scenarioTitleRef.current
            })
          })
            .then(response => {
              if (response.ok) {
                console.log('✅ Lesson saved to server');
              } else {
                console.warn('⚠️ Server save failed (non-critical)');
              }
            })
            .catch(error => {
              console.error('❌ Server save error (non-critical):', error);
            });
        });
      } else {
        console.log('⏭️ Skipping server save (no lessonId)');
      }
        
    } catch (error) {
      console.error('🔥 ERROR in completeLesson:', error);
      console.error('Stack trace:', (error as Error).stack);
      
      // Show error to user with emergency assessment
      setCefrAssessment({
        overall: { level: 'B1', score: 60, description: 'Assessment completed (error recovery mode)' },
        pronunciation: { level: 'B1', score: 60, description: 'Clear pronunciation' },
        fluency: { level: 'B1', score: 60, description: 'Good fluency' },
        vocabulary: { level: 'B1', score: 60, description: 'Good vocabulary' },
        grammar: { level: 'B1', score: 60, description: 'Good grammar' },
        interaction: { level: 'B1', score: 60, description: 'Good interaction' },
        comprehension: { level: 'B1', score: 60, description: 'Good comprehension' },
        technicalJargon: { level: 'Basic', termsUsed: [], accuracy: 50 },
        quickFeedback: ['System error - results may be approximate'],
        finalFeedback: 'An error occurred during assessment. Please try again or contact support.'
      });
      
      console.log('✅ Error fallback assessment set');
    }
  };
  
  // Keep the old function for reference (will be removed)
  const completeLesson_OLD_SERVER = async () => {
    console.log('📝 COMPLETING LESSON');
    console.log('  lessonId:', lessonId);
    console.log('  startTime:', startTime);
    console.log('  messages:', messages.length);
    
    if (!lessonId || !startTime) {
      console.error('❌ Missing lessonId or startTime');
      // Mock assessment for testing
      setCefrAssessment({
        overall: { level: 'B2', score: 75, description: 'Good communication' },
        pronunciation: { level: 'B2', score: 75, description: 'Clear pronunciation' },
        fluency: { level: 'B2', score: 75, description: 'Good fluency' },
        vocabulary: { level: 'B2', score: 75, description: 'Good vocabulary' },
        grammar: { level: 'B2', score: 75, description: 'Good grammar' },
        interaction: { level: 'B2', score: 75, description: 'Good interaction' },
        comprehension: { level: 'B2', score: 75, description: 'Good comprehension' },
        technicalJargon: { level: 'Intermediate', termsUsed: [], accuracy: 75 },
        quickFeedback: [],
        finalFeedback: 'Great job! Keep practicing.'
      });
      return;
    }
    
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
    
    console.log('📤 Sending lesson completion:');
    console.log('  Duration:', durationSeconds, 'seconds');
    console.log('  User messages:', userMessages.length);
    console.log('  Total tokens:', totalTokens);
    console.log('  Clarifications needed:', clarificationCount);
    
    // TIMEOUT with AbortController: Si no hay respuesta en 5 segundos, usar fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ Assessment timeout (5s) - aborting request');
      controller.abort();
    }, 5000); // 5 segundos
    
    try {
      const response = await fetch('/api/lesson/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          messages: userMessages,
          durationSeconds,
          tokenUsage: totalTokens,
          clarificationCount
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('📥 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ CEFR Assessment received:', data.assessment);
        setCefrAssessment(data.assessment);
      } else {
        console.error('❌ API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        
        // Fallback assessment
        setCefrAssessment({
          overall: { level: 'B2', score: 75, description: 'Assessment unavailable - showing estimated level' },
          pronunciation: { level: 'B2', score: 75, description: 'Estimated' },
          fluency: { level: 'B2', score: 75, description: 'Estimated' },
          vocabulary: { level: 'B2', score: 75, description: 'Estimated' },
          grammar: { level: 'B2', score: 75, description: 'Estimated' },
          interaction: { level: 'B2', score: 75, description: 'Estimated' },
          comprehension: { level: 'B2', score: 75, description: 'Estimated' },
          technicalJargon: { level: 'Intermediate', termsUsed: [], accuracy: 75 },
          quickFeedback: [],
          finalFeedback: 'Great work completing the scenario!'
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Check if it was a timeout/abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('⏱️ Request aborted due to timeout');
      } else {
        console.error('💥 Error completing lesson:', error);
      }
      
      // Fallback assessment for ANY error
      setCefrAssessment({
        overall: { level: 'B2', score: 75, description: 'Assessment unavailable - showing estimated level' },
        pronunciation: { level: 'B2', score: 75, description: 'Estimated' },
        fluency: { level: 'B2', score: 75, description: 'Estimated' },
        vocabulary: { level: 'B2', score: 75, description: 'Estimated' },
        grammar: { level: 'B2', score: 75, description: 'Estimated' },
        interaction: { level: 'B2', score: 75, description: 'Estimated' },
        comprehension: { level: 'B2', score: 75, description: 'Estimated' },
        technicalJargon: { level: 'Intermediate', termsUsed: [], accuracy: 75 },
        quickFeedback: [],
        finalFeedback: 'Great work completing the scenario!'
      });
    }
  };

  const startScenario = async () => {
    // Unlock audio for iOS/mobile (must be called from user interaction)
    unlockAudio();
    
    setStarted(true);
    setStartTime(Date.now());
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting scenario in', isDemoMode ? 'DEMO' : 'FULL', 'mode');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      console.log('📤 Sending POST to /api/lesson/start...');
      
      // Get the session token for authenticated requests
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (!isDemoMode) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
          console.log('🔑 Added auth token to request');
        } else {
          console.warn('⚠️ No session token available, request may fail');
        }
      }
      
      const response = await fetch('/api/lesson/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          scenarioType: 'database',
          demoMode: isDemoMode
        })
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 Response data:', data);
        setLessonId(data.lessonId);
        lessonIdRef.current = data.lessonId; // Store in ref too
        setIsDemoMode(data.demoMode || false);
        console.log('✅ Lesson started with ID:', data.lessonId, data.demoMode ? '(DEMO MODE - 2 min limit)' : '(FULL MODE - 5 min limit)');
      } else {
        console.error('❌ Failed to start lesson - Status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Error details:', errorJson);
        } catch {
          console.error('❌ Error (raw text):', errorText);
        }
      }
    } catch (error) {
      console.error('💥 FATAL ERROR starting lesson:', error);
      console.error('💥 Error type:', error instanceof Error ? error.name : typeof error);
      console.error('💥 Error message:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('💥 Stack trace:', error.stack);
      }
    }
    
    setTimeout(() => {
      generateOpeningMessage();
    }, 1000);
  };

  // Fallback opening line per language, used only if the API call fails.
  const FALLBACK_OPENER: Record<string, string> = {
    en: "Hey, sorry to bother you — we've got an urgent issue and I could really use your help. Can you take a look?",
    fr: "Salut, désolé de te déranger — on a un problème urgent et j'aurais vraiment besoin de ton aide. Tu peux jeter un œil ?",
    pt: "Oi, desculpa incomodar — temos um problema urgente e eu precisaria muito da sua ajuda. Você pode dar uma olhada?",
  };

  // Ask the model to open the scenario (derived from the job description + language).
  const generateOpeningMessage = async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          language: languageRef.current.code,
          jobDescription: jdRef.current.content,
          jobTitle: jdRef.current.title,
          level: levelRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.title) {
          setScenarioTitle(data.title);
          scenarioTitleRef.current = data.title;
        }
        if (data.tokenUsage) {
          const next = {
            input: totalTokensRef.current.input + (data.tokenUsage.input || 0),
            output: totalTokensRef.current.output + (data.tokenUsage.output || 0),
          };
          totalTokensRef.current = next;
          setTotalTokens(next);
        }
        if (data.message) {
          addAIMessage(data.message);
          return;
        }
      }
      throw new Error('No opening message returned');
    } catch (error) {
      console.error('⚠️ Opening message failed, using fallback:', error);
      addAIMessage(FALLBACK_OPENER[languageRef.current.code] || FALLBACK_OPENER.en);
    }
  };

  // Hard-stop any audio playback (audio element + Web Speech) and clear the queue.
  const stopAllAudio = () => {
    // Disable the continuous voice loop so it doesn't auto-restart recording.
    voiceModeRef.current = false;
    setVoiceModeActive(false);
    try {
      audioElementRef.current?.pause();
      audioRef.current?.pause();
      recognitionRef.current?.stop();
    } catch {
      // ignore — element/recognition may not be initialized yet
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setIsRecording(false);
    setPendingAudioQueue(0);
  };

  const addAIMessage = (content: string) => {
    // Once the scenario is complete, don't add or speak any more AI lines.
    if (scenarioCompletedRef.current) {
      console.log('⏹️ Scenario completed — suppressing new AI message');
      return;
    }
    console.log('💬 ADDING AI MESSAGE to queue');
    setPendingAudioQueue(prev => prev + 1);
    
    setMessages(prev => {
      const newMessages = [...prev, {
        role: 'ai' as const,
        content,
        timestamp: Date.now()
      }];
      messagesRef.current = newMessages; // Update ref
      return newMessages;
    });
    
    // Play audio (async)
    playAudio(content);
  };
  
  // Browser TTS fallback function (for mobile/iOS compatibility)
  const playBrowserTTS = (text: string) => {
    console.log('🔊 Using Browser TTS fallback');
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = languageRef.current.bcp47;
      
      // Try to use a female voice for consistency
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = languageRef.current.bcp47.split('-')[0];
      const langVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith(langPrefix));
      if (langVoice) {
        utterance.voice = langVoice;
      } else if (langPrefix === 'en') {
        const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria'));
        if (femaleVoice) utterance.voice = femaleVoice;
      }
      
      utterance.onend = () => {
        console.log('🔇 Browser TTS finished');
        setIsPlayingAudio(false);
        setPendingAudioQueue(prev => {
          const newCount = Math.max(0, prev - 1);
          setTimeout(() => checkAndTriggerCompletion(), 50);
          
          // If voice mode is active and no more audio in queue, auto-start listening
          if (newCount === 0 && voiceModeRef.current && !scenarioCompletedRef.current) {
            console.log('🎙️ Voice mode: Auto-starting recording after AI response');
            setTimeout(() => startVoiceRecording(), 500);
          }
          
          return newCount;
        });
      };
      
      utterance.onerror = (error) => {
        console.warn('⚠️ Browser TTS error:', error);
        setIsPlayingAudio(false);
        setPendingAudioQueue(prev => {
          const newCount = Math.max(0, prev - 1);
          setTimeout(() => checkAndTriggerCompletion(), 50);
          return newCount;
        });
      };
      
      setIsPlayingAudio(true);
      window.speechSynthesis.speak(utterance);
    } else {
      // No audio available at all - simulate delay based on text length
      console.warn('⚠️ No TTS available - simulating audio');
      setIsPlayingAudio(true);
      setTimeout(() => {
        setIsPlayingAudio(false);
        setPendingAudioQueue(prev => {
          const newCount = Math.max(0, prev - 1);
          setTimeout(() => checkAndTriggerCompletion(), 50);
          return newCount;
        });
      }, text.length * 50); // ~50ms per character
    }
  };

  const playAudio = async (text: string) => {
    console.log('🔊 GENERATING TTS with', isDemoMode ? 'Browser TTS (free)' : 'ElevenLabs');
    console.log('📝 Text:', text.substring(0, 100));
    
    setIsPlayingAudio(true);
    
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        // Call our TTS API
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            isFreeUser: isDemoMode,  // Use free TTS in demo mode
            language: languageRef.current.code,
          }),
        });
        
        const data = await response.json();
        
        // Check if we got actual audio data (not fallback)
        if (data.audio && !data.fallback && !data.error) {
          console.log(isDemoMode ? '✅ Playing Google Cloud TTS audio' : '✅ Playing premium TTS audio');
          const audioBlob = base64ToBlob(data.audio, data.contentType);
          const audioUrl = URL.createObjectURL(audioBlob);
          
          // Use the reusable audio element for iOS compatibility, or create new one
          const audio = audioElementRef.current || new Audio();
          audio.src = audioUrl;
          
          // Set iOS-friendly attributes
          (audio as any).playsInline = true;
          (audio as any).webkitPlaysInline = true;
          
          audio.onended = () => {
            console.log('🔇 AUDIO FINISHED');
            setIsPlayingAudio(false);
            setPendingAudioQueue(prev => {
              const newCount = Math.max(0, prev - 1);
              console.log(`📊 Audio queue: ${prev} → ${newCount}`);
              // Check completion after state updates
              setTimeout(() => checkAndTriggerCompletion(), 50);
              
              // If voice mode is active and no more audio in queue, auto-start listening
              if (newCount === 0 && voiceModeRef.current && !scenarioCompletedRef.current) {
                console.log('🎙️ Voice mode: Auto-starting recording after AI response');
                setTimeout(() => startVoiceRecording(), 500);
              }
              
              return newCount;
            });
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.onerror = (error) => {
            console.error('🔇 AUDIO ERROR:', error);
            setIsPlayingAudio(false);
            setPendingAudioQueue(prev => {
              const newCount = Math.max(0, prev - 1);
              setTimeout(() => checkAndTriggerCompletion(), 50);
              
              // Even on error, try to auto-start listening in voice mode
              if (newCount === 0 && voiceModeRef.current && !scenarioCompletedRef.current) {
                console.log('🎙️ Voice mode: Auto-starting recording despite audio error');
                setTimeout(() => startVoiceRecording(), 500);
              }
              
              return newCount;
            });
            URL.revokeObjectURL(audioUrl);
          };
          
          // Try to play - may fail on iOS without user interaction
          try {
            await audio.play();
          } catch (playError: any) {
            console.warn('⚠️ Audio autoplay blocked (iOS/mobile):', playError.message);
            // Fall back to browser TTS which may work better
            setIsPlayingAudio(false);
            setPendingAudioQueue(prev => Math.max(0, prev - 1));
            URL.revokeObjectURL(audioUrl);
            // Try browser TTS as fallback
            playBrowserTTS(text);
            return;
          }
          return; // Success! Exit function
        }
        
        // If we got here, API returned fallback flag - use browser TTS immediately
        if (data.fallback) {
          console.log('🎮 API returned fallback flag - using browser TTS');
          break; // Exit retry loop and go to browser TTS
        }
        
        // If we got here, there was an error - try again
        retryCount++;
        if (retryCount <= maxRetries) {
          console.warn(`⚠️ TTS API failed, retrying (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
        
      } catch (error) {
        console.error('💥 TTS API error:', error);
        retryCount++;
        if (retryCount <= maxRetries) {
          console.warn(`⚠️ Retrying (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // All retries failed OR free user - use fallback
    console.warn(isDemoMode ? '🎮 Demo mode: using Web Speech API (free, lower quality)' : '⚠️ ElevenLabs failed after retries, using Web Speech API fallback');
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = languageRef.current.bcp47;
      
      // Try to use a female voice for consistency
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = languageRef.current.bcp47.split('-')[0];
      const langVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith(langPrefix));
      if (langVoice) {
        utterance.voice = langVoice;
      } else if (langPrefix === 'en') {
        const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria'));
        if (femaleVoice) utterance.voice = femaleVoice;
      }
      
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setPendingAudioQueue(prev => Math.max(0, prev - 1));
      };
      
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setPendingAudioQueue(prev => Math.max(0, prev - 1));
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      // No audio available at all
      setTimeout(() => {
        setIsPlayingAudio(false);
        setPendingAudioQueue(prev => Math.max(0, prev - 1));
      }, text.length * 50);
    }
  };
  
  // Helper function to convert base64 to blob
  const base64ToBlob = (base64: string, contentType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  };
  
  const startVoiceRecording = async () => {
    console.log('🎙️ STARTING VOICE RECORDING');
    
    // First, request microphone permission explicitly
    try {
      console.log('🔐 Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone permission granted');
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      console.error('❌ Microphone permission denied:', err);
      alert('Microphone access is required for voice input. Please allow microphone access in your browser settings and try again.');
      return;
    }
    
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('⚠️ Speech Recognition not supported');
      alert('Voice input requires Chrome, Edge, or Safari');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = languageRef.current.bcp47;
    recognition.interimResults = true; // Show interim results while speaking
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // Keep listening even during pauses
    
    recognitionRef.current = recognition; // Store for manual stop
    setIsRecording(true);
    
    let finalTranscript = '';
    let silenceTimer: NodeJS.Timeout | null = null;
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      // Concatenate all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Show current progress (final + interim)
      const currentText = (finalTranscript + interimTranscript).trim();
      setUserInput(currentText);
      console.log('🎤 SPEAKING:', currentText);
      
      // Reset silence timer on each speech detected
      if (silenceTimer) clearTimeout(silenceTimer);
      
      // Auto-stop after 2 seconds of silence
      silenceTimer = setTimeout(() => {
        console.log('✅ FINAL TRANSCRIPTION:', finalTranscript.trim());
        setUserInput(finalTranscript.trim());
        recognition.stop();
      }, 2000); // 2 seconds of silence = done speaking
    };
    
    recognition.onerror = (event: any) => {
      console.error('❌ RECOGNITION ERROR:', event.error);
      
      // Don't stop on "no-speech" - it's normal during pauses
      if (event.error === 'no-speech') {
        console.log('⏸️ Pause detected, continuing to listen...');
        return; // Keep recording
      }
      
      // Only stop on critical errors
      setIsRecording(false);
      
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone in your browser settings.');
      } else if (event.error === 'aborted') {
        console.log('🔇 Recording manually stopped');
      } else {
        alert(`Speech recognition error: ${event.error}`);
      }
    };
    
    recognition.onend = () => {
      console.log('🔇 RECORDING ENDED');
      console.log('🔍 Voice mode active (ref):', voiceModeRef.current);
      console.log('🔍 Final transcript:', finalTranscript.trim());
      setIsRecording(false);
      
      // In voice mode, auto-send if there's text
      const textToSend = finalTranscript.trim();
      if (voiceModeRef.current && textToSend) {
        console.log('📤 Voice mode: Auto-sending message:', textToSend);
        
        // Clear the input first, then set and send
        setUserInput('');
        
        // Small delay to ensure state is clean
        setTimeout(() => {
          // Directly call the send logic instead of clicking button
          const userMessage = textToSend;
          const newMessage = {
            role: 'user' as const,
            content: userMessage,
            timestamp: Date.now()
          };
          
          setMessages(prev => {
            const newMessages = [...prev, newMessage];
            messagesRef.current = newMessages;
            return newMessages;
          });
          
          // Clear input again to be sure
          setUserInput('');
          
          // Respond after a short delay
          setTimeout(() => {
            respondToUser(userMessage, [...messagesRef.current]);
          }, 500);
          
          console.log('✅ Message sent via voice mode');
        }, 100);
      }
    };
    
    try {
      recognition.start();
      console.log('🎙️ Recognition started - speak now!');
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      console.log('🛑 MANUALLY STOPPING RECORDING');
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };
  
  // Toggle voice mode - activates continuous conversation
  const toggleVoiceMode = () => {
    if (isRecording) {
      // Stop recording and disable voice mode
      stopVoiceRecording();
      setVoiceModeActive(false);
      voiceModeRef.current = false;
      console.log('🔇 Voice mode DEACTIVATED');
    } else {
      // Activate voice mode and start recording
      setVoiceModeActive(true);
      voiceModeRef.current = true;
      console.log('🎙️ Voice mode ACTIVATED - conversation will be continuous');
      startVoiceRecording();
    }
  };

  const handleUserMessage = () => {
    if (!userInput.trim()) return;

    const userMessage = userInput;
    const newMessage = {
      role: 'user' as const,
      content: userMessage,
      timestamp: Date.now()
    };
    
    setMessages(prev => {
      const newMessages = [...prev, newMessage];
      messagesRef.current = newMessages; // Update ref
      return newMessages;
    });

    setTimeout(() => {
      respondToUser(userMessage, [...messages, newMessage]);
    }, 1500);

    setUserInput('');
  };

  const respondToUser = async (userMessage: string, conversationHistory: Message[]) => {
    // Don't process a reply if the scenario already ended.
    if (scenarioCompletedRef.current) {
      console.log('⏹️ Scenario completed — ignoring pending user message');
      return;
    }
    try {
      console.log('📤 Sending to Claude with', conversationHistory.length, 'messages');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          language: languageRef.current.code,
          jobDescription: jdRef.current.content,
          jobTitle: jdRef.current.title,
          level: levelRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error('API call failed');
      }

      const data = await response.json();
      
      if (data.tokenUsage) {
        const next = {
          input: totalTokensRef.current.input + (data.tokenUsage.input || 0),
          output: totalTokensRef.current.output + (data.tokenUsage.output || 0),
        };
        totalTokensRef.current = next;
        setTotalTokens(next);
      }

      const messageCount = messages.filter(m => m.role === 'user').length + 1;
      const feedback = generateQuickFeedback(userMessage, messageCount, 'database');
      if (feedback) {
        setQuickFeedback(prev => [...prev, feedback].slice(-3));
      }
      
      if (data.message) {
        // Detect if Sarah is asking for clarification
        const message = data.message.toLowerCase();
        const clarificationPhrases = [
          'what do you mean',
          'can you be more specific',
          'what exactly',
          'i\'m not sure i follow',
          'can you explain',
          'what are you seeing',
          'what did you find',
          'hold on',
          'wait',
          'can you walk me through',
          'what specifically'
        ];
        
        const isAskingClarification = clarificationPhrases.some(phrase => message.includes(phrase));
        if (isAskingClarification) {
          setClarificationCount(prev => prev + 1);
          console.log('❓ Sarah asked for clarification (total:', clarificationCount + 1, ')');
        }
        
        addAIMessage(data.message);
        
        // Progress based ONLY on time and conversation quality
        const elapsedMinutes = startTime ? (Date.now() - startTime) / 60000 : 0;
        const messageCount = messages.filter(m => m.role === 'user').length + 1;
        
        console.log(`⏱️ Time: ${elapsedMinutes.toFixed(1)}min | Messages: ${messageCount} | Phase: ${currentPhase}`);
        
        // Calculate progress based on time (up to 5 minutes)
        // Progress grows naturally with time, regardless of message count
        const timeProgress = Math.min(90, (elapsedMinutes / 5) * 90); // Max 90% from time
        
        // Update phase based on time milestones
        if (elapsedMinutes < 1) {
          setCurrentPhase('intro');
        } else if (elapsedMinutes < 2) {
          setCurrentPhase('diagnosis');
        } else if (elapsedMinutes < 3.5) {
          setCurrentPhase('resolution');
        } else if (elapsedMinutes < 5) {
          setCurrentPhase('verification');
        } else {
          setCurrentPhase('complete');
        }
        
        // Set progress based on time
        setProgress(Math.floor(timeProgress));
        
        // Only complete when 5+ minutes have passed
        if (elapsedMinutes >= 5 && currentPhase === 'verification') {
          console.log('✅ Scenario complete: 5 minutes reached');
          setCurrentPhase('complete');
          setProgress(100);
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      addAIMessage("Sorry, I'm having trouble connecting. Can you try again?");
    }
  };

  // Translator for the fixed UI chrome, in the selected practice language.
  const t = makeT(language.code);

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px),
              linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="max-w-3xl w-full">
          <Link href="/" className="inline-flex items-center text-cyan-600 mb-8 hover:text-emerald-600 transition-colors font-mono text-sm">
            <span className="mr-2">←</span> cd ../home
          </Link>
          
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass rounded-2xl p-8 md:p-12 border border-gray-200"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-xl mx-auto mb-6 flex items-center justify-center text-white text-2xl font-mono shadow-xl">
              &lt;/&gt;
            </div>
            
            <div className="text-center mb-8">
              <div className="font-mono text-sm text-gray-500 mb-2">// scenario.demo()</div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent font-mono">
                  {jdTitle || t('title_fallback')}
                </span>
              </h1>
              <p className="text-gray-600 font-mono text-sm">
                language = <span className="text-emerald-600">{language.flag} {language.label}</span>
              </p>
            </div>

            <p className="text-lg text-gray-700 mb-8 text-center">
              {jdTitle ? t('desc_from_jd') : t('desc_generic')}
              <br className="hidden md:block" />
              {t('practice_out_loud', { lang: language.label })}
            </p>

            <div className="bg-gray-900 rounded-xl p-6 mb-8 text-left shadow-xl border border-gray-800">
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-gray-400 text-xs font-mono">scenario.config.js</span>
              </div>
              <pre className="text-sm font-mono overflow-x-auto">
                <code>
                  <span className="text-cyan-400">const</span> <span className="text-white">scenario</span> <span className="text-gray-500">=</span> <span className="text-yellow-300">{'{'}</span>{'\n'}
                  {'  '}<span className="text-emerald-400">duration</span><span className="text-gray-500">:</span> <span className="text-yellow-300">'{isDemoMode ? '2 minutes (demo)' : '5-7 minutes'}'</span><span className="text-gray-500">,</span>{'\n'}
                  {'  '}<span className="text-emerald-400">difficulty</span><span className="text-gray-500">:</span> <span className="text-yellow-300">'MEDIUM'</span><span className="text-gray-500">,</span>{'\n'}
                  {'  '}<span className="text-emerald-400">role</span><span className="text-gray-500">:</span> <span className="text-yellow-300">'{jdTitle || 'Custom scenario'}'</span><span className="text-gray-500">,</span>{'\n'}
                  {'  '}<span className="text-emerald-400">language</span><span className="text-gray-500">:</span> <span className="text-yellow-300">'{language.label}'</span><span className="text-gray-500">,</span>{'\n'}
                  {'  '}<span className="text-emerald-400">audio</span><span className="text-gray-500">:</span> <span className="text-yellow-300">'{isDemoMode ? 'browser TTS' : 'premium AI'}'</span><span className="text-gray-500">,</span>{'\n'}
                  {'  '}<span className="text-emerald-400">cefr_evaluation</span><span className="text-gray-500">:</span> <span className="text-purple-400">true</span><span className="text-gray-500">,</span>{'\n'}
                  {'  '}<span className="text-emerald-400">feedback</span><span className="text-gray-500">:</span> <span className="text-yellow-300">'real-time'</span>{'\n'}
                  <span className="text-yellow-300">{'}'}</span><span className="text-gray-500">;</span>
                </code>
              </pre>
            </div>

            {/* Demo Mode Notice */}
            {isCheckingAuth ? (
              <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-mono text-gray-600">{t('checking_auth')}</p>
                </div>
              </div>
            ) : isDemoMode ? (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">🎮</span>
                  <div className="flex-1">
                    <h3 className="font-mono font-bold text-amber-900 mb-1">{t('demo_mode_active')}</h3>
                    <ul className="text-sm text-amber-800 space-y-1 font-mono">
                      <li>⏱️ {t('demo_bullet_time')}</li>
                      <li>🔊 {t('demo_bullet_audio')}</li>
                      <li>✨ {t('cefr_included')}</li>
                    </ul>
                    <p className="text-xs text-amber-700 mt-2 font-mono">
                      <a href="/signup" className="underline font-bold hover:text-amber-900">{t('signup')}</a> {t('signup_tail')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">✨</span>
                  <div className="flex-1">
                    <h3 className="font-mono font-bold text-emerald-900 mb-1">{t('full_access')}</h3>
                    <ul className="text-sm text-emerald-800 space-y-1 font-mono">
                      <li>⏱️ {t('full_bullet_time')}</li>
                      <li>🔊 {t('full_bullet_audio')}</li>
                      <li>💾 {t('full_bullet_history')}</li>
                      <li>✨ {t('cefr_included')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={startScenario}
              disabled={isCheckingAuth}
              className="group w-full py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white text-lg font-mono font-semibold rounded-xl hover:shadow-2xl transition-all hover:scale-[1.02] relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center justify-center">
                <span className="mr-2">▶</span> scenario.start()
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>

            <p className="text-center text-sm text-gray-500 mt-4 font-mono">
              // Claude Sonnet 4 + CEFR Assessment
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      <header className="glass border-b border-gray-200/50 backdrop-blur-xl sticky top-0 z-40">
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white px-6 py-2">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="font-mono font-bold text-sm">🎮 DEMO MODE</span>
                <span className="text-xs opacity-90">|</span>
                <span className="text-xs opacity-90">Limited to 2 minutes</span>
                <span className="text-xs opacity-90">|</span>
                <span className="text-xs opacity-90">🔊 Basic audio quality (browser TTS)</span>
              </div>
              <a 
                href="/signup" 
                className="text-xs font-mono font-bold bg-white text-orange-600 px-3 py-1 rounded-full hover:bg-orange-50 transition-colors whitespace-nowrap"
              >
                Upgrade for Premium Audio →
              </a>
            </div>
          </div>
        )}
        
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <h1 className="font-mono font-bold text-lg gradient-text">{scenarioTitle || jdTitle || 'Practice Session'}</h1>
                {isDemoMode && (
                  <span className="text-xs font-mono bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    DEMO
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 font-mono">
                <span className="text-gray-400">phase:</span> <span className="text-cyan-600">{currentPhase}</span> <span className="text-gray-400">|</span> <span className="text-gray-400">progress:</span> <span className="text-emerald-600">{progress}%</span> <span className="text-gray-400">|</span> <span className="text-gray-400">time:</span> <span className={isDemoMode && elapsedTime >= 90 ? "text-red-600 font-bold" : "text-blue-600"}>{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                {isDemoMode && (
                  <>
                    <span className="text-gray-400"> | </span>
                    <span className="text-amber-600">limit: 2:00</span>
                  </>
                )}
              </p>
            </div>
            
            {/* Audio Status Indicator */}
            <div className="flex items-center space-x-4">
              {isRecording && (
                <div className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-full animate-pulse">
                  <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                  <span className="font-mono text-sm font-bold">🎙 {t('recording')}</span>
                </div>
              )}
              
              {isPlayingAudio && (
                <div className="flex items-center space-x-2 bg-purple-500 text-white px-4 py-2 rounded-full animate-pulse">
                  <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                  <span className="font-mono text-sm font-bold">🔊 {t('playing')}</span>
                </div>
              )}
              
              {!isRecording && !isPlayingAudio && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <span className="font-mono text-sm">{t('ready')}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Floating Audio Indicators - SUPER VISIBLE */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="bg-red-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 animate-pulse">
                <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
                <div className="flex flex-col">
                  <span className="font-mono font-bold text-lg">🎙 {t('recording')}</span>
                  <span className="font-mono text-xs opacity-90">Listening to your voice...</span>
                </div>
              </div>
            </motion.div>
          )}
          
          {isPlayingAudio && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="bg-purple-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-6 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-7 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono font-bold text-lg">🔊 SARAH SPEAKING</span>
                  <span className="font-mono text-xs opacity-90">Playing audio message...</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="container mx-auto max-w-4xl space-y-6">
          <AnimatePresence>
            {messages.map((message, index) => {
              const isLastAIMessage = message.role === 'ai' && index === messages.length - 1;
              const showAudioIndicator = isLastAIMessage && isPlayingAudio;
              
              return (
              <motion.div
                key={index}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-2xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'ai' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-xs font-mono shadow-lg ${showAudioIndicator ? 'animate-pulse ring-4 ring-purple-300' : ''}`}>
                        SC
                      </div>
                      <span className="text-sm font-mono text-gray-600">Sarah_Chen</span>
                      {showAudioIndicator && (
                        <div className="flex items-center space-x-1 text-purple-500">
                          <div className="w-1 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                          <div className="w-1 h-4 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-1 h-3 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <span className="text-xs font-mono ml-2">speaking...</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={`p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white'
                      : showAudioIndicator
                      ? 'glass border-2 border-purple-400 shadow-lg shadow-purple-200'
                      : 'glass border border-gray-200'
                  }`}>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              </motion.div>
            )})}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-gray-200/50 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-mono">$</span>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUserMessage()}
                  placeholder={isRecording ? t('listening') : t('your_response')}
                  className={`w-full pl-10 pr-6 py-4 glass rounded-xl font-mono text-sm focus:outline-none focus:ring-2 ${
                    isRecording 
                      ? 'ring-2 ring-red-400 border-red-300 bg-red-50/50' 
                      : 'focus:ring-cyan-500 border-gray-200/50'
                  }`}
                  disabled={isRecording}
                />
                {isRecording && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </div>
              <button
                onClick={toggleVoiceMode}
                className={`px-6 py-4 rounded-xl font-mono font-semibold transition-all flex items-center space-x-2 ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-xl animate-pulse' 
                    : voiceModeActive
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-xl'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-xl hover:scale-105'
                }`}
                title={isRecording ? 'Click to stop voice mode' : voiceModeActive ? 'Voice mode active - click to stop' : 'Click to start voice conversation'}
              >
                <span className="text-xl">{isRecording ? '🔴' : voiceModeActive ? '🎧' : '🎙️'}</span>
                <span className="text-sm hidden sm:inline">
                  {isRecording ? 'Listening...' : voiceModeActive ? 'Voice On' : 'Voice'}
                </span>
              </button>
              <button
                onClick={handleUserMessage}
                disabled={!userInput.trim() || isRecording}
                data-send-button
                className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono text-sm"
              >
                send()
              </button>
            </div>
            
            {/* Live Feedback - Moved below input */}
            {quickFeedback.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 glass rounded-xl p-3 border border-cyan-500/30"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-cyan-600">💡</span>
                  <h4 className="font-mono text-xs font-bold text-gray-700">// live.feedback</h4>
                </div>
                <div className="space-y-1">
                  {quickFeedback.map((fb, i) => (
                    <div key={i} className="text-xs text-gray-600 font-mono">
                      <span className="text-cyan-600">→</span> {fb}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {progress === 100 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl p-6 md:p-10 max-w-4xl w-full border border-gray-200/50 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="text-center">
                <div className="text-6xl mb-6">🎉</div>
                <h2 className="text-3xl md:text-4xl font-bold mb-2 font-mono gradient-text">
                  scenario.complete()
                </h2>
                
                {/* Demo Mode Notice */}
                {isDemoMode && (
                  <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                    <p className="text-sm font-mono text-amber-800">
                      <span className="font-bold">🎮 DEMO MODE:</span> Limited session completed. 
                      <a href="/signup" className="underline ml-1 hover:text-amber-900">Sign up</a> for unlimited practice!
                    </p>
                  </div>
                )}
                
                <p className="text-lg text-gray-600 mb-2 font-mono text-sm">
                  <span className="text-gray-400">// </span>
                  {elapsedTime >= 300 ? '⏱️ Minimum time reached' : isDemoMode ? '⏱️ Demo time limit reached' : '✅ Well done!'}
                </p>
                <div className="flex items-center justify-center space-x-4 mb-8 text-sm font-mono">
                  <span className="text-gray-500">
                    ⏱️ Time: <span className="text-blue-600 font-bold">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">
                    ❓ Clarifications: <span className={`font-bold ${clarificationCount > 5 ? 'text-orange-600' : clarificationCount > 2 ? 'text-yellow-600' : 'text-green-600'}`}>{clarificationCount}</span>
                  </span>
                </div>

                {cefrAssessment ? (
                  <>
                    <div className="bg-gray-900 rounded-xl p-6 mb-8 text-left border border-gray-800">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="flex space-x-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-gray-400 text-xs font-mono">performance.json</span>
                      </div>

                      <pre className="text-sm font-mono overflow-x-auto">
                        <code>
                          <span className="text-cyan-400">const</span> <span className="text-white">assessment</span> <span className="text-gray-500">=</span> <span className="text-yellow-300">{'{'}</span>{'\n'}
                          {'  '}<span className="text-emerald-400">cefr_level</span><span className="text-gray-500">:</span> <span className="text-yellow-300">&apos;{cefrAssessment.overall.level}&apos;</span><span className="text-gray-500">,</span>{'\n'}
                          {'  '}<span className="text-emerald-400">fluency</span><span className="text-gray-500">:</span> <span className="text-yellow-300">&apos;{cefrAssessment.fluency.level}&apos;</span><span className="text-gray-500">,</span>{'\n'}
                          {'  '}<span className="text-emerald-400">technical_jargon</span><span className="text-gray-500">:</span> <span className="text-yellow-300">&apos;{cefrAssessment.technicalJargon.level}&apos;</span><span className="text-gray-500">,</span>{'\n'}
                          {'  '}<span className="text-emerald-400">communication</span><span className="text-gray-500">:</span> <span className="text-yellow-300">&apos;{cefrAssessment.interaction.level}&apos;</span>{'\n'}
                          <span className="text-yellow-300">{'}'}</span><span className="text-gray-500">;</span>
                        </code>
                      </pre>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-8 text-left">
                      <div className="glass rounded-xl p-4 border border-gray-200/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-mono text-gray-600">Your level</span>
                            {levelRef.current && (
                              <span className="text-[11px] font-mono text-gray-400">target: {levelRef.current}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-mono font-bold gradient-text">{cefrAssessment.overall.level}</span>
                            {levelRef.current && levelRef.current !== cefrAssessment.overall.level && (
                              <span className="block text-[11px] font-mono text-gray-400">was aiming for {levelRef.current}</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">{cefrAssessment.overall.description}</p>
                      </div>

                      <div className="glass rounded-xl p-4 border border-gray-200/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono text-gray-600">Technical Jargon</span>
                          <span className="tech-badge-emerald">{cefrAssessment.technicalJargon.level}</span>
                        </div>
                        <p className="text-xs text-gray-500">{cefrAssessment.technicalJargon.termsUsed.length} technical terms used</p>
                      </div>

                      <div className="glass rounded-xl p-4 border border-gray-200/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono text-gray-600">Fluency</span>
                          <span className="text-xl font-mono font-bold text-emerald-600">{cefrAssessment.fluency.level}</span>
                        </div>
                        <p className="text-xs text-gray-500">Score: {cefrAssessment.fluency.score}/100</p>
                      </div>

                      <div className="glass rounded-xl p-4 border border-gray-200/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono text-gray-600">Vocabulary</span>
                          <span className="text-xl font-mono font-bold text-cyan-600">{cefrAssessment.vocabulary.level}</span>
                        </div>
                        <p className="text-xs text-gray-500">Score: {cefrAssessment.vocabulary.score}/100</p>
                      </div>
                    </div>

                    {cefrAssessment.finalFeedback && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 text-left">
                        <h3 className="font-mono text-sm font-bold text-blue-900 mb-2">// detailed_feedback</h3>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{cefrAssessment.finalFeedback}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-mono text-sm mb-4">// calculating_assessment()</p>
                    <p className="text-xs text-gray-400 mb-4 font-mono">
                      {evaluating ? '⏳ Grading your language against CEFR…' : '⏳ Evaluating your performance...'}
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/"
                    className="flex-1 py-3 glass border-2 border-gray-300 rounded-xl font-mono font-semibold hover:border-cyan-500 hover:shadow-xl transition-all text-center"
                  >
                    <span className="mr-2">←</span> cd ../home
                  </Link>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white rounded-xl font-mono font-semibold hover:shadow-xl transition-all"
                  >
                    <span className="mr-2">&gt;</span> retry()
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
