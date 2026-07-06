  // No copying
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('copy', e => e.preventDefault());
  document.addEventListener('cut', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());
  document.addEventListener('selectstart', e => {
    const tag = e.target.tagName;
    if(tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
  });
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const blocked =
      k === 'f12' ||
      (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
      (e.ctrlKey && (k === 'u' || k === 's'));
    if(blocked) e.preventDefault();
  });
