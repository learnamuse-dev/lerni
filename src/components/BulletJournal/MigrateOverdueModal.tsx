import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArrowRight,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Star,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { BujoEntry, ENERGY_LEVELS } from '../../types';
import {
  getTodayKey,
  shiftDate,
  formatDateDisplay,
  getRelativeDayLabel,
} from '../../utils/dateUtils';
import { soundEngine } from '../../utils/audioSynth';
import {
  useI18n,
  getCategoryLabel,
  getEnergyLabel,
  toPersianDigits,
  formatMinutes,
} from '../../utils/i18n';
import { getLocalizedTaskTitle } from '../UnstickModal';
import { MaterialExpressiveDatePicker } from '../common/MaterialExpressiveDatePicker';

interface MigrateOverdueModalProps {
  isOpen: boolean;
  onClose: () => void;
  overdueTasks: BujoEntry[];
  onMigrateEntries: (entryIds: string[], targetDate: string) => void;
  onCompleteEntry: (entry: BujoEntry) => void;
  onDeleteEntry: (id: string) => void;
}

export const MigrateOverdueModal: React.FC<MigrateOverdueModalProps> = ({
  isOpen,
  onClose,
  overdueTasks,
  onMigrateEntries,
  onCompleteEntry,
  onDeleteEntry,
}) => {
  const { t, language } = useI18n();
  const isPersian = language === 'fa';
  const todayStr = getTodayKey();
  const tomorrowStr = shiftDate(todayStr, 1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTargetDate, setBatchTargetDate] = useState<string>(todayStr);

  // Sync selection whenever modal opens or overdueTasks changes
  useEffect(() => {
    if (isOpen) {
      setBatchTargetDate(todayStr);
      setSelectedIds(new Set(overdueTasks.map((task) => task.id)));
    }
  }, [isOpen, todayStr]);

  // Keep selectedIds pruned to existing overdueTasks
  useEffect(() => {
    if (!isOpen) return;
    const validIds = new Set(overdueTasks.map((task) => task.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [overdueTasks, isOpen]);

  // Auto-close cleanly when all overdue tasks are handled while open
  useEffect(() => {
    if (isOpen && overdueTasks.length === 0) {
      onClose();
    }
  }, [isOpen, overdueTasks.length, onClose]);

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

  // Group overdue tasks chronologically by original date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, BujoEntry[]> = {};
    for (const task of overdueTasks) {
      if (!groups[task.date]) groups[task.date] = [];
      groups[task.date].push(task);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [overdueTasks]);

  if (!isOpen) return null;

  const allSelected =
    overdueTasks.length > 0 && selectedIds.size === overdueTasks.length;

  const handleToggleSelectAll = () => {
    soundEngine.playPop();
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(overdueTasks.map((task) => task.id)));
    }
  };

  const handleToggleOne = (id: string) => {
    soundEngine.playPop();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchMigrate = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    onMigrateEntries(ids, batchTargetDate || todayStr);
  };

  const formatNum = (n: number) => (isPersian ? toPersianDigits(n) : String(n));

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs"
        onClick={() => {
          soundEngine.playPop();
          onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="migrate-overdue-title"
          className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-[28px] bg-white dark:bg-[#182316] border border-[#DCEAD4] dark:border-[#263722] shadow-2xl overflow-hidden"
        >
          {/* Header (Single Close Dismiss) */}
          <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#DCEAD4] dark:border-[#263722] flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </div>
              <div className="min-w-0">
                <h3
                  id="migrate-overdue-title"
                  className="font-display text-base sm:text-lg font-extrabold text-[#151E14] dark:text-[#E8F2E4] leading-snug"
                >
                  {t('journal.migrateModalTitle')}
                </h3>
                <p className="text-xs text-[#485B44] dark:text-[#9EB598] font-medium mt-0.5 tabular-nums">
                  {t('journal.migrateModalSub').replace('{count}', formatNum(overdueTasks.length))}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playPop();
                onClose();
              }}
              aria-label={t('common.close')}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#202C1E] transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Batch Selection & Target Date Bar */}
          <div className="px-5 sm:px-6 py-3.5 bg-[#F6FBF3] dark:bg-[#1C281A] border-b border-[#DCEAD4] dark:border-[#263722] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-2.5 text-xs font-bold text-[#151E14] dark:text-[#E8F2E4] min-h-[40px] px-2 -mx-2 rounded-xl hover:bg-[#EDF6E8] dark:hover:bg-[#243422] transition-colors self-start cursor-pointer"
            >
              <span
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  allSelected
                    ? 'bg-[#80D141] border-[#80D141] text-[#0F2600]'
                    : 'bg-white dark:bg-[#182316] border-[#B6CCB0] dark:border-[#395035]'
                }`}
              >
                {allSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </span>
              <span className="tabular-nums">
                {allSelected ? t('journal.deselectAll') : t('journal.selectAll')} (
                {formatNum(selectedIds.size)}/{formatNum(overdueTasks.length)})
              </span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 rounded-xl bg-white dark:bg-[#182316] p-1 border border-[#DCEAD4] dark:border-[#263722]">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setBatchTargetDate(todayStr);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    batchTargetDate === todayStr
                      ? 'bg-[#80D141] text-[#0F2600]'
                      : 'text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#202E1E]'
                  }`}
                >
                  {t('journal.jumpToday')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setBatchTargetDate(tomorrowStr);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    batchTargetDate === tomorrowStr
                      ? 'bg-[#80D141] text-[#0F2600]'
                      : 'text-[#485B44] dark:text-[#9EB598] hover:bg-[#EDF6E8] dark:hover:bg-[#202E1E]'
                  }`}
                >
                  {t('journal.tomorrow')}
                </button>
              </div>

              <MaterialExpressiveDatePicker
                value={batchTargetDate}
                onChange={(newDate) => setBatchTargetDate(newDate)}
                label={t('journal.targetDate')}
                buttonClassName="py-1.5 px-2.5 rounded-xl text-xs"
              />

              <button
                type="button"
                onClick={handleBatchMigrate}
                disabled={selectedIds.size === 0}
                className="min-h-[40px] px-4 py-2 rounded-full bg-[#80D141] hover:bg-[#72BF36] disabled:opacity-40 text-[#0F2600] text-xs font-extrabold shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                <span className="tabular-nums">
                  {t('journal.migrateSelected').replace('{count}', formatNum(selectedIds.size))}
                </span>
              </button>
            </div>
          </div>

          {/* Scrollable Overdue Task List Grouped by Original Date */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {groupedByDate.map(([dateStr, groupTasks]) => (
              <div key={dateStr} className="space-y-2">
                {/* Date Divider */}
                <div className="flex items-center justify-between px-1 pb-1 border-b border-[#DCEAD4]/70 dark:border-[#263722]/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#485B44] dark:text-[#9EB598]">
                    <CalendarIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-[#151E14] dark:text-[#E8F2E4]">
                      {getRelativeDayLabel(dateStr, language)}
                    </span>
                    <span className="opacity-60">·</span>
                    <span>
                      {formatDateDisplay(dateStr, {
                        showDayOfWeek: true,
                        includeYear: false,
                        lang: language,
                      })}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#485B44] dark:text-[#9EB598] tabular-nums">
                    {formatNum(groupTasks.length)}{' '}
                    {groupTasks.length === 1 ? t('journal.item') : t('journal.items')}
                  </span>
                </div>

                {/* Task Rows */}
                <div className="space-y-2">
                  {groupTasks.map((task) => {
                    const isChecked = selectedIds.has(task.id);
                    const energyMeta =
                      ENERGY_LEVELS.find((l) => l.id === task.energyCost) || ENERGY_LEVELS[0];

                    return (
                      <div
                        key={task.id}
                        className={`p-3.5 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-[#F3FAEE] dark:bg-[#1E2E1B] border-[#80D141]/60 dark:border-[#4D8628]'
                            : 'bg-white dark:bg-[#1A2618] border-[#DCEAD4] dark:border-[#263722]'
                        }`}
                      >
                        {/* Left: Checkbox + Content + Inline Meta */}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleOne(task.id)}
                            aria-label={getLocalizedTaskTitle(task.content, isPersian)}
                            className="w-9 h-9 -m-1 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <span
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                isChecked
                                  ? 'bg-[#80D141] border-[#80D141] text-[#0F2600]'
                                  : 'bg-white dark:bg-[#182316] border-[#B6CCB0] dark:border-[#395035]'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </span>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {task.isPriority && (
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                              )}
                              <span className="text-sm font-bold text-[#151E14] dark:text-[#E8F2E4] break-words leading-snug">
                                {getLocalizedTaskTitle(task.content, isPersian)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-[#485B44] dark:text-[#9EB598] font-medium flex-wrap">
                              <span>
                                {energyMeta.icon} {getEnergyLabel(energyMeta.id, language)}
                              </span>
                              {task.category && (
                                <>
                                  <span className="opacity-50">·</span>
                                  <span>{getCategoryLabel(task.category, language)}</span>
                                </>
                              )}
                              {(task.time || task.durationMinutes) && (
                                <>
                                  <span className="opacity-50">·</span>
                                  <span className="inline-flex items-center gap-1 tabular-nums">
                                    <Clock className="w-3 h-3" />
                                    {task.time
                                      ? isPersian
                                        ? toPersianDigits(task.time)
                                        : task.time
                                      : ''}
                                    {task.time && task.durationMinutes ? ' • ' : ''}
                                    {task.durationMinutes
                                      ? formatMinutes(task.durationMinutes, language)
                                      : ''}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: 1-tap Individual Triage Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                          <button
                            type="button"
                            onClick={() => onMigrateEntries([task.id], todayStr)}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[#E8F8D8] dark:bg-[#1E3800] hover:bg-[#D5F7B8] text-[#1C3700] dark:text-[#A2EB68] text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            title={t('journal.moveToToday')}
                          >
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                            <span>{t('journal.jumpToday')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onMigrateEntries([task.id], tomorrowStr)}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[#EDF6E8] dark:bg-[#202E1E] hover:bg-[#DCEAD4] text-[#3B4E37] dark:text-[#B6CCB0] text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            title={t('journal.moveToTomorrow')}
                          >
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                            <span>{t('journal.tomorrow')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onCompleteEntry(task)}
                            className="w-9 h-9 rounded-xl bg-[#EDF6E8] dark:bg-[#202E1E] hover:bg-[#80D141] text-[#3B7E10] dark:text-[#80D141] hover:text-[#0F2600] flex items-center justify-center transition-colors cursor-pointer"
                            title={t('journal.markDoneAlready')}
                            aria-label={t('journal.markDoneAlready')}
                          >
                            <CheckCheck className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteEntry(task.id)}
                            className="w-9 h-9 rounded-xl text-[#B3261E] hover:bg-[#FFE9E9] dark:hover:bg-[#432125] flex items-center justify-center transition-colors cursor-pointer"
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
