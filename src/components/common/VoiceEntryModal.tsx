import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Mic,
  Square,
  Sparkles,
  Loader2,
  Check,
  PenLine,
  AlertCircle,
  Settings,
  Eraser,
} from 'lucide-react';
import {
  BujoEntry,
  Habit,
  UserPreferences,
  hasActiveAiKey,
} from '../../types';
import {
  parseVoiceToBujoEntry,
  parseVoiceToHabit,
  ParsedVoiceBujoDraft,
  ParsedVoiceHabitDraft,
} from '../../utils/aiScheduler';
import { getTodayKey, getRelativeDayLabel } from '../../utils/dateUtils';
import { DEFAULT_JOURNAL_CATEGORIES, getTodayDateString } from '../../utils/storage';
import { soundEngine } from '../../utils/audioSynth';
import {
  useI18n,
  getCategoryLabel,
  getEnergyLabel,
  toPersianDigits,
  formatMinutes,
} from '../../utils/i18n';

interface VoiceEntryModalProps {
  isOpen: boolean;
  mode: 'journal' | 'habit';
  onClose: () => void;
  prefs: UserPreferences;
  defaultDate?: string;
  categories?: string[];
  onSaveJournalEntry?: (entry: BujoEntry) => void;
  onOpenManualJournal?: (draft: Partial<BujoEntry>) => void;
  onSaveHabit?: (habit: Habit) => void;
  onOpenManualHabit?: (draft: Partial<Habit>) => void;
  onOpenSettings?: () => void;
}

