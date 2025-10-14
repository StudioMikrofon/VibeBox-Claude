import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SessionSettings } from '../types/session';

interface GuestSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SessionSettings;
  onSave: (newSettings: SessionSettings) => Promise<void>;
}

export default function GuestSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: GuestSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<SessionSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(localSettings);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-purple-500/20">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            ⚙️ Room Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          
          {/* Crossfade Duration */}
          <div className="space-y-3">
            <label className="text-white font-semibold flex items-center justify-between">
              <span>🎚️ Crossfade Duration</span>
              <span className="text-purple-400">{localSettings.crossfadeDuration || 0}s</span>
            </label>
            <input
              type="range"
              min="0"
              max="15"
              value={localSettings.crossfadeDuration || 0}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                ...localSettings,
                crossfadeDuration: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none 
                       [&::-webkit-slider-thumb]:w-5 
                       [&::-webkit-slider-thumb]:h-5 
                       [&::-webkit-slider-thumb]:rounded-full 
                       [&::-webkit-slider-thumb]:bg-purple-500
                       [&::-webkit-slider-thumb]:shadow-lg
                       [&::-webkit-slider-thumb]:shadow-purple-500/50"
            />
            <p className="text-gray-400 text-sm">
              Smooth transition between songs (0 = instant skip)
            </p>
          </div>

          <div className="border-t border-white/10"></div>

          {/* Manual Skip Crossfade Duration */}
          <div className="space-y-3">
            <label className="text-white font-semibold flex items-center justify-between">
              <span>⏭️ Manual Skip Crossfade</span>
              <span className="text-purple-400">{localSettings.manualSkipCrossfade || 3}s</span>
            </label>
            <input
              type="range"
              min="0"
              max="5"
              value={localSettings.manualSkipCrossfade || 3}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                ...localSettings,
                manualSkipCrossfade: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none 
                       [&::-webkit-slider-thumb]:w-5 
                       [&::-webkit-slider-thumb]:h-5 
                       [&::-webkit-slider-thumb]:rounded-full 
                       [&::-webkit-slider-thumb]:bg-blue-500
                       [&::-webkit-slider-thumb]:shadow-lg
                       [&::-webkit-slider-thumb]:shadow-blue-500/50"
            />
            <p className="text-gray-400 text-sm">
              Crossfade duration when using Next button (0 = instant)
            </p>
          </div>

          <div className="border-t border-white/10"></div>

          {/* Voting Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">🗳️ Voting</h3>
            
            <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.votingEnabled || false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                  ...localSettings,
                  votingEnabled: e.target.checked,
                  allowVoting: e.target.checked
                })}
                className="w-5 h-5 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
              />
              <span className="text-white">Enable voting on songs</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoSkipNegative || false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                  ...localSettings,
                  autoSkipNegative: e.target.checked
                })}
                className="w-5 h-5 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
              />
              <span className="text-white">Auto-skip on negative votes</span>
            </label>

            {localSettings.autoSkipNegative && (
              <div className="ml-8 space-y-2">
                <label className="text-gray-300 text-sm">
                  Skip threshold
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="-10"
                    max="-1"
                    value={localSettings.autoSkipThreshold || -3}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                      ...localSettings,
                      autoSkipThreshold: parseInt(e.target.value)
                    })}
                    className="w-24 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                  />
                  <span className="text-gray-400 text-sm">negative votes</span>
                </div>
                <p className="text-gray-500 text-xs">
                  Song skips when vote count reaches this number
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-white/10"></div>

          {/* Queue Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">📋 Queue</h3>

            <div className="space-y-2">
              <label className="text-white text-sm">Max songs per guest</label>
              <input
                type="number"
                min="1"
                max="20"
                value={localSettings.maxSongsPerGuest || 5}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                  ...localSettings,
                  maxSongsPerGuest: parseInt(e.target.value)
                })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-white text-sm">Who can add songs?</label>
              <select
                value={localSettings.queuePermission || 'all'}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLocalSettings({
                  ...localSettings,
                  queuePermission: e.target.value as 'all' | 'host'
                })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer"
              >
                <option value="all">👥 Everyone</option>
                <option value="host">👑 Host Only</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-white text-sm">Max queue size</label>
              <input
                type="number"
                min="5"
                max="100"
                value={localSettings.maxQueueSize || 50}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                  ...localSettings,
                  maxQueueSize: parseInt(e.target.value)
                })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>

            <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.allowDuplicates || false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSettings({
                  ...localSettings,
                  allowDuplicates: e.target.checked
                })}
                className="w-5 h-5 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
              />
              <span className="text-white">Allow duplicate songs in queue</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all font-medium shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
