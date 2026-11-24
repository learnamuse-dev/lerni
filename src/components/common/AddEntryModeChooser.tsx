import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PenLine, Mic, ChevronRight } from 'lucide-react';
import { soundEngine } from '../../utils/audioSynth';
import { useI18n } from '../../utils/i18n';

interface AddEntryModeChooserProps {
  isOpen: boolean;
  mode: 'journal' | 'habit';
  onClose: () => void;
  onSelectManual: () => void;
  onSelectVoice: () => void;
}

export const AddEntryModeChooser: React.FC<AddEntryModeChooserProps> = ({
  isOpen,
  mode,
  onClose,
  onSelectManual,
  onSelectVoice,
}) => {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const title = mode === 'journal' ? t('addChooser.journalTitle') : t('addChooser.habitTitle');

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => {
              soundEngine.playPop();
              onClose();
            }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
          />

          {/* Chooser Dialog Card */}
          <motion.div
            id={`add-mode-chooser-${mode}`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] bg-[#F7FAF4] dark:bg-[#121B11] border border-[#DCEAD4] dark:border-[#263722] shadow-2xl p-6 space-y-5"
          >
            {/* Header with single close button */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#151E14] dark:text-[#E8F2E4] leading-tight">
                  {title}
                </h2>
                <p className="text-xs sm:text-sm text-[#485B44] dark:text-[#9EB598] font-medium">
                  {t('addChooser.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onClose();
                }}
                className="min-w-[44px] min-h-[44px] -me-2 -mt-1 rounded-xl flex items-center justify-center text-[#485B44] dark:text-[#9EB598] hover:bg-[#EAEFE6] dark:hover:bg-[#1C281A] transition-colors cursor-pointer"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Two Large Option Cards */}
            <div className="space-y-3">
              {/* 1. Manual Addition */}
              <button
                id={`chooser-manual-${mode}`}
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onSelectManual();
                }}
                className="w-full min-h-[100px] p-5 rounded-2xl bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] hover:border-[#80D141] dark:hover:border-[#80D141]/70 text-start flex items-center gap-4 transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EDF6E8] dark:bg-[#202E1E] text-[#3B7E10] dark:text-[#80D141] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <PenLine className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base font-bold text-[#151E14] dark:text-[#E8F2E4]">
                    {t('addChooser.manualTitle')}
                  </div>
                  <p className="text-xs sm:text-sm text-[#485B44] dark:text-[#9EB598] font-medium mt-1 leading-relaxed">
                    {t('addChooser.manualDesc')}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#485B44] dark:text-[#9EB598] shrink-0 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </button>

              {/* 2. Voice-Assisted Addition */}
              <button
                id={`chooser-voice-${mode}`}
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onSelectVoice();
                }}
                className="w-full min-h-[100px] p-5 rounded-2xl bg-white dark:bg-[#182316] border border-[#80D141]/60 dark:border-[#80D141]/40 hover:border-[#80D141] text-start flex items-center gap-4 transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#80D141] text-[#0F2600] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <Mic className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base font-bold text-[#151E14] dark:text-[#E8F2E4]">
                    {t('addChooser.voiceTitle')}
                  </div>
                  <p className="text-xs sm:text-sm text-[#485B44] dark:text-[#9EB598] font-medium mt-1 leading-relaxed">
                    {t('addChooser.voiceDesc')}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#3B7E10] dark:text-[#80D141] shrink-0 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
