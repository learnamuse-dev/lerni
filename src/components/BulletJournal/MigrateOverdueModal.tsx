import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Star,
  Trash2,
  CheckCheck,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { BujoEntry, ENERGY_LEVELS, SpaceItem } from '../../types';
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
  spaceItems?: SpaceItem[];
}

export const MigrateOverdueModal: React.FC<MigrateOverdueModalProps> = ({
  isOpen,
  onClose,
  overdueTasks,
  onMigrateEntries,
  onCompleteEntry,
  onDeleteEntry,
  spaceItems = [],
}) => {
  const { t, language, isRtl } = useI18n();
  const isPersian = language === 'fa';
  const todayStr = getTodayKey();
  const tomorrowStr = shiftDate(todayStr, 1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTargetDate, setBatchTargetDate] = useState<string>(todayStr);

  // Sync selection whenever modal opens
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

  // Lock background scroll & hide FAB while full-screen modal is open
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('app:modal-state-change', { detail: { isOpen } })
    );
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
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

  // Lookup map for linked Work/Study items
  const spaceItemMap = useMemo(() => {
    const map = new Map<string, SpaceItem>();
    for (const item of spaceItems) {
      map.set(item.id, item);
    }
    return map;
  }, [spaceItems]);

  // Group overdue tasks chronologically by original date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, BujoEntry[]> = {};
    for (const task of overdueTasks) {
      if (!groups[task.date]) groups[task.date] = [];
      groups[task.date].push(task);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [overdueTasks]);

  if (typeof document === 'undefined') return null;

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

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="migrate-overdue-fullscreen"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          dir={isRtl ? 'rtl' : 'ltr'}
          role="dialog"
          aria-modal="true"
          aria-labelledby="migrate-overdue-title"
          className="fixed inset-0 z-50 w-full h-full bg-[#F7FAF4] dark:bg-[#121B11] text-[#151E14] dark:text-[#E8F2E4] flex flex-col overflow-hidden text-start"
        >
          {/* Sticky Full-Screen Top Bar */}
          <div className="shrink-0 sticky top-0 z-20 bg-[#EDF6E8]/95 dark:bg-[#182316]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 border-b border-[#DCEAD4] dark:border-[#263722] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onClose();
                }}
                aria-label={t('common.back', 'Back')}
                className="min-h-[40px] p-2 -ms-2 rounded-xl text-[#485B44] dark:text-[#9EB598] hover:bg-[#DCEAD4] dark:hover:bg-[#2A3D26] transition-colors flex items-center gap-1.5 font-medium text-sm shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="hidden sm:inline">{t('common.back', 'Back')}</span>
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="migrate-overdue-title"
                    className="font-display text-base sm:text-lg font-extrabold text-[#151E14] dark:text-[#E8F2E4] leading-tight truncate"
                  >
                    {t('journal.migrateModalTitle')}
                  </h2>
                  <p className="text-xs text-[#485B44] dark:text-[#9EB598] font-medium mt-0.5 tabular-nums truncate">
                    {t('journal.migrateModalSub').replace('{count}', formatNum(overdueTasks.length))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Selection & Target Date Sub-Toolbar */}
          <div className="shrink-0 bg-[#F6FBF3] dark:bg-[#1A2618] border-b border-[#DCEAD4] dark:border-[#263722] px-4 sm:px-8 py-3">
            <div className="max-w-3xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
                    className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
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
                    className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
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
                  buttonClassName="py-1.5 px-2.5 rounded-xl text-xs min-h-[40px]"
                />
              </div>
            </div>
          </div>

          {/* Scrollable Overdue Task List Grouped by Original Date */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto w-full space-y-6">
              {groupedByDate.map(([dateStr, groupTasks]) => (
                <div key={dateStr} className="space-y-2.5">
                  {/* Date Divider */}
                  <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#DCEAD4]/80 dark:border-[#263722]/80">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#485B44] dark:text-[#9EB598]">
                      <CalendarIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[#151E14] dark:text-[#E8F2E4]">
                        {getRelativeDayLabel(dateStr, language)}
                      </span>
                      <span className="opacity-60" aria-hidden="true">·</span>
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
                  <div className="space-y-2.5">
                    {groupTasks.map((task) => {
                      const isChecked = selectedIds.has(task.id);
                      const energyMeta =
                        ENERGY_LEVELS.find((l) => l.id === task.energyCost) || ENERGY_LEVELS[0];
                      const linkedSpaceItem = task.linkedItemId
                        ? spaceItemMap.get(task.linkedItemId)
                        : undefined;
                      const LinkedIcon =
                        linkedSpaceItem?.space === 'work' ? Briefcase : GraduationCap;

                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
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
                              className="w-10 h-10 -m-1.5 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
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
                                    <span className="opacity-50" aria-hidden="true">·</span>
                                    <span>{getCategoryLabel(task.category, language)}</span>
                                  </>
                                )}
                                {(task.time || task.durationMinutes) && (
                                  <>
                                    <span className="opacity-50" aria-hidden="true">·</span>
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
                                {linkedSpaceItem && (
                                  <>
                                    <span className="opacity-50" aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 font-semibold text-[#151E14] dark:text-[#E8F2E4]">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{
                                          backgroundColor:
                                            linkedSpaceItem.color ||
                                            (linkedSpaceItem.space === 'work' ? '#80D141' : '#3B82F6'),
                                        }}
                                        aria-hidden="true"
                                      />
                                      <LinkedIcon className="w-3 h-3 opacity-80 shrink-0" />
                                      <span>{linkedSpaceItem.title}</span>
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
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#E8F8D8] dark:bg-[#1E3800] hover:bg-[#D5F7B8] text-[#1C3700] dark:text-[#A2EB68] text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                              title={t('journal.moveToToday')}
                            >
                              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                              <span>{t('journal.jumpToday')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onMigrateEntries([task.id], tomorrowStr)}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EDF6E8] dark:bg-[#202E1E] hover:bg-[#DCEAD4] text-[#3B4E37] dark:text-[#B6CCB0] text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                              title={t('journal.moveToTomorrow')}
                            >
                              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                              <span>{t('journal.tomorrow')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onCompleteEntry(task)}
                              className="w-10 h-10 rounded-xl bg-[#EDF6E8] dark:bg-[#202E1E] hover:bg-[#80D141] text-[#3B7E10] dark:text-[#80D141] hover:text-[#0F2600] flex items-center justify-center transition-colors cursor-pointer"
                              title={t('journal.markDoneAlready')}
                              aria-label={t('journal.markDoneAlready')}
                            >
                              <CheckCheck className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteEntry(task.id)}
                              className="w-10 h-10 rounded-xl text-[#B3261E] hover:bg-[#FFE9E9] dark:hover:bg-[#432125] flex items-center justify-center transition-colors cursor-pointer"
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
          </div>

          {/* Sticky Bottom Batch Action Bar */}
          <div className="shrink-0 border-t border-[#DCEAD4] dark:border-[#263722] bg-[#EDF6E8]/95 dark:bg-[#182316]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 pb-[max(env(safe-area-inset-bottom),0.875rem)]">
            <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-[#485B44] dark:text-[#9EB598] truncate">
                <span className="font-bold text-[#151E14] dark:text-[#E8F2E4] tabular-nums">
                  {formatNum(selectedIds.size)}/{formatNum(overdueTasks.length)}
                </span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>
                  {t('journal.migrateTo')}{' '}
                  <strong className="text-[#151E14] dark:text-[#E8F2E4]">
                    {batchTargetDate === todayStr
                      ? t('journal.jumpToday')
                      : batchTargetDate === tomorrowStr
                      ? t('journal.tomorrow')
                      : formatDateDisplay(batchTargetDate, {
                          showDayOfWeek: false,
                          includeYear: false,
                          lang: language,
                        })}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleBatchMigrate}
                disabled={selectedIds.size === 0}
                className="min-h-[44px] px-5 sm:px-6 py-2.5 rounded-full bg-[#80D141] hover:bg-[#72BF36] disabled:opacity-40 text-[#0F2600] text-sm font-extrabold shadow-xs flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                <span className="tabular-nums">
                  {t('journal.migrateSelected').replace('{count}', formatNum(selectedIds.size))}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
