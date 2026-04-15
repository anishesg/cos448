"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  FileText,
  List,
  LayoutGrid,
  Settings,
  ArrowUpDown,
  X,
  Trash2,
} from "lucide-react";

interface Note {
  id: string;
  title: string;
  linkedRecord?: string;
  createdAt: string;
  content?: string;
}

const STORAGE_KEY = "clientops_notes";

function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function NoteEditor({
  note,
  onSave,
  onDelete,
  onClose,
}: {
  note: Note;
  onSave: (updated: Note) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && note.content) {
      contentRef.current.textContent = note.content;
    }
  }, [note.id]);

  const handleClose = useCallback(() => {
    const content = contentRef.current?.textContent ?? "";
    onSave({ ...note, title: title || "Untitled note", content });
    onClose();
  }, [note, title, onSave, onClose]);

  return (
    <div className="v3-modal-overlay" onClick={handleClose}>
      <div
        className="v3-modal"
        style={{ maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v3-modal-header">
          <div className="v3-modal-title">
            <FileText size={14} style={{ color: "var(--v3-accent-blue)" }} />
            {title || "New Note"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              className="v3-topbar-btn-icon"
              title="Delete"
              onClick={() => { onDelete(note.id); onClose(); }}
              style={{ width: 24, height: 24 }}
            >
              <Trash2 size={12} />
            </button>
            <button className="v3-topbar-btn-icon" onClick={handleClose} style={{ width: 24, height: 24 }}>
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="v3-modal-body" style={{ flex: 1, overflow: "auto" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--v3-text-primary)",
              fontSize: 20,
              fontWeight: 600,
              width: "100%",
              outline: "none",
              marginBottom: 16,
            }}
            placeholder="Untitled note"
          />
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            style={{
              minHeight: 200,
              outline: "none",
              color: "var(--v3-text-secondary)",
              fontSize: 14,
              lineHeight: 1.7,
            }}
            data-placeholder="Start typing..."
          />
        </div>
      </div>
    </div>
  );
}

export default function V3NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const persistNotes = useCallback((updated: Note[]) => {
    setNotes(updated);
    saveNotes(updated);
  }, []);

  const handleSaveNote = useCallback((updated: Note) => {
    setNotes((prev) => {
      const exists = prev.find((n) => n.id === updated.id);
      const next = exists
        ? prev.map((n) => (n.id === updated.id ? updated : n))
        : [updated, ...prev];
      saveNotes(next);
      return next;
    });
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveNotes(next);
      return next;
    });
  }, []);

  const handleNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "Untitled note",
      createdAt: new Date().toISOString(),
      content: "",
    };
    setEditingNote(newNote);
    setShowEditor(true);
  };

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <FileText size={16} />
            Notes
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-btn-primary" onClick={handleNewNote}>
            <Plus size={14} />
            New note
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="v3-tabs">
        <button className="v3-tab active">
          Notes <span className="v3-tab-count">{notes.length}</span>
        </button>
        <button className="v3-tab">
          Templates <span className="v3-tab-count">0</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="v3-toolbar">
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Creation date
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className={`v3-toolbar-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            <List size={12} />
          </button>
          <button
            className={`v3-toolbar-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid size={12} />
          </button>
          <button className="v3-toolbar-btn">
            <Settings size={12} />
            View settings
          </button>
        </div>
      </div>

      {/* Content */}
      {notes.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <FileText size={80} strokeWidth={0.8} />
          </div>
          <h3>Notes</h3>
          <p>No notes yet! Create your first note to get started.</p>
          <button className="v3-btn-primary" style={{ marginTop: 20 }} onClick={handleNewNote}>
            <Plus size={14} />
            New note
          </button>
        </div>
      ) : (
        <div style={{ padding: 24 }}>
          {viewMode === "list" ? (
            <table className="v3-table">
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Linked record</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr
                    key={note.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setEditingNote(note);
                      setShowEditor(true);
                    }}
                  >
                    <td className="v3-table-link">{note.title}</td>
                    <td>{note.linkedRecord || "—"}</td>
                    <td>{new Date(note.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="v3-report-grid">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="v3-report-card"
                  onClick={() => {
                    setEditingNote(note);
                    setShowEditor(true);
                  }}
                >
                  <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{note.title}</h4>
                  <p style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>
                    {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEditor && editingNote && (
        <NoteEditor
          note={editingNote}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
