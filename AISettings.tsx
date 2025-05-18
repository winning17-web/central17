import React from 'react';

interface AISettingsProps {
  settings: {
    matchAutomation: {
      enabled: boolean;
      autoStart: boolean;
      autoEnd: boolean;
      resultVerification: 'ai-only' | 'ai-with-human-review' | 'human-only';
    };
    screenshotVerification: {
      enabled: boolean;
      confidenceThreshold: number;
      requireHumanReview: boolean;
    };
  };
  onSettingsChange: (newSettings: any) => void;
  userRole: 'admin' | 'moderator' | 'community';
}

export default function AISettings({ settings, onSettingsChange, userRole }: AISettingsProps) {
  const handleToggle = (section: string, field: string) => {
    const newSettings = { ...settings };
    newSettings[section][field] = !newSettings[section][field];
    onSettingsChange(newSettings);
  };

  const handleSelectChange = (section: string, field: string, value: string) => {
    const newSettings = { ...settings };
    newSettings[section][field] = value;
    onSettingsChange(newSettings);
  };

  const handleSliderChange = (section: string, field: string, value: number) => {
    const newSettings = { ...settings };
    newSettings[section][field] = value;
    onSettingsChange(newSettings);
  };

  // Determine which settings are editable based on user role
  const canEditAll = userRole === 'admin';
  const canEditVerification = canEditAll || userRole === 'moderator';

  return (
    <div className="card p-6">
      <h2 className="header">The Referee AI Settings</h2>
      
      <div className="mb-6">
        <h3 className="subheader">Match Automation</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-white">Enable Match Automation</label>
            <div 
              className={`w-12 h-6 rounded-full relative ${settings.matchAutomation.enabled ? 'bg-electric-blue' : 'bg-darker-bg'} transition-colors cursor-pointer ${!canEditAll ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => canEditAll && handleToggle('matchAutomation', 'enabled')}
            >
              <div 
                className={`absolute w-5 h-5 rounded-full bg-white top-0.5 transition-all ${settings.matchAutomation.enabled ? 'right-0.5' : 'left-0.5'}`}
              ></div>
            </div>
          </div>
          
          {settings.matchAutomation.enabled && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-white">Auto-Start Matches</label>
                <div 
                  className={`w-12 h-6 rounded-full relative ${settings.matchAutomation.autoStart ? 'bg-electric-blue' : 'bg-darker-bg'} transition-colors cursor-pointer ${!canEditAll ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => canEditAll && handleToggle('matchAutomation', 'autoStart')}
                >
                  <div 
                    className={`absolute w-5 h-5 rounded-full bg-white top-0.5 transition-all ${settings.matchAutomation.autoStart ? 'right-0.5' : 'left-0.5'}`}
                  ></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-white">Auto-End Matches</label>
                <div 
                  className={`w-12 h-6 rounded-full relative ${settings.matchAutomation.autoEnd ? 'bg-electric-blue' : 'bg-darker-bg'} transition-colors cursor-pointer ${!canEditAll ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => canEditAll && handleToggle('matchAutomation', 'autoEnd')}
                >
                  <div 
                    className={`absolute w-5 h-5 rounded-full bg-white top-0.5 transition-all ${settings.matchAutomation.autoEnd ? 'right-0.5' : 'left-0.5'}`}
                  ></div>
                </div>
              </div>
              
              <div>
                <label className="text-white block mb-2">Result Verification Method</label>
                <select 
                  value={settings.matchAutomation.resultVerification}
                  onChange={(e) => canEditVerification && handleSelectChange('matchAutomation', 'resultVerification', e.target.value)}
                  className={`w-full bg-darker-bg text-white p-2 rounded border border-[#333333] ${!canEditVerification ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!canEditVerification}
                >
                  <option value="ai-only">AI Only</option>
                  <option value="ai-with-human-review">AI with Human Review</option>
                  <option value="human-only">Human Only</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div>
        <h3 className="subheader">Screenshot Verification</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-white">Enable Screenshot Verification</label>
            <div 
              className={`w-12 h-6 rounded-full relative ${settings.screenshotVerification.enabled ? 'bg-electric-blue' : 'bg-darker-bg'} transition-colors cursor-pointer ${!canEditVerification ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => canEditVerification && handleToggle('screenshotVerification', 'enabled')}
            >
              <div 
                className={`absolute w-5 h-5 rounded-full bg-white top-0.5 transition-all ${settings.screenshotVerification.enabled ? 'right-0.5' : 'left-0.5'}`}
              ></div>
            </div>
          </div>
          
          {settings.screenshotVerification.enabled && (
            <>
              <div>
                <label className="text-white block mb-2">
                  Confidence Threshold: {settings.screenshotVerification.confidenceThreshold.toFixed(2)}
                </label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="0.99" 
                  step="0.01"
                  value={settings.screenshotVerification.confidenceThreshold}
                  onChange={(e) => canEditVerification && handleSliderChange('screenshotVerification', 'confidenceThreshold', parseFloat(e.target.value))}
                  className={`w-full ${!canEditVerification ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!canEditVerification}
                />
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>More Lenient</span>
                  <span>More Strict</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-white">Require Human Review for Low Confidence</label>
                <div 
                  className={`w-12 h-6 rounded-full relative ${settings.screenshotVerification.requireHumanReview ? 'bg-electric-blue' : 'bg-darker-bg'} transition-colors cursor-pointer ${!canEditVerification ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => canEditVerification && handleToggle('screenshotVerification', 'requireHumanReview')}
                >
                  <div 
                    className={`absolute w-5 h-5 rounded-full bg-white top-0.5 transition-all ${settings.screenshotVerification.requireHumanReview ? 'right-0.5' : 'left-0.5'}`}
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {!canEditAll && !canEditVerification && (
        <div className="mt-6 p-3 bg-darker-bg rounded text-text-secondary text-sm">
          Note: Community members can suggest changes to AI settings, but cannot directly modify them.
          <button className="btn-primary mt-3 w-full">Suggest AI Settings Change</button>
        </div>
      )}
      
      {(canEditAll || canEditVerification) && (
        <div className="mt-6 flex gap-3">
          <button className="btn-primary flex-1">Save Settings</button>
          <button className="btn-secondary flex-1">Reset to Defaults</button>
        </div>
      )}
    </div>
  );
}
