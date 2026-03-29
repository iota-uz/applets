import { useEffect, useCallback, useMemo } from 'react';
import { Lightning, Brain } from '@phosphor-icons/react';
import { useChatSession } from '../context/ChatContext';
import { useIotaContext } from '../context/IotaContext';

interface ModelEntry {
  id: string
  label: string
  default?: boolean
}

export function ModelSelector() {
  const { model, setModel } = useChatSession();
  const context = useIotaContext();

  const models: ModelEntry[] = useMemo(
    () => context.extensions?.llm?.models ?? [],
    [context.extensions?.llm?.models],
  );

  const defaultModel = models.find((m) => m.default) ?? models[0];
  const currentModel = model ?? defaultModel?.id;

  // Set default model on mount
  useEffect(() => {
    if (!model && defaultModel) {
      setModel(defaultModel.id);
    }
  }, [model, defaultModel, setModel]);

  // Keyboard shortcut: Cmd+Shift+M to rotate
  const rotateModel = useCallback(() => {
    const currentIndex = models.findIndex((m) => m.id === currentModel);
    const nextIndex = (currentIndex + 1) % models.length;
    setModel(models[nextIndex].id);
  }, [currentModel, models, setModel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        rotateModel();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [rotateModel]);

  // Don't render if less than 2 models
  if (models.length < 2) {return null;}

  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
        {models.map((m) => {
          const isActive = m.id === currentModel;
          const isFast = m.label === 'Fast';
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              className={`
                flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150
                ${
                  isActive
                    ? isFast
                      ? 'bg-white text-amber-600 shadow-sm dark:bg-gray-700 dark:text-amber-400'
                      : 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {isFast ? <Lightning size={13} weight="fill" /> : <Brain size={13} weight="fill" />}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
      <span className="hidden select-none text-[10px] text-gray-400 sm:block dark:text-gray-500">
        {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}{'\u21E7'}M
      </span>
    </div>
  );
}
