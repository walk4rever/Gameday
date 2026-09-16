import { useState } from 'react';

interface ChatInteractionProps {
  onSend: (message: string, emoji?: string) => void;
}

const PRESET_QUICK_PHRASES = [
  '👍 对家走，我垫底！',
  '🚀 炸他！别手软！',
  '🙈 要不起，你来！',
  '🎯 稳住，我们能赢！',
  '💪 漂亮的配合！',
  '☕ 倒杯水，别催~'
];

const PRESET_EMOJIS = ['🎉', '🔥', '👏', '😎', '😭', '☕'];

export function ChatInteraction({ onSend }: ChatInteractionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const handlePhraseClick = (phrase: string) => {
    onSend(phrase);
    setIsOpen(false);
  };

  const handleEmojiClick = (emoji: string) => {
    onSend(emoji, emoji);
    setIsOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setCustomText('');
    setIsOpen(false);
  };

  return (
    <div className="chat-interaction-container">
      <button
        type="button"
        className="chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="发送快捷短语或表情"
      >
        💬
      </button>

      {isOpen && (
        <div className="chat-popup-panel" onClick={(e) => e.stopPropagation()}>
          <div className="chat-popup-header">
            <span className="chat-popup-title">家庭快捷短语</span>
            <button
              type="button"
              className="chat-popup-close"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="chat-emoji-row">
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="chat-emoji-btn"
                onClick={() => handleEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="chat-phrases-list">
            {PRESET_QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                className="chat-phrase-btn"
                onClick={() => handlePhraseClick(phrase)}
              >
                {phrase}
              </button>
            ))}
          </div>

          <form className="chat-custom-form" onSubmit={handleCustomSubmit}>
            <input
              type="text"
              className="chat-custom-input"
              placeholder="自定义发一句话..."
              maxLength={20}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
            <button type="submit" className="chat-custom-send-btn" disabled={!customText.trim()}>
              发送
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