export const VoiceEntryModal: React.FC<VoiceEntryModalProps> = ({
  isOpen,
  mode,
  onClose,
  prefs,
  defaultDate,
  categories,
  onSaveJournalEntry,
  onOpenManualJournal,
  onSaveHabit,
  onOpenManualHabit,
  onOpenSettings,
}) => {
  const { t, language } = useI18n();
  const isFa = language === 'fa';
  const todayStr = getTodayKey();
  const availableCategories = categories && categories.length > 0 ? categories : DEFAULT_JOURNAL_CATEGORIES;
  const aiConfigured = hasActiveAiKey(prefs);

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isMissingKeyError, setIsMissingKeyError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [journalDraft, setJournalDraft] = useState<ParsedVoiceBujoDraft | null>(null);
  const [habitDraft, setHabitDraft] = useState<ParsedVoiceHabitDraft | null>(null);

  const recognitionRef = useRef<any>(null);
  const lastProcessedResultIndexRef = useRef<number>(-1);
  const ignoreResultsRef = useRef<boolean>(false);
  const interimRef = useRef<string>('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const appendSpeechChunk = (existing: string, incoming: string): string => {
    const base = existing.trimEnd();
    const next = incoming.trim();
    if (!next) return base;
    if (!base) return next;

    const baseLower = base.toLowerCase();
    const nextLower = next.toLowerCase();

    if (baseLower === nextLower || baseLower.endsWith(` ${nextLower}`) || baseLower.endsWith(nextLower)) {
      return base;
    }

    const baseWords = base.split(/\s+/);
    const nextWords = next.split(/\s+/);
    const maxOverlap = Math.min(baseWords.length, nextWords.length);
    for (let overlap = maxOverlap; overlap >= 1; overlap--) {
      const baseTail = baseWords.slice(baseWords.length - overlap).join(' ').toLowerCase();
      const nextHead = nextWords.slice(0, overlap).join(' ').toLowerCase();
      if (baseTail === nextHead) {
        const remaining = nextWords.slice(overlap).join(' ');
        return remaining ? `${base} ${remaining}` : base;
      }
    }

    return `${base} ${next}`;
  };

  const stopListeningCleanly = (abortImmediately = false) => {
    ignoreResultsRef.current = true;
    if (recognitionRef.current) {
      try {
        if (abortImmediately) {
          recognitionRef.current.abort();
        } else {
          recognitionRef.current.stop();
        }
      } catch {}
    }
    setIsListening(false);
    interimRef.current = '';
    setInterimTranscript('');
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      stopListeningCleanly(true);
      setTranscript('');
      setInterimTranscript('');
      setSpeechError(null);
      setAiError(null);
      setIsMissingKeyError(false);
      setIsProcessing(false);
      setJournalDraft(null);
      setHabitDraft(null);
    }
  }, [isOpen]);

  // Keep textarea scrolled to latest speech while dictating
  useEffect(() => {
    if (isListening && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript, isListening]);

  // Escape key to dismiss cleanly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopListeningCleanly(true);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Web Speech API setup using the deduplicated index tracking pattern
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language === 'fa' ? 'fa-IR' : 'en-US';

    recognition.onstart = () => {
      ignoreResultsRef.current = false;
      lastProcessedResultIndexRef.current = -1;
      interimRef.current = '';
      setInterimTranscript('');
    };

    recognition.onresult = (event: any) => {
      if (ignoreResultsRef.current) return;

      const startIndex = Math.max(event.resultIndex ?? 0, 0);
      const finalChunks: string[] = [];
      const interimChunks: string[] = [];

      for (let i = startIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const rawText = result?.[0]?.transcript || '';

        if (result?.isFinal) {
          if (i > lastProcessedResultIndexRef.current) {
            lastProcessedResultIndexRef.current = i;
            const cleaned = rawText.trim();
            if (cleaned) {
              finalChunks.push(cleaned);
            }
          }
        } else if (rawText.trim()) {
          interimChunks.push(rawText.trim());
        }
      }

      if (finalChunks.length > 0) {
        const finalized = finalChunks.join(' ');
        setTranscript((prev) => appendSpeechChunk(prev, finalized));
      }

      const nextInterim = interimChunks.join(' ');
      interimRef.current = nextInterim;
      setInterimTranscript(nextInterim);
    };

    recognition.onerror = (event: any) => {
      console.warn('Voice entry speech recognition error', event.error);
      setIsListening(false);
      interimRef.current = '';
      setInterimTranscript('');
      if (event.error === 'not-allowed') {
        setSpeechError(
          isFa ? 'دسترسی میکروفون رد شد.' : 'Microphone permission was denied.'
        );
      } else if (event.error !== 'aborted') {
        setSpeechError(
          isFa
            ? 'خطا در تایپ صوتی. می‌توانید متن را تایپ یا ویرایش کنید.'
            : 'Voice dictation error. You can still type or edit below.'
        );
      }
    };

    recognition.onend = () => {
      if (!ignoreResultsRef.current && interimRef.current.trim()) {
        const leftover = interimRef.current.trim();
        setTranscript((prev) => appendSpeechChunk(prev, leftover));
      }
      ignoreResultsRef.current = false;
      setIsListening(false);
      interimRef.current = '';
      setInterimTranscript('');
      lastProcessedResultIndexRef.current = -1;
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {}
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
  }, [language, isFa]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setSpeechError(
        isFa
          ? 'تشخیص صدا در این مرورگر پشتیبانی نمی‌شود.'
          : 'Speech recognition is not supported in this browser.'
      );
      return;
    }

    setSpeechError(null);
    setAiError(null);
    setIsMissingKeyError(false);

    if (isListening) {
      const pendingInterim = (interimRef.current || interimTranscript).trim();
      stopListeningCleanly(true);
      if (pendingInterim) {
        setTranscript((prev) => appendSpeechChunk(prev, pendingInterim));
      }
      soundEngine.playPop();
    } else {
      try {
        ignoreResultsRef.current = false;
        lastProcessedResultIndexRef.current = -1;
        interimRef.current = '';
        setInterimTranscript('');
        recognitionRef.current.start();
        setIsListening(true);
        soundEngine.playGentleChime();
      } catch (err) {
        console.error(err);
        setIsListening(false);
        interimRef.current = '';
        setInterimTranscript('');
      }
    }
  };

  const getCombinedTranscript = () => {
    return interimTranscript.trim()
      ? appendSpeechChunk(transcript, interimTranscript)
      : transcript.trim();
  };

  const handleGenerateWithAi = async () => {
    const combined = getCombinedTranscript();
    if (!combined || isProcessing) return;

    if (isListening) {
      stopListeningCleanly(true);
      setTranscript(combined);
    }

    setAiError(null);
    setIsMissingKeyError(false);
    setIsProcessing(true);
    soundEngine.playPop();

    try {
      if (mode === 'journal') {
        const parsed = await parseVoiceToBujoEntry(combined, {
          todayDate: todayStr,
          defaultDate: defaultDate || todayStr,
          categories: availableCategories,
          prefs,
        });
        setJournalDraft(parsed);
      } else {
        const parsed = await parseVoiceToHabit(combined, { prefs });
        setHabitDraft(parsed);
      }
      soundEngine.playGentleChime();
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg === 'MISSING_AI_KEY') {
        setIsMissingKeyError(true);
        setAiError(t('voiceAdd.missingKeyBody'));
      } else {
        setAiError(
          msg ||
            (isFa
              ? 'خطا در ارتباط با هوش مصنوعی. دوباره امتحان کنید یا به فرم دستی بروید.'
              : 'Could not reach AI provider. Try again or continue in manual form.')
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveDirect = () => {
    if (mode === 'journal' && journalDraft && onSaveJournalEntry) {
      const entry: BujoEntry = {
        id: `bujo-${Date.now()}`,
        date: journalDraft.date || defaultDate || todayStr,
        time: journalDraft.time,
        durationMinutes: journalDraft.durationMinutes,
        type: journalDraft.type,
        status: 'open',
        content: journalDraft.content,
        energyCost: journalDraft.energyCost,
        isPriority: journalDraft.isPriority,
        category: journalDraft.category,
        tags: [journalDraft.category],
        createdAt: Date.now(),
      };
      onSaveJournalEntry(entry);
      soundEngine.playGentleChime();
      onClose();
    } else if (mode === 'habit' && habitDraft && onSaveHabit) {
      const habit: Habit = {
        id: `habit-${Date.now()}`,
        title: habitDraft.title,
        timeBucket: habitDraft.timeBucket,
        time: habitDraft.time,
        durationMinutes: habitDraft.durationMinutes,
        activeDays: habitDraft.activeDays,
        energyCost: habitDraft.energyCost,
        unstickTip: habitDraft.unstickTip,
        color: '#80D141',
        createdAt: getTodayDateString(),
        completedDates: [],
        streakCount: 0,
        totalCompletions: 0,
      };
      onSaveHabit(habit);
      soundEngine.playGentleChime();
      onClose();
    }
  };

  const handleOpenInManualForm = (useAiDraft: boolean) => {
    soundEngine.playPop();
    const combined = getCombinedTranscript();
    if (mode === 'journal' && onOpenManualJournal) {
      if (useAiDraft && journalDraft) {
        onOpenManualJournal({
          content: journalDraft.content,
          type: journalDraft.type,
          date: journalDraft.date,
          time: journalDraft.time,
          durationMinutes: journalDraft.durationMinutes,
          energyCost: journalDraft.energyCost,
          isPriority: journalDraft.isPriority,
          category: journalDraft.category,
        });
      } else {
        onOpenManualJournal({
          content: combined,
          date: defaultDate || todayStr,
        });
      }
    } else if (mode === 'habit' && onOpenManualHabit) {
      if (useAiDraft && habitDraft) {
        onOpenManualHabit({
          title: habitDraft.title,
          timeBucket: habitDraft.timeBucket,
          time: habitDraft.time,
          durationMinutes: habitDraft.durationMinutes,
          activeDays: habitDraft.activeDays,
          energyCost: habitDraft.energyCost,
          unstickTip: habitDraft.unstickTip,
        });
      } else {
        onOpenManualHabit({
          title: combined,
        });
      }
    }
  };

  const formatHabitDaysText = (activeDays?: number[]) => {
    if (!activeDays || activeDays.length === 0 || activeDays.length === 7) {
      return t('habits.everyDay', 'Every Day');
    }
    const isWeekdays = isFa
      ? activeDays.length === 5 && [6, 0, 1, 2, 3].every((d) => activeDays.includes(d))
      : activeDays.length === 5 && [1, 2, 3, 4, 5].every((d) => activeDays.includes(d));
    if (isWeekdays) return t('habits.weekdays', 'Weekdays');

    const isWeekends = isFa
      ? activeDays.length === 2 && [4, 5].every((d) => activeDays.includes(d))
      : activeDays.length === 2 && [0, 6].every((d) => activeDays.includes(d));
    if (isWeekends) return t('habits.weekends', 'Weekends');

    const dayOrder = isFa ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    const dayMap: Record<number, string> = isFa
      ? { 6: 'ش', 0: 'ی', 1: 'د', 2: 'س', 3: 'چ', 4: 'پ', 5: 'ج' }
      : { 0: 'Su', 1: 'Mo', 2: 'Tu', 3: 'We', 4: 'Th', 5: 'Fr', 6: 'Sa' };
    return dayOrder
      .filter((d) => activeDays.includes(d))
      .map((d) => dayMap[d])
      .join(isFa ? '، ' : ', ');
  };

  const getBucketLabel = (bucket: string) => {
    if (bucket === 'morning') return t('habits.bucketMorning');
    if (bucket === 'midday') return t('habits.bucketMidday');
    if (bucket === 'evening') return t('habits.bucketEvening');
    return t('habits.bucketAnytime');
  };

  const getTypeLabel = (type: string) => {
    if (type === 'event') return t('journal.typeEvent');
    if (type === 'note') return t('journal.typeNote');
    return t('journal.typeTask');
  };

  const bullets =
    mode === 'journal'
      ? [
          t('voiceAdd.journalBullet1'),
          t('voiceAdd.journalBullet2'),
          t('voiceAdd.journalBullet3'),
          t('voiceAdd.journalBullet4'),
        ]
      : [
          t('voiceAdd.habitBullet1'),
          t('voiceAdd.habitBullet2'),
          t('voiceAdd.habitBullet3'),
          t('voiceAdd.habitBullet4'),
        ];

  const hasDraft = (mode === 'journal' && Boolean(journalDraft)) || (mode === 'habit' && Boolean(habitDraft));
  const combinedText = getCombinedTranscript();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={`voice-entry-modal-${mode}`}
          dir={isFa ? 'rtl' : 'ltr'}
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="fixed inset-0 z-50 w-full h-full bg-[#F7FAF4] dark:bg-[#121B11] text-[#151E14] dark:text-[#E8F2E4] flex flex-col overflow-hidden text-start"
          role="dialog"
          aria-modal="true"
          aria-label={mode === 'journal' ? t('voiceAdd.journalTitle') : t('voiceAdd.habitTitle')}
        >
          {/* Header with single Back dismiss control */}
          <div className="shrink-0 sticky top-0 z-20 bg-[#F7FAF4]/95 dark:bg-[#121B11]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 border-b border-[#DCEAD4] dark:border-[#22301F] flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  stopListeningCleanly();
                  onClose();
                }}
                className="min-w-[44px] min-h-[44px] px-2 -ms-2 rounded-xl text-[#485B44] dark:text-[#9EB598] hover:bg-[#EAEFE6] dark:hover:bg-[#1C281A] transition-colors flex items-center justify-center gap-1.5 font-medium text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                aria-label={t('common.back', 'Back')}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="hidden sm:inline">{t('common.back', 'Back')}</span>
              </button>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#80D141] text-[#0F2600] flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base sm:text-lg font-bold text-[#151E14] dark:text-[#E8F2E4] leading-tight truncate">
                    {mode === 'journal' ? t('voiceAdd.journalTitle') : t('voiceAdd.habitTitle')}
                  </h2>
                  <p className="text-xs text-[#485B44] dark:text-[#9EB598] font-medium hidden sm:block truncate">
                    {mode === 'journal' ? t('voiceAdd.journalSub') : t('voiceAdd.habitSub')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 py-5 sm:py-6">
            <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
              {!hasDraft ? (
                <>
                  {/* Concise "What to say" bullet guide + example */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] space-y-2.5">
                    <h3 className="text-sm font-bold text-[#151E14] dark:text-[#E8F2E4]">
                      {t('voiceAdd.whatToSay')}
                    </h3>
                    <ul className="list-disc ps-5 space-y-1 text-xs sm:text-sm text-[#485B44] dark:text-[#9EB598] leading-relaxed">
                      {bullets.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] sm:text-xs text-[#5A7055] dark:text-[#86A080] pt-1.5 border-t border-[#EDF4E8] dark:border-[#22301F] italic leading-relaxed">
                      {mode === 'journal' ? t('voiceAdd.journalExample') : t('voiceAdd.habitExample')}
                    </p>
                  </div>

                  {speechError && (
                    <div className="p-3.5 rounded-2xl bg-[#FFE9E9] dark:bg-[#3D1E22] border border-[#F2B8B5]/40 text-xs sm:text-sm text-[#B3261E] dark:text-[#F2B8B5] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{speechError}</span>
                    </div>
                  )}

                  {/* Editable Transcript Field */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`voice-transcript-${mode}`}
                        className="text-xs font-bold text-[#151E14] dark:text-[#E8F2E4]"
                      >
                        {t('voiceAdd.transcriptLabel')}
                      </label>
                      {isListening && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3B7E10] dark:text-[#80D141]">
                          <Mic className="w-3.5 h-3.5" />
                          <span>{t('voiceAdd.listeningStatus', 'Listening...')}</span>
                        </span>
                      )}
                    </div>

                    <textarea
                      ref={textareaRef}
                      id={`voice-transcript-${mode}`}
                      rows={5}
                      value={
                        interimTranscript
                          ? appendSpeechChunk(transcript, interimTranscript)
                          : transcript
                      }
                      onChange={(e) => {
                        interimRef.current = '';
                        setInterimTranscript('');
                        setTranscript(e.target.value);
                        if (aiError) setAiError(null);
                      }}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && combinedText && !isProcessing) {
                          e.preventDefault();
                          handleGenerateWithAi();
                        }
                      }}
                      placeholder={t('voiceAdd.transcriptPlaceholder')}
                      className={`w-full p-4 rounded-2xl border text-sm sm:text-base text-[#151E14] dark:text-[#E8F2E4] placeholder:text-[#788D73] dark:placeholder:text-[#6D8567] focus:outline-none leading-relaxed resize-y transition-colors ${
                        isListening
                          ? 'bg-[#F3FCEB] dark:bg-[#192817] border-[#80D141] ring-2 ring-[#80D141]/40'
                          : 'bg-white dark:bg-[#182316] border-[#DCEAD4] dark:border-[#263722] focus:ring-2 focus:ring-[#80D141]'
                      }`}
                    />

                    {/* Helper & Clear Action Row Directly Below the Text Box */}
                    {(isListening || transcript || interimTranscript) && (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-xs text-[#485B44] dark:text-[#9EB598] font-medium min-w-0 truncate">
                          {isListening
                            ? t('voiceAdd.listeningHint', 'Speak naturally — your words appear in the box above.')
                            : `${combinedText.split(/\s+/).filter(Boolean).length} ${
                                isFa ? 'کلمه' : combinedText.split(/\s+/).filter(Boolean).length === 1 ? 'word' : 'words'
                              }`}
                        </div>

                        {(transcript || interimTranscript) && (
                          <button
                            id={`btn-voice-clear-${mode}`}
                            type="button"
                            onClick={() => {
                              soundEngine.playPop();
                              interimRef.current = '';
                              setTranscript('');
                              setInterimTranscript('');
                              setAiError(null);
                              textareaRef.current?.focus();
                            }}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] hover:bg-[#FFE9E9] dark:hover:bg-[#3D1E22] hover:border-[#B3261E]/40 text-xs font-bold text-[#485B44] dark:text-[#9EB598] hover:text-[#B3261E] dark:hover:text-[#F2B8B5] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                          >
                            <Eraser className="w-3.5 h-3.5" />
                            <span>{t('voiceAdd.clearText')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Unconfigured AI helper notice or runtime AI error */}
                  {(!aiConfigured || aiError) && (
                    <div className="p-4 rounded-2xl bg-[#FFF8E1] dark:bg-[#2A2414] border border-amber-300/70 dark:border-amber-800/60 space-y-2.5 text-xs sm:text-sm text-[#4A3B12] dark:text-amber-200">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-1 flex-1">
                          {isMissingKeyError || !aiConfigured ? (
                            <>
                              <p className="font-bold">{t('voiceAdd.missingKeyTitle')}</p>
                              <p className="opacity-90 leading-relaxed">{t('voiceAdd.missingKeyBody')}</p>
                            </>
                          ) : (
                            <p className="font-medium leading-relaxed">{aiError}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {onOpenSettings && (isMissingKeyError || !aiConfigured) && (
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playPop();
                              stopListeningCleanly();
                              onClose();
                              onOpenSettings();
                            }}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#1C281A] border border-amber-300 dark:border-amber-700/60 text-xs font-bold text-[#151E14] dark:text-[#E8F2E4] flex items-center gap-1.5 cursor-pointer hover:bg-[#EDF6E8]"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>{t('voiceAdd.openSettings')}</span>
                          </button>
                        )}
                        {combinedText && (
                          <button
                            type="button"
                            onClick={() => handleOpenInManualForm(false)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#80D141] text-[#0F2600] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#72BF36]"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                            <span>{t('voiceAdd.useInManual')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Phase B: Structured AI Preview Card */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] space-y-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[#3B7E10] dark:text-[#80D141]">
                      {t('voiceAdd.previewTitle')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        setJournalDraft(null);
                        setHabitDraft(null);
                      }}
                      className="text-xs font-semibold text-[#485B44] dark:text-[#9EB598] hover:text-[#151E14] dark:hover:text-[#E8F2E4] cursor-pointer px-2 py-1"
                    >
                      {t('voiceAdd.rerecord')}
                    </button>
                  </div>

                  {mode === 'journal' && journalDraft && (
                    <div className="space-y-4">
                      <h3 className="font-display text-lg sm:text-xl font-bold text-[#151E14] dark:text-[#E8F2E4] leading-snug">
                        {journalDraft.content}
                      </h3>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 pt-3 border-t border-[#DCEAD4] dark:border-[#263722] text-xs sm:text-sm">
                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldType')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5">
                            {getTypeLabel(journalDraft.type)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldDate')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5 tabular-nums">
                            {getRelativeDayLabel(journalDraft.date, language)}
                          </div>
                        </div>

                        {journalDraft.time && (
                          <div>
                            <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                              {t('voiceAdd.fieldTime')}
                            </div>
                            <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5 tabular-nums">
                              {isFa ? toPersianDigits(journalDraft.time) : journalDraft.time}
                            </div>
                          </div>
                        )}

                        {journalDraft.durationMinutes && (
                          <div>
                            <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                              {t('voiceAdd.fieldDuration')}
                            </div>
                            <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5 tabular-nums">
                              {formatMinutes(journalDraft.durationMinutes, language)}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldCategory')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5">
                            {getCategoryLabel(journalDraft.category, language)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldEnergy')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5">
                            {getEnergyLabel(journalDraft.energyCost, language)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldPriority')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5">
                            {journalDraft.isPriority ? t('voiceAdd.yesPriority') : t('voiceAdd.noPriority')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {mode === 'habit' && habitDraft && (
                    <div className="space-y-4">
                      <h3 className="font-display text-lg sm:text-xl font-bold text-[#151E14] dark:text-[#E8F2E4] leading-snug">
                        {habitDraft.title}
                      </h3>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 pt-3 border-t border-[#DCEAD4] dark:border-[#263722] text-xs sm:text-sm">
                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldBucket')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5">
                            {getBucketLabel(habitDraft.timeBucket)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldDays')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5">
                            {formatHabitDaysText(habitDraft.activeDays)}
                          </div>
                        </div>

                        {habitDraft.time && (
                          <div>
                            <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                              {t('voiceAdd.fieldTime')}
                            </div>
                            <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5 tabular-nums">
                              {isFa ? toPersianDigits(habitDraft.time) : habitDraft.time}
                            </div>
                          </div>
                        )}

                        {habitDraft.durationMinutes && (
                          <div>
                            <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                              {t('voiceAdd.fieldDuration')}
                            </div>
                            <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5 tabular-nums">
                              {formatMinutes(habitDraft.durationMinutes, language)}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="text-[11px] text-[#485B44] dark:text-[#9EB598]">
                            {t('voiceAdd.fieldEnergy')}
                          </div>
                          <div className="font-bold text-[#151E14] dark:text-[#E8F2E4] mt-0.5">
                            {getEnergyLabel(habitDraft.energyCost, language)}
                          </div>
                        </div>
                      </div>

                      {habitDraft.unstickTip && (
                        <div className="pt-3 border-t border-[#DCEAD4] dark:border-[#263722] text-xs sm:text-sm">
                          <div className="text-[11px] font-bold text-[#3B7E10] dark:text-[#80D141] mb-1">
                            {t('voiceAdd.fieldUnstickTip')}
                          </div>
                          <p className="text-[#485B44] dark:text-[#9EB598] leading-relaxed">
                            {habitDraft.unstickTip}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {combinedText && (
                    <div className="pt-3 border-t border-[#DCEAD4] dark:border-[#263722] text-xs text-[#5A7055] dark:text-[#86A080] italic leading-relaxed">
                      “{combinedText}”
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Action Bar (Thumb Zone Below Text Box) */}
          <div className="shrink-0 sticky bottom-0 z-20 bg-[#F7FAF4]/95 dark:bg-[#121B11]/95 backdrop-blur-md px-4 sm:px-8 py-3 border-t border-[#DCEAD4] dark:border-[#22301F] flex items-center justify-between gap-2.5">
            {!hasDraft ? (
              <>
                <button
                  id={`btn-voice-record-${mode}`}
                  type="button"
                  onClick={toggleRecording}
                  disabled={isProcessing}
                  className={`min-h-[48px] px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] ${
                    isListening
                      ? 'flex-[1.2] sm:flex-none bg-[#FFE9E9] dark:bg-[#432125] text-[#B3261E] dark:text-[#F2B8B5] border border-[#B3261E]/40'
                      : !combinedText
                      ? 'flex-[1.25] sm:flex-none bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] shadow-md'
                      : 'flex-1 sm:flex-none bg-white dark:bg-[#1C281A] border border-[#DCEAD4] dark:border-[#263722] hover:bg-[#EDF6E8] dark:hover:bg-[#243421] text-[#151E14] dark:text-[#E8F2E4]'
                  }`}
                >
                  {isListening ? (
                    <>
                      <Square className="w-4 h-4 fill-current shrink-0" />
                      <span className="sm:hidden">{t('voiceAdd.stopShort', 'Stop')}</span>
                      <span className="hidden sm:inline">{t('voiceAdd.stopRecording')}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 shrink-0" />
                      <span>{t('voiceAdd.startRecording')}</span>
                    </>
                  )}
                </button>

                <button
                  id={`btn-voice-generate-${mode}`}
                  type="button"
                  onClick={handleGenerateWithAi}
                  disabled={!combinedText || isProcessing}
                  className={`min-h-[48px] px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141] ${
                    combinedText && !isListening
                      ? 'flex-[1.25] sm:flex-none bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] shadow-md active:scale-[0.98]'
                      : 'flex-1 sm:flex-none bg-[#E6EFE2] dark:bg-[#1E2B1C] text-[#3B4E37] dark:text-[#A4BAA0]'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="sm:hidden">{t('voiceAdd.generatingShort', 'Generating...')}</span>
                      <span className="hidden sm:inline">{t('voiceAdd.generating')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span className="sm:hidden">{t('voiceAdd.generateShort', 'Generate')}</span>
                      <span className="hidden sm:inline">{t('voiceAdd.generateBtn')}</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenInManualForm(true)}
                  className="flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-white dark:bg-[#1C281A] border border-[#DCEAD4] dark:border-[#263722] hover:bg-[#EDF6E8] text-[#151E14] dark:text-[#E8F2E4] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                >
                  <PenLine className="w-4 h-4" />
                  <span>{t('voiceAdd.editDetails')}</span>
                </button>
                <button
                  id={`btn-voice-save-${mode}`}
                  type="button"
                  onClick={handleSaveDirect}
                  className="flex-1 sm:flex-none min-h-[48px] px-6 py-2.5 rounded-xl bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{mode === 'journal' ? t('voiceAdd.saveJournal') : t('voiceAdd.saveHabit')}</span>
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
