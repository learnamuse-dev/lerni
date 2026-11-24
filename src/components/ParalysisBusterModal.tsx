import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { ArrowLeft, Dices, Play } from 'lucide-react';
import { BujoEntry, Habit, EnergyLevel, ENERGY_LEVELS } from '../types';
import { soundEngine } from '../utils/audioSynth';
import { getTodayKey } from '../utils/dateUtils';
import { useI18n, toPersianDigits } from '../utils/i18n';

interface ParalysisBusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: BujoEntry[];
  habits: Habit[];
  currentEnergy?: EnergyLevel;
  onStartFocus: (taskTitle: string, minutes: number) => void;
}

export const ParalysisBusterModal: React.FC<ParalysisBusterModalProps> = ({
  isOpen,
  onClose,
  entries,
  habits,
  currentEnergy = 'medium',
  onStartFocus,
}) => {
  const { t, language } = useI18n();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSpinInterval = () => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  };

  // Lock background scroll & hide FAB while full-screen modal is open
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('app:modal-state-change', { detail: { isOpen } })
    );
    if (!isOpen) {
      clearSpinInterval();
      setIsSpinning(false);
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      clearSpinInterval();
    };
  }, [isOpen]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundEngine.playPop();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const todayKey = getTodayKey();
  const energyMeta = ENERGY_LEVELS.find((l) => l.id === currentEnergy) || ENERGY_LEVELS[1];
  const energyLabel = t(
    `energy.${currentEnergy === 'high' ? 'high' : currentEnergy === 'low' ? 'low' : 'med'}` as any,
    energyMeta.label
  );

  // Open tasks and uncompleted habits that match current user energy level
  const candidateTasks: string[] = [
    ...entries
      .filter((e) => e.type === 'task' && e.status === 'open' && (e.energyCost || 'medium') === currentEnergy)
      .map((e) => e.content),
    ...habits
      .filter(
        (h) =>
          !h.completedDates.includes(todayKey) &&
          (h.energyCost || 'medium') === currentEnergy
      )
      .map((h) => h.title),
  ];

  const countFormatted = language === 'fa' ? toPersianDigits(candidateTasks.length) : candidateTasks.length;
  const itemsText = candidateTasks.length === 1 ? t('paralysis.item', 'item') : t('paralysis.items', 'items');

  const handleSpinWheel = () => {
    if (candidateTasks.length === 0) return;
    clearSpinInterval();
    setIsSpinning(true);
    soundEngine.playPop();

    let counter = 0;
    spinIntervalRef.current = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * candidateTasks.length);
      setSelectedTask(candidateTasks[randomIdx]);
      soundEngine.playPop();
      counter++;
      if (counter > 15) {
        clearSpinInterval();
        setIsSpinning(false);
        soundEngine.playGentleChime();
        try {
          confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.65 },
          });
        } catch (e) {}
      }
    }, 100);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="paralysis-buster-fullscreen"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          dir={language === 'fa' ? 'rtl' : 'ltr'}
          role="dialog"
          aria-modal="true"
          aria-labelledby="paralysis-buster-title"
          className="fixed inset-0 z-50 bg-[#F8FAF5] dark:bg-[#141C13] flex flex-col overflow-hidden text-start"
        >
          {/* Top Header Bar */}
          <div className="w-full bg-[#EDF6E8] dark:bg-[#182316] border-b border-[#D8E8D0] dark:border-[#263722] px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onClose();
                }}
                aria-label={t('common.back', 'Back')}
                className="min-h-[44px] min-w-[44px] px-2.5 -ms-2 rounded-xl text-[#485B44] dark:text-[#9EB598] hover:bg-[#DCEAD4] dark:hover:bg-[#2A3D26] transition-colors flex items-center justify-center gap-1.5 font-medium text-sm shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="hidden sm:inline">{t('common.back', 'Back')}</span>
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-600 dark:bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Dices className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="paralysis-buster-title"
                    className="font-display text-base sm:text-lg font-bold text-[#151E14] dark:text-[#E8F2E4] truncate"
                  >
                    {t('paralysis.title', 'Anti-Paralysis Picker')}
                  </h2>
                  <p className="text-xs text-[#485B44] dark:text-[#9EB598] font-medium truncate">
                    {t('paralysis.sub', 'Bypass decision fatigue — do just ONE task')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Centered Full-Screen Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10 flex flex-col items-center justify-center">
            <div className="w-full max-w-xl my-auto space-y-6 text-center">
              {/* Current Energy & Candidate Count */}
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-[#3B7E10] dark:text-[#80D141]">
                <span>{t('paralysis.currentEnergy', 'Current Energy:')}</span>
                <span>{energyMeta.icon}</span>
                <span>{energyLabel}</span>
                <span aria-hidden="true" className="opacity-50">·</span>
                <span className="tabular-nums text-[#485B44] dark:text-[#9EB598]">
                  {countFormatted} {itemsText}
                </span>
              </div>

              <p className="text-sm text-[#485B44] dark:text-[#9EB598] leading-relaxed font-medium max-w-lg mx-auto">
                {t(
                  'paralysis.desc',
                  'When staring at a long to-do list makes your brain lock up, eliminate the choice. Let the algorithm pick your next 5-minute action tailored to your current energy.'
                )}
              </p>

              {/* Selected Task Spotlight */}
              <div className="p-7 sm:p-9 rounded-3xl bg-[#EDF6E8] dark:bg-[#1C281A] border border-[#DCEAD4] dark:border-[#263722] min-h-[140px] flex flex-col items-center justify-center shadow-xs">
                {selectedTask ? (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#3B7E10] dark:text-[#80D141]">
                      {t('paralysis.singleFocus', 'Your Single Focus Right Now:')}
                    </span>
                    <div className="font-display text-xl sm:text-2xl font-bold text-[#151E14] dark:text-[#E8F2E4] break-words">
                      "{selectedTask}"
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-[#5A6D55] dark:text-[#9EB598] font-medium">
                    {t('paralysis.placeholder', 'Tap "Spin to Pick" below to break the freeze...')}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 max-w-md mx-auto w-full">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isSpinning || candidateTasks.length === 0}
                  onClick={handleSpinWheel}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                >
                  <Dices className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                  <span>
                    {isSpinning
                      ? t('paralysis.spinning', 'Picking randomly...')
                      : t('paralysis.spinBtn', '🎲 Spin to Pick 1 Task')}
                  </span>
                </motion.button>

                {selectedTask && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      soundEngine.playPop();
                      onStartFocus(selectedTask, 5);
                      onClose();
                    }}
                    className="w-full min-h-[48px] py-3.5 px-6 rounded-full bg-[#80D141] hover:bg-[#72BF36] text-[#0F2600] font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80D141]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{t('paralysis.startSprint', 'Start 5-Min Dopamine Sprint')}</span>
                  </motion.button>
                )}
              </div>

              {candidateTasks.length === 0 && (
                <div className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-bold p-3.5 bg-[#EDF6E8] dark:bg-[#1C281A] rounded-2xl border border-[#DCEAD4] dark:border-[#263722] max-w-md mx-auto">
                  {t('paralysis.noTasks', 'No open tasks match your current energy. Add an item or adjust energy level.')}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
