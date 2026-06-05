# Extension Manual Test Checklist

- [ ] `pnpm build:extension`
- [ ] Chrome: open `chrome://extensions`, enable Developer mode, load `dist`.
- [ ] Edge: open `edge://extensions`, enable Developer mode, load `dist`.
- [ ] Open a video/audio tab.
- [ ] Click extension action and start translation.
- [ ] Confirm tab audio remains audible.
- [ ] Confirm subtitles update in Side Panel.
- [ ] Pause and resume.
- [ ] Stop and verify resources are released.
- [ ] Navigate the captured tab and confirm expected capture behavior.
- [ ] Close the tab and verify UI enters a readable error/idle state.
