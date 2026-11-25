"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CanvasBoard from "@/components/CanvasBoard";
import Brand from "@/components/Brand";
import { getSocket, type AppSocket } from "@/lib/socket";
import { Ack, ChatMessage, RoomState, Settings, WordCategory, WordMode } from "@/lib/protocol";

type Session = { playerId: string; resumeToken: string; name: string };
const formatTime = (deadline: number | null, now: number) => deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();
  const router = useRouter();
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [yourWord, setYourWord] = useState("");
  const [guess, setGuess] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const connectRoom = useCallback((s: AppSocket, saved: Session) => {
    s.timeout(8000).emit("join_room", { code, name: saved.name, resumeToken: saved.resumeToken }, (timeout: Error | null, response: Ack) => {
      if (timeout) return setError("Connection timed out. Trying again may help.");
      if (!response.ok) return setError(response.error);
      const next = { ...saved, playerId: response.playerId, resumeToken: response.resumeToken };
      sessionStorage.setItem(`atelier-session-${code}`, JSON.stringify(next));
      setSession(next); setError("");
    });
  }, [code]);

  useEffect(() => {
    const s = getSocket(); setSocket(s); setConnected(s.connected);
    const readSaved = (): Session | null => {
      try { return JSON.parse(sessionStorage.getItem(`atelier-session-${code}`) || "null"); } catch { return null; }
    };
    const initial = readSaved();
    if (initial) {
      setSession(initial);
      setName(initial.name);
      if (s.connected) connectRoom(s, initial);
    } else {
      setName(localStorage.getItem("atelier-name") || "");
    }
    const onConnect = () => {
      setConnected(true);
      const current = readSaved();
      if (current) connectRoom(s, current);
    };
    const onDisconnect = () => setConnected(false);
    const onRoom = (value: RoomState) => setRoom(value);
    const onOptions = (value: string[]) => setOptions(value);
    const onWord = (value: string) => setYourWord(value);
    const onChat = (value: ChatMessage) => setRoom(prev => prev ? { ...prev, chat: prev.chat.some(m => m.id === value.id) ? prev.chat : [...prev.chat, value].slice(-60) } : prev);
    const onKicked = (reason: string) => {
      sessionStorage.removeItem(`atelier-session-${code}`);
      setSession(null);
      setRoom(null);
      setError(reason || "You were removed from the room.");
    };
    s.on("connect", onConnect); s.on("disconnect", onDisconnect); s.on("room_state", onRoom); s.on("word_options", onOptions); s.on("your_word", onWord); s.on("chat_message", onChat); s.on("kicked", onKicked);
    return () => { s.off("connect", onConnect); s.off("disconnect", onDisconnect); s.off("room_state", onRoom); s.off("word_options", onOptions); s.off("your_word", onWord); s.off("chat_message", onChat); s.off("kicked", onKicked); };
  }, [code, connectRoom]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [room?.chat.length]);
  useEffect(() => { if (room?.phase !== "choosing") setOptions([]); if (room?.phase !== "drawing") setYourWord(""); }, [room?.phase, room?.turn]);

  const me = room?.players.find(p => p.id === session?.playerId);
  const drawer = room?.players.find(p => p.id === room.drawerId);
  const isHost = room?.hostId === session?.playerId;
  const isDrawer = room?.drawerId === session?.playerId;
  const seconds = formatTime(room?.deadline || null, now);
  const leaderboard = useMemo(() => [...(room?.players || [])].sort((a, b) => b.score - a.score), [room?.players]);

  function join(event: FormEvent) {
    event.preventDefault(); if (!name.trim() || !socket) return;
    const saved: Session = { playerId: "", resumeToken: "", name: name.trim() };
    localStorage.setItem("atelier-name", saved.name);
    connectRoom(socket, saved);
  }
  function sendGuess(event: FormEvent) {
    event.preventDefault(); if (!guess.trim() || !socket) return;
    socket.emit("guess", guess.trim()); setGuess("");
  }
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) { if (room && socket) socket.emit("update_settings", { ...room.settings, [key]: value }); }
  async function copyInvite() { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  function leave() { socket?.emit("leave_room"); sessionStorage.removeItem(`atelier-session-${code}`); router.push("/"); }

  if (!session) return <main className="room-shell"><header className="room-header"><Brand /></header><div className="join-panel"><span className="eyebrow">ROOM / {code}</span><h1>Step into<br /><em>the room.</em></h1><form onSubmit={join}><label className="field-label" htmlFor="join-name">YOUR NAME</label><input id="join-name" value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="What should we call you?" /><button className="primary-button" type="submit">JOIN ROOM <span>↗</span></button></form>{error && <p className="form-error" role="alert">{error}</p>}</div></main>;

  if (!room) return <main className="room-shell"><header className="room-header"><Brand /></header><div className="join-panel"><span className="eyebrow">ROOM / {code}</span><h1>Finding<br /><em>your room.</em></h1><p>{error || "Connecting to the studio…"}</p><button className="text-button" onClick={leave}>← Back to entrance</button></div></main>;

  return <main className="room-shell">
    {room.phase === "lobby" && <header className="room-header"><Brand /><div className="room-header-right"><span className={`connection ${connected ? "" : "offline"}`}><i />{connected ? "CONNECTED" : "RECONNECTING"}</span><button className="room-code" onClick={copyInvite} title="Copy invite link">ROOM {room.code} <span>{copied ? "COPIED ✓" : "COPY ↗"}</span></button><button className="text-button leave-button" onClick={leave}>Leave</button></div></header>}
    {room.phase === "lobby" ? <div className="lobby-layout">
      <div className="lobby-main"><p className="eyebrow"><span>01 /</span> THE WAITING ROOM</p><h1>The room is<br /><em>yours.</em></h1><p className="lobby-subtitle">Pass the invite around. When everyone&apos;s here, start the game and let the questionable art begin.</p><button className="invite-box" onClick={copyInvite}><span>INVITE LINK</span><strong>{typeof window !== "undefined" ? window.location.href : `/room/${room.code}`}</strong><b>{copied ? "COPIED ✓" : "COPY LINK ↗"}</b></button><div className="lobby-players"><div className="section-head"><span>IN THE ROOM</span><span>{room.players.length} / {room.settings.maxPlayers}</span></div><div className="player-grid">{room.players.map((p, i) => <div className="lobby-player" key={p.id}><span className="avatar">{p.name.charAt(0).toUpperCase()}</span><span>{p.name}<small>{p.id === room.hostId ? "HOST" : p.ready ? "READY ✓" : "WAITING"}</small></span><span className="player-index">0{i + 1}</span>{isHost && p.id !== session.playerId && <button type="button" className="kick-btn" onClick={() => socket?.emit("kick_player", p.id)} title={`Remove ${p.name}`} aria-label={`Remove ${p.name}`}>×</button>}</div>)}{Array.from({ length: Math.min(4, Math.max(0, room.settings.maxPlayers - room.players.length)) }, (_, i) => <div className="lobby-player empty" key={i}><span className="avatar">+</span><span>OPEN SEAT</span></div>)}</div></div></div>
      <aside className="lobby-aside"><div className="aside-heading"><span>GAME SETTINGS</span><span>↗</span></div><label className="setting-row">Players <select disabled={!isHost} value={room.settings.maxPlayers} onChange={e => updateSetting("maxPlayers", Number(e.target.value))}>{Array.from({ length: 19 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}</select></label><label className="setting-row">Rounds <select disabled={!isHost} value={room.settings.rounds} onChange={e => updateSetting("rounds", Number(e.target.value))}>{Array.from({ length: 9 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}</select></label><label className="setting-row">Draw time <select disabled={!isHost} value={room.settings.drawTime} onChange={e => updateSetting("drawTime", Number(e.target.value))}>{[15, 30, 45, 60, 80, 90, 120, 180, 240].map(n => <option key={n} value={n}>{n} sec</option>)}</select></label><label className="setting-row">Word choices <select disabled={!isHost} value={room.settings.wordCount} onChange={e => updateSetting("wordCount", Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label className="setting-row">Hints <select disabled={!isHost} value={room.settings.hints} onChange={e => updateSetting("hints", Number(e.target.value))}>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 0 ? "Off" : n}</option>)}</select></label><label className="setting-row">Word mode <select disabled={!isHost} value={room.settings.wordMode} onChange={e => updateSetting("wordMode", e.target.value as WordMode)}><option value="normal">Normal</option><option value="hidden">Hidden</option><option value="combination">Combo</option></select></label><label className="setting-row">Category <select disabled={!isHost} value={room.settings.category} onChange={e => updateSetting("category", e.target.value as WordCategory)}><option value="all">All words</option><option value="animals">Animals</option><option value="food">Food</option><option value="objects">Objects</option><option value="nature">Nature</option></select></label><div className="setting-row"><span>Room type</span><strong>INVITE ONLY</strong></div>{isHost ? <button className="primary-button start-button" disabled={room.players.filter(p => p.connected).length < 2} onClick={() => socket?.emit("start_game")}>START GAME<span>↗</span></button> : <button className="primary-button start-button" type="button" onClick={() => socket?.emit("toggle_ready")}>{me?.ready ? "READY ✓ (TAP TO UNREADY)" : "MARK READY"}<span>↗</span></button>}<p className="settings-note">{isHost ? "You need at least two players to begin." : "Only the host can change settings and start."}</p></aside>
    </div> : <div className="game-layout">
      <div className="game-topline"><div><span className="eyebrow">ROUND {room.round} / {room.settings.rounds}</span><h1>{room.phase === "finished" ? "The final frame." : room.phase === "result" ? "Nice work, artists." : room.phase === "choosing" ? isDrawer ? "Choose your word." : "A word is being chosen." : isDrawer ? "Your canvas awaits." : `${drawer?.name || "Someone"} is drawing.`}</h1></div><div className="game-topline-right"><div className="game-utility"><span className={`connection ${connected ? "" : "offline"}`}><i />{connected ? "CONNECTED" : "RECONNECTING"}</span><button className="room-code compact" onClick={copyInvite} title="Copy invite link">ROOM {room.code} <span>{copied ? "COPIED ✓" : "COPY ↗"}</span></button><button className="text-button leave-button" onClick={leave}>Leave</button></div><div className={`timer ${seconds <= 10 && room.phase === "drawing" ? "urgent" : ""}`}><span>TIME LEFT</span><strong>{room.phase === "drawing" ? `${seconds}s` : "—"}</strong></div></div></div>
      <div className="game-columns"><aside className="score-panel"><div className="panel-heading"><span>PLAYERS</span><span>{room.players.length}</span></div>{leaderboard.map((p, index) => <div className={`score-row ${p.id === room.drawerId ? "drawing" : ""}`} key={p.id}><span className="score-rank">{String(index + 1).padStart(2, "0")}</span><span className="score-avatar">{p.name[0]?.toUpperCase()}</span><span className="score-name">{p.name}{p.id === room.drawerId && <small>DRAWING</small>}{p.guessed && <small>GUESSED ✓</small>}</span><strong>{p.score}</strong></div>)}</aside>
        <section className="play-center"><div className="word-bar"><span>THE WORD</span><strong>{room.phase === "finished" || room.phase === "result" ? room.resultWord : isDrawer ? yourWord || "CHOOSING…" : room.hint || "WAITING…"}</strong><span>{room.phase === "drawing" ? (room.wordLength > 0 ? `${room.wordLength} LETTERS` : "HIDDEN MODE") : `TURN ${room.turn} / ${room.totalTurns}`}</span></div><div className="canvas-stage"><CanvasBoard socket={socket!} canDraw={!!isDrawer} strokes={room.strokes} phase={room.phase} />{room.phase === "choosing" && <div className="canvas-overlay"><div className="overlay-inner"><span className="eyebrow">THE NEXT MASTERPIECE</span><h2>{isDrawer ? "Pick a word to draw" : `${drawer?.name || "The artist"} is choosing a word`}</h2>{isDrawer && <div className="word-options">{options.map(option => <button key={option} onClick={() => { socket?.emit("word_chosen", option); setOptions([]); }}>{option}<span>↗</span></button>)}</div>}<p>{isDrawer ? "Choose quickly. The timer starts when you do." : "The canvas will open in a moment."}</p></div></div>}{(room.phase === "result" || room.phase === "finished") && <div className="canvas-overlay"><div className="overlay-inner"><span className="eyebrow">{room.phase === "finished" ? "GAME COMPLETE" : "TURN COMPLETE"}</span><h2>{room.phase === "finished" ? `${leaderboard[0]?.name || "Everyone"} wins the room.` : "The word was"}</h2><div className="reveal-word">{room.phase === "finished" ? `${leaderboard[0]?.score || 0} POINTS` : room.resultWord}</div><p>{room.phase === "finished" ? "Good art, better company." : "Next artist is getting ready…"}</p>{room.phase === "finished" && <div className="finish-actions">{isHost && <button className="primary-button" onClick={() => socket?.emit("play_again")}>PLAY AGAIN <span>↗</span></button>}<button className="text-button" onClick={leave}>Back to entrance</button></div>}</div></div>}</div><p className="canvas-caption">{isDrawer ? "YOUR TURN TO DRAW. MAKE IT COUNT." : me?.guessed ? "YOU GUESSED IT. WAIT FOR THE NEXT TURN." : "LOOK CLOSELY. THE ANSWER IS IN THE DETAILS."}</p></section>
        <aside className="chat-panel"><div className="panel-heading"><span>GUESSES & CHAT</span><span>↗</span></div><div className="chat-scroll" ref={chatRef} aria-live="polite">{room.chat.length === 0 && <div className="chat-empty">The room is quiet.<br />Be the first to guess.</div>}{room.chat.map(m => <div key={m.id} className={`chat-line ${m.kind}`}><span>{m.kind === "chat" ? m.playerName : "●"}</span><p>{m.text}</p></div>)}</div><form className="guess-form" onSubmit={sendGuess}><input aria-label="Your guess" placeholder={room.phase !== "drawing" ? "Wait for the next turn…" : isDrawer ? "You're drawing…" : me?.guessed ? "You got it!" : "Type your guess…"} disabled={room.phase !== "drawing" || !!isDrawer || !!me?.guessed} value={guess} onChange={e => setGuess(e.target.value)} maxLength={160} /><button aria-label="Send guess" disabled={room.phase !== "drawing" || !!isDrawer || !!me?.guessed}>↗</button></form></aside>
      </div>
    </div>}
  </main>;
}
