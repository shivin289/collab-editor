import { useRef } from 'react';

export default function Editor({ content, onChange, onCursorMove }) {
  const textareaRef = useRef(null);

  function handleChange(e) {
    onChange(e.target.value);
  }

  // Fires on click, keyup, and selection change - covers mouse clicks,
  // arrow key navigation, and typing, so cursor position stays in sync.
  function handleSelect() {
    const el = textareaRef.current;
    if (el) onCursorMove(el.selectionStart);
  }

  return (
    <textarea
      ref={textareaRef}
      className="editor-textarea"
      value={content}
      onChange={handleChange}
      onClick={handleSelect}
      onKeyUp={handleSelect}
      onSelect={handleSelect}
      spellCheck={false}
      placeholder="Start typing... anyone with the link can join and edit live."
    />
  );
}
