# Prompt for the next thread (2026-10-10: the Pack 3 proposal)

The previous prompt (the 3D model review and refinement) is done. It is kept in git at `d13146b`, and
`SESSION_HANDOFF.md`, item 9, has what it built.

The next thread is **the Pack 3 proposal**. Its prompt is `PACK3_PROPOSAL_PROMPT.md`, in this folder. Read that
file in full, including the notes at its top, then follow the prompt below its line. The notes take precedence
where they differ from the prompt. The "Model refinement note (2026-10-10)" says what the refined model library
means for Pack 3: the size room for its new models, and the standard to build them to.

The final, authoritative code for the 3D version is branch `claude/lab-studio-3d` in the worktree
`C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`, kept completely separate from the 2D version
(the user, 2026-10-10). Commit there. Never merge, fast-forward or push it into `main`, which is the 2D version.

Held until the user asks:
- pushing the branch (`origin/claude/lab-studio-3d` is at `713c248`; every later commit is local);
- publishing the D8 experiment to virtuallab.az;
- G3, the real-webcam test.
