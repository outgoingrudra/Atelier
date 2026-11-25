"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Point, Stroke, Tool } from "@/lib/protocol";
import type { AppSocket } from "@/lib/socket";

type Props = {
  socket: AppSocket;
  canDraw: boolean;
  strokes: Stroke[];
  phase: string;
};
const COLORS = [
  "#25221f",
  "#f4f0e8",
  "#c76f47",
  "#d8a23a",
  "#4f8575",
  "#527da4",
  "#805b92",
  "#dd6c77",
];
const SIZE = { thin: 3, medium: 7, thick: 15 };

export default function CanvasBoard({
  socket,
  canDraw,
  strokes,
  phase,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>(structuredClone(strokes));
  const currentRef = useRef<Stroke | null>(null);
  const lastSendRef = useRef(0);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZE.medium);
  const [tool, setTool] = useState<Tool>("pen");

  const paintStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      stroke: Stroke,
      width: number,
      height: number,
    ) => {
      const points = stroke.points;
      if (!points.length) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = stroke.size * (width / 900);
      ctx.strokeStyle = stroke.tool === "eraser" ? "#fbf9f4" : stroke.color;
      ctx.fillStyle = ctx.strokeStyle;
      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          points[0].x * width,
          points[0].y * height,
          ctx.lineWidth / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x * width, points[0].y * height);
        for (let i = 1; i < points.length; i++)
          ctx.lineTo(points[i].x * width, points[i].y * height);
        ctx.stroke();
      }
      ctx.restore();
    },
    [],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fbf9f4";
    ctx.fillRect(0, 0, width, height);
    for (const stroke of strokesRef.current)
      paintStroke(ctx, stroke, width, height);
    if (currentRef.current) paintStroke(ctx, currentRef.current, width, height);
  }, [paintStroke]);

  const paintTail = useCallback(
    (stroke: Stroke) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const points = stroke.points;
      if (points.length < 2) {
        paintStroke(ctx, stroke, canvas.width, canvas.height);
        return;
      }
      const a = points[points.length - 2],
        b = points[points.length - 1];
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = stroke.size * (canvas.width / 900);
      ctx.strokeStyle = stroke.tool === "eraser" ? "#fbf9f4" : stroke.color;
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
      ctx.restore();
    },
    [paintStroke],
  );

  useEffect(() => {
    const snapshot = structuredClone(strokes);
    const index = snapshot.findIndex(
      (stroke) => stroke.id === currentRef.current?.id,
    );
    if (index >= 0 && phase === "drawing") snapshot.splice(index, 1);
    strokesRef.current = snapshot;
    redraw();
  }, [strokes, phase, redraw]);
  useEffect(() => {
    currentRef.current = null;
    redraw();
  }, [phase, canDraw, redraw]);
  useEffect(() => {
    const observer = new ResizeObserver(redraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [redraw]);
  useEffect(() => {
    const onStart = (stroke: Stroke) => {
      if (currentRef.current) strokesRef.current.push(currentRef.current);
      currentRef.current = structuredClone(stroke);
      paintTail(stroke);
    };
    const onMove = (point: { id?: string; x?: number; y?: number }) => {
      if (point.id && !currentRef.current) {
        const index = strokesRef.current.findIndex(
          (stroke) => stroke.id === point.id,
        );
        if (index >= 0)
          currentRef.current = strokesRef.current.splice(index, 1)[0];
      }
      if (
        !point.id ||
        currentRef.current?.id !== point.id ||
        typeof point.x !== "number" ||
        typeof point.y !== "number"
      )
        return;
      currentRef.current.points.push({ x: point.x, y: point.y });
      paintTail(currentRef.current);
    };
    const onEnd = (payload: { id?: string; points?: Point[] }) => {
      if (!payload?.id) return;
      const completed =
        currentRef.current?.id === payload.id
          ? currentRef.current
          : strokesRef.current.find((stroke) => stroke.id === payload.id);
      if (!completed) return;
      if (payload.points?.length) completed.points = payload.points;
      strokesRef.current = strokesRef.current.filter(
        (stroke) => stroke.id !== completed.id,
      );
      strokesRef.current.push(completed);
      strokesRef.current = strokesRef.current.slice(-250);
      if (currentRef.current?.id === completed.id) currentRef.current = null;
      redraw();
    };
    const onState = (next: Stroke[]) => {
      strokesRef.current = structuredClone(next);
      currentRef.current = null;
      redraw();
    };
    socket.on("draw_start", onStart);
    socket.on("draw_move", onMove);
    socket.on("draw_end", onEnd);
    socket.on("canvas_state", onState);
    return () => {
      socket.off("draw_start", onStart);
      socket.off("draw_move", onMove);
      socket.off("draw_end", onEnd);
      socket.off("canvas_state", onState);
    };
  }, [socket, redraw, paintTail]);

  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }
  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (
      !canDraw ||
      phase !== "drawing" ||
      currentRef.current ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      color,
      size,
      tool,
      points: [p],
    };
    currentRef.current = stroke;
    paintTail(stroke);
    socket.emit("draw_start", { ...p, id: stroke.id, color, size, tool });
  }
  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (
      !canDraw ||
      !currentRef.current ||
      phase !== "drawing" ||
      !event.isPrimary
    )
      return;
    const now = performance.now();
    if (now - lastSendRef.current < 16) return;
    lastSendRef.current = now;
    if (currentRef.current.points.length >= 1000) {
      pointerUp();
      return;
    }
    const raw = point(event);
    const p = { x: +raw.x.toFixed(5), y: +raw.y.toFixed(5) };
    currentRef.current.points.push(p);
    paintTail(currentRef.current);
    socket.emit("draw_move", { ...p, id: currentRef.current.id });
  }
  function pointerUp(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event && !event.isPrimary) return;
    if (!canDraw || phase !== "drawing" || !currentRef.current) return;
    const completed = currentRef.current;
    strokesRef.current.push(completed);
    socket.emit("draw_end", {
      id: completed.id,
      points: completed.points.slice(0, 1000),
    });
    currentRef.current = null;
  }

  return (
    <div className="board-wrap">
      <div className="board-top">
        <span>
          <i className="live-dot" />{" "}
          {phase === "drawing" ? "LIVE CANVAS" : "THE CANVAS"}
        </span>
        <span>900 × 600 STUDIO</span>
      </div>
      <canvas
        ref={canvasRef}
        className={`drawing-canvas ${canDraw && phase === "drawing" ? "can-draw" : ""}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        aria-label="Shared drawing canvas"
      />
      {canDraw && phase === "drawing" && (
        <div className="tools" aria-label="Drawing tools">
          <div className="tool-group">
            <button
              className={tool === "pen" ? "selected" : ""}
              onClick={() => setTool("pen")}
              title="Pen"
              aria-label="Pen"
            >
              ✎
            </button>
            <button
              className={tool === "eraser" ? "selected" : ""}
              onClick={() => setTool("eraser")}
              title="Eraser"
              aria-label="Eraser"
            >
              ⌫
            </button>
          </div>
          <div className="tool-divider" />
          <div className="color-list">
            {COLORS.map((c) => (
              <button
                key={c}
                className={color === c && tool === "pen" ? "selected" : ""}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setTool("pen");
                }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
          <div className="tool-divider" />
          <div className="tool-group size-group">
            <button
              className={size === SIZE.thin ? "selected" : ""}
              onClick={() => setSize(SIZE.thin)}
              aria-label="Thin brush"
            >
              ·
            </button>
            <button
              className={size === SIZE.medium ? "selected" : ""}
              onClick={() => setSize(SIZE.medium)}
              aria-label="Medium brush"
            >
              •
            </button>
            <button
              className={size === SIZE.thick ? "selected" : ""}
              onClick={() => setSize(SIZE.thick)}
              aria-label="Thick brush"
            >
              ●
            </button>
          </div>
          <div className="tool-divider" />
          <div className="tool-group">
            <button
              onClick={() => socket.emit("draw_undo")}
              title="Undo last stroke"
              aria-label="Undo last stroke"
            >
              ↶
            </button>
            <button
              onClick={() => socket.emit("canvas_clear")}
              title="Clear canvas"
              aria-label="Clear canvas"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
