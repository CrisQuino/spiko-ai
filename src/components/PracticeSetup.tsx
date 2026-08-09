'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LANGUAGE_LIST, DEFAULT_LANGUAGE, type LanguageCode } from '@/lib/languages';
import {
  getJobDescriptions,
  createJobDescription,
  type JobDescription,
} from '@/lib/supabase';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string | null;
};

export default function PracticeSetup({ isOpen, onClose, companyId }: Props) {
  const router = useRouter();

  const [language, setLanguage] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [selectedJdId, setSelectedJdId] = useState<string>('');
  const [loadingJds, setLoadingJds] = useState(true);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    (async () => {
      setLoadingJds(true);
      const list = await getJobDescriptions();
      if (!active) return;
      setJds(list);
      // Preselect the most recent JD; if none exist, open the "add" form.
      if (list.length > 0) {
        setSelectedJdId((prev) => prev || list[0].id);
        setShowNewForm(false);
      } else {
        setShowNewForm(true);
      }
      setLoadingJds(false);
    })();

    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleSaveJd = async () => {
    setError(null);
    if (!newTitle.trim() || !newContent.trim()) {
      setError('Add a title and paste the job description text.');
      return;
    }
    setSaving(true);
    const created = await createJobDescription({
      title: newTitle,
      content: newContent,
      companyId: companyId ?? null,
    });
    setSaving(false);

    if (!created) {
      setError('Could not save the job description. Please try again.');
      return;
    }

    setJds((prev) => [created, ...prev]);
    setSelectedJdId(created.id);
    setNewTitle('');
    setNewContent('');
    setShowNewForm(false);
  };

  const handleStart = () => {
    if (!selectedJdId) {
      setError('Select or add a job description to start.');
      return;
    }
    const params = new URLSearchParams({ lang: language, jd: selectedJdId });
    router.push(`/demo?${params.toString()}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold font-mono">
                <span className="text-gray-400">// </span>practice_setup()
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-700 font-mono text-sm"
                aria-label="Close"
              >
                close()
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Language */}
              <div>
                <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                  <span className="text-gray-400">1. </span>language
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGE_LIST.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLanguage(l.code)}
                      className={`flex flex-col items-center py-3 rounded-xl border-2 font-mono text-sm transition-all ${
                        language === l.code
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <span className="text-2xl mb-1">{l.flag}</span>
                      {l.nativeLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job description */}
              <div>
                <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                  <span className="text-gray-400">2. </span>job_description
                </label>

                {loadingJds ? (
                  <p className="text-sm text-gray-500 font-mono py-2">// loading_jds()...</p>
                ) : (
                  <>
                    {jds.length > 0 && !showNewForm && (
                      <div className="space-y-2">
                        <select
                          value={selectedJdId}
                          onChange={(e) => setSelectedJdId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 font-mono text-sm focus:border-emerald-500 focus:outline-none"
                        >
                          {jds.map((jd) => (
                            <option key={jd.id} value={jd.id}>
                              {jd.title}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            setShowNewForm(true);
                            setError(null);
                          }}
                          className="text-cyan-600 hover:text-emerald-600 font-mono text-xs"
                        >
                          + add_new_jd()
                        </button>
                      </div>
                    )}

                    {showNewForm && (
                      <div className="space-y-3">
                        {jds.length === 0 && (
                          <p className="text-xs text-gray-500 font-mono">
                            // no job descriptions yet — add one to generate scenarios
                          </p>
                        )}
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Title (e.g. Senior DevOps Engineer)"
                          className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 font-mono text-sm focus:border-emerald-500 focus:outline-none"
                        />
                        <textarea
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          placeholder="Paste the full job description here..."
                          rows={6}
                          className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 font-mono text-sm focus:border-emerald-500 focus:outline-none resize-y"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleSaveJd}
                            disabled={saving}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-mono text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                          >
                            {saving ? 'saving()...' : 'save_jd()'}
                          </button>
                          {jds.length > 0 && (
                            <button
                              onClick={() => {
                                setShowNewForm(false);
                                setError(null);
                              }}
                              className="text-gray-500 hover:text-gray-700 font-mono text-sm"
                            >
                              cancel()
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 font-mono">// {error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleStart}
                disabled={!selectedJdId || showNewForm}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white rounded-xl font-mono font-semibold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &gt; start_practice()
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
