"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { Ack, DEFAULT_SETTINGS, Settings } from "@/lib/protocol";
import Brand from "@/components/Brand";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem("atelier-name") || "");
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Add your name before entering the room.");
    if (mode === "join" && !code.trim()) return setError("Enter a room code.");
    setBusy(true);

    const socket = getSocket();
    const trimmedName = name.trim();
    const payload =
      mode === "create"
        ? { name: trimmedName, settings }
        : { name: trimmedName, code: code.trim().toUpperCase() };

    const handleAck = (timeout: Error | null, response: Ack) => {
      setBusy(false);
      if (timeout) return setError("The studio is taking too long to respond. Try again.");
      if (!response.ok) return setError(response.error);
      localStorage.setItem("atelier-name", trimmedName);
      sessionStorage.setItem(
        `atelier-session-${response.code}`,
        JSON.stringify({
          playerId: response.playerId,
          resumeToken: response.resumeToken,
          name: trimmedName,
        })
      );
      router.push(`/room/${response.code}`);
    };

    if (mode === "create") {
      socket.timeout(8000).emit("create_room", payload, handleAck);
    } else {
      socket.timeout(8000).emit("join_room", payload, handleAck);
    }
  }

  return (
    <main className="home-shell">
      <header className="site-header">
        <Brand />
        <span className="header-note">
          <i aria-hidden="true" /> A LITTLE ART. A LOT OF GUESSING.
        </span>
      </header>

      <section className="hero-grid" aria-label="Studio entrance">
        <div className="hero-copy">
          <p className="eyebrow">
            <span>THE SOCIAL DRAWING GAME</span> / NO. 01
          </p>
          <h1>
            Draw badly.
            <br />
            Guess <em>brilliantly.</em>
          </h1>
          <p className="hero-description">
            One person draws. Everyone else tries to read their mind. Make a private room, share the
            link, and see who gets there first.
          </p>
          <div className="hero-rule" aria-hidden="true"><span>✳</span><i /></div>
        </div>

        <div className="hero-entry">
          <div className="entry-card" id="enter">
            <div className="entry-top">
              <span>YOUR SEAT AT THE TABLE</span>
              <span>01 — 02</span>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Room action">
              <button
                id="tab-create"
                type="button"
                role="tab"
                aria-selected={mode === "create"}
                aria-controls="entry-panel"
                className={mode === "create" ? "active" : ""}
                onClick={() => {
                  setMode("create");
                  setError("");
                }}
              >
                Create a room
              </button>
              <button
                id="tab-join"
                type="button"
                role="tab"
                aria-selected={mode === "join"}
                aria-controls="entry-panel"
                className={mode === "join" ? "active" : ""}
                onClick={() => {
                  setMode("join");
                  setError("");
                }}
              >
                Join a room
              </button>
            </div>

            <form
              id="entry-panel"
              role="tabpanel"
              aria-labelledby={mode === "create" ? "tab-create" : "tab-join"}
              onSubmit={submit}
            >
              <label className="field-label" htmlFor="player-name">
                YOUR NAME
              </label>
              <input
                id="player-name"
                maxLength={20}
                placeholder="What should we call you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />

              {mode === "join" ? (
                <>
                  <label className="field-label" htmlFor="room-code">
                    ROOM CODE
                  </label>
                  <input
                    id="room-code"
                    placeholder="e.g. A1B2C3"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </>
              ) : (
                <div className="quick-settings">
                  <span className="quick-settings-label">ROOM SETTINGS</span>
                  <div className="quick-settings-controls">
                    <label htmlFor="create-players">
                      <span>Players</span>
                      <select
                        id="create-players"
                        value={settings.maxPlayers}
                        onChange={(e) =>
                          setSettings({ ...settings, maxPlayers: Number(e.target.value) })
                        }
                      >
                        {[4, 6, 8, 10, 12, 16, 20].map((n) => (
                          <option key={n} value={n}>
                            {n} max
                          </option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor="create-rounds">
                      <span>Rounds</span>
                      <select
                        id="create-rounds"
                        value={settings.rounds}
                        onChange={(e) =>
                          setSettings({ ...settings, rounds: Number(e.target.value) })
                        }
                      >
                        {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <button className="primary-button" disabled={busy} type="submit">
                <span>
                  {busy ? "OPENING THE DOOR…" : mode === "create" ? "CREATE ROOM" : "JOIN ROOM"}
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            </form>

            <p className="entry-foot">No sign-up. Just a name and some good company.</p>
          </div>
        </div>

        <div className="hero-studio">
          <div className="artwork" aria-hidden="true">
            <div className="artwork-header">
              <span>AN EXAMPLE ROUND</span>
              <span>01 / 03</span>
            </div>
            <div className="artwork-canvas">
              <span className="artwork-corner">WHAT AM I?</span>
              <svg viewBox="0 0 520 240" fill="none">
                <g transform="translate(142 2) rotate(32 118 112)" stroke="#EDE7DB" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M118 22c-27 22-43 55-43 92 0 34 14 63 43 91 29-28 43-57 43-91 0-37-16-70-43-92Z" />
                  <path d="M76 139 53 171l32-6M160 139l23 32-32-6M100 190l-9 24 27-9 27 9-9-24" />
                  <circle cx="118" cy="99" r="17" />
                  <path d="M104 142c9 4 19 4 28 0" stroke="#c98257" />
                  <path d="M104 209c1 14 8 26 14 33 6-7 13-19 14-33" stroke="#c98257" strokeWidth="4" />
                </g>
                <path d="m92 62 5-13 5 13 13 5-13 5-5 13-5-13-13-5 13-5Zm336 97 4-11 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#c98257" />
                <path d="M64 169c24 18 44 24 69 20M380 48c23-5 42-2 63 11" stroke="#aa9e8f" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="artwork-guess"><span>THE WORD</span><strong>_ _ _ _ _ _</strong><span>6 LETTERS</span></div>
            </div>
            <div className="artwork-footer">
              <span>A VERY SERIOUS ART COMPETITION.</span>
              <span>ANSWER: ROCKET</span>
            </div>
          </div>

          <div className="hero-meta">
            <span>NO ACCOUNT NEEDED</span>
            <span>2–20 PLAYERS</span>
            <span>REAL-TIME PLAY</span>
          </div>
        </div>
      </section>

      <section className="home-instructions" aria-label="How to play">
        <div><span>THE RULES, BRIEFLY</span><h2>Three steps.<br /><em>Zero talent required.</em></h2></div>
        <ol><li><span>01</span><p>Open a private room and bring your friends.</p></li><li><span>02</span><p>Take turns drawing a secret word.</p></li><li><span>03</span><p>Guess quickly. The sharpest eye wins.</p></li></ol>
      </section>

      <footer className="site-footer">
        <span>ATELIER © 2026</span>
        <span>MADE FOR PLAYING TOGETHER</span>
      </footer>
    </main>
  );
}
